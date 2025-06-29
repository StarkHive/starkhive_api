import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { Job } from './job.entity';
import { BudgetRange } from '../types/budget-range.type';

@Entity('recommendations')
@Index(['userId', 'jobId'], { unique: true })
@Index(['userId', 'score'])
@Index(['userId', 'createdAt'])
export class Recommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job: Job;

  @Column()
  jobId: number;

  @Column('decimal', { precision: 5, scale: 4, default: 0 })
  score: number;

  @Column('json', { nullable: true })
  scoringFactors: {
    skillMatch: number;
    experienceMatch: number;
    locationMatch: number;
    budgetMatch: number;
    userBehavior: number;
    jobPopularity: number;
    [key: string]: number;
  };

  @Column('json', { nullable: true })
  userPreferences: {
    skills?: string[];
    experienceLevel?: string;
    location?: string;
    budgetRange?: BudgetRange;
    jobTypes?: string[];
    [key: string]: any;
  };

  @Column({ default: false })
  isViewed: boolean;

  @Column({ default: false })
  isApplied: boolean;

  @Column({ default: false })
  isSaved: boolean;

  @Column({ default: false })
  isDismissed: boolean;

  @Column({ nullable: true })
  viewedAt: Date;

  @Column({ nullable: true })
  appliedAt: Date;

  @Column({ nullable: true })
  savedAt: Date;

  @Column({ nullable: true })
  dismissedAt: Date;

  @Column('decimal', { precision: 5, scale: 4, nullable: true })
  clickThroughRate: number;

  @Column('decimal', { precision: 5, scale: 4, nullable: true })
  applicationRate: number;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  impressionCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  calculateCTR(): number {
    if (this.impressionCount === 0) return 0;
    return this.viewCount / this.impressionCount;
  }

  calculateApplicationRate(): number {
    // For a single recommendation: application rate = applications / views
    // (isApplied is boolean, so 1 if applied, 0 if not)
    if (this.viewCount === 0) return 0;
    return this.isApplied ? 1 / this.viewCount : 0;
  }

  updateMetrics(): void {
    this.clickThroughRate = this.calculateCTR();
    this.applicationRate = this.calculateApplicationRate();
  }
}
