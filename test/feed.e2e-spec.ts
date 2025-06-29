import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Report } from '../src/feed/entities/report.entity';
import { Post } from '../src/post/entities/post.entity';
import { User } from '../src/auth/entities/user.entity';
import { Repository } from 'typeorm';
import { UserRole } from '../src/auth/enums/userRole.enum';
import { getJwtTokenForUser } from './test-helpers';

describe('FeedController (e2e)', () => {
  let app: INestApplication;
  let reportRepo: Repository<Report>;
  let postRepo: Repository<Post>;
  let userRepo: Repository<User>;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    reportRepo = moduleFixture.get<Repository<Report>>(
      getRepositoryToken(Report),
    );
    postRepo = moduleFixture.get<Repository<Post>>(getRepositoryToken(Post));
    userRepo = moduleFixture.get<Repository<User>>(getRepositoryToken(User));

    // Create users and get tokens (implement your own auth logic here)
    const admin = await userRepo.save({
      email: 'admin@test.com',
      password: 'pw',
      role: UserRole.ADMIN,
    });
    const user = await userRepo.save({
      email: 'user@test.com',
      password: 'pw',
      role: UserRole.FREELANCER,
    });

    // Get tokens for these users (implement this using your auth system)
    adminToken = await getJwtTokenForUser(admin);
    userToken = await getJwtTokenForUser(user);

    // Create test post, reporter, and report
    const post = await postRepo.save({ content: 'Test post' });
    const reporter = await userRepo.save({
      email: 'reporter@test.com',
      password: 'pw',
      role: UserRole.FREELANCER,
    });
    await reportRepo.save({
      reason: 'Test reason',
      post,
      reporter,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /feed/reports', () => {
    it('should return 401 for unauthenticated users', async () => {
      return request(app.getHttpServer()).get('/feed/reports').expect(401);
    });

    it('should return 403 for non-admin users', async () => {
      return request(app.getHttpServer())
        .get('/feed/reports')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return paginated reports for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/feed/reports?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('reason', 'Test reason');
      expect(response.body.data[0].post).toHaveProperty('content', 'Test post');
    });
  });
});
