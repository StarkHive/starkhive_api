import { Column, Entity, OneToMany, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { UserRole } from '../enums/userRole.enum';
import { ApiProperty } from '@nestjs/swagger';
import { SavedPost } from 'src/feed/entities/savedpost.entity';
import { Post } from 'src/feed/entities/post.entity';
import { Portfolio } from './portfolio.entity';
import { Application } from 'src/applications/entities/application.entity';
import { Job } from 'src/jobs/entities/job.entity';
import { Comment } from 'src/feed/entities/comment.entity';
import { EmailToken } from './email-token.entity';

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

  @OneToMany(() => Application, (application) => application.user)
  applications: Application[];

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

  @OneToMany(() => SavedPost, (savedPost) => savedPost.user)
  savedPosts: SavedPost[];

  notifications: any;

  @OneToMany(() => Portfolio, (portfolio) => portfolio.user)
  portfolios: Portfolio[];

  @OneToMany(() => Post, post => post.user)
  posts: Post[];

  @OneToMany(() => Job, (job) => job.recruiter)
  jobs: Job [];

  @OneToMany(() => Comment, (comment) => comment.user)
  comments: Comment[];

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
}