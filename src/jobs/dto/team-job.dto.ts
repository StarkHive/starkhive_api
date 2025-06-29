import { IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTeamJobDto {
  @ApiProperty({
    description: 'Team ID for shared job posting',
    required: false,
    example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
  })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiProperty({
    description: 'Whether job requires team approval before posting',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean = false;
}

export class UpdateTeamJobDto {
  @ApiProperty({
    description: 'Team ID for shared job posting',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiProperty({
    description: 'Whether job requires team approval',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
}
