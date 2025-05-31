import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from './entities/job.entity';
import { JobService } from './jobs.service';
import { JobController } from './jobs.controller'; 
import { AntiSpamModule } from '../anti-spam/anti-spam.module';

@Module({
  imports: [TypeOrmModule.forFeature([Job]), AntiSpamModule],
  providers: [JobService],
  controllers: [JobController],
})
export class JobModule {}
