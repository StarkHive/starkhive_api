import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async create(senderId: string, receiverId: string, message: string): Promise<Message> {
    const newMessage = this.messageRepository.create({
      senderId,
      receiverId,
      message,
    });
    return await this.messageRepository.save(newMessage);
  }

  async findAll(): Promise<Message[]> {
    return await this.messageRepository.find();
  }

  async findOne(id: string): Promise<Message> {
    const message = await this.messageRepository.findOne({ where: { id } });
    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }
    return message;
  }

  async findUserMessages(userId: string): Promise<Message[]> {
    return await this.messageRepository.find({
      where: [
        { senderId: userId },
        { receiverId: userId },
      ],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async markAsRead(id: string): Promise<Message> {
    const message = await this.findOne(id);
    message.isRead = true;
    return await this.messageRepository.save(message);
  }
} 