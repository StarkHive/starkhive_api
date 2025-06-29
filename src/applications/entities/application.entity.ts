import { User } from 'src/auth/entities/user.entity';
import { JobStatus } from 'src/feed/enums/job-status.enum';
import { Job } from 'src/jobs/entities/job.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  ManyToOne,
  BaseEntity,
} from 'typeorm';

export enum ApplicationStatus {
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  SHORTLISTED = 'shortlisted',
  REJECTED = 'rejected',
  ACCEPTED = 'accepted',
}

@Entity('applications')
@Unique(['jobId', 'freelancerId'])
export class Application extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  jobId: number;

  @Column()
  freelancerId: string;

  @Column()
  recruiterId: string;

  @ManyToOne(() => User, (user) => user.applications)
  user: User;

  @ManyToOne(() => Job, (job) => job.applications)
  job: Job;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.OPEN })
  jobStatus: JobStatus;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.SUBMITTED,
  })
  status: ApplicationStatus;

  @Column('jsonb', { default: [] })
  statusHistory: {
    status: ApplicationStatus;
    updatedAt: Date;
    updatedBy?: string;
  }[];

  @Column('text')
  coverLetter: string;

  @CreateDateColumn()
  createdAt: Date;
}
