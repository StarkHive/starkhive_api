import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitEvidenceDto {
  @ApiProperty({
    description: 'Location of the uploaded file',
    example: 'https://storage.starkhive.dev/disputes/invoice-0412.pdf',
  })
  @IsUrl({}, { message: 'fileUrl must be a valid URL.' })
  fileUrl: string;

  @ApiProperty({
    description: 'Original file name',
    example: 'invoice-0412.pdf',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(127)
  mimeType?: string;

  @ApiPropertyOptional({ description: 'File size in bytes', example: 84213 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  fileSizeBytes?: number;

  @ApiPropertyOptional({
    description: 'What this file is meant to show',
    example: 'Invoice showing the agreed milestone amount.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
