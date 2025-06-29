import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Team } from './team.entity';
import { TeamRole } from '../enums/teamRole.enum';
import { TeamMemberStatus } from '../enums/teamMemberStatus.enum';

@Entity('team_members')
@Unique(['team', 'user'])
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Team, (team) => team.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team: Team;

  @Column()
  teamId: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: TeamRole,
    default: TeamRole.MEMBER,
  })
  role: TeamRole;

  @Column({
    type: 'enum',
    enum: TeamMemberStatus,
    default: TeamMemberStatus.ACTIVE,
  })
  status: TeamMemberStatus;

  @Column({ type: 'json', nullable: true })
  permissions?: {
    canCreateJobs: boolean;
    canEditJobs: boolean;
    canDeleteJobs: boolean;
    canViewApplications: boolean;
    canManageApplications: boolean;
    canInviteMembers: boolean;
    canRemoveMembers: boolean;
  };

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'invitedById' })
  invitedBy?: User;

  @Column({ nullable: true })
  invitedById?: string;

  @Column({ nullable: true })
  invitedAt?: Date;

  @Column({ nullable: true })
  joinedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper method to check permissions
  hasPermission(
    permission: keyof NonNullable<TeamMember['permissions']>,
  ): boolean {
    if (this.role === TeamRole.OWNER) return true;

    const defaultPermissions = this.getDefaultPermissions();
    return this.permissions?.[permission] ?? defaultPermissions[permission];
  }

  private getDefaultPermissions() {
    switch (this.role) {
      case TeamRole.OWNER:
        return {
          canCreateJobs: true,
          canEditJobs: true,
          canDeleteJobs: true,
          canViewApplications: true,
          canManageApplications: true,
          canInviteMembers: true,
          canRemoveMembers: true,
        };
      case TeamRole.ADMIN:
        return {
          canCreateJobs: true,
          canEditJobs: true,
          canDeleteJobs: true,
          canViewApplications: true,
          canManageApplications: true,
          canInviteMembers: true,
          canRemoveMembers: false,
        };
      case TeamRole.MANAGER:
        return {
          canCreateJobs: true,
          canEditJobs: true,
          canDeleteJobs: false,
          canViewApplications: true,
          canManageApplications: true,
          canInviteMembers: false,
          canRemoveMembers: false,
        };
      case TeamRole.MEMBER:
        return {
          canCreateJobs: true,
          canEditJobs: false,
          canDeleteJobs: false,
          canViewApplications: true,
          canManageApplications: false,
          canInviteMembers: false,
          canRemoveMembers: false,
        };
      case TeamRole.VIEWER:
        return {
          canCreateJobs: false,
          canEditJobs: false,
          canDeleteJobs: false,
          canViewApplications: true,
          canManageApplications: false,
          canInviteMembers: false,
          canRemoveMembers: false,
        };
      default:
        return {
          canCreateJobs: false,
          canEditJobs: false,
          canDeleteJobs: false,
          canViewApplications: false,
          canManageApplications: false,
          canInviteMembers: false,
          canRemoveMembers: false,
        };
    }
  }
}
