import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { Post } from 'src/feed/entities/post.entity';
import { Job } from 'src/jobs/entities/job.entity';
import { Report } from 'src/reports/entities/report.entity';
import { DashboardStatsDto } from '../dto/dashboard-stats.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  async getDashboardStats(): Promise<DashboardStatsDto> {
    const [totalUsers, totalPosts, totalJobs, totalReports] = await Promise.all(
      [
        this.userRepository.count(),
        this.postRepository.count(),
        this.jobRepository.count({ where: { deletedAt: null } as any }), // Type assertion to fix type error
        this.reportRepository.count(),
      ],
    );

    return {
      totalUsers,
      totalPosts,
      totalJobs,
      totalReports,
      timestamp: new Date(),
    };
  }
}
