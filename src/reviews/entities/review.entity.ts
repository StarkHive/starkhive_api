import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { Job } from 'src/jobs/entities/job.entity';

@Entity()
@Unique(['recruiter', 'job'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', width: 1 })
  rating: number;

  @Column({ type: 'text' })
  comment: string;

  @ManyToOne(() => User, (user) => user.id, {
    eager: true,
    onDelete: 'CASCADE',
  })
  recruiter: User;

  @ManyToOne(() => Job, (job) => job.id, { eager: true, onDelete: 'CASCADE' })
  job: Job;

  @CreateDateColumn()
  createdAt: Date;
}
