import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { User } from './auth/entities/user.entity';
import { EmailToken } from './auth/entities/email-token.entity';
import { PasswordReset } from './auth/entities/password-reset.entity';
import { Portfolio } from './auth/entities/portfolio.entity';
import { Post } from './feed/entities/post.entity';
import { Comment } from './feed/entities/comment.entity';
import { SavedPost } from './feed/entities/savedpost.entity';
import { Job } from './jobs/entities/job.entity';
import { SavedJob } from './jobs/entities/saved-job.entity';
import { Recommendation } from './jobs/entities/recommendation.entity';
import { Application } from './applications/entities/application.entity';
import { Report } from './reports/entities/report.entity';

config();

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get<string>('DB_HOST'),
  port: parseInt(configService.get<string>('DB_PORT') || '5432', 10),
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_NAME'),
  synchronize: false,
  logging: true,
  entities: [
    User,
    EmailToken,
    PasswordReset,
    Portfolio,
    Post,
    Comment,
    SavedPost,
    Job,
    SavedJob,
    Recommendation,
    Application,
    Report,
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});
