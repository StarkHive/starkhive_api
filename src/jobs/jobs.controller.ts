import { Controller, Post, Body, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { UpdateJobStatusDto } from './dto/update-status.dto';
import { CreateJobDto } from './dto/create-job.dto';
// TODO: Import AuthGuard once authentication is implemented

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

  @Patch(':id/status')
  // TODO: Add @UseGuards(AuthGuard) once authentication is implemented
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateJobStatusDto,
    // TODO: Add @Request() req once authentication is implemented
  ) {
    // TODO: Get userId from request once authentication is implemented
    const userId = 1; // Placeholder
    return this.jobsService.updateJobStatus(+id, updateStatusDto, userId);
  }

  @Patch(':id/toggle-applications')
  // TODO: Add @UseGuards(AuthGuard) once authentication is implemented
  async toggleAcceptingApplications(
    @Param('id') id: string,
    @Body('isAcceptingApplications') isAcceptingApplications: boolean,
    // TODO: Add @Request() req once authentication is implemented
  ) {
    // TODO: Get userId from request once authentication is implemented
    const userId = 1; // Placeholder
    return this.jobsService.toggleAcceptingApplications(+id, isAcceptingApplications, userId);
  }
}
