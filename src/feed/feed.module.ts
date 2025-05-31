import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { SavedPost } from './entities/saved-post.entity'; 

@Module({
  imports: [TypeOrmModule.forFeature([SavedPost])],
  providers: [FeedService],
  controllers: [FeedController],
})
export class FeedModule {}
