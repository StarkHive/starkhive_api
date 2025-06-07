import { Application } from 'src/applications/entities/application.entity';
import { User } from 'src/auth/entities/user.entity';
import { JobStatus } from 'src/feed/enums/job-status.enum';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, JoinColumn, ManyToOne } from 'typeorm';

@Entity()
export class Job {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({ default: false })
  isFlagged: boolean;

  @Column('decimal', { nullable: true })
  budget?: number;

  @Column({ type: 'timestamp', nullable: true })
  deadline?: Date;

  @Column({ default: true })
  isAcceptingApplications: boolean;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.OPEN
  })
  status: JobStatus;

  @OneToMany(() => Application, (application) => application.job)
  applications: Application[];

  @Column()
  ownerId: number;

  @ManyToOne(() => User, (user) => user.jobs, { eager: false })
  @JoinColumn({ name: 'recruiterId' })
  recruiter: User;

  @Column()
  recruiterId: string;


  @CreateDateColumn()
  createdAt: Date;
feature/job-edit-budget-deadline


  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
main
  freelancer: any;
}
 
