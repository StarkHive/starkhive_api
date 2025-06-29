import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Team } from '../entities/team.entity';

import {
  type TeamMember,
  TeamRole,
  TeamMemberStatus,
} from '../entities/team-member.entity';
import {
  type TeamActivity,
  ActivityType,
} from '../entities/team-activity.entity';

import type { User } from '../entities/user.entity';
import type {
  CreateTeamDto,
  UpdateTeamDto,
  InviteTeamMemberDto,
  InviteMultipleTeamMembersDto,
  UpdateTeamMemberDto,
  RemoveTeamMemberDto,
  GetTeamActivitiesDto,
  GetTeamsDto,
} from '../dto/manage-team.dto';
import { UserRole } from '../enums/userRole.enum';
import { TeamRole } from '../enums/teamRole.enum';
import { TeamMemberStatus } from '../enums/teamMemberStatus.enum';
import { ActivityType } from '../enums/activityType.enum';


@Injectable()
export class TeamService {
  private readonly teamRepository: Repository<Team>;
  private readonly teamMemberRepository: Repository<TeamMember>;
  private readonly teamActivityRepository: Repository<TeamActivity>;
  private readonly userRepository: Repository<User>;

  constructor(
    teamRepository: Repository<Team>,
    teamMemberRepository: Repository<TeamMember>,
    teamActivityRepository: Repository<TeamActivity>,
    userRepository: Repository<User>,
  ) {
    this.teamRepository = teamRepository;
    this.teamMemberRepository = teamMemberRepository;
    this.teamActivityRepository = teamActivityRepository;
    this.userRepository = userRepository;
  }

  async createTeam(
    ownerId: string,
    createTeamDto: CreateTeamDto,
  ): Promise<Team> {
    // Verify user is a recruiter
    const user = await this.userRepository.findOne({ where: { id: ownerId } });
    if (!user || user.role !== UserRole.RECRUITER) {
      throw new ForbiddenException('Only recruiters can create teams');
    }

    // Check if team name already exists for this user
    const existingTeam = await this.teamRepository.findOne({
      where: { name: createTeamDto.name, ownerId },
    });
    if (existingTeam) {
      throw new ConflictException('A team with this name already exists');
    }

    // Create team
    const team = this.teamRepository.create({
      ...createTeamDto,
      ownerId,
      settings: {
        allowMemberInvites: false,
        requireApprovalForJobs: false,
        shareApplications: true,
        ...createTeamDto.settings,
      },
    });

    const savedTeam = await this.teamRepository.save(team);

    // Add owner as team member
    const ownerMember = this.teamMemberRepository.create({
      teamId: savedTeam.id,
      userId: ownerId,
      role: TeamRole.OWNER,
      status: TeamMemberStatus.ACTIVE,
      joinedAt: new Date(),
    });
    await this.teamMemberRepository.save(ownerMember);

    // Log activity
    await this.logActivity(
      savedTeam.id,
      ownerId,
      ActivityType.TEAM_CREATED,
      'Team created',
      {
        teamName: savedTeam.name,
      },
    );

    return this.getTeamById(savedTeam.id, ownerId);
  }

