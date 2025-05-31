import { Controller, Post, Body, Get } from '@nestjs/common';
import { JobService } from './jobs.service'; 

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  create(@Body() body: { title: string; description: string }) {
    return this.jobService.create(body);
  }

  @Get()
  findAll() {
    return this.jobService.findAll();
  }
}
