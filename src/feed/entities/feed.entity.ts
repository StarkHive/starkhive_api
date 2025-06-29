import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { JobStatus } from '../enums/job-status.enum';

@Entity('feed_posts')
export class FeedPost {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  content: string;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column()
  authorId: number;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.APPROVED })
  status: JobStatus;

  @CreateDateColumn()
  createdAt: Date;
}
