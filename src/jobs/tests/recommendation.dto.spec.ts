import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  BudgetRangeDto,
  UserPreferencesDto,
  GetRecommendationsDto,
  RecommendationResponseDto,
  ScoringFactorsDto,
  JobSummaryDto,
  RecommendationMetricsDto,
  SkillCountDto,
  JobTypeCountDto,
  ScoreRangeCountDto,
} from '../dto/recommendation.dto';

describe('Recommendation DTOs', () => {
  describe('BudgetRangeDto', () => {
    it('should validate a valid budget range', async () => {
      const budgetRange = plainToClass(BudgetRangeDto, {
        min: 1000,
        max: 5000,
      });

      const errors = await validate(budgetRange);
      expect(errors).toHaveLength(0);
    });

    it('should reject negative min value', async () => {
      const budgetRange = plainToClass(BudgetRangeDto, {
        min: -100,
        max: 5000,
      });

      const errors = await validate(budgetRange);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.min).toBeDefined();
    });

    it('should reject negative max value', async () => {
      const budgetRange = plainToClass(BudgetRangeDto, {
        min: 1000,
        max: -500,
      });

      const errors = await validate(budgetRange);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.min).toBeDefined();
    });

    it('should reject max value above limit', async () => {
      const budgetRange = plainToClass(BudgetRangeDto, {
        min: 1000,
        max: 2000000, // Above 1M limit
      });

      const errors = await validate(budgetRange);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.max).toBeDefined();
    });

    it('should reject non-numeric values', async () => {
      const budgetRange = plainToClass(BudgetRangeDto, {
        min: 'invalid',
        max: 5000,
      });

      const errors = await validate(budgetRange);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNumber).toBeDefined();
    });
  });

  describe('ScoringFactorsDto', () => {
    it('should validate valid scoring factors', async () => {
      const scoringFactors = plainToClass(ScoringFactorsDto, {
        skillMatch: 0.8,
        experienceMatch: 0.7,
        locationMatch: 0.9,
        budgetMatch: 0.6,
        userBehavior: 0.5,
        jobPopularity: 0.4,
      });

      const errors = await validate(scoringFactors);
      expect(errors).toHaveLength(0);
    });

    it('should reject values outside 0-1 range', async () => {
      const scoringFactors = plainToClass(ScoringFactorsDto, {
        skillMatch: 1.5, // Above 1
        experienceMatch: -0.1, // Below 0
        locationMatch: 0.9,
        budgetMatch: 0.6,
        userBehavior: 0.5,
        jobPopularity: 0.4,
      });

      const errors = await validate(scoringFactors);
      expect(errors).toHaveLength(2);
    });
  });

  describe('JobSummaryDto', () => {
    it('should validate valid job summary', async () => {
      const jobSummary = plainToClass(JobSummaryDto, {
        id: 1,
        title: 'Frontend Developer',
        description: 'React, JavaScript, HTML, CSS',
        budget: 5000,
        deadline: '2024-01-15T00:00:00.000Z',
        status: 'OPEN',
        createdAt: '2024-01-01T00:00:00.000Z',
      });

      const errors = await validate(jobSummary);
      expect(errors).toHaveLength(0);
    });

    it('should validate job summary without optional fields', async () => {
      const jobSummary = plainToClass(JobSummaryDto, {
        id: 1,
        title: 'Backend Developer',
        description: 'Node.js, TypeScript',
        status: 'OPEN',
        createdAt: '2024-01-01T00:00:00.000Z',
      });

      const errors = await validate(jobSummary);
      expect(errors).toHaveLength(0);
    });
  });

  describe('RecommendationResponseDto', () => {
    it('should validate valid recommendation response', async () => {
      const response = plainToClass(RecommendationResponseDto, {
        id: 'rec-uuid',
        jobId: 123,
        score: 0.85,
        scoringFactors: {
          skillMatch: 0.8,
          experienceMatch: 0.7,
          locationMatch: 0.9,
          budgetMatch: 0.8,
          userBehavior: 0.6,
          jobPopularity: 0.7,
        },
        job: {
          id: 123,
          title: 'Frontend Developer',
          description: 'React, JavaScript, HTML, CSS',
          budget: 5000,
          deadline: '2024-01-15T00:00:00.000Z',
          status: 'OPEN',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        isViewed: false,
        isApplied: false,
        isSaved: false,
        isDismissed: false,
        clickThroughRate: 0,
        applicationRate: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
      });

      const errors = await validate(response);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid score values', async () => {
      const response = plainToClass(RecommendationResponseDto, {
        id: 'rec-uuid',
        jobId: 123,
        score: 1.5, // Above 1
        scoringFactors: {
          skillMatch: 0.8,
          experienceMatch: 0.7,
          locationMatch: 0.9,
          budgetMatch: 0.8,
          userBehavior: 0.6,
          jobPopularity: 0.7,
        },
        job: {
          id: 123,
          title: 'Frontend Developer',
          description: 'React, JavaScript, HTML, CSS',
          status: 'OPEN',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        isViewed: false,
        isApplied: false,
        isSaved: false,
        isDismissed: false,
        clickThroughRate: 0,
        applicationRate: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
      });

      const errors = await validate(response);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.max).toBeDefined();
    });
  });

  describe('RecommendationMetricsDto', () => {
    it('should validate valid metrics', async () => {
      const metrics = plainToClass(RecommendationMetricsDto, {
        totalRecommendations: 150,
        averageScore: 0.72,
        clickThroughRate: 0.45,
        applicationRate: 0.12,
        topSkills: [
          { skill: 'javascript', count: 25 },
          { skill: 'react', count: 20 },
        ],
        topJobTypes: [
          { type: 'frontend', count: 15 },
          { type: 'fullstack', count: 12 },
        ],
        recommendationsByScore: [
          { scoreRange: '0.8-1.0', count: 30 },
          { scoreRange: '0.6-0.8', count: 45 },
        ],
      });

      const errors = await validate(metrics);
      expect(errors).toHaveLength(0);
    });
  });

  describe('UserPreferencesDto', () => {
    it('should validate valid user preferences with budget range', async () => {
      const preferences = plainToClass(UserPreferencesDto, {
        skills: ['javascript', 'react'],
        experienceLevel: 'mid',
        location: 'remote',
        budgetRange: {
          min: 3000,
          max: 8000,
        },
        jobTypes: ['frontend', 'fullstack'],
      });

      const errors = await validate(preferences);
      expect(errors).toHaveLength(0);
    });

    it('should validate user preferences without budget range', async () => {
      const preferences = plainToClass(UserPreferencesDto, {
        skills: ['javascript'],
        experienceLevel: 'senior',
      });

      const errors = await validate(preferences);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid budget range in preferences', async () => {
      const preferences = plainToClass(UserPreferencesDto, {
        skills: ['javascript'],
        budgetRange: {
          min: -100,
          max: 5000,
        },
      });

      const errors = await validate(preferences);
      expect(errors).toHaveLength(1);
      expect(errors[0].children).toBeDefined();
    });
  });

  describe('GetRecommendationsDto', () => {
    it('should validate valid recommendation request', async () => {
      const request = plainToClass(GetRecommendationsDto, {
        limit: 10,
        offset: 0,
        sortBy: 'score',
        sortOrder: 'desc',
        preferences: {
          skills: ['python'],
          budgetRange: {
            min: 2000,
            max: 6000,
          },
        },
      });

      const errors = await validate(request);
      expect(errors).toHaveLength(0);
    });

    it('should use default values when not provided', async () => {
      const request = plainToClass(GetRecommendationsDto, {});

      const errors = await validate(request);
      expect(errors).toHaveLength(0);
      expect(request.limit).toBe(20);
      expect(request.offset).toBe(0);
      expect(request.sortBy).toBe('score');
      expect(request.sortOrder).toBe('desc');
    });
  });
});
