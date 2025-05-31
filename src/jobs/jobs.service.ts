import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from './entities/job.entity';
import { Repository } from 'typeorm';
import { AntiSpamService } from '../anti-spam/anti-spam.service';

@Injectable()
export class JobService {
  constructor(
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    private antiSpamService: AntiSpamService,
  ) {}

  async create(dto: { title: string; description: string }) {
    const job = this.jobRepo.create(dto);
    const saved = await this.jobRepo.save(job);

    const isSpam = await this.antiSpamService.analyzeJobPost(saved);
    if (isSpam) {
      saved.isFlagged = true;
      await this.jobRepo.save(saved);
    }

    return saved;
  }

  findAll() {
    return this.jobRepo.find();
  }
}
