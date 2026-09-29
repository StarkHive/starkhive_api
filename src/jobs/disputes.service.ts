import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { Escrow, EscrowStatus } from './entities/escrow.entity';
import {
  Dispute,
  DisputeResolution,
  DisputeStatus,
} from './entities/dispute.entity';
import { DisputeEvidence } from './entities/dispute-evidence.entity';
import { FileDisputeDto } from './dto/file-dispute.dto';
import { SubmitEvidenceDto } from './dto/submit-evidence.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { QueryDisputesDto } from './dto/query-disputes.dto';
import { UserRole } from '../auth/enums/userRole.enum';

/** The caller, as the JWT strategy puts it on the request. */
export interface DisputeActor {
  id: string;
  role?: UserRole | string;
}

/** Statuses a dispute can still be worked on in. */
const ACTIVE_STATUSES = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW];

/** Escrow states that are already settled, so nothing is left to contest. */
const SETTLED_ESCROW_STATUSES = [EscrowStatus.RELEASED, EscrowStatus.REFUNDED];

/**
 * Each outcome maps to exactly one escrow end state. Keeping this as a total
 * map rather than a chain of ifs means adding a resolution without deciding
 * what it does to the money is a compile error, not a silent no-op.
 */
const ESCROW_OUTCOME: Record<DisputeResolution, EscrowStatus> = {
  [DisputeResolution.RELEASE_TO_FREELANCER]: EscrowStatus.RELEASED,
  [DisputeResolution.REFUND_TO_RECRUITER]: EscrowStatus.REFUNDED,
  [DisputeResolution.SPLIT]: EscrowStatus.RELEASED,
  // No merit found: the escrow goes back to where it was before the dispute.
  [DisputeResolution.DISMISSED]: EscrowStatus.LOCKED,
};

/**
 * Postgres returns `decimal` columns as strings, so an escrow amount read back
 * from the database is not safe to compare numerically as-is.
 */
function toAmount(value: number | string): number {
  return typeof value === 'number' ? value : Number.parseFloat(value);
}

