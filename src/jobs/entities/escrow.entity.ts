import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Job } from './job.entity';

export enum EscrowStatus {
  LOCKED = 'locked',
  RELEASED = 'released',
  DISPUTED = 'disputed',
  REFUNDED = 'refunded',
}

@Entity('escrows')
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  jobId: string;

  @ManyToOne(() => Job, { eager: true })
  @JoinColumn({ name: 'jobId' })
  job: Job;

  @Column()
  recruiterId: string;

  @Column()
  freelancerId: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  @Column({ type: 'enum', enum: ['ETH', 'USDC', 'STRK'] })
  currency: 'ETH' | 'USDC' | 'STRK';

  @Column({ type: 'enum', enum: EscrowStatus, default: EscrowStatus.LOCKED })
  status: EscrowStatus;

  @Column({ type: 'timestamp', nullable: true })
  lockedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  releasedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  disputedAt?: Date;

  @Column({ type: 'text', nullable: true })
  disputeReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
