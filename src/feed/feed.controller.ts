import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { FeedService } from './feed.service';
import { CreateFeedDto, GetSavedPostsDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt.strategy';
import { CreateCommentDto } from './dto/create-comment.dto';
import { User } from 'src/auth/entities/user.entity';
import { Report } from './entities/report.entity';
import { UserRole } from '../auth/enums/userRole.enum';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/role.decorator';

interface AuthenticatedRequest extends Request {
  user: User;
}

@Controller('feed')
export class FeedController {
  @Post('post')
  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new post (LinkedIn-style feed)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Post created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid post data',
  })
  async createFeedPost(
    @Body() dto: import('./dto/create-post.dto').CreatePostDto,
    @Req() req: any,
  ) {
    const user = req.user;
    if (!user) throw new Error('Authentication required');
    return await this.feedService.createFeedPost(user, dto);
  }

  constructor(private readonly feedService: FeedService) {}

  @Post(':postId/save-toggle')
  toggleSave(@Param('postId') postId: number, @Request() req) {
    // Simulate user.id = 1 if auth not ready
    return this.feedService.toggleSavePost(+postId, req.user?.id ?? 1);
  }

  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get paginated saved posts' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated saved posts',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameters',
  })
  @Get('saved')
  async getSavedPosts(@Req() req: Request, @Query() query: GetSavedPostsDto) {
    const userId = req['user'].id;
    return this.feedService.getSavedPosts(userId, query.page, query.limit);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':postId/comments')
  async addComment(
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return await this.feedService.addComment(postId, req.user, dto);
  }

  @Post()
  create(@Body() createFeedDto: CreateFeedDto) {
    return this.feedService.create(createFeedDto);
  }

  @Get()
  findAll() {
    return this.feedService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.feedService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFeedDto: UpdateFeedDto) {
    return this.feedService.update(+id, updateFeedDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.feedService.remove(+id);
  }

  @Get('reports')
  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get paginated reported content for admin review' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated reported content',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  async getReportedContent(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.feedService.getReportedContent(Number(page), Number(limit));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':postId/like-toggle')
  @ApiBearerAuth('jwt-auth')
  @ApiOperation({ summary: 'Toggle like status for a post' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Like status toggled successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Post not found',
  })
  async toggleLike(@Param('postId') postId: string, @Req() req) {
    return await this.feedService.toggleLikePost(postId, req.user.id);
  }
}
