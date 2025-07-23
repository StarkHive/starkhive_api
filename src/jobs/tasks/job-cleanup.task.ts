import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobsService } from '../jobs.service';

@Injectable()
export class JobCleanupTask {
  private readonly logger = new Logger(JobCleanupTask.name);

  constructor(
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredJobs() {
    this.logger.log('Starting expired jobs cleanup');
    await this.jobsService.processJobExpiry();
    this.logger.log('Expired jobs cleanup completed');
  }

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async handleExpiryNotifications() {
    this.logger.log('Sending expiry notifications');
    await this.jobsService.sendExpiryNotifications();
    this.logger.log('Expiry notifications sent');
  }

  @Cron(CronExpression.EVERY_WEEK)
  async handleInactiveJobs() {
    this.logger.log('Starting inactive jobs archival');
    await this.jobsService.archiveInactiveJobs();
    this.logger.log('Inactive jobs archival completed');
  }
}
