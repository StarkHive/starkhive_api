import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SpamFlag } from './entities/spam-flag.entity';
import { Repository } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';

@Injectable()
export class AntiSpamService {
  private readonly blacklist = [
    'easy money',
    'click here',
    'work from home',
    'free',
    'guaranteed',
  ];
  private readonly postTimestamps: Map<number, number[]> = new Map(); // jobId → timestamps

  constructor(
    @InjectRepository(SpamFlag) private flagRepo: Repository<SpamFlag>,
  ) {}

  async analyzeJobPost(job: Job): Promise<boolean> {
    const lowerDesc = job.description.toLowerCase();
    const matched = this.blacklist.find((kw) => lowerDesc.includes(kw));

    if (matched) {
      await this.flagRepo.save({
        jobId: job.id,
        reason: `Matched keyword: ${matched}`,
      });
      return true;
    }

    const now = Date.now();
    const timestamps = this.postTimestamps.get(job.id) || [];
    const filtered = timestamps.filter((t) => now - t < 60000); // last 60s
    filtered.push(now);
    this.postTimestamps.set(job.id, filtered);

    if (filtered.length > 3) {
      await this.flagRepo.save({
        jobId: job.id,
        reason: 'Flood control: too many posts in short time',
      });
      return true;
    }

    return false;
  }

  findAllFlags() {
    return this.flagRepo.find();
  }
}
