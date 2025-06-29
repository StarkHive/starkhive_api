import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  IsEmail,
  IsPhoneNumber,
  IsDateString,
  IsBoolean,
  IsNumber,
  Min,
  Length,
  ArrayMaxSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { JobType, JobStatus, ExperienceLevel } from '../entities/job.entity';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  company: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  location: string;

  @IsEnum(JobType)
  @IsOptional()
  jobType?: JobType = JobType.FULL_TIME;

  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus = JobStatus.ACTIVE;

  @IsEnum(ExperienceLevel)
  @IsOptional()
  experienceLevel?: ExperienceLevel = ExperienceLevel.MID;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  salaryMin?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  salaryMax?: number;

  @IsString()
  @IsOptional()
  @Length(1, 10)
  salaryCurrency?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ArrayMaxSize(20)
  @Transform(({ value }) => (Array.isArray(value) ? value : []))
  requirements?: string[] = [];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ArrayMaxSize(20)
  @Transform(({ value }) => (Array.isArray(value) ? value : []))
  responsibilities?: string[] = [];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ArrayMaxSize(15)
  @Transform(({ value }) => (Array.isArray(value) ? value : []))
  benefits?: string[] = [];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ArrayMaxSize(30)
  @Transform(({ value }) => (Array.isArray(value) ? value : []))
  skills?: string[] = [];

  @IsEmail()
  @IsOptional()
  @Length(1, 100)
  contactEmail?: string;

  @IsPhoneNumber()
  @IsOptional()
  contactPhone?: string;

  @IsDateString()
  @IsOptional()
  applicationDeadline?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isRemote?: boolean = false;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isUrgent?: boolean = false;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isFeatured?: boolean = false;
}
