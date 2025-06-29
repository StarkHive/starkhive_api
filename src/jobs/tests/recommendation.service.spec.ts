import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RecommendationService } from '../recommendation.service';
import { Recommendation } from '../entities/recommendation.entity';
import { Job } from '../entities/job.entity';
import { User } from 'src/auth/entities/user.entity';
import { Application } from 'src/applications/entities/application.entity';
import { SavedJob } from '../entities/saved-job.entity';
import { GetRecommendationsDto } from '../dto/recommendation.dto';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let recommendationRepository: Repository<Recommendation>;
  let jobRepository: Repository<Job>;
  let userRepository: Repository<User>;
  let applicationRepository: Repository<Application>;
  let savedJobRepository: Repository<SavedJob>;

  const mockRecommendationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockJobRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockApplicationRepository = {
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockSavedJobRepository = {
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockDataSource = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        {
          provide: getRepositoryToken(Recommendation),
          useValue: mockRecommendationRepository,
        },
        {
          provide: getRepositoryToken(Job),
          useValue: mockJobRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Application),
          useValue: mockApplicationRepository,
        },
        {
          provide: getRepositoryToken(SavedJob),
          useValue: mockSavedJobRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
    recommendationRepository = module.get<Repository<Recommendation>>(
      getRepositoryToken(Recommendation),
    );
    jobRepository = module.get<Repository<Job>>(getRepositoryToken(Job));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    applicationRepository = module.get<Repository<Application>>(
      getRepositoryToken(Application),
    );
    savedJobRepository = module.get<Repository<SavedJob>>(
      getRepositoryToken(SavedJob),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations for a user', async () => {
      const userId = 'user-1';
      const options: GetRecommendationsDto = { limit: 10, offset: 0 };

      const mockJobs = [
        {
          id: 1,
          title: 'Frontend Developer',
          description: 'React, JavaScript, HTML, CSS',
          budget: 5000,
          status: 'OPEN',
          isAcceptingApplications: true,
          isRemote: true,
          createdAt: new Date(),
        } as Job,
      ];

      const mockRecommendation = {
        id: 'rec-1',
        userId,
        jobId: 1,
        score: 0.85,
        scoringFactors: {
          skillMatch: 0.8,
          experienceMatch: 0.7,
          locationMatch: 0.9,
          budgetMatch: 0.8,
          userBehavior: 0.6,
          jobPopularity: 0.7,
        },
        isViewed: false,
        isApplied: false,
        isSaved: false,
        isDismissed: false,
        clickThroughRate: 0,
        applicationRate: 0,
        createdAt: new Date(),
      } as Recommendation;

      mockJobRepository.find.mockResolvedValue(mockJobs);
      mockRecommendationRepository.findOne.mockResolvedValue(null);
      mockRecommendationRepository.create.mockReturnValue(mockRecommendation);
      mockRecommendationRepository.save.mockResolvedValue(mockRecommendation);
      mockJobRepository.findOne.mockResolvedValue(mockJobs[0]);

      const result = await service.generateRecommendations(userId, options);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(mockJobRepository.find).toHaveBeenCalled();
      expect(mockRecommendationRepository.create).toHaveBeenCalled();
    });
  });

  describe('updateRecommendationAction', () => {
    it('should update recommendation action', async () => {
      const recommendationId = 'rec-1';
      const action = { action: 'view', value: true };

      const mockRecommendation = {
        id: recommendationId,
        isViewed: false,
        viewCount: 0,
        updateMetrics: jest.fn(),
      } as any;

      mockRecommendationRepository.findOne.mockResolvedValue(
        mockRecommendation,
      );
      mockRecommendationRepository.save.mockResolvedValue(mockRecommendation);

      await service.updateRecommendationAction(recommendationId, action);

      expect(mockRecommendation.isViewed).toBe(true);
      expect(mockRecommendation.viewCount).toBe(1);
      expect(mockRecommendation.updateMetrics).toHaveBeenCalled();
      expect(mockRecommendationRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent recommendation', async () => {
      const recommendationId = 'non-existent';
      const action = { action: 'view', value: true };

      mockRecommendationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateRecommendationAction(recommendationId, action),
      ).rejects.toThrow('Recommendation not found');
    });
  });

  describe('getRecommendationMetrics', () => {
    it('should return recommendation metrics', async () => {
      const userId = 'user-1';

      const mockRecommendations = [
        {
          id: 'rec-1',
          score: 0.8,
          isViewed: true,
          isApplied: false,
          userPreferences: { skills: ['javascript', 'react'] },
        },
        {
          id: 'rec-2',
          score: 0.9,
          isViewed: true,
          isApplied: true,
          userPreferences: { skills: ['python', 'django'] },
        },
      ] as Recommendation[];

      mockRecommendationRepository.find.mockResolvedValue(mockRecommendations);

      const result = await service.getRecommendationMetrics(userId);

      expect(result).toBeDefined();
      expect(result.totalRecommendations).toBe(2);
      expect(result.averageScore).toBe(0.85);
      expect(result.clickThroughRate).toBe(1);
      expect(result.applicationRate).toBe(0.5);
    });

    it('should return empty metrics for user with no recommendations', async () => {
      const userId = 'user-1';

      mockRecommendationRepository.find.mockResolvedValue([]);

      const result = await service.getRecommendationMetrics(userId);

      expect(result.totalRecommendations).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.clickThroughRate).toBe(0);
      expect(result.applicationRate).toBe(0);
    });
  });
});
