import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedPost } from './entities/saved-post.entity'; 

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(SavedPost)
    private savedPostRepo: Repository<SavedPost>,
  ) {}

  async toggleSavePost(postId: number, userId: number): Promise<{ message: string }> {
    const existing = await this.savedPostRepo.findOne({
      where: { postId, userId },
    });

    if (existing) {
      await this.savedPostRepo.remove(existing);
      return { message: 'Post unsaved' };
    }

    const savedPost = this.savedPostRepo.create({ postId, userId });
    await this.savedPostRepo.save(savedPost);
    return { message: 'Post saved' };
  }

  async getSavedPosts(userId: number): Promise<SavedPost[]> {
    return this.savedPostRepo.find({ where: { userId } });
  }
}
