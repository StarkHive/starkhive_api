import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { UserRole } from '../enums/userRole.enum';

export class GetUsersDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  isSuspended?: boolean;
}
