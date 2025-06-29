import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { User } from 'src/auth/entities/user.entity';
import { Job } from 'src/jobs/entities/job.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
  ) {}

  async createReview(recruiter: User, dto: CreateReviewDto): Promise<Review> {
    const job = await this.jobRepository.findOne({
      where: { id: Number(dto.jobId) },
    });
    if (!job) throw new NotFoundException('Job not found');
    const existing = await this.reviewRepository.findOne({
      where: { recruiter: { id: recruiter.id }, job: { id: job.id } },
    });
    if (existing)
      throw new ConflictException('You have already reviewed this job');
    const review = this.reviewRepository.create({
      rating: dto.rating,
      comment: dto.comment,
      recruiter,
      job,
    });
    return await this.reviewRepository.save(review);
  }
}
