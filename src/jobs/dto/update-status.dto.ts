import { IsEnum } from 'class-validator';
import { JobStatus } from 'src/feed/enums/job-status.enum';

export class UpdateJobStatusDto {
  @IsEnum(JobStatus)
  status: JobStatus;
}
