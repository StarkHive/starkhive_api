import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  IsObject,
  ValidateNested,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BudgetRange } from '../types/budget-range.type';

export class BudgetRangeDto implements BudgetRange {
  @IsNumber()
  @Min(0)
  min: number;

  @IsNumber()
  @Min(0)
  @Max(1000000) // Reasonable maximum budget limit
  max: number;
}

export class ScoringFactorsDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  skillMatch: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  experienceMatch: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  locationMatch: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  budgetMatch: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  userBehavior: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  jobPopularity: number;
}

export class JobSummaryDto {
  @IsNumber()
  id: number;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsNumber()
  @IsOptional()
  budget?: number;

  @IsDateString()
  @IsOptional()
  deadline?: Date;

  @IsString()
  status: string;

  @IsDateString()
  createdAt: Date;
}

export class UserPreferencesDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @IsString()
  @IsOptional()
  experienceLevel?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @ValidateNested()
  @Type(() => BudgetRangeDto)
  @IsOptional()
  budgetRange?: BudgetRangeDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  jobTypes?: string[];
}

export class GetRecommendationsDto {
  @IsNumber()
  @IsOptional()
  limit?: number = 20;

  @IsNumber()
  @IsOptional()
  offset?: number = 0;

  @IsString()
  @IsOptional()
  sortBy?: 'score' | 'createdAt' | 'popularity' = 'score';

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ValidateNested()
  @Type(() => UserPreferencesDto)
  @IsOptional()
  preferences?: UserPreferencesDto;
}

export class UpdateRecommendationActionDto {
  @IsString()
  action: 'view' | 'apply' | 'save' | 'dismiss';

  @IsBoolean()
  @IsOptional()
  value?: boolean = true;
}

export class RecommendationResponseDto {
  @IsString()
  id: string;

  @IsNumber()
  jobId: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  score: number;

  @ValidateNested()
  @Type(() => ScoringFactorsDto)
  scoringFactors: ScoringFactorsDto;

  @ValidateNested()
  @Type(() => JobSummaryDto)
  job: JobSummaryDto;

  @IsBoolean()
  isViewed: boolean;

  @IsBoolean()
  isApplied: boolean;

  @IsBoolean()
  isSaved: boolean;

  @IsBoolean()
  isDismissed: boolean;

  @IsNumber()
  @Min(0)
  @Max(1)
  clickThroughRate: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  applicationRate: number;

  @IsDateString()
  createdAt: Date;
}

export class RecommendationMetricsDto {
  @IsNumber()
  @Min(0)
  totalRecommendations: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  averageScore: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  clickThroughRate: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  applicationRate: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillCountDto)
  topSkills: SkillCountDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobTypeCountDto)
  topJobTypes: JobTypeCountDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScoreRangeCountDto)
  recommendationsByScore: ScoreRangeCountDto[];
}

export class SkillCountDto {
  @IsString()
  skill: string;

  @IsNumber()
  @Min(0)
  count: number;
}

export class JobTypeCountDto {
  @IsString()
  type: string;

  @IsNumber()
  @Min(0)
  count: number;
}

export class ScoreRangeCountDto {
  @IsString()
  scoreRange: string;

  @IsNumber()
  @Min(0)
  count: number;
}
