import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import type { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/auth/entities/user.entity';
import { Team } from '../src/auth/entities/team.entity';
import { TeamMember } from '../src/auth/entities/team-member.entity';
import { UserRole } from '../src/auth/enums/userRole.enum';
import {
  TeamRole,
  TeamMemberStatus,
} from '../src/auth/entities/team-member.entity';
import { getJwtTokenForUser } from './test-helpers';
import {
  describe,
  beforeAll,
  afterAll,
  it,
  expect,
  beforeEach,
} from '@jest/globals';

describe('Team Management (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let teamRepository: Repository<Team>;
  let teamMemberRepository: Repository<TeamMember>;
  let recruiterToken: string;
  let secondRecruiterToken: string;
  let recruiterUser: User;
  let secondRecruiterUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    teamRepository = moduleFixture.get<Repository<Team>>(
      getRepositoryToken(Team),
    );
    teamMemberRepository = moduleFixture.get<Repository<TeamMember>>(
      getRepositoryToken(TeamMember),
    );

    // Create test recruiters
    recruiterUser = await userRepository.save({
      email: 'recruiter1@test.com',
      password: 'password',
      role: UserRole.RECRUITER,
      isEmailVerified: true,
    });

    secondRecruiterUser = await userRepository.save({
      email: 'recruiter2@test.com',
      password: 'password',
      role: UserRole.RECRUITER,
      isEmailVerified: true,
    });

    recruiterToken = getJwtTokenForUser(recruiterUser);
    secondRecruiterToken = getJwtTokenForUser(secondRecruiterUser);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/teams', () => {
    it('should create a new team', async () => {
      const teamData = {
        name: 'Engineering Team',
        description: 'Team for hiring engineers',
        settings: {
          allowMemberInvites: false,
          requireApprovalForJobs: true,
          shareApplications: true,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/auth/teams')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send(teamData)
        .expect(201);

      expect(response.body.name).toBe(teamData.name);
      expect(response.body.description).toBe(teamData.description);
      expect(response.body.ownerId).toBe(recruiterUser.id);
      expect(response.body.settings.requireApprovalForJobs).toBe(true);
    });

    it('should not allow non-recruiters to create teams', async () => {
      const freelancerUser = await userRepository.save({
        email: 'freelancer@test.com',
        password: 'password',
        role: UserRole.FREELANCER,
        isEmailVerified: true,
      });

      const freelancerToken = getJwtTokenForUser(freelancerUser);

      await request(app.getHttpServer())
        .post('/auth/teams')
        .set('Authorization', `Bearer ${freelancerToken}`)
        .send({ name: 'Test Team' })
        .expect(403);
    });
  });

  describe('GET /auth/teams', () => {
    let testTeam: Team;

    beforeEach(async () => {
      testTeam = await teamRepository.save({
        name: 'Test Team',
        description: 'Test Description',
        ownerId: recruiterUser.id,
      });

      // Add team member
      await teamMemberRepository.save({
        team: testTeam,
        user: recruiterUser,
        role: TeamRole.OWNER,
        status: TeamMemberStatus.ACTIVE,
        joinedAt: new Date(),
      });
    });

    it('should get user teams', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/teams')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Test Team');
      expect(response.body.meta.total).toBe(1);
    });

    it('should filter teams by search', async () => {
      await request(app.getHttpServer())
        .get('/auth/teams?search=Test')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(200);
    });
  });

  describe('POST /auth/teams/:teamId/members/invite', () => {
    let testTeam: Team;

    beforeEach(async () => {
      testTeam = await teamRepository.save({
        name: 'Test Team',
        description: 'Test Description',
        ownerId: recruiterUser.id,
      });

      await teamMemberRepository.save({
        team: { id: testTeam.id },
        user: { id: recruiterUser.id },
        role: TeamRole.OWNER,
        status: TeamMemberStatus.ACTIVE,
        joinedAt: new Date(),
      });
    });

    it('should invite a team member', async () => {
      const inviteData = {
        email: secondRecruiterUser.email,
        role: TeamRole.MEMBER,
      };

      const response = await request(app.getHttpServer())
        .post(`/auth/teams/${testTeam.id}/members/invite`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send(inviteData)
        .expect(201);

      expect(response.body.userId).toBe(secondRecruiterUser.id);
      expect(response.body.role).toBe(TeamRole.MEMBER);
      expect(response.body.status).toBe('pending');
    });

    it('should not allow inviting non-existent users', async () => {
      const inviteData = {
        email: 'nonexistent@test.com',
        role: TeamRole.MEMBER,
      };

      await request(app.getHttpServer())
        .post(`/auth/teams/${testTeam.id}/members/invite`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send(inviteData)
        .expect(404);
    });
  });

  describe('POST /auth/teams/:teamId/accept-invitation', () => {
    let testTeam: Team;

    beforeEach(async () => {
      testTeam = await teamRepository.save({
        name: 'Test Team',
        description: 'Test Description',
        ownerId: recruiterUser.id,
      });

      // Create pending invitation
      await teamMemberRepository.save({
        team: { id: testTeam.id },
        user: { id: secondRecruiterUser.id },
        role: TeamRole.MEMBER,
        status: TeamMemberStatus.PENDING,
        invitedById: recruiterUser.id,
        invitedAt: new Date(),
      });
    });

    it('should accept team invitation', async () => {
      const response = await request(app.getHttpServer())
        .post(`/auth/teams/${testTeam.id}/accept-invitation`)
        .set('Authorization', `Bearer ${secondRecruiterToken}`)
        .expect(200);

      expect(response.body.status).toBe('active');
      expect(response.body.joinedAt).toBeDefined();
    });
  });

  describe('GET /auth/teams/:teamId/activities', () => {
    let testTeam: Team;

    beforeEach(async () => {
      testTeam = await teamRepository.save({
        name: 'Test Team',
        description: 'Test Description',
        ownerId: recruiterUser.id,
      });

      await teamMemberRepository.save({
        team: { id: testTeam.id },
        user: { id: recruiterUser.id },
        role: TeamRole.OWNER,
        status: TeamMemberStatus.ACTIVE,
        joinedAt: new Date(),
      });
    });

    it('should get team activities', async () => {
      const response = await request(app.getHttpServer())
        .get(`/auth/teams/${testTeam.id}/activities`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.total).toBeGreaterThanOrEqual(0);
    });

    it('should filter activities by type', async () => {
      await request(app.getHttpServer())
        .get(`/auth/teams/${testTeam.id}/activities?activityType=team_created`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(200);
    });
  });

  describe('Team Permissions', () => {
    let testTeam: Team;
    let memberUser: User;
    let memberToken: string;

    beforeEach(async () => {
      testTeam = await teamRepository.save({
        name: 'Test Team',
        description: 'Test Description',
        ownerId: recruiterUser.id,
      });

      memberUser = await userRepository.save({
        email: 'member@test.com',
        password: 'password',
        role: UserRole.RECRUITER,
        isEmailVerified: true,
      });

      memberToken = getJwtTokenForUser(memberUser);

      // Add as team member with limited permissions
      await teamMemberRepository.save({
        team: { id: testTeam.id },
        user: { id: memberUser.id },
        role: TeamRole.MEMBER,
        status: TeamMemberStatus.ACTIVE,
        joinedAt: new Date(),
        permissions: {
          canCreateJobs: true,
          canEditJobs: false,
          canDeleteJobs: false,
          canViewApplications: true,
          canManageApplications: false,
          canInviteMembers: false,
          canRemoveMembers: false,
        },
      });
    });

    it('should prevent members from inviting others without permission', async () => {
      const inviteData = {
        email: 'another@test.com',
        role: TeamRole.MEMBER,
      };

      await request(app.getHttpServer())
        .post(`/auth/teams/${testTeam.id}/members/invite`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send(inviteData)
        .expect(403);
    });

    it('should allow owner to update team settings', async () => {
      const updateData = {
        description: 'Updated description',
        settings: {
          allowMemberInvites: true,
        },
      };

      const response = await request(app.getHttpServer())
        .patch(`/auth/teams/${testTeam.id}`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.description).toBe('Updated description');
    });
  });
});
