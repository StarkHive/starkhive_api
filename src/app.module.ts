import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/entities/user.entity';
import { EmailToken } from './auth/entities/email-token.entity';
import { PasswordReset } from './auth/entities/password-reset.entity';
import { Message } from './messaging/entities/messaging.entity';
import { FeedModule } from './feed/feed.module';
import { PostModule } from './post/post.module';
import * as dotenv from 'dotenv';
import { SavedPost } from './feed/entities/savedpost.entity';
import { Post } from './feed/entities/post.entity';
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
import { Like } from './feed/entities/like.entity';
import { Job } from './jobs/entities/job.entity';
import { SavedJob } from './jobs/entities/saved-job.entity';
import { Recommendation } from './jobs/entities/recommendation.entity';
import { Portfolio } from './auth/entities/portfolio.entity';
import { SkillVerification } from './auth/entities/skills-verification.entity';
import { Report } from './reports/entities/report.entity';
import { BackupModule } from './backup/backup.module';
import { Backup } from './backup/entities/backup.entity';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './auth/guards/rate-limit.guard';
import { AvailabilityModule } from './availability/availability.module';

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
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [
          User,
          EmailToken,
          PasswordReset,
          SavedPost,
          Post,
          Application,
          Message,
          Comment,
          Like,
          Job,
          SavedJob,
          Recommendation,
          Portfolio,
          SkillVerification,
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

    // Rate limiting module
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60 * 1000, // 1 minute
          limit: 100,
        },
      ],
    }),

    AvailabilityModule,
  ],
  providers: [
    // {
    //   provide: APP_GUARD,
    //   useClass: RateLimitGuard,
    // },
  ],
})
export class AppModule {}
