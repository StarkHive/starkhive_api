import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { UserRole } from '../enums/userRole.enum';
import { ApiProperty } from '@nestjs/swagger';
import { SavedPost } from '../../feed/entities/savedpost.entity';
import { Post } from '../../feed/entities/post.entity';
import { Portfolio } from './portfolio.entity';
import { Application } from '../../applications/entities/application.entity';
import { Job } from '../../jobs/entities/job.entity';
import { Comment } from '../../feed/entities/comment.entity';
import { Like } from '../../feed/entities/like.entity';
import { EmailToken } from './email-token.entity';
import { TeamMember } from './team-member.entity';
import { Team } from './team.entity';

@Entity()
export class User {
  @ApiProperty({
    description: 'Unique identifier for the user',
    example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'user@example.com',
  })
  @Column({ unique: true })
  email: string;

  @ApiProperty({
    description: 'Password for the user',
    example: 'hashed_password',
  })
  @Column()
  password: string;

  @ApiProperty({
    description: 'Role of the user',
    enum: UserRole,
    example: UserRole.FREELANCER,
  })
  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;

  @OneToMany(() => Application, (application) => application.user)
  applications: Application[];

  @OneToMany(() => SavedPost, (savedPost) => savedPost.user)
  savedPosts: SavedPost[];

  @OneToMany(() => Like, (like) => like.user)
  likes: Like[];

  @OneToMany(() => Team, (team) => team.owner)
  ownedTeams: Team[];

  @OneToMany(() => TeamMember, (teamMember) => teamMember.user)
  teamMemberships: TeamMember[];

  @OneToMany(() => Portfolio, (portfolio) => portfolio.user)
  portfolios: Portfolio[];

  @OneToMany(() => Post, (post) => post.user)
  posts: Post[];

  @OneToMany(() => Job, (job) => job.recruiter)
  jobs: Job[];

  @OneToMany(() => Comment, (comment) => comment.user)
  comments: Comment[];

  @Column({ default: false })
  isSuspended: boolean;

  @ApiProperty({
    description: 'Whether the user has verified their email',
    example: false,
  })
  @Column({ default: false })
  isEmailVerified: boolean;

  @OneToMany(() => EmailToken, (emailToken) => emailToken.user)
  emailTokens: EmailToken[];

  @ApiProperty({
    description: 'The date when the user was created',
    example: '2023-01-01T00:00:00.000Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  // Add this only if you have a Notification entity in the future
  // @OneToMany(() => Notification, (notification) => notification.user)
  // notifications: Notification[];
}
