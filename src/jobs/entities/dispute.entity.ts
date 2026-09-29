import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { DisputeEvidence } from './dispute-evidence.entity';

/** What the dispute is about. */
export enum DisputeCategory {
  PAYMENT = 'payment',
  JOB_COMPLETION = 'job_completion',
  OTHER = 'other',
}

/**
 * Dispute lifecycle.
 *
 * open -> under_review -> resolved
 *   \-> cancelled (withdrawn by the filer, only while still open)
 *
 * `resolved` and `cancelled` are terminal: a dispute that has been settled
 * must not accept new evidence or a second resolution.
 */
export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

/**
 * The outcome an admin decided, and what it does to the escrow.
 *
 * Each outcome maps to exactly one escrow end state, which is what makes
 * resolution *enforced* rather than merely recorded.
 */
export enum DisputeResolution {
  /** Freelancer keeps the full amount — escrow is released. */
  RELEASE_TO_FREELANCER = 'release_to_freelancer',
  /** Recruiter gets the full amount back — escrow is refunded. */
  REFUND_TO_RECRUITER = 'refund_to_recruiter',
  /** Partial award to the freelancer — escrow is released for `awardedAmount`. */
  SPLIT = 'split',
  /** No merit found — the escrow returns to its locked state. */
  DISMISSED = 'dismissed',
}

@Entity('disputes')
@Index(['status', 'createdAt'])
@Index(['escrowId'])
@Index(['filedById'])
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Escrow whose funds this dispute contests. */
  @Column()
  escrowId: string;

  /** Denormalised from the escrow so disputes can be listed per job. */
  @Column()
  jobId: string;

  /** Party who raised the dispute. Always the recruiter or the freelancer. */
  @Column()
  filedById: string;

  /** The other party to the escrow. Derived, never client-supplied. */
  @Column()
  respondentId: string;

  @Column({ type: 'enum', enum: DisputeCategory })
  category: DisputeCategory;

  @Column('text')
  description: string;

  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  /** Admin who took the case, set when it moves to under_review. */
  @Column({ type: 'varchar', nullable: true })
  assignedAdminId: string | null;

  @Column({ type: 'enum', enum: DisputeResolution, nullable: true })
  resolution: DisputeResolution | null;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string | null;

  /**
   * Amount awarded to the freelancer. Only meaningful for a SPLIT outcome;
   * the other outcomes are fully determined by the escrow amount.
   */
  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  awardedAmount: number | null;

  @Column({ type: 'varchar', nullable: true })
  resolvedById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @OneToMany(() => DisputeEvidence, (evidence) => evidence.dispute)
  evidence: DisputeEvidence[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
