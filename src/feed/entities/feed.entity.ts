import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity('feed_posts')
export class FeedPost {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  content: string;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column()
  authorId: number;

  @CreateDateColumn()
  createdAt: Date;
}
