import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum JobType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  INTERNSHIP = 'internship',
  FREELANCE = 'freelance',
}

export enum JobStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CLOSED = 'closed',
  DRAFT = 'draft',
}

export enum ExperienceLevel {
  ENTRY = 'entry',
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  LEAD = 'lead',
  EXECUTIVE = 'executive',
}

@Entity('jobs')
@Index(['status', 'createdAt'])
@Index(['location'])
@Index(['jobType'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  @Index()
  title: string;

  @Column('text')
  description: string;

  @Column({ length: 100 })
  @Index()
  company: string;

  @Column({ length: 100 })
  location: string;

  @Column({
    type: 'enum',
    enum: JobType,
    default: JobType.FULL_TIME,
  })
  jobType: JobType;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.ACTIVE,
  })
  status: JobStatus;

  @Column({
    type: 'enum',
    enum: ExperienceLevel,
    default: ExperienceLevel.MID,
  })
  experienceLevel: ExperienceLevel;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  salaryMin: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  salaryMax: number;

  @Column({ length: 10, nullable: true })
  salaryCurrency: string;

  @Column('text', { array: true, default: [] })
  requirements: string[];

  @Column('text', { array: true, default: [] })
  responsibilities: string[];

  @Column('text', { array: true, default: [] })
  benefits: string[];

  @Column('text', { array: true, default: [] })
  skills: string[];

  @Column({ length: 100, nullable: true })
  contactEmail: string;

  @Column({ length: 20, nullable: true })
  contactPhone: string;

  @Column({ type: 'date', nullable: true })
  applicationDeadline: Date;

  @Column({ default: false })
  isRemote: boolean;

  @Column({ default: false })
  isUrgent: boolean;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  applicationCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
