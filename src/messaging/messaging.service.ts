import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async create(
    senderId: string,
    createMessageDto: CreateMessageDto,
  ): Promise<Message> {
    if (senderId === createMessageDto.receiverId) {
      throw new BadRequestException('Cannot send message to yourself');
    }

    const newMessage = this.messageRepository.create({
      senderId,
      receiverId: createMessageDto.receiverId,
      message: createMessageDto.message,
    });
    return await this.messageRepository.save(newMessage);
  }

  async findAll(): Promise<Message[]> {
    return await this.messageRepository.find();
  }

  async findUserMessages(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ messages: Message[]; total: number }> {
    const [messages, total] = await this.messageRepository.findAndCount({
      where: [{ senderId: userId }, { receiverId: userId }],
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { messages, total };
  }

  async findOne(id: string, userId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({ where: { id } });
    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    if (message.senderId !== userId && message.receiverId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this message',
      );
    }

    return message;
  }

  async markAsRead(id: string, userId: string): Promise<Message> {
    const message = await this.findOne(id, userId);

    if (message.receiverId !== userId) {
      throw new ForbiddenException(
        'Only the message recipient can mark it as read',
      );
    }

    message.isRead = true;
    return await this.messageRepository.save(message);
  }
}
