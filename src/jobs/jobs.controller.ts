import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Request,
  Query,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { UpdateJobStatusDto } from './dto/update-status.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { SearchJobsDto } from './dto/search-jobs.dto';
import { Request as ExpressRequest } from 'express';

// Extend Express Request with user property
interface RequestWithUser extends ExpressRequest {
  user?: {
    id: string;
  };
}

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@Body() createJobDto: CreateJobDto) {
    return this.jobsService.createJob(createJobDto);
  }

  @Get()
  findAll() {
    return this.jobsService.findAllJobs();
  }

  @Get('search')
  async advancedSearch(@Query() query: SearchJobsDto) {
    return this.jobsService.advancedSearchJobs(query);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateJobStatusDto,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.id || '1'; // Placeholder
    return this.jobsService.updateJobStatus(id, updateStatusDto, userId);
  }

  @Patch(':id/toggle-applications')
  async toggleAcceptingApplications(
    @Param('id') id: string,
    @Body('isAcceptingApplications') isAcceptingApplications: boolean,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.id || '1'; // Placeholder
    return this.jobsService.toggleAcceptingApplications(
      id,
      isAcceptingApplications,
      userId,
    );
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.jobsService.findJobById(id);
  }

  @Patch(':id')
  async updateJob(
    @Param('id') id: string,
    @Body() updateJobDto: UpdateJobDto,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.id || '1'; // Placeholder
    return this.jobsService.updateJob(id, updateJobDto, userId);
  }

  @Post(':id/save')
  async toggleSaveJob(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.id || '1'; // Placeholder
    return this.jobsService.toggleSaveJob(id, userId);
  }

  @Get('saved')
  async getSavedJobs(@Request() req: RequestWithUser) {
    const userId = req.user?.id || '1'; // Placeholder
    return this.jobsService.getSavedJobs(userId);
  }

  @Get(':id/saved')
  async isJobSaved(@Param('id') id: string, @Request() req: RequestWithUser) {
    const userId = req.user?.id || '1'; // Placeholder
    return this.jobsService.isJobSaved(id, userId);
  }
}
