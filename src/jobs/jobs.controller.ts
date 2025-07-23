import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  NotFoundException,
  UnauthorizedException,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { RecommendationService } from './recommendation.service';
import { UpdateJobStatusDto } from './dto/update-status.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { SearchJobsDto } from './dto/search-jobs.dto';
import {
  GetRecommendationsDto,
  UpdateRecommendationActionDto,
  RecommendationMetricsDto,
} from './dto/recommendation.dto';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { BlockchainService } from './blockchain/blockchain.service';
import { PaymentRequestDto } from './dto/payment-request.dto';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ExtendJobDto } from './dto/extend-job.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Job } from './entities/job.entity';
import {
  CreateJobFromTemplateDto,
  CreateTemplateDto,
  UpdateTemplateDto,
} from './dto/job-template.dto';
import { JobTemplate } from './entities/job-template.entity';
import { AuthGuardGuard } from '../auth/guards/auth.guard';
import { PaginationDto } from './dto/pagination.dto';

// For Express Request typing
import { Request } from 'express';

@Controller('jobs')
@ApiTags('jobs')
@ApiBearerAuth('jwt-auth')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly recommendationService: RecommendationService,
    private readonly blockchainService: BlockchainService,
  ) {}

  @Post('escrow/initiate')
  async initiateEscrow(@Body() dto: InitiatePaymentDto) {
    return this.jobsService.initiateEscrow(dto);
  }

  @Patch('escrow/release/:escrowId')
  async releaseEscrow(@Param('escrowId') escrowId: string) {
    return this.jobsService.releaseEscrow(escrowId);
  }

  @Patch('escrow/dispute/:escrowId')
  async markEscrowAsDisputed(@Param('escrowId') escrowId: string) {
    return this.jobsService.markEscrowAsDisputed(escrowId);
  }
  @Post()
  @UseGuards(AuthGuardGuard)
  createJob(@Body() createJobDto: CreateJobDto, @GetUser() user: User) {
    // Attach recruiterId to DTO for job creation
    return this.jobsService.createJob({
      ...createJobDto,
      recruiterId: user.id,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Get paginated list of job postings',
    description:
      'Retrieve a paginated list of active job postings with optional filtering. Newest jobs are displayed first by default. This is a public endpoint accessible without authentication.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Paginated list of job postings with filtering and sorting support',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              company: { type: 'string' },
              location: { type: 'string' },
              jobType: { type: 'string' },
              experienceLevel: { type: 'string' },
              salaryMin: { type: 'number' },
              salaryMax: { type: 'number' },
              skills: { type: 'array', items: { type: 'string' } },
              isRemote: { type: 'boolean' },
              isUrgent: { type: 'boolean' },
              isFeatured: { type: 'boolean' },
              viewCount: { type: 'number' },
              applicationCount: { type: 'number' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: {
          type: 'number',
          description: 'Total number of jobs matching the criteria',
        },
        page: { type: 'number', description: 'Current page number' },
        limit: { type: 'number', description: 'Number of items per page' },
        totalPages: { type: 'number', description: 'Total number of pages' },
      },
    },
  })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.jobsService.findAll(paginationDto);
  }

  @Get('search')
  async advancedSearch(@Query() query: SearchJobsDto) {
    return this.jobsService.advancedSearchJobs(query);
  }

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.jobsService.findJobById(id);
  }

  // This endpoint is ambiguous in your code; typically 'saved' is for checking if the job is saved for the user, not updating it.
  // Let's correct it to return saved status:
  @Get(':id/saved')
  @UseGuards(AuthGuardGuard)
  async isJobSaved(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    return this.jobsService.isJobSaved(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a job listing (recruiter only)' })
  @ApiResponse({ status: 200, description: 'Job updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the job owner can update this job.',
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuardGuard)
  async updateJob(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateJobDto: UpdateJobDto,
    @GetUser() user: User,
  ) {
    return this.jobsService.updateJob(id, updateJobDto, user.id);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuardGuard)
  async updateJobStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateJobStatusDto,
    @GetUser() user: User,
  ) {
    return this.jobsService.updateJobStatus(id, updateStatusDto, user.id);
  }

  @Patch(':id/toggle-applications')
  @UseGuards(AuthGuardGuard)
  toggleAcceptingApplications(
    @Param('id', ParseIntPipe) id: number,
    @Body('isAcceptingApplications') isAcceptingApplications: boolean,
    @GetUser() user: User,
  ) {
    return this.jobsService.toggleAcceptingApplications(
      id,
      isAcceptingApplications,
      user.id,
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuardGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeJob(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    await this.jobsService.removeJob(id, user.id);
  }

  @Post(':id/restore')
  @UseGuards(AuthGuardGuard)
  restoreJob(@Param('id', ParseIntPipe) id: number, @GetUser() user: User) {
    return this.jobsService.restoreJob(id, user.id);
  }

  @Post(':id/save')
  @UseGuards(AuthGuardGuard)
  async saveJob(@Param('id', ParseIntPipe) id: number, @GetUser() user: User) {
    return this.jobsService.toggleSaveJob(id, user.id);
  }

  @Get('saved')
  @UseGuards(AuthGuardGuard)
  async getSavedJobs(@GetUser() user: User) {
    return this.jobsService.getSavedJobs(user.id);
  }

  // Job recommendations endpoints
  @Get('recommendations')
  @UseGuards(AuthGuardGuard)
  getRecommendations(
    @Query() query: GetRecommendationsDto,
    @GetUser() user: User,
  ) {
    return this.recommendationService.generateRecommendations(user.id, query);
  }

  @Get('recommendations/metrics')
  @UseGuards(AuthGuardGuard)
  getRecommendationMetrics(
    @GetUser() user: User,
  ): Promise<RecommendationMetricsDto> {
    return this.recommendationService.getRecommendationMetrics(user.id);
  }

  /**
   * Initiate a payment for a job (Web3 payment)
   * POST /jobs/:id/pay
   */
  @ApiOperation({
    summary: 'Initiate a payment for a job using Starknet smart contract',
  })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiBody({ type: PaymentRequestDto, description: 'Payment request payload' })
  @ApiResponse({
    status: 201,
    description: 'Transaction hash returned if successful',
  })
  @Post(':id/pay')
  @UseGuards(AuthGuardGuard)
  async payForJob(
    @Param('id', ParseIntPipe) id: number,
    @Body() paymentDto: PaymentRequestDto,
    @GetUser() user: User,
  ) {
    if (!paymentDto.contractAddress) {
      throw new NotFoundException('contractAddress is required');
    }
    if (!user?.id) {
      throw new UnauthorizedException(
        'User must be authenticated to make a payment',
      );
    }
    const job = await this.jobsService.findJobById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (job.recruiterId !== user.id) {
      throw new UnauthorizedException(
        'You are not authorized to pay for this job',
      );
    }
    const from = user.id;
    return this.blockchainService.makePayment(
      paymentDto.recipient,
      paymentDto.amount,
      paymentDto.abi,
      paymentDto.contractAddress,
      from,
      paymentDto.type,
    );
  }

  /**
   * Check and update the status of a transaction
   * GET /jobs/tx/:txHash/status
   */
  @ApiOperation({
    summary:
      'Check and update the status of a blockchain transaction by its hash',
  })
  @ApiParam({ name: 'txHash', description: 'Transaction hash' })
  @ApiResponse({ status: 200, description: 'Current transaction status' })
  @Get('tx/:txHash/status')
  async getTransactionStatus(@Param('txHash') txHash: string) {
    return this.blockchainService.trackTransactionStatus(txHash);
  }

  @Patch('recommendations/:id/action')
  @UseGuards(AuthGuardGuard)
  updateRecommendationAction(
    @Param('id') recommendationId: string,
    @Body() action: UpdateRecommendationActionDto,
    @GetUser() user: User,
  ) {
    return this.recommendationService.updateRecommendationAction(
      recommendationId,
      action,
      user.id,
    );
  }

  @Post('templates')
  @UseGuards(AuthGuardGuard)
  async createTemplate(
    @Body() createTemplateDto: CreateTemplateDto,
    @GetUser() user: User,
  ): Promise<JobTemplate> {
    return this.jobsService.createTemplate({
      ...createTemplateDto,
      createdBy: user.id,
    });
  }

  @Get('templates')
  @UseGuards(AuthGuardGuard)
  async findAllTemplates(
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('includeShared') includeShared?: string,
    @GetUser() user?: User,
  ): Promise<JobTemplate[]> {
    const tagsArray = tags
      ? tags.split(',').map((tag) => tag.trim())
      : undefined;
    const includeSharedBool = includeShared !== 'false';
    return this.jobsService.findAllTemplates(
      user!.id,
      category,
      tagsArray,
      includeSharedBool,
    );
  }

  @Get('templates/categories')
  @UseGuards(AuthGuardGuard)
  async getTemplateCategories(@GetUser() user: User): Promise<string[]> {
    return this.jobsService.getTemplateCategories(user.id);
  }

  @Get('templates/tags')
  @UseGuards(AuthGuardGuard)
  async getTemplateTags(@GetUser() user: User): Promise<string[]> {
    return this.jobsService.getTemplateTags(user.id);
  }

  @Get('templates/stats')
  @UseGuards(AuthGuardGuard)
  async getTemplateStats(@GetUser() user: User): Promise<any> {
    return this.jobsService.getTemplateStats(user.id);
  }

  @Get('templates/:id')
  @UseGuards(AuthGuardGuard)
  async findTemplateById(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ): Promise<JobTemplate> {
    return this.jobsService.findTemplateById(id, user.id);
  }

  @Patch('templates/:id')
  @UseGuards(AuthGuardGuard)
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @GetUser() user: User,
  ): Promise<JobTemplate> {
    return this.jobsService.updateTemplate(id, updateTemplateDto, user.id);
  }

  @Delete('templates/:id')
  @UseGuards(AuthGuardGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ): Promise<void> {
    await this.jobsService.deleteTemplate(id, user.id);
  }

  @Post('templates/:id/share')
  @UseGuards(AuthGuardGuard)
  async shareTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ): Promise<JobTemplate> {
    return this.jobsService.shareTemplate(id, user.id);
  }

  @Post('templates/:id/unshare')
  @UseGuards(AuthGuardGuard)
  async unshareTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ): Promise<JobTemplate> {
    return this.jobsService.unshareTemplate(id, user.id);
  }

  @Post('templates/:id/create-job')
  @UseGuards(AuthGuardGuard)
  async createJobFromTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createJobFromTemplateDto: CreateJobFromTemplateDto,
    @GetUser() user: User,
  ): Promise<Job> {
    return this.jobsService.createJobFromTemplate(
      { ...createJobFromTemplateDto, templateId: id },
      user.id,
    );
  }

  @Post(':id/extend')
  async extendJob(@Param('id') id: string, @Body() extendJobDto: ExtendJobDto) {
    return this.jobsService.extendJob(id, extendJobDto);
  }

  @Post(':id/renew')
  async renewJob(@Param('id') id: string) {
    return this.jobsService.renewJob(id);
  }

  @Get('expiring')
  async getExpiringJobs(@Query('days') days: string = '7') {
    return this.jobsService.findJobsExpiringIn(parseInt(days));
  }

  @Get('expired')
  async getExpiredJobs() {
    return this.jobsService.findExpiredJobs();
  }

  @Post(':id/archive')
  async archiveJob(@Param('id') id: string) {
    return this.jobsService.archiveJob(id);
  }

  @Post('cleanup/expired')
  async processExpiredJobs() {
    await this.jobsService.processJobExpiry();
    return { message: 'Expired jobs processed' };
  }

  @Post('cleanup/inactive')
  async processInactiveJobs() {
    await this.jobsService.archiveInactiveJobs();
    return { message: 'Inactive jobs archived' };
  }
}
