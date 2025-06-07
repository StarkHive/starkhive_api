// src/feed/entities/like.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Post } from '../../post/entities/post.entity';
import { User } from '../../auth/entities/user.entity';

@Entity()
@Unique(['user', 'post'])
export class Like {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.likes, {
    eager: true,
    onDelete: 'CASCADE',
  })
  user: User;

  @ManyToOne(() => Post, (post) => post.likes, {
    eager: false,
    onDelete: 'CASCADE',
  })
  post: Post;

  @CreateDateColumn()
  createdAt: Date;
}
