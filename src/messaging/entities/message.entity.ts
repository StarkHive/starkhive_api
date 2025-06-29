import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';

@Entity('messages')
export class Message {
  @ApiProperty({ description: 'Unique identifier of the message' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID of the message sender' })
  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column()
  senderId: string;

  @ApiProperty({ description: 'ID of the message receiver' })
  @ManyToOne(() => User)
  @JoinColumn({ name: 'receiverId' })
  receiver: User;

  @Column()
  receiverId: string;

  @ApiProperty({
    description: 'Content of the message',
    minLength: 1,
    maxLength: 1000,
  })
  @Column('text')
  @IsNotEmpty()
  @Length(1, 1000, { message: 'Message must be between 1 and 1000 characters' })
  message: string;

  @ApiProperty({ description: 'Whether the message has been read' })
  @Column({ default: false })
  isRead: boolean;

  @ApiProperty({ description: 'When the message was created' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'When the message was last updated' })
  @UpdateDateColumn()
  updatedAt: Date;
}
