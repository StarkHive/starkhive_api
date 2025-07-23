import {
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
  IsString,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { JobType, ExperienceLevel } from '../entities/job.entity';

export enum JobSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum JobSortField {
  CREATED_AT = 'createdAt',
  TITLE = 'title',
  BUDGET = 'budget',
  DEADLINE = 'deadline',
  STATUS = 'status',
  VIEW_COUNT = 'viewCount',
  APPLICATION_COUNT = 'applicationCount',
  SALARY_MIN = 'salaryMin',
  SALARY_MAX = 'salaryMax',
}

export class PaginationDto {
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

  @IsOptional()
  @IsEnum(JobSortField)
  sortBy?: JobSortField = JobSortField.CREATED_AT;

  @IsOptional()
  @IsEnum(JobSortOrder)
  sortOrder?: JobSortOrder = JobSortOrder.DESC;

  // Optional filters for job listings
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isRemote?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isUrgent?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isFeatured?: boolean;

  @IsOptional()
  @IsString()
  skills?: string;
}
