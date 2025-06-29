import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { Post } from '../post/entities/post.entity';
import { User } from '../auth/entities/user.entity';
import { SavedPost } from './entities/savedpost.entity';
import { Repository } from 'typeorm';

describe('FeedService', () => {
  let service: FeedService;
  let reportRepository: Repository<Report>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        {
          provide: getRepositoryToken(SavedPost),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Post),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Report),
          useValue: {
            findAndCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
    reportRepository = module.get<Repository<Report>>(
      getRepositoryToken(Report),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getReportedContent', () => {
    it('should return paginated reports with post and user data', async () => {
      const mockReports = [
        {
          id: 'report-uuid',
          reason: 'Spam',
          createdAt: new Date(),
          post: { id: 'post-uuid', content: 'Reported post' } as Post,
          reporter: { id: 'user-uuid', email: 'user@example.com' } as User,
        },
      ];
      (reportRepository.findAndCount as jest.Mock).mockResolvedValue([
        mockReports,
        1,
      ]);

      const result = await service.getReportedContent(1, 10);

      expect(reportRepository.findAndCount).toHaveBeenCalledWith({
        relations: ['post', 'reporter'],
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        data: mockReports,
      });
    });
  });
});
