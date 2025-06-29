import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Job } from './entities/job.entity';
import { Application } from 'src/applications/entities/application.entity';
import { SavedJob } from './entities/saved-job.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { CreateApplicationDto } from 'src/applications/dto/create-application.dto';
import { UpdateApplicationDto } from 'src/applications/dto/update-application.dto';
import { UpdateJobStatusDto } from './dto/update-status.dto';
import { AntiSpamService } from '../anti-spam/anti-spam.service';
import {
  JobResponseDto,
  PaginatedJobResponseDto,
} from 'src/job-posting/dto/job-response.dto';
import { JobAdapter } from './adapters/job.adapter';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,

    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,

    @InjectRepository(SavedJob)
    private readonly savedJobRepository: Repository<SavedJob>,

    private readonly antiSpamService: AntiSpamService,

    @Inject(DataSource)
    private readonly dataSource: DataSource,
  ) {}

  async createJob(createJobDto: CreateJobDto): Promise<Job> {
    const job = this.jobRepository.create(createJobDto);
    const saved = await this.jobRepository.save(job);

    try {
      const jobForAnalysis = {
        ...saved,
        main: saved.description || '',
        isAcceptingApplications: saved.isAcceptingApplications,
        applications: [],
        recruiter: null,
        recruiterId: saved.recruiterId,
        freelancerts: [],
      } as any;

      const isSpam = await this.antiSpamService.analyzeJobPost(jobForAnalysis);
      if (isSpam) {
        console.warn(`Potential spam job detected: ${saved.id}`);
        saved.isFlagged = true;
        await this.jobRepository.save(saved);
      }
    } catch (error) {
      console.error('Anti-spam analysis failed:', error);
    }

    return saved;
  }

  async findAllJobs(includeDeleted = false): Promise<Job[]> {
    const options: any = { order: { createdAt: 'DESC' } };
    if (includeDeleted) options.withDeleted = true;
    return this.jobRepository.find(options);
  }

  async findJobById(id: number, includeDeleted = false): Promise<Job> {
    const options: any = { where: { id } };
    if (includeDeleted) options.withDeleted = true;

    const job = await this.jobRepository.findOne(options);
    if (!job) throw new NotFoundException(`Job with ID ${id} not found`);
    return job;
  }

  async updateJob(id: number, dto: UpdateJobDto, userId: string): Promise<Job> {
    const job = await this.findJobById(id);
    if (job.recruiterId !== userId)
      throw new ForbiddenException('Only the job owner can update this job');

    Object.assign(job, dto);
    return this.jobRepository.save(job);
  }

  async removeJob(id: number, userId: string): Promise<{ message: string }> {
    const job = await this.findJobById(id);
    if (job.recruiterId !== userId)
      throw new ForbiddenException('Only the job owner can delete this job');

    await this.jobRepository.softDelete(id);
    return { message: 'Job deleted successfully' };
  }

  async restoreJob(id: number, userId: string): Promise<{ message: string }> {
    const job = await this.findJobById(id, true);
    if (!job.deletedAt)
      throw new BadRequestException('Job is not deleted');

    if (job.recruiterId !== userId)
      throw new ForbiddenException('Only the job owner can restore this job');

    await this.jobRepository.restore(id);
    return { message: 'Job restored successfully' };
  }

  async createApplication(dto: CreateApplicationDto): Promise<Application> {
    const jobId = typeof dto.jobId === 'string' ? parseInt(dto.jobId, 10) : dto.jobId;
    const job = await this.jobRepository.findOne({ where: { id: jobId } });

    if (!job) throw new NotFoundException(`Job with ID ${dto.jobId} not found`);
    if (!job.isAcceptingApplications)
      throw new ForbiddenException('This job is not accepting applications.');

    const app = this.applicationRepository.create(dto);
    return this.applicationRepository.save(app);
  }

  async updateApplication(
    id: number,
    dto: UpdateApplicationDto,
  ): Promise<Application> {
    const application = await this.findApplicationById(id);
    Object.assign(application, dto);
    return this.applicationRepository.save(application);
  }

  async findApplicationById(id: number): Promise<Application> {
    const app = await this.applicationRepository.findOne({ where: { id: id.toString() } });
    if (!app) throw new NotFoundException(`Application with ID ${id} not found`);
    return app;
  }

  async removeApplication(id: number): Promise<{ message: string }> {
    const result = await this.applicationRepository.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Application with ID ${id} not found`);
    return { message: 'Application removed successfully' };
  }

  async updateJobStatus(
    id: number,
    dto: UpdateJobStatusDto,
    userId: string,
  ): Promise<Job> {
    const job = await this.findJobById(id);
    if (job.recruiterId !== userId)
      throw new ForbiddenException('Only the job owner can update the job status');

    job.status = dto.status;
    return this.jobRepository.save(job);
  }

  async toggleAcceptingApplications(
    jobId: number,
    isAccepting: boolean,
    userId: string,
  ): Promise<Job> {
    const job = await this.findJobById(jobId);
    if (job.recruiterId !== userId)
      throw new ForbiddenException('Only the job owner can update this setting');

    job.isAcceptingApplications = isAccepting;
    return this.jobRepository.save(job);
  }

  async toggleSaveJob(
    jobId: number,
    userId: string,
  ): Promise<{ saved: boolean }> {
    await this.findJobById(jobId);

    const existing = await this.savedJobRepository.findOne({
      where: { job: { id: jobId }, user: { id: userId } },
      relations: ['job', 'user'],
    });

    if (existing) {
      await this.savedJobRepository.remove(existing);
      return { saved: false };
    }

    const saved = this.savedJobRepository.create({
      job: { id: jobId },
      user: { id: userId },
    });
    await this.savedJobRepository.save(saved);
    return { saved: true };
  }

  async getSavedJobs(userId: string): Promise<Job[]> {
    const saved = await this.savedJobRepository.find({
      where: { user: { id: userId } },
      relations: ['job'],
      order: { savedAt: 'DESC' },
    });

    return saved.map((s) => s.job);
  }

  async isJobSaved(jobId: number, userId: string): Promise<boolean> {
    const saved = await this.savedJobRepository.findOne({
      where: { job: { id: jobId }, user: { id: userId } },
      relations: ['job', 'user'],
    });
    return !!saved;
  }

  async getWeeklyNewJobsCount(includeDeleted = false): Promise<{ week: string; count: number }[]> {
    const query = this.jobRepository
      .createQueryBuilder('job')
      .select(`TO_CHAR(DATE_TRUNC('week', job."createdAt"), 'YYYY-MM-DD')`, 'week')
      .addSelect('COUNT(*)', 'count')
      .groupBy('1')
      .orderBy('1', 'DESC');

    if (!includeDeleted) query.andWhere('job.deletedAt IS NULL');

    const raw = await query.getRawMany();
    return raw.map((r) => ({ week: r.week, count: parseInt(r.count, 10) }));
  }

  async getWeeklyNewApplicationsCount(): Promise<{ week: string; count: number }[]> {
    const raw = await this.applicationRepository
      .createQueryBuilder('application')
      .select(`TO_CHAR(DATE_TRUNC('week', application."createdAt"), 'YYYY-MM-DD')`, 'week')
      .addSelect('COUNT(*)', 'count')
      .groupBy('1')
      .orderBy('1', 'DESC')
      .getRawMany();

    return raw.map((r) => ({ week: r.week, count: parseInt(r.count, 10) }));
  }

  async getPaginatedJobs(
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
  ): Promise<PaginatedJobResponseDto> {
    const skip = (page - 1) * limit;
    const validSortFields: (keyof Job)[] = ['createdAt', 'title', 'budget', 'deadline', 'status'];

    const query = this.jobRepository.createQueryBuilder('job');
    if (validSortFields.includes(sortBy as keyof Job)) {
      query.orderBy(`job.${sortBy}`, 'DESC');
    } else {
      query.orderBy('job.createdAt', 'DESC');
    }

    const [jobs, total] = await query.skip(skip).take(limit).getManyAndCount();
    const converted = JobAdapter?.toJobPostingEntities
      ? JobAdapter.toJobPostingEntities(jobs)
      : jobs;

    return new PaginatedJobResponseDto(converted, total, page, limit);
  }

  async getSingleJobAsDto(id: number): Promise<JobResponseDto> {
    const job = await this.findJobById(id);
    const converted = JobAdapter?.toJobPostingEntity
      ? JobAdapter.toJobPostingEntity(job)
      : job;
    return new JobResponseDto(converted);
  }
}
