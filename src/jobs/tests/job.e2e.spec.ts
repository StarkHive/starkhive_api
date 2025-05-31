import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { DataSource } from 'typeorm';

describe('Job + Anti-Spam (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
  });

  afterEach(async () => {
    // Clean up between tests
    const entities = dataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.query(`DELETE FROM "${entity.tableName}"`);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const spammyJob = {
    title: 'Get rich fast scheme',
    description: 'Earn $$$ from home with no experience!!! Click here.',
    company: 'Scam Inc',
  };

  const normalJob = {
    title: 'Frontend Developer',
    description: 'We are looking for a React developer with 2+ years of experience.',
    company: 'LegitTech',
  };

  it('should post a normal job (not flagged)', async () => {
    const response = await request(app.getHttpServer())
      .post('/jobs')
      .send(normalJob)
      .expect(201);

    expect(response.body).toMatchObject({
      title: normalJob.title,
      isFlagged: false,
    });
  });

  it('should flag a spammy job', async () => {
    const response = await request(app.getHttpServer())
      .post('/jobs')
      .send(spammyJob)
      .expect(201);

    expect(response.body).toMatchObject({
      title: spammyJob.title,
      isFlagged: true,
    });

    const flags = await request(app.getHttpServer())
      .get('/anti-spam/flags')
      .expect(200);

    expect(flags.body.length).toBe(1);
    expect(flags.body[0]).toMatchObject({
      reason: expect.stringContaining('blacklist'),
      job: {
        title: spammyJob.title,
      },
    });
  });

  it('should return all flagged jobs for admin review', async () => {
    // First post a spammy job
    await request(app.getHttpServer())
      .post('/jobs')
      .send(spammyJob)
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/anti-spam/flags')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].job.title).toBe(spammyJob.title);
    expect(response.body[0].reason).toBeDefined();
  });
});
