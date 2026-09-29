import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeResolution } from '../entities/dispute.entity';

export class ResolveDisputeDto {
  @ApiProperty({
    enum: DisputeResolution,
    description: 'Outcome to enforce against the escrow',
    example: DisputeResolution.SPLIT,
  })
  @IsEnum(DisputeResolution)
  resolution: DisputeResolution;

  @ApiProperty({
    description: 'Reasoning for the decision, visible to both parties',
    example:
      'Partial delivery confirmed against the milestone brief; awarding 60% to the freelancer.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'A resolution must record the reasoning behind the decision.',
  })
  @MaxLength(5000)
  resolutionNotes: string;

  @ApiPropertyOptional({
    description:
      'Amount awarded to the freelancer. Required for a SPLIT outcome, rejected for any other.',
    example: 120.5,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  awardedAmount?: number;
}
