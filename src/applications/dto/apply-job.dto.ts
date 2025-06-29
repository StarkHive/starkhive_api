import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class ApplyJobDto {
  @IsNotEmpty()
  @IsNumber()
  jobId: number;

  @IsNotEmpty()
  @IsString()
  coverLetter: string;
}
