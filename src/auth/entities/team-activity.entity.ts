import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Team } from './team.entity';
import { User } from './user.entity';
import { ActivityType } from '../enums/activityType.enum';

@Entity('team_activities')
@Index(['team', 'createdAt'])
export class TeamActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Team, (team) => team.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team: Team;

  @Column()
  teamId: string;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ nullable: true })
  userId?: string;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  type: ActivityType;

  @Column()
  description: string;

  @Column({ type: 'json', nullable: true })
  metadata?: {
    targetUserId?: string;
    targetUserEmail?: string;
    jobId?: string;
    jobTitle?: string;
    applicationId?: string;
    oldRole?: string;
    newRole?: string;
    [key: string]: any;
  };

  @CreateDateColumn()
  createdAt: Date;
}
