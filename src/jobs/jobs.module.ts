import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JobsService } from './jobs.service';
import { RecommendationService } from './recommendation.service';
import { Application } from 'src/applications/entities/application.entity';
import { User } from 'src/auth/entities/user.entity';
import { AntiSpamModule } from '../anti-spam/anti-spam.module';
import { JobsController } from './jobs.controller';
import { FeedModule } from 'src/feed/feed.module';
import { Job } from './entities/job.entity';
import { SavedJob } from './entities/saved-job.entity';
import { Recommendation } from './entities/recommendation.entity';
import { ExcludeSoftDeleteInterceptor } from 'src/common/interceptors/exclude-soft-delete.interceptor';

@Module({
  imports: [
    FeedModule,
    TypeOrmModule.forFeature([
      Job,
      Application,
      SavedJob,
      Recommendation,
      User,
    ]),
    AntiSpamModule,
  ],
  providers: [
    JobsService,
    RecommendationService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ExcludeSoftDeleteInterceptor,
    },
  ],
  controllers: [JobsController],
  exports: [JobsService, RecommendationService],
})
export class JobModule {}
