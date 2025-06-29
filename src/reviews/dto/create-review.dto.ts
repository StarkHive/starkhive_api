import { IsInt, IsString, Min, Max, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ description: 'Rating from 1 to 5', example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description: 'Review comment',
    example: 'Great work and communication!',
  })
  @IsString()
  @IsNotEmpty()
  comment: string;

  @ApiProperty({ description: 'Job ID for the review', example: 'job-uuid' })
  @IsString()
  @IsNotEmpty()
  jobId: string;
}
