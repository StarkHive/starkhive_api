import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsService } from './jobs.service';
import { Application } from 'src/applications/entities/application.entity';
import { AntiSpamModule } from '../anti-spam/anti-spam.module';
import { JobsController } from './jobs.controller';
import { FeedModule } from 'src/feed/feed.module';
import { Job } from './entities/job.entity';
import { SavedJob } from './entities/saved-job.entity';

@Module({
  imports: [
    FeedModule,
    TypeOrmModule.forFeature([Job, Application, SavedJob]),
    AntiSpamModule,
  ],
  providers: [JobsService],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobModule {}
