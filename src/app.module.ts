import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/entities/user.entity';
import { Message } from './messaging/entities/message.entity';
import { FeedModule } from './feed/feed.module';
import { PostModule } from './post/post.module';
import * as dotenv from 'dotenv';
import { SavedPost } from './feed/entities/savedpost.entity';
import { Post } from './post/entities/post.entity';
import { MessagingModule } from './messaging/messaging.module';
import { Team } from './auth/entities/team.entity';
import { TeamMember } from './auth/entities/team-member.entity';
import { TeamActivity } from './auth/entities/team-activity.entity';
import { JobModule } from './jobs/jobs.module';
import { AntiSpamModule } from './anti-spam/anti-spam.module';
import { Application } from './applications/entities/application.entity';
import { ApplicationsModule } from './applications/applications.module';
import { AdminModule } from './admin/admin.module';
import { ReportsModule } from './reports/reports.module';
import { Comment } from './feed/entities/comment.entity';
import { Job } from './jobs/entities/job.entity';
import { Portfolio } from './auth/entities/portfolio.entity';
import { Report } from './reports/entities/report.entity';
import { BackupModule } from './backup/backup.module';
import { Backup } from './backup/entities/backup.entity';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

dotenv.config();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres', // Force postgres, no fallback to sqlite
        host: configService.get<string>('DB_HOST'),
        port: Number.parseInt(
          configService.get<string>('DB_PORT') || '5432',
          10,
        ), // default postgres port
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number.parseInt(configService.get<string>('DB_PORT') || '5432', 10),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [
          User,
          SavedPost,
          Post,
          Application,
          Message,
          Comment,
          Job,
          Portfolio,
          Report,
          Team,
          TeamMember,
          TeamActivity,
          Backup,
        ],
        synchronize: true,
      }),
    }),
    AuthModule,
    MessagingModule,
    FeedModule,
    PostModule,
    JobModule,
    AntiSpamModule,
    AdminModule,
    ReportsModule,
    ApplicationsModule,
    BackupModule,

    // ✅ Rate limiting module merged from API-Rate-Limiting-and-Security-Enhancement
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60 * 1000, // 1 minute
          limit: 100,
        },
      ],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: require('./auth/guards/rate-limit.guard').RateLimitGuard,
    },
  ],
})
export class AppModule {}
