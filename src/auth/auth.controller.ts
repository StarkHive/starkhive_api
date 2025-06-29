import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  // UseInterceptors,
  // UploadedFile,
  Get,
  Param,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import type { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register-user.dto';
import { User } from './entities/user.entity';
import type { FeedService } from '../feed/feed.service';
import type { JobsService } from '../jobs/jobs.service';
import type { GetUsersDto } from './dto/get-users.dto';
import type { SuspendUserDto } from './dto/suspend-user.dto';
import type { TeamService } from './services/team.service';
import type {
  CreateTeamDto,
  UpdateTeamDto,
  InviteTeamMemberDto,
  InviteMultipleTeamMembersDto,
  UpdateTeamMemberDto,
  RemoveTeamMemberDto,
  GetTeamActivitiesDto,
  GetTeamsDto,
} from './dto/manage-team.dto';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBody,
  // ApiConsumes,
  // ApiBody,
} from '@nestjs/swagger';
import { Roles } from './decorators/role.decorator';
import { UserRole } from './enums/userRole.enum';
import { RolesGuard } from './guards/role.guard';
import { AuthGuardGuard } from './guards/auth.guard';
// import { FileInterceptor } from '@nestjs/platform-express';
// import { diskStorage } from 'multer';
// import { extname } from 'path';
import { AuthGuard } from '@nestjs/passport';
import type { LogInDto } from './dto/loginDto';
import type { LogInProvider } from './providers/loginProvider';
import { AdminGuard } from './admin.guard';
// import { AdminGuard } from './admin.guard';

