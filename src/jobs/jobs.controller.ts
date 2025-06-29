import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  Request,
  Query,
  UseGuards,
  UnauthorizedException,
  ParseIntPipe,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { RecommendationService } from './recommendation.service';
import { UpdateJobStatusDto } from './dto/update-status.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import {
  GetRecommendationsDto,
  UpdateRecommendationActionDto,
  RecommendationMetricsDto,
} from './dto/recommendation.dto';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { AuthGuardGuard } from '../auth/guards/auth.guard';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly recommendationService: RecommendationService,
  ) {}

  // Create a job
  @Post()
  @UseGuards(AuthGuardGuard)
  createJob(@Body() createJobDto: CreateJobDto, @GetUser() user: User) {
    return this.jobsService.createJob(createJobDto, user.id);
  }

  // Get all jobs
  @Get()
  findAllJobs() {
    return this.jobsService.findAllJobs();
  }

  // Get a single job by ID
  @Get(':id')
  findJobById(@Param('id', ParseIntPipe) id: number) {
    return this.jobsService.findJobById(id);
  }

  // Update a job
  @Patch(':id')
  @UseGuards(AuthGuardGuard)
  updateJob(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateJobDto: UpdateJobDto,
    @GetUser() user: User,
  ) {
    return this.jobsService.updateJob(id, updateJobDto, user.id);
  }

  // Update job status
  @Patch(':id/status')
  @UseGuards(AuthGuardGuard)
  updateJobStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateJobStatusDto,
    @GetUser() user: User,
  ) {
    return this.jobsService.updateJobStatus(id, updateStatusDto, user.id);
  }

  // Toggle job accepting applications
  @Patch(':id/toggle-applications')
  @UseGuards(AuthGuardGuard)
  toggleAcceptingApplications(
    @Param('id', ParseIntPipe) id: number,
    @Body('isAcceptingApplications') isAcceptingApplications: boolean,
    @GetUser() user: User,
  ) {
    return this.jobsService.toggleAcceptingApplications(
      id,
      isAcceptingApplications,
      user.id,
    );
  }

  // Delete a job
  @Delete(':id')
  @UseGuards(AuthGuardGuard)
  removeJob(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    return this.jobsService.removeJob(id, user.id);
  }

  // Restore a deleted job
  @Post(':id/restore')
  @UseGuards(AuthGuardGuard)
  restoreJob(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    return this.jobsService.restoreJob(id, user.id);
  }

  // Save/Unsave job
  @Post(':id/save')
  @UseGuards(AuthGuardGuard)
  toggleSaveJob(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    return this.jobsService.toggleSaveJob(id, user.id);
  }

  // Check if job is saved
  @Get(':id/saved')
  @UseGuards(AuthGuardGuard)
  isJobSaved(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    return this.jobsService.isJobSaved(id, user.id);
  }

  // Get all saved jobs
  @Get('saved')
  @UseGuards(AuthGuardGuard)
  getSavedJobs(@GetUser() user: User) {
    return this.jobsService.getSavedJobs(user.id);
  }

  // Get job recommendations
  @Get('recommendations')
  @UseGuards(AuthGuardGuard)
  getRecommendations(
    @Query() query: GetRecommendationsDto,
    @GetUser() user: User,
  ) {
    return this.recommendationService.generateRecommendations(
      user.id,
      query,
    );
  }

  // Get recommendation metrics
  @Get('recommendations/metrics')
  @UseGuards(AuthGuardGuard)
  getRecommendationMetrics(
    @GetUser() user: User,
  ): Promise<RecommendationMetricsDto> {
    return this.recommendationService.getRecommendationMetrics(user.id);
  }

  // Update recommendation interaction (e.g., like/dislike)
  @Patch('recommendations/:id/action')
  @UseGuards(AuthGuardGuard)
  updateRecommendationAction(
    @Param('id') recommendationId: string,
    @Body() action: UpdateRecommendationActionDto,
    @GetUser() user: User,
  ) {
    return this.recommendationService.updateRecommendationAction(
      recommendationId,
      action,
      user.id,
    );
  }
}
