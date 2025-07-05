import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BackupService } from '../backup.service';
import { BackupType } from '../dto/backup-config.dto';

@Injectable()
export class BackupTask {
  private readonly logger = new Logger(BackupTask.name);

  constructor(
    private readonly backupService: BackupService,
    private readonly configService: ConfigService,
  ) {}

  private async executeBackup(
    retentionDays: number,
    backupType: string,
  ): Promise<void> {
    this.logger.log(`Starting ${backupType} backup...`);

    try {
      const database = this.configService.get<string>('DB_NAME');
      if (!database) {
        throw new Error('DB_NAME environment variable is not set');
      }

      // Validate AWS configuration for cross-region backups
      const awsAccessKey = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const awsSecretKey = this.configService.get<string>(
        'AWS_SECRET_ACCESS_KEY',
      );
      const awsBucket = this.configService.get<string>('AWS_BACKUP_BUCKET');

      if (!awsAccessKey || !awsSecretKey || !awsBucket) {
        this.logger.warn(
          'AWS credentials not configured, cross-region backup may fail',
        );
      }

      await this.backupService.createBackup({
        type: BackupType.FULL,
        database,
        retentionDays,
        compression: true,
        crossRegion: true,
      });

      this.logger.log(`${backupType} backup initiated successfully`);
    } catch (error) {
      this.logger.error(`${backupType} backup failed:`, error);
    }
  }

  // Daily backup at 2 AM
  @Cron('0 2 * * *', {
    name: 'daily-backup',
    timeZone: 'UTC',
  })
  async handleDailyBackup() {
    await this.executeBackup(7, 'Daily');
  }

  // Weekly backup on Sunday at 1 AM
  @Cron('0 1 * * 0', {
    name: 'weekly-backup',
    timeZone: 'UTC',
  })
  async handleWeeklyBackup() {
    await this.executeBackup(30, 'Weekly');
  }

  // Cleanup old backups daily at 3 AM
  @Cron('0 3 * * *', {
    name: 'backup-cleanup',
    timeZone: 'UTC',
  })
  async handleBackupCleanup() {
    this.logger.log('Starting backup cleanup...');

    try {
      await this.backupService.cleanupOldBackups();
      this.logger.log('Backup cleanup completed');
    } catch (error) {
      this.logger.error('Backup cleanup failed:', error);
    }
  }

  // Health check every hour
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'backup-health-check',
  })
  async handleHealthCheck() {
    try {
      const health = await this.backupService.getBackupHealth();

      if (health.status === 'warning') {
        this.logger.warn('Backup system health warning:', health);
        // Here you could send alerts via email, Slack, etc.
      }
    } catch (error) {
      this.logger.error('Backup health check failed:', error);
    }
  }
}
