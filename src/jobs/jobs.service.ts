import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  Brackets,
  LessThan,
  MoreThanOrEqual,
  LessThanOrEqual,
  Between,
} from 'typeorm';
import { CompletionStatus, Job, ExperienceLevel } from './entities/job.entity';
import { Escrow, EscrowStatus } from './entities/escrow.entity';
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
import { JobTemplate } from './entities/job-template.entity';
import {
  CreateJobFromTemplateDto,
  CreateTemplateDto,
  UpdateTemplateDto,
} from './dto/job-template.dto';
import { BlockchainService } from './blockchain/blockchain.service';
import { CurrencyConversionService } from './services/currency-conversion.service';
import { User } from '../auth/entities/user.entity';
import { JobStatus } from 'src/feed/enums/job-status.enum';
import { CreateEscrowDto } from './dto/initiate-payment.dto';
import { ReleaseEscrowDto } from './dto/release-payment.dto';
import { ExtendJobDto } from './dto/extend-job.dto';
import { JobAdapter } from './adapters/job.adapter';
import { PaginationDto } from './dto/pagination.dto';

@Injectable()
export class JobsService {
  logger: any;
  mailerService: any;

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,

    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,

    @InjectRepository(SavedJob)
    private readonly savedJobRepository: Repository<SavedJob>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly antiSpamService: AntiSpamService,

    @InjectRepository(JobTemplate)
    private readonly templateRepository: Repository<JobTemplate>,

    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,

    @InjectDataSource()
    private readonly dataSource: DataSource,

