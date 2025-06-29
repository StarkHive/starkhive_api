import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, DataSource, Brackets } from 'typeorm';

import { Job } from 'src/job-posting/entities/job.entity';
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
import { SearchJobsDto, JobSortBy } from './dto/search-jobs.dto';
// import { JobAdapter } from './adapters/job.adapter'; // Uncomment if you create the adapter

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
    private dataSource: DataSource,
  ) {}

  async createJob(createJobDto: CreateJobDto): Promise<Job> {
    const job = this.jobRepository.create(createJobDto);
    const saved = await this.jobRepository.save(job);

    try {
      // Option 1: Using the adapter (if you create it)
      // const jobForAnalysis = JobAdapter.toJobsEntity(saved);

      // Option 2: Inline mapping (current approach)
      const jobForAnalysis = {
        ...saved,
        isFlagged: false,
        main: saved.description || '',
        isAcceptingApplications: saved.status === 'active',
        applications: [],
        ownerId: saved.contactEmail || '',
        recruiter: null,
        recruiterId: saved.contactEmail || '',
        freelancerts: [],
      } as any;

      const isSpam = await this.antiSpamService.analyzeJobPost(jobForAnalysis);
      if (isSpam) {
        // Handle spam detection
        console.warn(`Potential spam job detected: ${saved.id}`);
        // You might want to update the job status or flag it for review
        // saved.status = 'pending_review' as any;
        // await this.jobRepository.save(saved);
      }
    } catch (error) {
      console.error('Anti-spam analysis failed:', error);
    }

    return saved;
  }

  async findAllJobs(includeDeleted: boolean = false): Promise<Job[]> {
    const query = this.jobRepository.createQueryBuilder('job')
      .orderBy('job.createdAt', 'DESC');

    if (!includeDeleted) {
      query.andWhere('job.deletedAt IS NULL');
    }

    return query.getMany();
  }

  async findJobById(id: number, includeDeleted: boolean = false): Promise<Job> {
    const query = this.jobRepository.createQueryBuilder('job')
      .where('job.id = :id', { id });

    if (!includeDeleted) {
      query.andWhere('job.deletedAt IS NULL');
    }
    
    const job = await query.getOne();
    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }
    
    return job;
  }

  async updateJob(
    id: string,
    updateJobDto: UpdateJobDto,
    userId: string,
  ): Promise<Job> {
    const job = await this.findJobById(id);

    // Note: You'll need to check which field represents the owner in the job-posting entity
    // The second entity doesn't have ownerId, so you might need recruiterId or another field
    if (job.contactEmail !== userId) {
      // Adjust this condition based on your auth logic
      throw new ForbiddenException('Only the job owner can update this job');
    }

    Object.assign(job, updateJobDto);
    return this.jobRepository.save(job);
  }


  async removeJob(id: number, userId: number): Promise<{ message: string }> {
    const job = await this.findJobById(id);
    // Check if the user is the owner of the job
    if (job.ownerId !== userId) {
      throw new ForbiddenException('Only the job owner can delete this job');
    }
    
    // Soft delete the job using TypeORM's softDelete
    await this.jobRepository.softDelete(id);
    
    return { message: 'Job deleted successfully' };
  }
  
  async restoreJob(id: number, userId: number): Promise<{ message: string }> {
    const job = await this.jobRepository.findOne({
      where: { id },
      withDeleted: true
    });

    if (!job) {

      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    if (!job.deletedAt) {
      throw new NotFoundException('Job is not deleted');
    }
    
    // Check if the user is the owner of the job
    if (job.ownerId !== userId) {
      throw new ForbiddenException('Only the job owner can restore this job');
    }
    
    // Restore the job
    await this.jobRepository.restore(id);
    
    return { message: 'Job restored successfully' };
  }

  async createApplication(
    createApplicationDto: CreateApplicationDto,
  ): Promise<Application> {
    const job = await this.jobRepository.findOne({
      where: { id: createApplicationDto.jobId },
    });
    if (!job) {
      throw new NotFoundException(
        `Job with ID ${createApplicationDto.jobId} not found`,
      );
    }
    // Note: The job-posting entity doesn't have isAcceptingApplications
    // You might need to check job.status instead
    if (job.status !== 'active') {
      throw new ForbiddenException('This job is not accepting applications.');
    }

    const application = this.applicationRepository.create(createApplicationDto);
    return this.applicationRepository.save(application);
  }

  async findApplicationById(id: number): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id: id.toString() },
    });
    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }
    return application;
  }

  async updateApplication(
    id: number,
    updateApplicationDto: UpdateApplicationDto,
  ): Promise<Application> {
    const application = await this.findApplicationById(id);
    Object.assign(application, updateApplicationDto);
    return this.applicationRepository.save(application);
  }

  async removeApplication(id: number): Promise<{ message: string }> {
    const result = await this.applicationRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }
    return { message: 'Application removed successfully' };
  }


  // Weekly analytics for jobs
  async getWeeklyNewJobsCount(includeDeleted: boolean = false): Promise<Array<{ week: string; count: number }>> {
    const query = this.jobRepository

      .createQueryBuilder('job')
      .select(
        `TO_CHAR(DATE_TRUNC('week', job."createdAt"), 'YYYY-MM-DD')`,
        'week',
      )
      .addSelect('COUNT(*)', 'count')
      .groupBy('1')
      .orderBy('1', 'DESC');
      
    if (!includeDeleted) {
      query.andWhere('job.deletedAt IS NULL');
    }
    
    const raw = await query.getRawMany<{ week: string; count: string }>();

    return raw.map((r) => ({
      week: r.week,
      count: parseInt(r.count, 10),
    }));
  }

  async getWeeklyNewApplicationsCount(): Promise<
    Array<{ week: string; count: number }>
  > {
    const raw = await this.applicationRepository
      .createQueryBuilder('application')
      .select(
        `TO_CHAR(DATE_TRUNC('week', application."createdAt"), 'YYYY-MM-DD')`,
        'week',
      )
      .addSelect('COUNT(*)', 'count')
      .groupBy(`DATE_TRUNC('week', application."createdAt")`)
      .orderBy(`DATE_TRUNC('week', application."createdAt")`, 'DESC')
      .getRawMany<{ week: string; count: string }>();

    return raw.map((r) => ({
      week: r.week,
      count: parseInt(r.count, 10),
    }));
  }

  async updateJobStatus(
    id: string,
    updateStatusDto: UpdateJobStatusDto,
    userId: string,
  ): Promise<Job> {
    const job = await this.findJobById(id);
    // Note: Adjust this condition based on your ownership logic for the job-posting entity
    if (job.contactEmail !== userId) {
      throw new ForbiddenException(
        'Only the job owner can update the job status',
      );
    }

    // Map the status to match the Job entity's JobStatus enum
    // You'll need to adjust this based on your actual JobStatus enum
    job.status = updateStatusDto.status as any; // Type assertion for now
    return this.jobRepository.save(job);
  }

  async toggleAcceptingApplications(
    jobId: string,
    isAccepting: boolean,
    userId: string,
  ): Promise<Job> {
    const job = await this.findJobById(jobId);
    // Note: Adjust this condition based on your ownership logic
    if (job.contactEmail !== userId) {
      throw new ForbiddenException(
        'Only the job owner can update this setting',
      );
    }

    // Use the correct JobStatus enum values
    // You'll need to import and use the correct JobStatus enum
    job.status = isAccepting ? ('active' as any) : ('inactive' as any);
    return this.jobRepository.save(job);
  }

  async toggleSaveJob(
    jobId: string,
    userId: string,
  ): Promise<{ saved: boolean }> {
    await this.findJobById(jobId); // Verify job exists

    const existingSavedJob = await this.savedJobRepository.findOne({
      where: {
        job: { id: jobId } as any,
        user: { id: userId } as any,
      },
      relations: ['job', 'user'],
    });

    if (existingSavedJob) {
      await this.savedJobRepository.remove(existingSavedJob);
      return { saved: false };
    }

    const savedJob = this.savedJobRepository.create({
      job: { id: jobId } as any,
      user: { id: userId } as any,
    });
    await this.savedJobRepository.save(savedJob);
    return { saved: true };
  }

  async getSavedJobs(userId: string): Promise<Job[]> {
    const savedJobs = await this.savedJobRepository.find({
      where: { user: { id: userId } as any },
      relations: ['job'],
      order: { savedAt: 'DESC' },
    });

    // Convert SavedJob.job (jobs entity) to Job (job-posting entity)
    return savedJobs.map((savedJob) => savedJob.job as unknown as Job);
  }

  async isJobSaved(jobId: string, userId: string): Promise<boolean> {
    const savedJob = await this.savedJobRepository.findOne({
      where: {
        job: { id: jobId } as any,
        user: { id: userId } as any,
      },
      relations: ['job', 'user'],
    });
    return !!savedJob;
  }

  // Fixed paginated job list method
  async getPaginatedJobs(
    page?: number,
    limit?: number,
    sortBy?: string,
  ): Promise<PaginatedJobResponseDto> {
    const safePage = Number(page) || 1;
    const safeLimit = Number(limit) || 10;
    const skip = (safePage - 1) * safeLimit;

    const validSortFields: (keyof Job)[] = [
      'createdAt',
      'title',
      'company',
      'location',
      'salaryMin',
      'salaryMax',
    ];
    const query = this.jobRepository.createQueryBuilder('job');

    // Fixed: Check if sortBy exists and is valid before using it
    if (sortBy && validSortFields.includes(sortBy as keyof Job)) {
      query.orderBy(`job.${sortBy}`, 'DESC');
    } else {
      // Default sort by createdAt if no valid sortBy provided
      query.orderBy('job.createdAt', 'DESC');
    }

    const [jobs, total] = await query
      .skip(skip)
      .take(safeLimit)
      .getManyAndCount();

    // Fixed: Use safePage and safeLimit instead of potentially undefined values
    return new PaginatedJobResponseDto(jobs, total, safePage, safeLimit);
  }

  async getSingleJobAsDto(id: string): Promise<JobResponseDto> {
    const job = await this.findJobById(id);
    return new JobResponseDto(job);
  }

  /**
   * Advanced job search with full-text, filtering, sorting, and pagination
   */
  async advancedSearchJobs(dto: SearchJobsDto): Promise<PaginatedJobResponseDto> {
    const {
      q,
      minBudget,
      maxBudget,
      deadlineFrom,
      deadlineTo,
      location,
      jobType,
      status,
      experienceLevel,
      skills,
      sortBy = JobSortBy.DATE,
      page = 1,
      limit = 10,
    } = dto;
    const skip = (page - 1) * limit;

    const query = this.jobRepository.createQueryBuilder('job');

    // Only active jobs by default
    if (!status) {
      query.andWhere('job.status = :active', { active: 'active' });
    } else {
      query.andWhere('job.status = :status', { status });
    }

    // Full-text search (title, description, skills)
    if (q) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('job.title ILIKE :q', { q: `%${q}%` })
            .orWhere('job.description ILIKE :q', { q: `%${q}%` })
            .orWhere(`:q = ANY(job.skills)`, { q });
        })
      );
    }

    // Budget filtering
    if (minBudget !== undefined) {
      query.andWhere('(job.salaryMin IS NULL OR job.salaryMin >= :minBudget)', { minBudget });
    }
    if (maxBudget !== undefined) {
      query.andWhere('(job.salaryMax IS NULL OR job.salaryMax <= :maxBudget)', { maxBudget });
    }

    // Deadline filtering
    if (deadlineFrom) {
      query.andWhere('(job.applicationDeadline IS NULL OR job.applicationDeadline >= :deadlineFrom)', { deadlineFrom });
    }
    if (deadlineTo) {
      query.andWhere('(job.applicationDeadline IS NULL OR job.applicationDeadline <= :deadlineTo)', { deadlineTo });
    }

    // Location filtering (partial match)
    if (location) {
      query.andWhere('job.location ILIKE :location', { location: `%${location}%` });
    }

    // Job type, experience, skills
    if (jobType) {
      query.andWhere('job.jobType = :jobType', { jobType });
    }
    if (experienceLevel) {
      query.andWhere('job.experienceLevel = :experienceLevel', { experienceLevel });
    }
    if (skills && skills.length > 0) {
      for (const skill of skills) {
        query.andWhere(`:skill = ANY(job.skills)`, { skill });
      }
    }

    // Sorting
    if (sortBy === JobSortBy.BUDGET) {
      query.orderBy('job.salaryMax', 'DESC');
    } else if (sortBy === JobSortBy.RELEVANCE && q) {
      // For now, fallback to title match; for real relevance, use Postgres full-text search
      query.orderBy('job.title', 'DESC');
    } else {
      query.orderBy('job.createdAt', 'DESC');
    }

    // Pagination
    query.skip(skip).take(limit);

    // Select only needed fields (optional for optimization)
    // query.select(['job.id', 'job.title', ...]);

    const [jobs, total] = await query.getManyAndCount();
    return new PaginatedJobResponseDto(jobs, total, page, limit);
  }
}
