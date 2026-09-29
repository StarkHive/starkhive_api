import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Dispute } from './dispute.entity';

/**
 * A single piece of evidence attached to a dispute.
 *
 * This records a *reference* to an uploaded file rather than its bytes. The
 * repository has no working object-storage service yet
 * (`CertificateUploadService` is a stub), so binary upload is deliberately out
 * of scope here: the mediation workflow needs the evidence trail — who
 * submitted what, when, and on which side — and that is what this stores.
 * Pointing `fileUrl` at real storage later requires no change to the dispute
 * model.
 */
@Entity('dispute_evidence')
@Index(['disputeId', 'createdAt'])
export class DisputeEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @ManyToOne(() => Dispute, (dispute) => dispute.evidence, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'disputeId' })
  dispute: Dispute;

  /** Party who submitted it — either side of the dispute, or an admin. */
  @Column()
  submittedById: string;

  @Column()
  fileUrl: string;

  @Column()
  fileName: string;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string | null;

  @Column({ type: 'int', nullable: true })
  fileSizeBytes: number | null;

  /** Optional explanation of what the file is meant to show. */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
