import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt.strategy';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Recruiter leaves a review for a freelancer after job completion',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Review created successfully',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Review already exists for this job',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Job not found' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateReviewDto, @Req() req: any) {
    // Assume recruiter is authenticated user
    return await this.reviewsService.createReview(req.user, dto);
  }
}
