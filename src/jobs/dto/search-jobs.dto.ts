import { IsOptional, IsString, IsNumber, IsEnum, IsDateString, Min, Max, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { JobType, JobStatus, ExperienceLevel } from '../../job-posting/entities/job.entity';

export enum JobSortBy {
  DATE = 'date',
  BUDGET = 'budget',
  RELEVANCE = 'relevance',
}

export class SearchJobsDto {
  @IsOptional()
  @IsString()
  q?: string; // Full-text search

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minBudget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxBudget?: number;

  @ValidateIf(o => o.minBudget !== undefined && o.maxBudget !== undefined)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetRangeValid? = undefined; // Used for custom validation logic

  @IsOptional()
  @IsDateString()
  deadlineFrom?: string;

  @IsOptional()
  @IsDateString()
  deadlineTo?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @IsOptional()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsEnum(JobSortBy)
  sortBy?: JobSortBy;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