@ApiTags('auth')
@ApiResponse({ status: 400, description: 'Bad Request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly feedService: FeedService,
    private readonly jobsService: JobsService,
    private readonly logInProvider: LogInProvider,
    private readonly teamService: TeamService,
  ) {}

  /**
   * Promote a user to admin. Only accessible by super admins.
   */
  @Patch('promote/:userId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Promote a user to admin (super admin only)' })
  @ApiResponse({ status: 200, description: 'User promoted to admin' })
  @ApiUnauthorizedResponse({
    description: 'Only super admins can promote users',
  })
  @ApiBadRequestResponse({ description: 'Target user does not exist' })
  async promoteToAdmin(@Param('userId') userId: string, req) {
    const updatedUser = await this.authService.promoteToAdmin(
      req.user.id,
      userId,
    );
    return { message: `User ${updatedUser.email} has been promoted to admin.` };
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify user email with token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', example: 'a1b2c3d4e5f6g7h8i9j0' },
      },
    },
  })
  async verifyEmail(@Body('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  @ApiResponse({ status: 400, description: 'Email is already verified' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
      },
    },
  })
  async resendVerificationEmail(@Body('email') email: string) {
    await this.authService.resendVerificationEmail(email);
    return { message: 'Verification email sent successfully' };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user as Freelancer or Recruiter' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: User,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or email already exists',
  })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuardGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Login successful, JWT returned' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async login(@Body() loginDto: LogInDto, req) {
    const token = await this.logInProvider.Login(loginDto);
    return { access_token: token };
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body('email') email: string) {
    return await this.authService.sendPasswordResetEmail(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Get('users')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({
    summary: 'Get all users with pagination and filters (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users returned successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Only admins can access this endpoint',
  })
  async getUsers(@Query() getUsersDto: GetUsersDto, req) {
    const { page = 1, limit = 10, role, isSuspended } = getUsersDto;
    return this.authService.getUsersWithFilters(page, limit, role, isSuspended);
  }

  @Post('suspend')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Suspend or unsuspend a user (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User suspension status toggled successfully',
  })
  @ApiUnauthorizedResponse({ description: 'Only admins can suspend users' })
  @ApiBadRequestResponse({
    description: 'Invalid user ID or cannot suspend admin users',
  })
  async suspendUser(@Body() suspendUserDto: SuspendUserDto, req) {
    const user = await this.authService.suspendUser(
      req.user.id,
      suspendUserDto.userId,
    );
    return {
      message: `User ${user.email} has been ${user.isSuspended ? 'suspended' : 'unsuspended'}.`,
      isSuspended: user.isSuspended,
    };
  }

  @Get('recruiter/:recruiterId/public-profile')
  @ApiOperation({ summary: 'Get public recruiter profile information' })
  @ApiResponse({
    status: 200,
    description: 'Public recruiter profile returned successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-string' },
        role: { type: 'string', example: 'RECRUITER' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Recruiter not found' })
  async getPublicRecruiterProfile(@Param('recruiterId') recruiterId: string) {
    return this.authService.getPublicRecruiterProfile(recruiterId);
  }

  // Team Management Endpoints
  @Post('teams')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Create a new team (recruiter only)' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({ status: 403, description: 'Only recruiters can create teams' })
  async createTeam(@Body() createTeamDto: CreateTeamDto, req) {
    return this.teamService.createTeam(req.user.id, createTeamDto);
  }

  @Get('teams')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Get user teams with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Teams retrieved successfully' })
  async getUserTeams(@Query() query: GetTeamsDto, req) {
    return this.teamService.getTeamsByUser(req.user.id, query);
  }

  @Get('teams/:teamId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Get team details by ID' })
  @ApiResponse({
    status: 200,
    description: 'Team details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getTeamById(@Param('teamId') teamId: string, req) {
    return this.teamService.getTeamById(teamId, req.user.id);
  }

  @Patch('teams/:teamId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Update team details' })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateTeam(
    @Param('teamId') teamId: string,
    @Body() updateTeamDto: UpdateTeamDto,
    req,
  ) {
    return this.teamService.updateTeam(teamId, req.user.id, updateTeamDto);
  }

  @Delete('teams/:teamId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Delete team (owner only)' })
  @ApiResponse({ status: 200, description: 'Team deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only team owner can delete' })
  async deleteTeam(@Param('teamId') teamId: string, req) {
    return this.teamService.deleteTeam(teamId, req.user.id);
  }

  @Post('teams/:teamId/members/invite')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Invite a member to the team' })
  @ApiResponse({ status: 201, description: 'Team member invited successfully' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions to invite',
  })
  async inviteTeamMember(
    @Param('teamId') teamId: string,
    @Body() inviteDto: InviteTeamMemberDto,
    req,
  ) {
    return this.teamService.inviteTeamMember(teamId, req.user.id, inviteDto);
  }

  @Post('teams/:teamId/members/invite-multiple')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Invite multiple members to the team' })
  @ApiResponse({
    status: 201,
    description: 'Team members invited (with results)',
  })
  async inviteMultipleTeamMembers(
    @Param('teamId') teamId: string,
    @Body() inviteDto: InviteMultipleTeamMembersDto,
    req,
  ) {
    return this.teamService.inviteMultipleTeamMembers(
      teamId,
      req.user.id,
      inviteDto,
    );
  }

  @Patch('teams/:teamId/members/:memberId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Update team member role and permissions' })
  @ApiResponse({ status: 200, description: 'Team member updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateTeamMember(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Body() updateDto: UpdateTeamMemberDto,
    req,
  ) {
    return this.teamService.updateTeamMember(
      teamId,
      memberId,
      req.user.id,
      updateDto,
    );
  }

  @Delete('teams/:teamId/members')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Remove a team member' })
  @ApiResponse({ status: 200, description: 'Team member removed successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async removeTeamMember(
    @Param('teamId') teamId: string,
    @Body() removeDto: RemoveTeamMemberDto,
    req,
  ) {
    return this.teamService.removeTeamMember(teamId, req.user.id, removeDto);
  }

  @Post('teams/:teamId/accept-invitation')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Accept team invitation' })
  @ApiResponse({ status: 200, description: 'Team invitation accepted' })
  @ApiResponse({ status: 404, description: 'Team invitation not found' })
  async acceptTeamInvitation(@Param('teamId') teamId: string, req) {
    return this.teamService.acceptTeamInvitation(teamId, req.user.id);
  }

  @Get('teams/:teamId/activities')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Get team activity history' })
  @ApiResponse({
    status: 200,
    description: 'Team activities retrieved successfully',
  })
  async getTeamActivities(
    @Param('teamId') teamId: string,
    @Query() query: GetTeamActivitiesDto,
    req,
  ) {
    return this.teamService.getTeamActivities(teamId, req.user.id, query);
  }
}
