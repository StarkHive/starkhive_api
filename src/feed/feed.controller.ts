import { Controller, Post, Param, Request, Get } from '@nestjs/common';
import { FeedService } from './feed.service';
 

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  
  @Post(':postId/save-toggle')
  toggleSave(@Param('postId') postId: number, @Request() req) {
    return this.feedService.toggleSavePost(+postId, req.user.id = 1); // Simulate user.id = 1 if auth not ready
  }

  
  @Get('saved')
  getSaved(@Request() req) {
    return this.feedService.getSavedPosts(req.user.id);
  }
}
