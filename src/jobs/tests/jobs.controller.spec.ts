import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from '../jobs.controller';
import { JobsService } from '../jobs.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: {
    id: string;
  };
}

describe('JobsController', () => {
  let controller: JobsController;
  let service: JobsService;

  const mockRequest: RequestWithUser = {
    user: {
      id: 'user-1',
    },
  } as RequestWithUser;

  const mockJobsService = {
    toggleSaveJob: jest.fn(),
    getSavedJobs: jest.fn(),
    isJobSaved: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
      ],
    }).compile();

    controller = module.get<JobsController>(JobsController);
    service = module.get<JobsService>(JobsService);
  });

  describe('toggleSaveJob', () => {
    it('should toggle save status of a job', async () => {
      const jobId = '1';
      const expectedResult = { saved: true };
      mockJobsService.toggleSaveJob.mockResolvedValue(expectedResult);

      const result = await controller.toggleSaveJob(jobId, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(service.toggleSaveJob).toHaveBeenCalledWith(+jobId, 'user-1');
    });

    it('should use default user ID when not authenticated', async () => {
      const jobId = '1';
      const expectedResult = { saved: true };
      mockJobsService.toggleSaveJob.mockResolvedValue(expectedResult);

      const result = await controller.toggleSaveJob(
        jobId,
        {} as RequestWithUser,
      );

      expect(result).toEqual(expectedResult);
      expect(service.toggleSaveJob).toHaveBeenCalledWith(+jobId, '1');
    });
  });

  describe('getSavedJobs', () => {
    it('should return all saved jobs for authenticated user', async () => {
      const expectedJobs = [{ id: 1, title: 'Test Job' }];
      mockJobsService.getSavedJobs.mockResolvedValue(expectedJobs);

      const result = await controller.getSavedJobs(mockRequest);

      expect(result).toEqual(expectedJobs);
      expect(service.getSavedJobs).toHaveBeenCalledWith('user-1');
    });

    it('should use default user ID when not authenticated', async () => {
      const expectedJobs = [{ id: 1, title: 'Test Job' }];
      mockJobsService.getSavedJobs.mockResolvedValue(expectedJobs);

      const result = await controller.getSavedJobs({} as RequestWithUser);

      expect(result).toEqual(expectedJobs);
      expect(service.getSavedJobs).toHaveBeenCalledWith('1');
    });
  });

  describe('isJobSaved', () => {
    it('should check if job is saved for authenticated user', async () => {
      const jobId = '1';
      const expectedResult = true;
      mockJobsService.isJobSaved.mockResolvedValue(expectedResult);

      const result = await controller.isJobSaved(jobId, mockRequest);

      expect(result).toBe(expectedResult);
      expect(service.isJobSaved).toHaveBeenCalledWith(+jobId, 'user-1');
    });

    it('should use default user ID when not authenticated', async () => {
      const jobId = '1';
      const expectedResult = false;
      mockJobsService.isJobSaved.mockResolvedValue(expectedResult);

      const result = await controller.isJobSaved(jobId, {} as RequestWithUser);

      expect(result).toBe(expectedResult);
      expect(service.isJobSaved).toHaveBeenCalledWith(+jobId, '1');
    });
  });
});
