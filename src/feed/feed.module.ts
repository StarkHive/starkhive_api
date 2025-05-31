import { Module, Post } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedPost } from './entities/savedpost.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SavedPost, Post])],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