    private readonly blockchainService: BlockchainService,
    private readonly currencyConversionService: CurrencyConversionService,
  ) {}

  async findAll(
    paginationDto?: PaginationDto,
  ): Promise<PaginatedJobResponseDto> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      location,
      company,
      jobType,
      experienceLevel,
      salaryMin,
      salaryMax,
      isRemote,
      isUrgent,
      isFeatured,
      skills,
    } = paginationDto || {};

    const skip = (page - 1) * limit;

    const query = this.jobRepository.createQueryBuilder('job');

    // Only show open/active jobs for public access
    query.where('job.status IN (:...activeStatuses)', {
      activeStatuses: [JobStatus.OPEN, JobStatus.ACTIVE],
    });

    // Only show jobs that are accepting applications
    query.andWhere('job.isAcceptingApplications = :isAccepting', {
      isAccepting: true,
    });

    // Apply filters
    if (search) {
      query.andWhere(
        '(job.title ILIKE :search OR job.description ILIKE :search OR job.company ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (location) {
      query.andWhere('job.location ILIKE :location', {
        location: `%${location}%`,
      });
    }

    if (company) {
      query.andWhere('job.company ILIKE :company', {
        company: `%${company}%`,
      });
    }

    if (jobType) {
      query.andWhere('job.jobType = :jobType', { jobType });
    }

    if (experienceLevel) {
      query.andWhere('job.experienceLevel = :experienceLevel', {
        experienceLevel,
      });
    }

    if (salaryMin !== undefined) {
      query.andWhere('job.salaryMax >= :salaryMin', { salaryMin });
    }

    if (salaryMax !== undefined) {
      query.andWhere('job.salaryMin <= :salaryMax', { salaryMax });
    }

    if (isRemote !== undefined) {
      query.andWhere('job.isRemote = :isRemote', { isRemote });
    }

    if (isUrgent !== undefined) {
      query.andWhere('job.isUrgent = :isUrgent', { isUrgent });
    }

    if (isFeatured !== undefined) {
      query.andWhere('job.isFeatured = :isFeatured', { isFeatured });
    }

    if (skills) {
      // Split skills by comma and search for any of them
      const skillsArray = skills.split(',').map((skill) => skill.trim());
      query.andWhere('job.skills && :skills', { skills: skillsArray });
    }

    // Apply sorting - default to newest first (createdAt DESC)
    const sortDirection = sortOrder.toUpperCase() as 'ASC' | 'DESC';
    query.orderBy(`job.${sortBy}`, sortDirection);

    // Apply pagination
    query.skip(skip).take(limit);

    const [jobs, total] = await query.getManyAndCount();

    // Convert jobs using adapter to ensure proper response format
    const convertedJobs = jobs.map((job) => JobAdapter.toJobPostingEntity(job));

    return new PaginatedJobResponseDto(
      convertedJobs as any,
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id: parseInt(id, 10) },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async initiateEscrowPayment(dto: CreateEscrowDto): Promise<Escrow> {
    const job = await this.jobRepository.findOne({
      where: { id: parseInt(dto.jobId, 10) },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.escrowId)
      throw new BadRequestException('Escrow already initiated for this job');

    const recruiter = await this.userRepository.findOne({
      where: { id: job.recruiterId },
    });
    if (!recruiter?.walletAddress)
      throw new BadRequestException('Recruiter wallet address not found');

    const balance = await this.blockchainService.getTokenBalance(
      recruiter.walletAddress,
      dto.currency,
    );

    if (balance < dto.amount)
      throw new BadRequestException('Insufficient funds for escrow deposit');

    await this.blockchainService.lockFunds(
      recruiter.walletAddress,
      dto.currency,
      dto.amount,
    );

    const escrow = this.escrowRepository.create({
      job,
      freelancerId: dto.freelancerId,
      amount: dto.amount,
      currency: dto.currency,
      status: EscrowStatus.LOCKED,
      lockedAt: new Date(),
    });

    const savedEscrow = await this.escrowRepository.save(escrow);
    job.escrowId = savedEscrow.id;
    await this.jobRepository.save(job);
    return savedEscrow;
  }

  async releaseEscrowPayment(dto: ReleaseEscrowDto): Promise<Escrow> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: dto.escrowId },
      relations: ['job'],
    });

    if (!escrow || escrow.status !== EscrowStatus.LOCKED)
      throw new BadRequestException('Escrow not in a valid state for release');

    const freelancer = await this.userRepository.findOne({
      where: { id: escrow.freelancerId },
    });

    if (!freelancer?.walletAddress)
      throw new BadRequestException('Freelancer wallet address missing');

    await this.blockchainService.releaseFunds(
      freelancer.walletAddress,
      escrow.currency,
      escrow.amount,
    );

    escrow.status = EscrowStatus.RELEASED;
    escrow.releasedAt = new Date();
    escrow.job.paymentReleased = true;
    await this.jobRepository.save(escrow.job);
    return this.escrowRepository.save(escrow);
  }

  async handleDispute(escrowId: string, reason: string): Promise<Escrow> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');

    escrow.status = EscrowStatus.DISPUTED;
    escrow.disputeReason = reason;
    escrow.disputedAt = new Date();

    return this.escrowRepository.save(escrow);
  }

  // Alias methods for controller compatibility
  async initiateEscrow(dto: CreateEscrowDto): Promise<Escrow> {
    return this.initiateEscrowPayment(dto);
  }

  async releaseEscrow(escrowId: string): Promise<Escrow> {
    const dto: ReleaseEscrowDto = { escrowId, releasedBy: 'system' };
    return this.releaseEscrowPayment(dto);
  }

  async markEscrowAsDisputed(escrowId: string): Promise<Escrow> {
    return this.handleDispute(escrowId, 'Disputed by user');
  }

  async createJob(createJobDto: CreateJobDto): Promise<Job> {
    if (
      createJobDto.currency &&
      createJobDto.budget &&
      createJobDto.recruiterId
    ) {
      const recruiterRaw = await this.userRepository.findOne({
        where: { id: createJobDto.recruiterId as string },
      });
      if (!recruiterRaw) {
        throw new BadRequestException('Recruiter wallet address not found.');
      }
      const balance = await this.blockchainService.getTokenBalance(
        recruiterRaw.walletAddress!,
        createJobDto.currency,
      );
      if (balance < createJobDto.budget) {
        throw new BadRequestException(
          `Insufficient ${createJobDto.currency} balance to post this job. Required: ${createJobDto.budget}, Available: ${balance}`,
        );
      }
    }
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
      } as unknown as Job;

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
    const options: { order: { createdAt: 'DESC' }; withDeleted?: boolean } = {
      order: { createdAt: 'DESC' },
    };
    if (includeDeleted) options.withDeleted = true;
    return this.jobRepository.find(options);
  }

  async findJobById(id: number, includeDeleted = false): Promise<Job> {
    const options: { where: { id: number }; withDeleted?: boolean } = {
      where: { id },
    };
    if (includeDeleted) options.withDeleted = true;
    const job = await this.jobRepository.findOne(options);
    if (!job) throw new NotFoundException(`Job with ID ${id} not found`);
    return job;
  }

  async updateJob(id: number, dto: UpdateJobDto, userId: string): Promise<Job> {
    const job = await this.findJobById(id);
    if (String(job.recruiterId) !== String(userId)) {
      throw new ForbiddenException('Only the job owner can update this job');
    }
    Object.assign(job, dto);
    return this.jobRepository.save(job);
  }

  async removeJob(id: number, userId: string): Promise<{ message: string }> {
    const job = await this.findJobById(id);
    if (String(job.recruiterId) !== String(userId))
      throw new ForbiddenException('Only the job owner can delete this job');
    await this.jobRepository.softDelete(id);
    return { message: 'Job deleted successfully' };
  }

  async restoreJob(id: number, userId: string): Promise<{ message: string }> {
    const job = await this.findJobById(id, true);
    if (!job.deletedAt) throw new BadRequestException('Job is not deleted');
    if (String(job.recruiterId) !== String(userId))
      throw new ForbiddenException('Only the job owner can restore this job');
    await this.jobRepository.restore(id);
    return { message: 'Job restored successfully' };
  }

  async createApplication(
    createApplicationDto: CreateApplicationDto,
  ): Promise<Application> {
    const jobId =
      typeof createApplicationDto.jobId === 'string'
        ? parseInt(createApplicationDto.jobId, 10)
        : createApplicationDto.jobId;

    const job = await this.jobRepository.findOne({
      where: { id: jobId },
    });
    if (!job) {
      throw new NotFoundException(
        `Job with ID ${createApplicationDto.jobId} not found`,
      );
    }

    if (!job.isAcceptingApplications) {
      throw new ForbiddenException('This job is not accepting applications.');
    }

    const application = this.applicationRepository.create(createApplicationDto);
    const savedApplication = await this.applicationRepository.save(application);

    await this.jobRepository.increment({ id: jobId }, 'applicationCount', 1);

    return savedApplication;
  }

  async findApplicationById(id: number): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id: String(id) },
    });
    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }
    return application;
  }

  async updateApplication(
    id: number,
    dto: UpdateApplicationDto,
  ): Promise<Application> {
    const application = await this.findApplicationById(id);
    Object.assign(application, dto);
    return this.applicationRepository.save(application);
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

    if (String(job.recruiterId) !== String(userId)) {
      throw new ForbiddenException(
        'Only the job owner can update the job status',
      );
    }

    job.status = dto.status;
    return this.jobRepository.save(job);
  }

  async toggleAcceptingApplications(
    jobId: number,
    isAccepting: boolean,
    userId: string,
  ): Promise<Job> {
    const job = await this.findJobById(jobId);

    if (String(job.recruiterId) !== String(userId)) {
      throw new ForbiddenException(
        'Only the job owner can update this setting',
      );
    }
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

  async incrementViewCount(jobId: number): Promise<void> {
    await this.jobRepository.increment({ id: jobId }, 'viewCount', 1);
  }

  async getPaginatedJobs(
    page = 1,
    limit = 10,
    sortBy: keyof Job = 'createdAt',
    filters?: {
      status?: JobStatus;
      jobType?: string;
      location?: string;
      isRemote?: boolean;
      salaryMin?: number;
      salaryMax?: number;
    },
  ): Promise<PaginatedJobResponseDto> {
    const safePage = Number(page) || 1;
    const safeLimit = Number(limit) || 10;
    const skip = (safePage - 1) * safeLimit;

    const validSortFields: (keyof Job)[] = [
      'createdAt',
      'title',
      'budget',
      'deadline',
      'status',
      'viewCount',
      'applicationCount',
      'salaryMin',
      'salaryMax',
    ];

    const query = this.jobRepository.createQueryBuilder('job');

    if (filters) {
      if (filters.status) {
        query.andWhere('job.status = :status', { status: filters.status });
      }
      if (filters.jobType) {
        query.andWhere('job.jobType = :jobType', { jobType: filters.jobType });
      }
      if (filters.location) {
        query.andWhere('job.location ILIKE :location', {
          location: `%${filters.location}%`,
        });
      }
      if (filters.isRemote !== undefined) {
        query.andWhere('job.isRemote = :isRemote', {
          isRemote: filters.isRemote,
        });
      }
      if (typeof filters.salaryMin === 'number') {
        query.andWhere('job.salaryMin >= :salaryMin', {
          salaryMin: filters.salaryMin,
        });
      }
      if (typeof filters.salaryMax === 'number') {
        query.andWhere('job.salaryMax <= :salaryMax', {
          salaryMax: filters.salaryMax,
        });
      }
    }

    if (sortBy && validSortFields.includes(sortBy as keyof Job)) {
      query.orderBy(`job.${sortBy}`, 'DESC');
    } else {
      query.orderBy('job.createdAt', 'DESC');
    }

    const [jobs, total] = await query
      .skip(skip)
      .take(safeLimit)
      .getManyAndCount();

    const adaptedJobs = jobs.map((job) => JobAdapter.toJobPostingEntity(job));
    return new PaginatedJobResponseDto(
      adaptedJobs as any,
      total,
      safePage,
      safeLimit,
    );
  }

  async getSingleJobAsDto(id: number): Promise<JobResponseDto> {
    const job = await this.findJobById(id);
    await this.incrementViewCount(id);
    // const convertedJob = JobAdapter?.toJobPostingEntity
    //   ? JobAdapter.toJobPostingEntity(job)
    //   : job;
    return JobAdapter.toJobPostingEntity(job);
  }

  // Template methods remain the same
  async createTemplate(
    createTemplateDto: CreateTemplateDto,
  ): Promise<JobTemplate> {
    const template = this.templateRepository.create(createTemplateDto);
    return await this.templateRepository.save(template);
  }

  async findAllTemplates(
    userId: string,
    category?: string,
    tags?: string[],
    includeShared = true,
  ): Promise<JobTemplate[]> {
    const query = this.templateRepository.createQueryBuilder('template');

    if (includeShared) {
      query.where(
        'template.createdBy = :userId OR template.isShared = :isShared',
        { userId, isShared: true },
      );
    } else {
      query.where('template.createdBy = :userId', { userId });
    }

    if (category) {
      query.andWhere('template.category = :category', { category });
    }

    if (tags && tags.length > 0) {
      query.andWhere('template.tags && :tags', { tags });
    }

    query
      .orderBy('template.lastUsedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('template.createdAt', 'DESC');

    return await query.getMany();
  }

  async findTemplateById(id: string, userId: string): Promise<JobTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.createdBy !== userId && !template.isShared) {
      throw new NotFoundException('Template not found or access denied');
    }

    return template;
  }

  async updateTemplate(
    id: string,
    updateTemplateDto: UpdateTemplateDto,
    userId: string,
  ): Promise<JobTemplate> {
    const template = await this.findTemplateById(id, userId);

    if (template.createdBy !== userId) {
      throw new BadRequestException('Only the template creator can update it');
    }

    Object.assign(template, updateTemplateDto);
    return await this.templateRepository.save(template);
  }

  async deleteTemplate(id: string, userId: string): Promise<void> {
    const template = await this.findTemplateById(id, userId);

    if (template.createdBy !== userId) {
      throw new BadRequestException('Only the template creator can delete it');
    }

    await this.templateRepository.remove(template);
  }

  async getTemplateCategories(userId: string): Promise<string[]> {
    const result = await this.templateRepository
      .createQueryBuilder('template')
      .select('DISTINCT template.category', 'category')
      .where('template.createdBy = :userId OR template.isShared = true', {
        userId,
      })
      .andWhere('template.category IS NOT NULL')
      .getRawMany();

    return (result as { category: string }[])
      .map((r) => r.category)
      .filter(Boolean);
  }

  async getTemplateTags(userId: string): Promise<string[]> {
    const templates = await this.templateRepository.find({
      where: [{ createdBy: userId }, { isShared: true }],
      select: ['tags'],
    });

    const allTags = templates.flatMap((t) => t.tags || []);
    return [...new Set(allTags)].sort();
  }

  async createJobFromTemplate(
    createJobFromTemplateDto: CreateJobFromTemplateDto,
    userId: string,
  ): Promise<Job> {
    const { templateId, ...overrides } = createJobFromTemplateDto;

    const template = await this.findTemplateById(templateId, userId);

    const jobData: Partial<Job> = {
      title: overrides.title || template.title,
      description: overrides.description || template.jobDescription,
      company: template.company,
      location: overrides.location || template.location,
      jobType: template.jobType,
      experienceLevel: template.experienceLevel,
      salaryMin: template.salaryMin,
      salaryMax: template.salaryMax,
      salaryCurrency: template.salaryCurrency,
      requirements: template.requirements || [],
      responsibilities: template.responsibilities || [],
      benefits: template.benefits || [],
      skills: template.skills || [],
      contactEmail: overrides.contactEmail || template.contactEmail,
      contactPhone: overrides.contactPhone || template.contactPhone,
      applicationDeadline: overrides.applicationDeadline,
      isUrgent: overrides.isUrgent ?? false,
      isFeatured: overrides.isFeatured ?? false,
      status: JobStatus.CLOSED,
      recruiterId: userId,
      ownerId: userId,
      viewCount: 0,
      applicationCount: 0,
      completionStatus: CompletionStatus.NOT_SUBMITTED,
      paymentReleased: false,
      isAcceptingApplications: true,
      isRemote: template.isRemote ?? false,
      isFlagged: false,
    };

    const job = this.jobRepository.create(jobData);
    const savedJob = await this.jobRepository.save(job);

    await this.updateTemplateUsage(templateId);

    return savedJob;
  }

  private async updateTemplateUsage(templateId: string): Promise<void> {
    await this.templateRepository
      .createQueryBuilder()
      .update(JobTemplate)
      .set({
        useCount: () => '"useCount" + 1',
        lastUsedAt: new Date(),
      })
      .where('id = :templateId', { templateId })
      .execute();
  }

  async shareTemplate(
    templateId: string,
    userId: string,
  ): Promise<JobTemplate> {
    const template = await this.findTemplateById(templateId, userId);

    if (template.createdBy !== userId) {
      throw new BadRequestException('Only the template creator can share it');
    }

    template.isShared = true;
    return await this.templateRepository.save(template);
  }

  async unshareTemplate(
    templateId: string,
    userId: string,
  ): Promise<JobTemplate> {
    const template = await this.findTemplateById(templateId, userId);

    if (template.createdBy !== userId) {
      throw new BadRequestException('Only the template creator can unshare it');
    }

    template.isShared = false;
    return await this.templateRepository.save(template);
  }

  async getTemplateStats(userId: string): Promise<any> {
    const stats = (await this.templateRepository
      .createQueryBuilder('template')
      .select([
        'COUNT(*) as total_templates',
        'COUNT(CASE WHEN template.isShared = true THEN 1 END) as shared_templates',
        'SUM(template.useCount) as total_uses',
        'AVG(template.useCount) as avg_uses_per_template',
      ])
      .where('template.createdBy = :userId', { userId })
      .getRawOne()) as {
      total_templates: number;
      shared_templates: number;
      total_uses: number;
      avg_uses_per_template: number;
    };

    const mostUsedTemplates = await this.templateRepository.find({
      where: { createdBy: userId },
      order: { useCount: 'DESC', lastUsedAt: 'DESC' },
      take: 5,
      select: ['id', 'name', 'useCount', 'lastUsedAt'],
    });

    return {
      ...stats,
      most_used_templates: mostUsedTemplates,
    };
  }

  async getJobsByStatus(status: JobStatus, userId?: string): Promise<Job[]> {
    const query = this.jobRepository
      .createQueryBuilder('job')
      .where('job.status = :status', { status });

    if (userId) {
      query.andWhere('job.recruiterId = :userId', { userId });
    }

    return await query.getMany();
  }

  async getJobsByExperienceLevel(
    experienceLevel: string,
    limit = 10,
  ): Promise<Job[]> {
    return await this.jobRepository.find({
      where: { experienceLevel: experienceLevel as ExperienceLevel },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getFeaturedJobs(limit = 5): Promise<Job[]> {
    return await this.jobRepository.find({
      where: { isFeatured: true, status: JobStatus.OPEN },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getUrgentJobs(limit = 10): Promise<Job[]> {
    return await this.jobRepository.find({
      where: { isUrgent: true, status: JobStatus.OPEN },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async advancedSearchJobs(
    dto: SearchJobsDto,
  ): Promise<PaginatedJobResponseDto> {
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
      sortBy = JobSortBy.DATE,
      page = 1,
      limit = 10,
    } = dto;
    const skip = (page - 1) * limit;
    const query = this.jobRepository.createQueryBuilder('job');
    if (!status) {
      query.andWhere('job.status = :active', { active: 'active' });
    } else {
      query.andWhere('job.status = :status', { status });
    }
    if (q) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('job.title ILIKE :q', { q: `%${q}%` }).orWhere(
            'job.description ILIKE :q',
            { q: `%${q}%` },
          );
        }),
      );
    }
    if (typeof minBudget === 'number') {
      query.andWhere('(job.budget IS NULL OR job.budget >= :minBudget)', {
        minBudget,
      });
    }
    if (typeof maxBudget === 'number') {
      query.andWhere('(job.budget IS NULL OR job.budget <= :maxBudget)', {
        maxBudget,
      });
    }
    if (deadlineFrom) {
      query.andWhere(
        '(job.deadline IS NULL OR job.deadline >= :deadlineFrom)',
        { deadlineFrom },
      );
    }
    if (deadlineTo) {
      query.andWhere('(job.deadline IS NULL OR job.deadline <= :deadlineTo)', {
        deadlineTo,
      });
    }
    if (location) {
      query.andWhere('job.location ILIKE :location', {
        location: `%${location}%`,
      });
    }
    if (jobType) {
      query.andWhere('job.jobType = :jobType', { jobType });
    }
    if (experienceLevel) {
      query.andWhere('job.experienceLevel = :experienceLevel', {
        experienceLevel,
      });
    }
    // Skills filter omitted unless present in entity
    if (sortBy === JobSortBy.BUDGET) {
      query.orderBy('job.budget', 'DESC');
    } else if (sortBy === JobSortBy.RELEVANCE && q) {
      query
        .addSelect(
          `ts_rank(to_tsvector('english', job.title || ' ' || job.description), plainto_tsquery('english', :q))`,
          'relevance',
        )
        .orderBy('relevance', 'DESC');
    } else {
      query.orderBy('job.createdAt', 'DESC');
    }
    query.skip(skip).take(limit);
    const [jobs, total] = await query.getManyAndCount();
    const adaptedJobs = jobs.map((job) => JobAdapter.toJobPostingEntity(job));
    return new PaginatedJobResponseDto(adaptedJobs as any, total, page, limit);
  }

  async findExpiredJobs(): Promise<Job[]> {
    const now = new Date();
    return this.jobRepository.find({
      where: {
        deadline: LessThan(now),
        status: JobStatus.ACTIVE,
      },
      relations: ['employer'],
    });
  }

  async findJobsExpiringIn(days: number): Promise<Job[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const now = new Date();

    return this.jobRepository.find({
      where: {
        deadline: Between(now, futureDate),
        status: JobStatus.ACTIVE,
      },
      relations: ['employer'],
    });
  }

  async expireJob(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id: parseInt(jobId) },
      relations: ['employer'],
    });

    if (!job) {
      throw new Error('Job not found');
    }

    job.status = JobStatus.EXPIRED;
    job.expiredAt = new Date();
    return this.jobRepository.save(job);
  }

  async archiveJob(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id: parseInt(jobId) },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    job.status = JobStatus.ARCHIVED;
    job.archivedAt = new Date();
    return this.jobRepository.save(job);
  }

  async extendJob(jobId: string, extendJobDto: ExtendJobDto): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id: parseInt(jobId) },
      relations: ['employer'],
    });

    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== JobStatus.ACTIVE && job.status !== JobStatus.EXPIRED) {
      throw new Error('Job cannot be extended');
    }

    const newDeadline = new Date(extendJobDto.newDeadline);
    if (newDeadline <= new Date()) {
      throw new Error('New deadline must be in the future');
    }

    job.deadline = newDeadline;
    job.status = JobStatus.ACTIVE;
    job.updatedAt = new Date();

    return this.jobRepository.save(job);
  }

  async renewJob(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id: parseInt(jobId) },
      relations: ['employer'],
    });

    if (!job) {
      throw new Error('Job not found');
    }

    const newDeadline = new Date();
    newDeadline.setMonth(newDeadline.getMonth() + 1);

    job.deadline = newDeadline;
    job.status = JobStatus.ACTIVE;
    job.updatedAt = new Date();

    return this.jobRepository.save(job);
  }

  async sendExpiryNotification(job: Job): Promise<void> {
    if (!job.deadline) {
      return; // Skip jobs without deadline
    }

    const daysUntilExpiry = Math.ceil(
      (job.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    );

    await this.mailerService.sendMail({
      to: job.employer.email,
      subject: `Job Posting "${job.title}" Expires Soon`,
      template: 'job-expiry-notification',
      context: {
        jobTitle: job.title,
        daysUntilExpiry,
        jobId: job.id,
        renewUrl: `${process.env.FRONTEND_URL}/jobs/${job.id}/renew`,
      },
    });
  }

  async processJobExpiry(): Promise<void> {
    const expiredJobs = await this.findExpiredJobs();

    for (const job of expiredJobs) {
      await this.expireJob(job.id.toString());
      this.logger.log(`Job ${job.id} expired`);
    }
  }

  async sendExpiryNotifications(): Promise<void> {
    const jobsExpiringSoon = await this.findJobsExpiringIn(3);

    for (const job of jobsExpiringSoon) {
      await this.sendExpiryNotification(job);
      this.logger.log(`Expiry notification sent for job ${job.id}`);
    }
  }

  async findInactiveJobs(inactiveDays: number = 30): Promise<Job[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    return this.jobRepository.find({
      where: {
        status: JobStatus.ACTIVE,
        updatedAt: LessThan(cutoffDate),
      },
    });
  }

  async archiveInactiveJobs(): Promise<void> {
    const inactiveJobs = await this.findInactiveJobs();

    for (const job of inactiveJobs) {
      await this.archiveJob(job.id.toString());
      this.logger.log(`Job ${job.id} archived due to inactivity`);
    }
  }
}
