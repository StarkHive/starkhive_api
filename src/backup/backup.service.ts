import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  unlinkSync,
  statSync,
} from 'fs';
import { mkdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { join } from 'path';
import { Readable } from 'stream';
import { Backup } from './entities/backup.entity';
import {
  BackupConfigDto,
  BackupResponseDto,
  RestoreConfigDto,
  BackupStatus,
  BackupType,
} from './dto/backup-config.dto';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly s3Client: S3Client;
  private readonly backupDir: string;

  constructor(
    @InjectRepository(Backup)
    private readonly backupRepository: Repository<Backup>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.backupDir =
      this.configService.get<string>('BACKUP_DIR') || './backups';

    // Initialize S3 client if AWS credentials are provided
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    const region = this.configService.get<string>('AWS_REGION');

    if (accessKeyId && secretAccessKey && region) {
      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      // Validate bucket configuration when S3 client is initialized
      const bucket = this.configService.get<string>('AWS_BACKUP_BUCKET');
      if (!bucket) {
        this.logger.warn(
          'S3 client initialized but AWS_BACKUP_BUCKET not configured',
        );
      }
    }
  }

  async createBackup(config: BackupConfigDto): Promise<BackupResponseDto> {
    const backupId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const backup = this.backupRepository.create({
      id: backupId,
      type: config.type,
      database: config.database,
      status: BackupStatus.PENDING,
      filePath: '',
      size: 0,
      checksum: '',
    });

    await this.backupRepository.save(backup);
    this.logger.log(
      `Starting backup ${backupId} for database ${config.database}`,
    );

    try {
      const filename = `${config.database}_${timestamp}.sql${config.compression ? '.gz' : ''}`;
      const filePath = join(this.backupDir, filename);

      // Create backup directory if it doesn't exist (using Node.js fs module)
      await mkdir(this.backupDir, { recursive: true });

      // Generate PostgreSQL dump with secure command execution
      const { command: dumpCommand, env } = this.buildDumpCommand(
        config,
        filePath,
      );
      await execAsync(dumpCommand, { env });

      // Calculate file size and checksum
      const stats = statSync(filePath);
      const checksum = await this.calculateChecksum(filePath);

      backup.filePath = filePath;
      backup.size = stats.size;
      backup.checksum = checksum;
      backup.completedAt = new Date();
      backup.status = BackupStatus.COMPLETED;

      // Upload to S3 if configured
      if (this.s3Client && config.crossRegion) {
        try {
          const s3Key = await this.uploadToS3(filePath, filename);
          backup.s3Key = s3Key;
          this.logger.log(`Backup ${backupId} uploaded to S3 successfully`);
        } catch (s3Error) {
          this.logger.error(
            `S3 upload failed for backup ${backupId}:`,
            s3Error,
          );
          backup.error = `Local backup completed but S3 upload failed: ${s3Error.message}`;
          backup.status = BackupStatus.PARTIALLY_COMPLETED;
        }
      }

      await this.backupRepository.save(backup);
      this.logger.log(`Backup ${backupId} completed successfully`);
    } catch (error) {
      backup.status = BackupStatus.FAILED;
      backup.error = error.message;
      await this.backupRepository.save(backup);
      this.logger.error(`Backup ${backupId} failed:`, error);
    }

    return this.mapToResponseDto(backup);
  }

  private buildDumpCommand(
    config: BackupConfigDto,
    filePath: string,
  ): { command: string; env: NodeJS.ProcessEnv } {
    const host = this.configService.get<string>('DB_HOST') || 'localhost';
    const port = this.configService.get<string>('DB_PORT') || '5432';
    const username =
      this.configService.get<string>('DB_USERNAME') || 'postgres';
    const password = this.configService.get<string>('DB_PASSWORD');

    // Use environment variable for password to avoid command line exposure
    const env = { ...process.env, PGPASSWORD: password };

    // Properly escape shell arguments
    const escapedArgs = [
      '-h',
      this.escapeShellArg(host),
      '-p',
      this.escapeShellArg(port),
      '-U',
      this.escapeShellArg(username),
      '-d',
      this.escapeShellArg(config.database),
    ];

    let command = `pg_dump ${escapedArgs.join(' ')} --verbose --clean --no-owner --no-privileges`;

    if (config.compression) {
      command += ` | gzip > ${this.escapeShellArg(filePath)}`;
    } else {
      command += ` > ${this.escapeShellArg(filePath)}`;
    }

    return { command, env };
  }

  private async performRestore(
    filePath: string,
    database: string,
    compressed: boolean,
  ): Promise<void> {
    const host = this.configService.get<string>('DB_HOST') || 'localhost';
    const port = this.configService.get<string>('DB_PORT') || '5432';
    const username =
      this.configService.get<string>('DB_USERNAME') || 'postgres';
    const password = this.configService.get<string>('DB_PASSWORD');

    const env = { ...process.env, PGPASSWORD: password };
    const escapedArgs = [
      '-h',
      this.escapeShellArg(host),
      '-p',
      this.escapeShellArg(port),
      '-U',
      this.escapeShellArg(username),
      '-d',
      this.escapeShellArg(database),
    ];

    let command: string;
    if (compressed) {
      command = `gunzip -c ${this.escapeShellArg(filePath)} | psql ${escapedArgs.join(' ')}`;
    } else {
      command = `psql ${escapedArgs.join(' ')} < ${this.escapeShellArg(filePath)}`;
    }

    await execAsync(command, { env });
  }

  private escapeShellArg(arg: string): string {
    return `'${arg.replace(/'/g, "'\"'\"'")}'`;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async uploadToS3(
    filePath: string,
    filename: string,
  ): Promise<string> {
    const bucket = this.configService.get<string>('AWS_BACKUP_BUCKET');
    if (!bucket) {
      throw new Error('AWS_BACKUP_BUCKET not configured');
    }

    const s3Key = `backups/${filename}`;
    const fileStream = createReadStream(filePath);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: fileStream,
      ServerSideEncryption: 'AES256',
    });

    await this.s3Client.send(command);
    return s3Key;
  }

  async cleanupOldBackups(): Promise<void> {
    const retentionDays =
      this.configService.get<number>('BACKUP_RETENTION_DAYS') || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const oldBackups = await this.backupRepository.find({
      where: {
        createdAt: LessThan(cutoffDate),
      },
    });

    for (const backup of oldBackups) {
      try {
        await this.deleteBackup(backup.id);
        this.logger.log(`Cleaned up old backup: ${backup.id}`);
      } catch (error) {
        this.logger.error(`Failed to cleanup backup ${backup.id}:`, error);
      }
    }
  }

  async getBackups(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: BackupResponseDto[]; total: number }> {
    const [backups, total] = await this.backupRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: backups.map((backup) => this.mapToResponseDto(backup)),
      total,
    };
  }

  async deleteBackup(id: string): Promise<{ message: string }> {
    const backup = await this.backupRepository.findOne({ where: { id } });
    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    // Delete local file
    if (existsSync(backup.filePath)) {
      try {
        unlinkSync(backup.filePath);
      } catch (error) {
        this.logger.warn(
          `Failed to delete local backup file ${backup.filePath}:`,
          error,
        );
        // Continue with S3 deletion and database cleanup
      }
    }

    // Delete from S3
    if (backup.s3Key && this.s3Client) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.configService.get<string>('AWS_BACKUP_BUCKET'),
          Key: backup.s3Key,
        });
        await this.s3Client.send(command);
      } catch (error) {
        this.logger.warn(`Failed to delete S3 backup ${backup.s3Key}:`, error);
        // Continue with database cleanup
      }
    }

    await this.backupRepository.remove(backup);
    return { message: 'Backup deleted successfully' };
  }

  async restoreBackup(config: RestoreConfigDto): Promise<{ message: string }> {
    // Validate point-in-time recovery is not requested (not supported)
    if (config.pointInTime) {
      throw new BadRequestException('Point-in-time recovery not supported');
    }

    const backup = await this.backupRepository.findOne({
      where: { id: config.backupId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    if (backup.status !== BackupStatus.COMPLETED) {
      throw new Error('Cannot restore from incomplete backup');
    }

    let filePath = backup.filePath;
    const isCompressed = filePath.endsWith('.gz');

    // Download from S3 if needed
    if (backup.s3Key && this.s3Client && !existsSync(filePath)) {
      filePath = await this.downloadFromS3(backup.s3Key, backup.filePath);
    }

    if (!existsSync(filePath)) {
      throw new Error('Backup file not found');
    }

    // Verify backup integrity with case-insensitive comparison
    const currentChecksum = await this.calculateChecksum(filePath);
    if (currentChecksum.toLowerCase() !== backup.checksum?.toLowerCase()) {
      throw new Error('Backup file integrity check failed');
    }

    // Validate target database exists
    const targetDatabase = config.targetDatabase || backup.database;
    await this.validateDatabaseExists(targetDatabase);

    // Perform the restore
    await this.performRestore(filePath, targetDatabase, isCompressed);

    this.logger.log(`Backup ${config.backupId} restored successfully`);
    return { message: 'Backup restored successfully' };
  }

  private async validateDatabaseExists(database: string): Promise<void> {
    if (!this.dataSource.isInitialized) {
      throw new Error('Database connection not initialized');
    }

    const query = 'SELECT 1 FROM pg_database WHERE datname = $1';
    const result = await this.dataSource.query(query, [database]);
    if (result.length === 0) {
      throw new Error(`Target database '${database}' does not exist`);
    }
  }

  private async downloadFromS3(
    s3Key: string,
    localPath: string,
  ): Promise<string> {
    const bucket = this.configService.get<string>('AWS_BACKUP_BUCKET');
    if (!bucket) {
      throw new Error('AWS_BACKUP_BUCKET not configured');
    }

    // Ensure directory exists
    await mkdir(this.backupDir, { recursive: true });

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    });

    const response = await this.s3Client.send(command);
    const writeStream = createWriteStream(localPath);

    return new Promise((resolve, reject) => {
      if (response.Body instanceof Readable) {
        response.Body.pipe(writeStream)
          .on('finish', () => {
            // Verify file was created and has content
            if (existsSync(localPath) && statSync(localPath).size > 0) {
              resolve(localPath);
            } else {
              reject(new Error('Downloaded file is empty or was not created'));
            }
          })
          .on('error', reject);
      } else {
        reject(new Error('Invalid S3 response body'));
      }
    });
  }

  async getBackupHealth(): Promise<{
    status: string;
    lastBackup: Date | null;
    totalBackups: number;
    failedBackups: number;
  }> {
    const [totalBackups, failedBackups] = await Promise.all([
      this.backupRepository.count(),
      this.backupRepository.count({ where: { status: BackupStatus.FAILED } }),
    ]);

    const lastBackup = await this.backupRepository.findOne({
      where: { status: BackupStatus.COMPLETED },
      order: { completedAt: 'DESC' },
    });

    const status = failedBackups === 0 && lastBackup ? 'healthy' : 'warning';

    return {
      status,
      lastBackup: lastBackup?.completedAt || null,
      totalBackups,
      failedBackups,
    };
  }

  private mapToResponseDto(backup: Backup): BackupResponseDto {
    return {
      id: backup.id,
      status: backup.status,
      filePath: backup.filePath,
      size: Number(backup.size),
      createdAt: backup.createdAt,
      completedAt: backup.completedAt,
      error: backup.error,
    };
  }
}
