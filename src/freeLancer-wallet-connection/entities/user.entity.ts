import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ default: 'freelancer' })
  role: string;

  // Crypto wallet field - unique and immutable after first save
  @Column({
    nullable: true,
    unique: true,
    name: 'wallet_address',
    comment: 'Cryptocurrency wallet address - read-only after initial save',
  })
  @Index('idx_wallet_address', { unique: true })
  walletAddress: string | null;

  @Column({
    nullable: true,
    name: 'wallet_connected_at',
    comment: 'Timestamp when wallet was first connected',
  })
  walletConnectedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual property to check if wallet is connected
  get isWalletConnected(): boolean {
    return !!this.walletAddress;
  }

  // Virtual property to check if wallet can be modified
  get canModifyWallet(): boolean {
    return !this.walletAddress;
  }
}