  async getTeamsByUser(userId: string, query: GetTeamsDto) {
    const { page = 1, limit = 10, isActive, search } = query;
    const skip = (page - 1) * limit;

    // Get teams where user is owner or member
    const queryBuilder = this.teamRepository
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.owner', 'owner')
      .leftJoin('team.members', 'member')
      .where('team.ownerId = :userId OR member.userId = :userId', { userId })
      .andWhere('member.status = :status OR team.ownerId = :userId', {
        status: TeamMemberStatus.ACTIVE,
      });

    if (isActive !== undefined) {
      queryBuilder.andWhere('team.isActive = :isActive', { isActive });
    }

    if (search) {
      queryBuilder.andWhere('team.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    const [teams, total] = await queryBuilder
      .orderBy('team.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Load member counts for each team
    const teamsWithCounts = await Promise.all(
      teams.map(async (team) => {
        const memberCount = await this.teamMemberRepository.count({
          where: { teamId: team.id, status: TeamMemberStatus.ACTIVE },
        });
        return { ...team, memberCount };
      }),
    );

    return {
      data: teamsWithCounts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTeamById(teamId: string, userId: string): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ['owner', 'members', 'members.user'],
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Check if user has access to this team
    const hasAccess =
      team.ownerId === userId ||
      team.members.some(
        (member) =>
          member.userId === userId && member.status === TeamMemberStatus.ACTIVE,
      );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this team');
    }

    return team;
  }

  async updateTeam(
    teamId: string,
    userId: string,
    updateTeamDto: UpdateTeamDto,
  ): Promise<Team> {
    const team = await this.getTeamById(teamId, userId);

    // Check permissions
    const userMember = await this.getUserTeamMember(teamId, userId);
    if (!userMember.hasPermission('canEditJobs') && team.ownerId !== userId) {
      throw new ForbiddenException('Insufficient permissions to update team');
    }

    // Update team
    Object.assign(team, updateTeamDto);
    const updatedTeam = await this.teamRepository.save(team);

    // Log activity
    await this.logActivity(
      teamId,
      userId,
      ActivityType.TEAM_SETTINGS_UPDATED,
      'Team settings updated',
    );

    return this.getTeamById(teamId, userId);
  }

  async inviteTeamMember(
    teamId: string,
    inviterId: string,
    inviteDto: InviteTeamMemberDto,
  ): Promise<TeamMember> {
    const team = await this.getTeamById(teamId, inviterId);

    // Check permissions
    const inviterMember = await this.getUserTeamMember(teamId, inviterId);
    if (!inviterMember.hasPermission('canInviteMembers')) {
      throw new ForbiddenException(
        'Insufficient permissions to invite team members',
      );
    }

    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email: inviteDto.email },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.RECRUITER) {
      throw new BadRequestException('Only recruiters can be added to teams');
    }

    // Check if user is already a member
    const existingMember = await this.teamMemberRepository.findOne({
      where: { teamId, userId: user.id },
    });
    if (existingMember) {
      throw new ConflictException('User is already a member of this team');
    }

    // Create team member
    const teamMember = this.teamMemberRepository.create({
      teamId,
      userId: user.id,
      role: inviteDto.role,
      status: TeamMemberStatus.PENDING,
      permissions: inviteDto.permissions,
      invitedById: inviterId,
      invitedAt: new Date(),
    });

    const savedMember = await this.teamMemberRepository.save(teamMember);

    // Log activity
    await this.logActivity(
      teamId,
      inviterId,
      ActivityType.MEMBER_ADDED,
      'Team member invited',
      {
        targetUserId: user.id,
        targetUserEmail: user.email,
        role: inviteDto.role,
      },
    );

    return savedMember;
  }

  async inviteMultipleTeamMembers(
    teamId: string,
    inviterId: string,
    inviteDto: InviteMultipleTeamMembersDto,
  ): Promise<{
    successful: TeamMember[];
    failed: { email: string; error: string }[];
  }> {
    const successful: TeamMember[] = [];
    const failed: { email: string; error: string }[] = [];

    for (const invitation of inviteDto.invitations) {
      try {
        const member = await this.inviteTeamMember(
          teamId,
          inviterId,
          invitation,
        );
        successful.push(member);
      } catch (error) {
        failed.push({
          email: invitation.email,
          error: error.message,
        });
      }
    }

    return { successful, failed };
  }

  async updateTeamMember(
    teamId: string,
    memberId: string,
    updaterId: string,
    updateDto: UpdateTeamMemberDto,
  ): Promise<TeamMember> {
    const team = await this.getTeamById(teamId, updaterId);

    // Check permissions
    const updaterMember = await this.getUserTeamMember(teamId, updaterId);
    if (
      !updaterMember.hasPermission('canRemoveMembers') &&
      team.ownerId !== updaterId
    ) {
      throw new ForbiddenException(
        'Insufficient permissions to update team member',
      );
    }

    const teamMember = await this.teamMemberRepository.findOne({
      where: { id: memberId, teamId },
      relations: ['user'],
    });

    if (!teamMember) {
      throw new NotFoundException('Team member not found');
    }

    // Prevent downgrading owner
    if (teamMember.role === TeamRole.OWNER) {
      throw new ForbiddenException('Cannot modify team owner');
    }

    const oldRole = teamMember.role;

    // Update team member
    Object.assign(teamMember, updateDto);
    const updatedMember = await this.teamMemberRepository.save(teamMember);

    // Log activity if role changed
    if (updateDto.role && oldRole !== updateDto.role) {
      await this.logActivity(
        teamId,
        updaterId,
        ActivityType.MEMBER_ROLE_CHANGED,
        'Team member role updated',
        {
          targetUserId: teamMember.userId,
          targetUserEmail: teamMember.user.email,
          oldRole,
          newRole: updateDto.role,
        },
      );
    }

    return updatedMember;
  }

  async removeTeamMember(
    teamId: string,
    removerId: string,
    removeDto: RemoveTeamMemberDto,
  ): Promise<{ message: string }> {
    const team = await this.getTeamById(teamId, removerId);

    // Check permissions
    const removerMember = await this.getUserTeamMember(teamId, removerId);
    if (
      !removerMember.hasPermission('canRemoveMembers') &&
      team.ownerId !== removerId
    ) {
      throw new ForbiddenException(
        'Insufficient permissions to remove team member',
      );
    }

    const teamMember = await this.teamMemberRepository.findOne({
      where: { id: removeDto.memberId, teamId },
      relations: ['user'],
    });

    if (!teamMember) {
      throw new NotFoundException('Team member not found');
    }

    // Prevent removing owner
    if (teamMember.role === TeamRole.OWNER) {
      throw new ForbiddenException('Cannot remove team owner');
    }

    // Remove team member
    await this.teamMemberRepository.remove(teamMember);

    // Log activity
    await this.logActivity(
      teamId,
      removerId,
      ActivityType.MEMBER_REMOVED,
      'Team member removed',
      {
        targetUserId: teamMember.userId,
        targetUserEmail: teamMember.user.email,
        reason: removeDto.reason,
      },
    );

    return { message: 'Team member removed successfully' };
  }

  async acceptTeamInvitation(
    teamId: string,
    userId: string,
  ): Promise<TeamMember> {
    const teamMember = await this.teamMemberRepository.findOne({
      where: { teamId, userId, status: TeamMemberStatus.PENDING },
    });

    if (!teamMember) {
      throw new NotFoundException('Team invitation not found');
    }

    teamMember.status = TeamMemberStatus.ACTIVE;
    teamMember.joinedAt = new Date();

    return this.teamMemberRepository.save(teamMember);
  }

  async getTeamActivities(
    teamId: string,
    userId: string,
    query: GetTeamActivitiesDto,
  ) {
    // Verify user has access to team
    await this.getTeamById(teamId, userId);

    const { page = 1, limit = 20, activityType, userId: filterUserId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.teamActivityRepository
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .where('activity.teamId = :teamId', { teamId });

    if (activityType) {
      queryBuilder.andWhere('activity.type = :activityType', { activityType });
    }

    if (filterUserId) {
      queryBuilder.andWhere('activity.userId = :filterUserId', {
        filterUserId,
      });
    }

    const [activities, total] = await queryBuilder
      .orderBy('activity.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: activities,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteTeam(
    teamId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const team = await this.getTeamById(teamId, userId);

    // Only owner can delete team
    if (team.ownerId !== userId) {
      throw new ForbiddenException('Only team owner can delete the team');
    }

    // Check if team has active jobs (implement this check based on your job entity)
    // const activeJobs = await this.jobRepository.count({ where: { teamId, isActive: true } });
    // if (activeJobs > 0) {
    //   throw new BadRequestException('Cannot delete team with active job postings');
    // }

    await this.teamRepository.remove(team);

    return { message: 'Team deleted successfully' };
  }

  async getUserTeamMember(teamId: string, userId: string): Promise<TeamMember> {
    const teamMember = await this.teamMemberRepository.findOne({
      where: { teamId, userId, status: TeamMemberStatus.ACTIVE },
      relations: ['user'],
    });

    if (!teamMember) {
      throw new NotFoundException('Team member not found');
    }

    return teamMember;
  }

  async getUserTeamRole(
    teamId: string,
    userId: string,
  ): Promise<TeamRole | null> {
    const teamMember = await this.teamMemberRepository.findOne({
      where: { teamId, userId, status: TeamMemberStatus.ACTIVE },
    });

    return teamMember?.role || null;
  }

  async checkTeamPermission(
    teamId: string,
    userId: string,
    permission: keyof NonNullable<TeamMember['permissions']>,
  ): Promise<boolean> {
    try {
      const teamMember = await this.getUserTeamMember(teamId, userId);
      return teamMember.hasPermission(permission);
    } catch {
      return false;
    }
  }

  private async logActivity(
    teamId: string,
    userId: string,
    type: ActivityType,
    description: string,
    metadata?: any,
  ): Promise<void> {
    try {
      const activity = this.teamActivityRepository.create({
        teamId,
        userId,
        type,
        description,
        metadata,
      });
      await this.teamActivityRepository.save(activity);
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to log team activity:', error);
    }
  }
}
