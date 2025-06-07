import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Job } from './entities/job.entity';
import { Application } from 'src/applications/entities/application.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { CreateApplicationDto } from 'src/applications/dto/create-application.dto'; 
import { UpdateApplicationDto } from 'src/applications/dto/update-application.dto';
import { UpdateJobStatusDto } from './dto/update-status.dto';

import { AntiSpamService } from '../anti-spam/anti-spam.service';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,

    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,

    private readonly antiSpamService: AntiSpamService,
  ) {}

  // Job CRUD with anti-spam check on create
  async createJob(createJobDto: CreateJobDto): Promise<Job> {
    const job = this.jobRepository.create(createJobDto);
    const saved = await this.jobRepository.save(job);

    const isSpam = await this.antiSpamService.analyzeJobPost(saved);
    if (isSpam) {
      saved.isFlagged = true;
      await this.jobRepository.save(saved);
    }

    return saved;
  }

  async findAllJobs(): Promise<Job[]> {
    return this.jobRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findJobById(id: number): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }
    return job;
  }

  async updateJob(id: number, updateJobDto: UpdateJobDto, userId: number): Promise<Job> {
    const job = await this.findJobById(id);
    
    // Check if the user is the owner of the job
    if (job.ownerId !== userId) {
      throw new ForbiddenException('Only the job owner can update this job');
    }
    
    // Update only the provided fields
    Object.assign(job, updateJobDto);
    
    // Save the updated job
    return this.jobRepository.save(job);
  }

  async removeJob(id: number): Promise<{ message: string }> {
    const result = await this.jobRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }
    return { message: 'Job removed successfully' };
  }

  // Application CRUD
  async createApplication(createApplicationDto: CreateApplicationDto): Promise<Application> {
    // Check if job is accepting applications
    const job = await this.jobRepository.findOne({ where: { id: Number(createApplicationDto.jobId) } });
    if (!job) {
      throw new NotFoundException(`Job with ID ${createApplicationDto.jobId} not found`);
    }
    if (!job.isAcceptingApplications) {
      throw new ForbiddenException('This job is not accepting applications.');
    }
    const application = this.applicationRepository.create(createApplicationDto);
    return this.applicationRepository.save(application);
  }

  async findAllApplications(): Promise<Application[]> {
    return this.applicationRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findApplicationById(id: number): Promise<Application> {
    const application = await this.applicationRepository.findOne({ where: { id: id.toString() } });
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
  async getWeeklyNewJobsCount(): Promise<Array<{ week: string; count: number }>> {
    const raw = await this.jobRepository
      .createQueryBuilder('job')
      .select(`TO_CHAR(DATE_TRUNC('week', job."createdAt"), 'YYYY-MM-DD')`, 'week')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`DATE_TRUNC('week', job."createdAt")`)
      .orderBy(`DATE_TRUNC('week', job."createdAt")`, 'DESC')
      .getRawMany<{ week: string; count: string }>();

    return raw.map(r => ({
      week: r.week,
      count: parseInt(r.count, 10),
    }));
  }

  // Weekly analytics for applications
  async getWeeklyNewApplicationsCount(): Promise<Array<{ week: string; count: number }>> {
    const raw = await this.applicationRepository
      .createQueryBuilder('application')
      .select(`TO_CHAR(DATE_TRUNC('week', application."createdAt"), 'YYYY-MM-DD')`, 'week')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`DATE_TRUNC('week', application."createdAt")`)
      .orderBy(`DATE_TRUNC('week', application."createdAt")`, 'DESC')
      .getRawMany<{ week: string; count: string }>();

    return raw.map(r => ({
      week: r.week,
      count: parseInt(r.count, 10),
    }));
  }

  async updateJobStatus(id: number, updateStatusDto: UpdateJobStatusDto, userId: number): Promise<Job> {
    const job = await this.findJobById(id);
    
    // TODO: Add proper user ownership check once user system is implemented
    // For now, we'll just throw a placeholder error
    if (job.ownerId !== userId) {
      throw new ForbiddenException('Only the job owner can update the job status');
    }

    job.status = updateStatusDto.status;
    return this.jobRepository.save(job);
  }

  // Toggle isAcceptingApplications for a job
  async toggleAcceptingApplications(jobId: number, isAccepting: boolean, userId: number): Promise<Job> {
    const job = await this.findJobById(jobId);
    if (job.ownerId !== userId) {
      throw new ForbiddenException('Only the job owner can update this setting');
    }
    job.isAcceptingApplications = isAccepting;
    return this.jobRepository.save(job);
  }
}