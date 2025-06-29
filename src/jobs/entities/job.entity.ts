import { Application } from 'src/applications/entities/application.entity';
import { User } from 'src/auth/entities/user.entity';
import { JobStatus } from 'src/feed/enums/job-status.enum';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
  ManyToOne,
  DeleteDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ExcludeFromQuery } from '../../common/decorators/exclude-from-query.decorator';
import { Team } from '../../auth/entities/team.entity';

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

  @Column({ type: 'json', nullable: true })
  skills?: string[];

  @Column('decimal', { nullable: true })
  budget?: number;

  @Column({ type: 'timestamp', nullable: true })
  deadline?: Date;

  @Column({ default: true })
  isAcceptingApplications: boolean;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.OPEN,
  })
  status: JobStatus;

  @OneToMany(() => Application, (application) => application.job)
  applications: Application[];

  @Column()
  ownerId: string;

  @ManyToOne(() => User, (user) => user.jobs, { eager: false })
  @JoinColumn({ name: 'recruiterId' })
  recruiter: User;

  @Column()
  recruiterId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  freelancer: any;

  @ManyToOne(() => Team, { nullable: true, eager: false })
  @JoinColumn({ name: 'teamId' })
  team?: Team;

  @Column({ nullable: true })
  teamId?: string;

  @Column({ default: false })
  requiresApproval: boolean;

  @Column({ default: false })
  isApproved: boolean;

  @Column({ default: false })
  isRemote: boolean;

  @Column({ nullable: true })
  approvedById?: string;

  @Column({ nullable: true })
  approvedAt?: Date;

  @Column({ type: 'json', nullable: true })
  teamSettings?: {
    sharedWithTeam: boolean;
    allowTeamEditing: boolean;
    notifyTeamOnApplication: boolean;
  };

  @DeleteDateColumn({ name: 'deleted_at' })
  @Exclude()
  @ExcludeFromQuery()
  deletedAt?: Date;
}
