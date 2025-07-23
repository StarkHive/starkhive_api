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
import { Escrow } from './entities/escrow.entity';
import { SavedJob } from './entities/saved-job.entity';
import { Recommendation } from './entities/recommendation.entity';
import { ExcludeSoftDeleteInterceptor } from 'src/common/interceptors/exclude-soft-delete.interceptor';
import { BlockchainService } from './blockchain/blockchain.service';
import { JobTemplate } from './entities/job-template.entity';
import { JobCleanupTask } from './tasks/job-cleanup.task';
import { CurrencyConversionService } from './services/currency-conversion.service';
import { Transaction } from './entities/transaction.entity';

@Module({
  imports: [
    FeedModule,
    TypeOrmModule.forFeature([
      Job,
      Application,
      SavedJob,
      JobTemplate,
      SavedJob,
      Recommendation,
      User,
      Transaction,
      Escrow,
    ]),
    AntiSpamModule,
  ],
  providers: [
    JobsService,
    // JobCleanupTask,
    RecommendationService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ExcludeSoftDeleteInterceptor,
    },
    BlockchainService,
    CurrencyConversionService,
  ],
  controllers: [JobsController],
  exports: [JobsService, RecommendationService],
})
export class JobModule {}
