// Create this as a new file: src/jobs/adapters/job.adapter.ts

import { Job } from '../entities/job.entity';
import { JobResponseDto } from '../../job-posting/dto/job-response.dto';

export class JobAdapter {
  /**
   * Convert a single Job entity to the format expected by JobResponseDto
   */
  static toJobPostingEntity(job: Job): JobResponseDto {
    // Create a compatible object that matches the job-posting Job interface
    const compatibleJob = {
      id: job.id,
      title: job.title,
      description: job.description,
      company: job.company || '',
      location: job.location || '',
      jobType: job.jobType || 'full_time',
      status: job.status,
      experienceLevel: job.experienceLevel || 'mid',
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      requirements: job.requirements || [],
      responsibilities: job.responsibilities || [],
      benefits: job.benefits || [],
      skills: job.skills || [],
      contactEmail: job.contactEmail,
      contactPhone: job.contactPhone,
      applicationDeadline: job.applicationDeadline,
      isRemote: job.isRemote || false,
      isUrgent: job.isUrgent || false,
      isFeatured: job.isFeatured || false,
      viewCount: job.viewCount || 0,
      applicationCount: job.applicationCount || 0,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      freelancer: job.freelancer || null,
    };

    return new JobResponseDto(compatibleJob as any);
  }

  /**
   * Convert an array of Job entities to the format expected by PaginatedJobResponseDto
   */
  static toJobPostingEntities(jobs: Job[]): JobResponseDto[] {
    return jobs.map((job) => this.toJobPostingEntity(job));
  }
}
