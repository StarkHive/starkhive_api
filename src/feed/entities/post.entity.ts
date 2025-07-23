import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { Like } from './like.entity';
import { Comment } from './comment.entity';
import { SavedPost } from './savedpost.entity';

@Entity()
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  image?: string;

  @ManyToOne(() => User, (user) => user.posts)
  user: User;

  @OneToMany(() => Like, (like) => like.post)
  likes: Like[];

  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];

  @OneToMany(() => SavedPost, (savedPost) => savedPost.post)
  savedBy: SavedPost[];

  @CreateDateColumn()
  createdAt: Date;
}
