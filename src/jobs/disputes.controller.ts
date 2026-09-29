import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.strategy';
import { AdminGuard } from '../auth/admin.guard';
import { DisputeActor, DisputesService } from './disputes.service';
import { FileDisputeDto } from './dto/file-dispute.dto';
import { SubmitEvidenceDto } from './dto/submit-evidence.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { QueryDisputesDto } from './dto/query-disputes.dto';

/** The request as the JWT strategy leaves it, with the decoded user attached. */
interface AuthenticatedRequest {
  user: DisputeActor;
}

@ApiTags('disputes')
@ApiBearerAuth('jwt-auth')
@UseGuards(JwtAuthGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  private actor(req: AuthenticatedRequest): DisputeActor {
    return req.user;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'File a dispute against an escrow',
    description:
      'Callable by either party to the escrow. The respondent is derived from the escrow, not supplied by the client.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Dispute filed' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Escrow already settled, or a dispute is already open on it',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Caller is not a party to the escrow',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Escrow not found',
  })
  fileDispute(@Body() dto: FileDisputeDto, @Req() req: AuthenticatedRequest) {
    return this.disputesService.fileDispute(this.actor(req), dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'List disputes the caller is a party to' })
  findMine(@Query() query: QueryDisputesDto, @Req() req: AuthenticatedRequest) {
    return this.disputesService.findMine(this.actor(req), query);
  }

  @Get('admin')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Admin mediation queue — every dispute, filtered',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admins only' })
  findAll(@Query() query: QueryDisputesDto) {
    return this.disputesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Fetch one dispute with its evidence trail',
    description:
      'Restricted to the two parties and to admins. A caller with no stake gets 404 rather than 403, so the endpoint does not confirm that two users are in conflict.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Not found, or not visible to the caller',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.disputesService.findOne(id, this.actor(req));
  }

  @Post(':id/evidence')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Attach evidence to an open dispute',
    description:
      'Records a reference to an uploaded file. Rejected once the dispute is resolved or cancelled.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Evidence recorded' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dispute is no longer accepting evidence',
  })
  submitEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitEvidenceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.disputesService.submitEvidence(id, this.actor(req), dto);
  }

  @Patch(':id/assign')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Admin takes the case, moving it to under review' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admins only' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.disputesService.assignToAdmin(id, this.actor(req));
  }

  @Patch(':id/resolve')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Record the decision and enforce it against the escrow',
    description:
      'Each outcome maps to one escrow end state. The dispute and the escrow are written in a single transaction.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dispute resolved and escrow updated',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Already settled, or awardedAmount disagrees with the outcome',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admins only' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.disputesService.resolve(id, this.actor(req), dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Withdraw a dispute',
    description: 'Filer only, and only while the dispute is still open.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Dispute withdrawn' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only the filer can withdraw',
  })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.disputesService.cancel(id, this.actor(req));
  }
}
