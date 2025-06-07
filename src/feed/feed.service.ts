import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedPost } from './entities/savedpost.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { Post } from './entities/post.entity';
import { Report } from './entities/report.entity';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { Job } from '../jobs/entities/job.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { JobStatus } from './enums/job-status.enum';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Comment } from './entities/comment.entity';
import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(SavedPost)
    private readonly savedPostRepo: Repository<SavedPost>,

    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,

    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,

    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,

    private readonly notificationsService: NotificationsService,

    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
  ) {}

  async createFeedPost(user: User, dto: CreatePostDto): Promise<Post> {
    if (!dto.content || dto.content.trim().length === 0) {
      throw new Error('Post content is required');
    }
    const post = this.postRepository.create({
      content: dto.content,
      image: dto.image,
      user,
    });
    return await this.postRepository.save(post);
  }

  async toggleSavePost(
    postId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const existing = await this.savedPostRepo.findOne({
      where: {
        post: { id: postId.toString() },
        user: { id: userId.toString() },
      },
      relations: ['post', 'user'],
    });

    if (existing) {
      await this.savedPostRepo.remove(existing);
      return { message: 'Post unsaved' };
    }

    const savedPost = this.savedPostRepo.create({
      post: { id: postId.toString() },
      user: { id: userId.toString() },
    });
    await this.savedPostRepo.save(savedPost);
    return { message: 'Post saved' };
  }

  async getSavedPosts(userId: number, page = 1, limit = 10) {
    const [savedPosts, total] = await this.savedPostRepo.findAndCount({
      where: { user: { id: userId.toString() } },
      relations: ['post', 'user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      total,
      page,
      limit,
      data: savedPosts.map((sp) => sp.post),
    };
  }

  async getWeeklyNewPostsCount(): Promise<
    Array<{ week: string; count: number }>
  > {
    const raw = await this.postRepository
      .createQueryBuilder('post')
      .select(
        `TO_CHAR(DATE_TRUNC('week', post."createdAt"), 'YYYY-MM-DD')`,
        'week',
      )
      .addSelect('COUNT(*)', 'count')
      .groupBy(`DATE_TRUNC('week', post."createdAt")`)
      .orderBy(`DATE_TRUNC('week', post."createdAt")`, 'DESC')
      .getRawMany<{ week: string; count: string }>();

    return raw.map((r) => ({
      week: r.week,
      count: parseInt(r.count, 10),
    }));
  }

  async moderateJob(jobId: string, status: JobStatus): Promise<Job> {
    const job = await this.jobRepo.findOne({
      where: { id: Number(jobId) },
      relations: ['freelancer'],
    });
    if (!job) throw new NotFoundException('Job not found');

    job.status = status;

    const updatedJob = await this.jobRepo.save(job);

    await this.notificationsService.sendJobStatusNotification(
      job.freelancer.id,
      job.title,
      status as 'approved' | 'rejected',
    );

    return updatedJob;
  }

  async getReportedContent(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [reports, total] = await this.reportRepository.findAndCount({
      relations: ['post', 'reporter'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return {
      total,
      page,
      limit,
      data: reports,
    };
  }

  async addComment(
    postId: string,
    user: User,
    createCommentDto: CreateCommentDto,
  ): Promise<Comment> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const comment = this.commentRepository.create({
      content: createCommentDto.content,
      user,
      post,
    });

    return await this.commentRepository.save(comment);
  }
  // Optional CRUD methods - adjust as needed
  create(createFeedDto: CreateFeedDto) {
    return 'This action adds a new feed';
  }

  findAll() {
    return `This action returns all feed`;
  }

  findOne(id: number) {
    return `This action returns a #${id} feed`;
  }

  update(id: number, updateFeedDto: UpdateFeedDto) {
    return `This action updates a #${id} feed`;
  }

  remove(id: number) {
    return `This action removes a #${id} feed`;
  }
}
