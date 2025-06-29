import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { TeamMember } from './team-member.entity';
import { TeamActivity } from './team-activity.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  ownerId: string;

  @OneToMany(() => TeamMember, (teamMember) => teamMember.team, {
    cascade: true,
    eager: false,
  })
  members: TeamMember[];

  @OneToMany(() => TeamActivity, (activity) => activity.team, {
    cascade: true,
    eager: false,
  })
  activities: TeamActivity[];

  @Column({ type: 'json', nullable: true })
  settings?: {
    allowMemberInvites: boolean;
    requireApprovalForJobs: boolean;
    shareApplications: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual property to get member count
  get memberCount(): number {
    return this.members ? this.members.length : 0;
  }
}
