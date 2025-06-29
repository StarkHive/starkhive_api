import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsEmail,
  IsUUID,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TeamRole, TeamMemberStatus } from '../entities/team-member.entity';
import { TeamRole } from '../enums/teamRole.enum';
import { TeamMemberStatus } from '../enums/teamMemberStatus.enum';


export class CreateTeamDto {
  @ApiProperty({
    description: 'Name of the team',
    example: 'Engineering Hiring Team',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Description of the team',
    example: 'Team responsible for hiring software engineers',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Team settings',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TeamSettingsDto)
  settings?: TeamSettingsDto;
}

export class UpdateTeamDto {
  @ApiProperty({
    description: 'Name of the team',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: 'Description of the team',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Whether the team is active',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Team settings',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TeamSettingsDto)
  settings?: TeamSettingsDto;
}

export class TeamSettingsDto {
  @ApiProperty({
    description: 'Allow team members to invite others',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allowMemberInvites?: boolean = false;

  @ApiProperty({
    description: 'Require approval for job postings',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requireApprovalForJobs?: boolean = false;

  @ApiProperty({
    description: 'Share applications across team members',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  shareApplications?: boolean = true;
}

export class InviteTeamMemberDto {
  @ApiProperty({
    description: 'Email of the user to invite',
    example: 'jane.doe@company.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Role to assign to the team member',
    enum: TeamRole,
    example: TeamRole.MEMBER,
  })
  @IsEnum(TeamRole)
  role: TeamRole;

  @ApiProperty({
    description: 'Custom permissions for the team member',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TeamPermissionsDto)
  permissions?: TeamPermissionsDto;
}

export class InviteMultipleTeamMembersDto {
  @ApiProperty({
    description: 'List of team member invitations',
    type: [InviteTeamMemberDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InviteTeamMemberDto)
  invitations: InviteTeamMemberDto[];
}

export class UpdateTeamMemberDto {
  @ApiProperty({
    description: 'Role to assign to the team member',
    enum: TeamRole,
    required: false,
  })
  @IsOptional()
  @IsEnum(TeamRole)
  role?: TeamRole;

  @ApiProperty({
    description: 'Status of the team member',
    enum: TeamMemberStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(TeamMemberStatus)
  status?: TeamMemberStatus;

  @ApiProperty({
    description: 'Custom permissions for the team member',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TeamPermissionsDto)
  permissions?: TeamPermissionsDto;
}

export class TeamPermissionsDto {
  @ApiProperty({ description: 'Can create job postings' })
  @IsOptional()
  @IsBoolean()
  canCreateJobs?: boolean;

  @ApiProperty({ description: 'Can edit job postings' })
  @IsOptional()
  @IsBoolean()
  canEditJobs?: boolean;

  @ApiProperty({ description: 'Can delete job postings' })
  @IsOptional()
  @IsBoolean()
  canDeleteJobs?: boolean;

  @ApiProperty({ description: 'Can view job applications' })
  @IsOptional()
  @IsBoolean()
  canViewApplications?: boolean;

  @ApiProperty({ description: 'Can manage (approve/reject) applications' })
  @IsOptional()
  @IsBoolean()
  canManageApplications?: boolean;

  @ApiProperty({ description: 'Can invite new team members' })
  @IsOptional()
  @IsBoolean()
  canInviteMembers?: boolean;

  @ApiProperty({ description: 'Can remove team members' })
  @IsOptional()
  @IsBoolean()
  canRemoveMembers?: boolean;
}

export class RemoveTeamMemberDto {
  @ApiProperty({
    description: 'ID of the team member to remove',
    example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
  })
  @IsUUID()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({
    description: 'Reason for removal (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class GetTeamActivitiesDto {
  @ApiProperty({
    description: 'Page number for pagination',
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    default: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by activity type',
    required: false,
  })
  @IsOptional()
  @IsString()
  activityType?: string;

  @ApiProperty({
    description: 'Filter by user ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class GetTeamsDto {
  @ApiProperty({
    description: 'Page number for pagination',
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    default: 10,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @ApiProperty({
    description: 'Filter by team status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Search teams by name',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
