// Keep the combined imports from both branches
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Get,
  Param,
  Patch,
  Delete,
  Query,
  Request as Req,
  UnauthorizedException,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register-user.dto';
import { LoginDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { User } from './entities/user.entity';
import type { FeedService } from '../feed/feed.service';
import type { JobsService } from '../jobs/jobs.service';
import type { GetUsersDto } from './dto/get-users.dto';
import type { SuspendUserDto } from './dto/suspend-user.dto';
import type { TeamService } from './services/team.service';
import { LogInProvider } from './providers/loginProvider';
import { Public } from './decorators/public.decorator';
// ... keep other imports from main ...

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly feedService: FeedService,
    private readonly jobsService: JobsService,
    private readonly logInProvider: LogInProvider,
    private readonly teamService: TeamService,
  ) {}

  // ... keep other endpoints ...

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({
    status: 200,
    description: 'Successfully logged in',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Successfully refreshed token',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    try {
      const tokens = await this.authService.refreshTokens(
        refreshTokenDto.refreshToken,
      );
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  @Post('request-password-reset')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  async requestPasswordReset(@Body('email') email: string) {
    return this.authService.sendPasswordResetEmail(email);
  }

  // ... keep all other endpoints from main branch ...
}
