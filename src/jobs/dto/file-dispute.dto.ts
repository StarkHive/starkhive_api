import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DisputeCategory } from '../entities/dispute.entity';

export class FileDisputeDto {
  @ApiProperty({
    description: 'Escrow whose funds are being contested',
    example: '3f2a9c1e-5b7d-4e88-9a10-2c4d6e8f0a12',
  })
  @IsString()
  @IsNotEmpty()
  escrowId: string;

  @ApiProperty({
    enum: DisputeCategory,
    description: 'What the dispute is about',
    example: DisputeCategory.PAYMENT,
  })
  @IsEnum(DisputeCategory)
  category: DisputeCategory;

  @ApiProperty({
    description: 'Account of what went wrong, shown to the mediating admin',
    example:
      'Work was delivered and approved on 12 March but the escrow was never released.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20, {
    message:
      'A dispute description must be at least 20 characters so an admin has something to mediate on.',
  })
  @MaxLength(5000)
  description: string;
}