function isAdmin(actor: DisputeActor): boolean {
  return actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;
}

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
    @InjectRepository(DisputeEvidence)
    private readonly evidenceRepository: Repository<DisputeEvidence>,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Files a dispute against an escrow.
   *
   * The respondent is derived from the escrow rather than taken from the
   * request: letting a client name the other party would let it point a
   * dispute at someone with no stake in the job.
   */
  async fileDispute(
    actor: DisputeActor,
    dto: FileDisputeDto,
  ): Promise<Dispute> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: dto.escrowId },
    });
    if (!escrow) {
      throw new NotFoundException(`Escrow ${dto.escrowId} not found`);
    }

    const isRecruiter = escrow.recruiterId === actor.id;
    const isFreelancer = escrow.freelancerId === actor.id;
    if (!isRecruiter && !isFreelancer) {
      throw new ForbiddenException(
        'Only the recruiter or the freelancer on this escrow can file a dispute.',
      );
    }

    if (SETTLED_ESCROW_STATUSES.includes(escrow.status)) {
      throw new BadRequestException(
        `Escrow is already ${escrow.status}; there are no funds left to dispute.`,
      );
    }

    const existing = await this.disputeRepository.findOne({
      where: { escrowId: escrow.id, status: In(ACTIVE_STATUSES) },
    });
    if (existing) {
      throw new BadRequestException(
        `Dispute ${existing.id} is already open on this escrow.`,
      );
    }

    const dispute = this.disputeRepository.create({
      escrowId: escrow.id,
      jobId: escrow.jobId,
      filedById: actor.id,
      respondentId: isRecruiter ? escrow.freelancerId : escrow.recruiterId,
      category: dto.category,
      description: dto.description,
      status: DisputeStatus.OPEN,
    });

    const saved = await this.disputeRepository.save(dispute);

    // Flag the escrow so the rest of the system stops treating it as routine.
    escrow.status = EscrowStatus.DISPUTED;
    await this.escrowRepository.save(escrow);

    return saved;
  }

  /** Lists disputes the caller is a party to. */
  async findMine(
    actor: DisputeActor,
    query: QueryDisputesDto,
  ): Promise<{ data: Dispute[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.disputeRepository
      .createQueryBuilder('dispute')
      .where(
        '(dispute.filedById = :actorId OR dispute.respondentId = :actorId)',
        { actorId: actor.id },
      );

    this.applyFilters(qb, query);

    const [data, total] = await qb
      .orderBy('dispute.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  /** Admin queue: every dispute, filtered. */
  async findAll(
    query: QueryDisputesDto,
  ): Promise<{ data: Dispute[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.disputeRepository.createQueryBuilder('dispute');
    this.applyFilters(qb, query);

    const [data, total] = await qb
      .orderBy('dispute.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  private applyFilters(
    qb: SelectQueryBuilder<Dispute>,
    query: QueryDisputesDto,
  ): void {
    if (query.status) {
      qb.andWhere('dispute.status = :status', { status: query.status });
    }
    if (query.category) {
      qb.andWhere('dispute.category = :category', { category: query.category });
    }
    if (query.jobId) {
      qb.andWhere('dispute.jobId = :jobId', { jobId: query.jobId });
    }
  }

  /** Fetches one dispute with its evidence, enforcing read access. */
  async findOne(id: string, actor: DisputeActor): Promise<Dispute> {
    const dispute = await this.disputeRepository.findOne({
      where: { id },
      relations: ['evidence'],
    });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }
    this.assertCanView(dispute, actor);
    return dispute;
  }

  /**
   * Attaches evidence to an active dispute.
   *
   * Both parties and the mediating admin may submit. A resolved or cancelled
   * dispute is closed to new evidence, so the record an admin decided on
   * cannot be edited after the fact.
   */
  async submitEvidence(
    id: string,
    actor: DisputeActor,
    dto: SubmitEvidenceDto,
  ): Promise<DisputeEvidence> {
    const dispute = await this.disputeRepository.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }
    this.assertCanView(dispute, actor);

    if (!ACTIVE_STATUSES.includes(dispute.status)) {
      throw new BadRequestException(
        `Dispute is ${dispute.status}; evidence can only be added while it is open or under review.`,
      );
    }

    const evidence = this.evidenceRepository.create({
      disputeId: dispute.id,
      submittedById: actor.id,
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
      mimeType: dto.mimeType ?? null,
      fileSizeBytes: dto.fileSizeBytes ?? null,
      note: dto.note ?? null,
    });

    return this.evidenceRepository.save(evidence);
  }

  /** Admin takes the case, moving it out of the unassigned queue. */
  async assignToAdmin(id: string, admin: DisputeActor): Promise<Dispute> {
    const dispute = await this.disputeRepository.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }
    if (dispute.status !== DisputeStatus.OPEN) {
      throw new BadRequestException(
        `Only an open dispute can be taken for review; this one is ${dispute.status}.`,
      );
    }

    dispute.status = DisputeStatus.UNDER_REVIEW;
    dispute.assignedAdminId = admin.id;
    return this.disputeRepository.save(dispute);
  }

  /**
   * Records the admin's decision and enforces it against the escrow.
   *
   * Both writes happen in one transaction: a dispute marked resolved while the
   * escrow still sits in `disputed` would leave the funds stranded with
   * nothing left in the queue to prompt anyone to fix it.
   */
  async resolve(
    id: string,
    admin: DisputeActor,
    dto: ResolveDisputeDto,
  ): Promise<Dispute> {
    const dispute = await this.disputeRepository.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }
    if (!ACTIVE_STATUSES.includes(dispute.status)) {
      throw new BadRequestException(
        `Dispute is already ${dispute.status} and cannot be resolved again.`,
      );
    }

    const escrow = await this.escrowRepository.findOne({
      where: { id: dispute.escrowId },
    });
    if (!escrow) {
      throw new NotFoundException(
        `Escrow ${dispute.escrowId} for this dispute no longer exists.`,
      );
    }

    const awardedAmount = this.resolveAwardedAmount(dto, escrow);

    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = dto.resolution;
    dispute.resolutionNotes = dto.resolutionNotes;
    dispute.awardedAmount = awardedAmount;
    dispute.resolvedById = admin.id;
    dispute.resolvedAt = new Date();
    escrow.status = ESCROW_OUTCOME[dto.resolution];

    await this.dataSource.transaction(async (manager) => {
      await manager.save(Dispute, dispute);
      await manager.save(Escrow, escrow);
    });

    return dispute;
  }

  /**
   * Validates the award against the outcome.
   *
   * A SPLIT without an amount is meaningless, and an amount attached to any
   * other outcome would silently disagree with what the escrow actually does.
   */
  private resolveAwardedAmount(
    dto: ResolveDisputeDto,
    escrow: Escrow,
  ): number | null {
    if (dto.resolution !== DisputeResolution.SPLIT) {
      if (dto.awardedAmount !== undefined) {
        throw new BadRequestException(
          'awardedAmount only applies to a SPLIT resolution; the other outcomes transfer the full escrow amount.',
        );
      }
      return null;
    }

    if (dto.awardedAmount === undefined) {
      throw new BadRequestException(
        'A SPLIT resolution must state the awardedAmount.',
      );
    }

    const escrowAmount = toAmount(escrow.amount);
    if (dto.awardedAmount >= escrowAmount) {
      throw new BadRequestException(
        `awardedAmount (${dto.awardedAmount}) must be less than the escrow amount (${escrowAmount}); use RELEASE_TO_FREELANCER to award the full amount.`,
      );
    }

    return dto.awardedAmount;
  }

  /**
   * Withdraws a dispute.
   *
   * Only the filer, and only while it is still open — once an admin has taken
   * the case, withdrawing would discard work already done on it.
   */
  async cancel(id: string, actor: DisputeActor): Promise<Dispute> {
    const dispute = await this.disputeRepository.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }
    if (dispute.filedById !== actor.id) {
      throw new ForbiddenException(
        'Only the party who filed a dispute can withdraw it.',
      );
    }
    if (dispute.status !== DisputeStatus.OPEN) {
      throw new BadRequestException(
        `A dispute can only be withdrawn while open; this one is ${dispute.status}.`,
      );
    }

    const escrow = await this.escrowRepository.findOne({
      where: { id: dispute.escrowId },
    });

    dispute.status = DisputeStatus.CANCELLED;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(Dispute, dispute);
      if (escrow && escrow.status === EscrowStatus.DISPUTED) {
        escrow.status = EscrowStatus.LOCKED;
        await manager.save(Escrow, escrow);
      }
    });

    return dispute;
  }

  private assertCanView(dispute: Dispute, actor: DisputeActor): void {
    if (isAdmin(actor)) {
      return;
    }
    if (dispute.filedById === actor.id || dispute.respondentId === actor.id) {
      return;
    }
    // Deliberately 404, not 403: confirming a dispute exists would leak that
    // two particular users are in conflict over a job.
    throw new NotFoundException(`Dispute ${dispute.id} not found`);
  }
}
