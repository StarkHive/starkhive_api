import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class EmailToken {
  @ApiProperty({
    description: 'Unique identifier for the email token',
    example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'The verification token',
    example: 'a1b2c3d4e5f6g7h8i9j0',
  })
  @Column({ unique: true })
  token: string;

  @ApiProperty({
    description: 'Expiration date of the token',
    example: '2023-12-31T23:59:59.999Z',
  })
  @Column()
  expiresAt: Date;

  @ApiProperty({
    description: 'Whether the token has been used',
    example: false,
  })
  @Column({ default: false })
  used: boolean;

  @ManyToOne(() => User, (user) => user.emailTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  constructor(partial?: Partial<EmailToken>) {
    Object.assign(this, partial);
  }
}
