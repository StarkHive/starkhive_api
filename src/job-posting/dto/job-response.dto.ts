import type { Job } from '../entities/job.entity';

export class JobResponseDto {
  id: string;
  title: string;
  description: string;
  company: string;
  location: string;
  jobType: string;
  status: string;
  experienceLevel: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  requirements: string[];
  responsibilities: string[];
  benefits: string[];
  skills: string[];
  contactEmail?: string;
  contactPhone?: string;
  applicationDeadline?: Date;
  isRemote: boolean;
  isUrgent: boolean;
  isFeatured: boolean;
  viewCount: number;
  applicationCount: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(job: Job) {
    this.id = job.id;
    this.title = job.title;
    this.description = job.description;
    this.company = job.company;
    this.location = job.location;
    this.jobType = job.jobType;
    this.status = job.status;
    this.experienceLevel = job.experienceLevel;
    this.salaryMin = job.salaryMin;
    this.salaryMax = job.salaryMax;
    this.salaryCurrency = job.salaryCurrency;
    this.requirements = job.requirements;
    this.responsibilities = job.responsibilities;
    this.benefits = job.benefits;
    this.skills = job.skills;
    this.contactEmail = job.contactEmail;
    this.contactPhone = job.contactPhone;
    this.applicationDeadline = job.applicationDeadline;
    this.isRemote = job.isRemote;
    this.isUrgent = job.isUrgent;
    this.isFeatured = job.isFeatured;
    this.viewCount = job.viewCount;
    this.applicationCount = job.applicationCount;
    this.createdAt = job.createdAt;
    this.updatedAt = job.updatedAt;
  }
}

export class PaginatedJobResponseDto {
  data: JobResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;

  constructor(jobs: Job[], total: number, page: number, limit: number) {
    this.data = jobs.map((job) => new JobResponseDto(job));
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
  }
}
