import { Comment } from '../../feed/entities/comment.entity';
import { Like } from '../../feed/entities/like.entity';
import { SavedPost } from '../../feed/entities/savedpost.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  // ManyToOne,
} from 'typeorm';

@Entity()
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  content: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => Like, (like) => like.post)
  likes: Like[];

  @OneToMany(() => SavedPost, (savedPost) => savedPost.post)
  savedBy: SavedPost[];

  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];
}
