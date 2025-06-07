import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobsService } from '../jobs.service';
import { Job } from '../entities/job.entity';
import { Application } from 'src/applications/entities/application.entity';
import { SavedJob } from '../entities/saved-job.entity';
import { AntiSpamService } from 'src/anti-spam/anti-spam.service';
import { NotFoundException } from '@nestjs/common';

describe('JobsService', () => {
  let service: JobsService;
  let jobRepository: Repository<Job>;
  let savedJobRepository: Repository<SavedJob>;

  const mockJob = {
    id: 1,
    title: 'Test Job',
    description: 'Test Description',
    isFlagged: false,
    status: 'OPEN',
    ownerId: 1,
    recruiterId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSavedJob = {
    id: 'saved-1',
    job: mockJob,
    user: { id: 'user-1' },
    savedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: getRepositoryToken(Job),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Application),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SavedJob),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: AntiSpamService,
          useValue: {
            analyzeJobPost: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    jobRepository = module.get<Repository<Job>>(getRepositoryToken(Job));
    savedJobRepository = module.get<Repository<SavedJob>>(
      getRepositoryToken(SavedJob),
    );
  });

  describe('toggleSaveJob', () => {
    it('should save a job when it is not already saved', async () => {
      jest.spyOn(jobRepository, 'findOne').mockResolvedValue(mockJob as Job);
      jest.spyOn(savedJobRepository, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(savedJobRepository, 'create')
        .mockReturnValue(mockSavedJob as SavedJob);
      jest
        .spyOn(savedJobRepository, 'save')
        .mockResolvedValue(mockSavedJob as SavedJob);

      const result = await service.toggleSaveJob(1, 'user-1');

      expect(result).toEqual({ saved: true });
      expect(savedJobRepository.create).toHaveBeenCalledWith({
        job: { id: 1 },
        user: { id: 'user-1' },
      });
      expect(savedJobRepository.save).toHaveBeenCalled();
    });

    it('should unsave a job when it is already saved', async () => {
      jest.spyOn(jobRepository, 'findOne').mockResolvedValue(mockJob as Job);
      jest
        .spyOn(savedJobRepository, 'findOne')
        .mockResolvedValue(mockSavedJob as SavedJob);
      jest
        .spyOn(savedJobRepository, 'remove')
        .mockResolvedValue(mockSavedJob as SavedJob);

      const result = await service.toggleSaveJob(1, 'user-1');

      expect(result).toEqual({ saved: false });
      expect(savedJobRepository.remove).toHaveBeenCalledWith(mockSavedJob);
    });

    it('should throw NotFoundException when job does not exist', async () => {
      jest.spyOn(jobRepository, 'findOne').mockResolvedValue(null);

      await expect(service.toggleSaveJob(999, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSavedJobs', () => {
    it('should return all saved jobs for a user', async () => {
      const mockSavedJobs = [mockSavedJob];
      jest
        .spyOn(savedJobRepository, 'find')
        .mockResolvedValue(mockSavedJobs as SavedJob[]);

      const result = await service.getSavedJobs('user-1');

      expect(result).toEqual([mockJob]);
      expect(savedJobRepository.find).toHaveBeenCalledWith({
        where: { user: { id: 'user-1' } },
        relations: ['job'],
        order: { savedAt: 'DESC' },
      });
    });
  });

  describe('isJobSaved', () => {
    it('should return true when job is saved', async () => {
      jest
        .spyOn(savedJobRepository, 'findOne')
        .mockResolvedValue(mockSavedJob as SavedJob);

      const result = await service.isJobSaved(1, 'user-1');

      expect(result).toBe(true);
      expect(savedJobRepository.findOne).toHaveBeenCalledWith({
        where: {
          job: { id: 1 },
          user: { id: 'user-1' },
        },
        relations: ['job', 'user'],
      });
    });

    it('should return false when job is not saved', async () => {
      jest.spyOn(savedJobRepository, 'findOne').mockResolvedValue(null);

      const result = await service.isJobSaved(1, 'user-1');

      expect(result).toBe(false);
    });
  });
});
