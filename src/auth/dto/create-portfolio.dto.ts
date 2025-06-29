import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePortfolioDto {
  @ApiProperty({
    example: 'Landing Page Design',
    description: 'Title of the portfolio item',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'A modern landing page for a SaaS product.',
    description: 'Description of the portfolio item',
  })
  @IsString()
  @IsOptional()
  description?: string;

  // The file will be handled via multipart/form-data, so not included here directly
}
