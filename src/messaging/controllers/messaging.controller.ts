import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt.strategy';
import { MessagingService } from '../providers/messaging.service';
import { MessageResponseDto } from '../dto/message-response.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { GetMessagesDto } from '../dto/get-messages.dto';

@ApiTags('messaging')
@Controller('messaging')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt-auth')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a direct message to another user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Message sent successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Recipient not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  @ApiBody({ type: SendMessageDto })
  async sendMessage(@Body() messageDto: SendMessageDto, @Request() req) {
    const senderId = req.user.id;
    return this.messagingService.sendMessage(senderId, messageDto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations for the current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of conversations retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async getConversations(@Request() req) {
    const userId = req.user.id;
    return this.messagingService.getConversations(userId);
  }

  @Get('conversation')
  @ApiOperation({
    summary: 'Get messages between the current user and another user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Messages retrieved successfully',
    type: [MessageResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async getConversation(@Request() req, @Query() params: GetMessagesDto) {
    const userId = req.user.id;
    return this.messagingService.getConversation(userId, params);
  }

  @Patch('mark-read/:userId')
  @ApiOperation({ summary: 'Mark all messages from a user as read' })
  @ApiParam({
    name: 'userId',
    description: 'ID of the user whose messages to mark as read',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Messages marked as read successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async markAsRead(
    @Request() req,
    @Param('userId') conversationUserId: string,
  ) {
    const userId = req.user.id;
    return this.messagingService.markAsRead(userId, conversationUserId);
  }
}
