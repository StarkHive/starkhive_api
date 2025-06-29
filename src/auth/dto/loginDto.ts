import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * login DTO class
 * @module logInDto
 */
export class LogInDto {
  /**
   * Email parameter - must be a valid email string
   * @example "user@example.com"
   */
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  /**
   * Password parameter - must be a non-empty string
   * @example "strongpassword123"
   */
  @ApiProperty({ example: 'strongpassword123', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
