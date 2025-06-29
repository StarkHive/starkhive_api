import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import type { JobService } from './job.service';
import type { CreateJobDto } from './dto/create-job.dto';
import type { UpdateJobDto } from './dto/update-job.dto';
import type { JobQueryDto } from './dto/job-query.dto';
import type {
  JobResponseDto,
  PaginatedJobResponseDto,
} from './dto/job-response.dto';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createJobDto: CreateJobDto): Promise<JobResponseDto> {
    return this.jobService.create(createJobDto);
  }

  @Get()
  async findAll(
    @Query() queryDto: JobQueryDto,
  ): Promise<PaginatedJobResponseDto> {
    return this.jobService.findAll(queryDto);
  }

  @Get('stats')
  async getStats(): Promise<any> {
    return this.jobService.getJobStats();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JobResponseDto> {
    const job = await this.jobService.findOne(id);
    // Increment view count when job is viewed
    await this.jobService.incrementViewCount(id);
    return job;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateJobDto: UpdateJobDto,
  ): Promise<JobResponseDto> {
    return this.jobService.update(id, updateJobDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.jobService.remove(id);
  }

  @Post(':id/apply')
  @HttpCode(HttpStatus.OK)
  async applyToJob(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    // Increment application count
    await this.jobService.incrementApplicationCount(id);
    return { message: 'Application submitted successfully' };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
  ): Promise<JobResponseDto> {
    return this.jobService.update(id, { status } as UpdateJobDto);
  }

  @Patch(':id/feature')
  async toggleFeatured(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isFeatured') isFeatured: boolean,
  ): Promise<JobResponseDto> {
    return this.jobService.update(id, { isFeatured });
  }
}
