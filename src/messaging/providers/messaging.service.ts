import { Injectable, NotFoundException } from "@nestjs/common"
import { Repository } from "typeorm"
import { Inject } from "@nestjs/common"
import { getRepositoryToken } from "@nestjs/typeorm"
import { User } from "src/auth/entities/user.entity"
import { Message } from "../entities/messaging.entity"
import { SendMessageDto } from "../dto/send-message.dto"
import { GetConversationDto } from "../dto/get-conversation.dto"

@Injectable()
export class MessagingService {
  constructor(
    @Inject(getRepositoryToken(Message))
    private readonly messageRepository: Repository<Message>,
    @Inject(getRepositoryToken(User))
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Send a message from one user to another
   * @param senderId The ID of the sender
   * @param messageDto The message data
   * @returns The created message
   */
  async sendMessage(senderId: string, messageDto: SendMessageDto): Promise<Message> {
    const { recipientId, content } = messageDto

    // Check if recipient exists
    const recipient = await this.userRepository.findOne({ where: { id: recipientId } })
    if (!recipient) {
      throw new NotFoundException("Recipient not found")
    }

    // Create and save the message
    const message = this.messageRepository.create({
      content,
      senderId,
      recipientId,
      isRead: false,
    })

    return this.messageRepository.save(message)
  }

  /**
   * Get messages between the current user and another user
   * @param currentUserId The ID of the current user
   * @param params Query parameters for pagination, filtering, and sorting
   * @returns Paginated messages with metadata
   */
  async getConversation(currentUserId: string, params: GetConversationDto) {
    const { userId, page = 1, limit = 20, sortOrder = "DESC", autoMarkRead = false } = params

    // Check if the other user exists
    const otherUser = await this.userRepository.findOne({ where: { id: userId } })
    if (!otherUser) {
      throw new NotFoundException("User not found")
    }

    // Get messages between the two users
    const [messages, total] = await this.messageRepository.findAndCount({
      where: [
        { senderId: currentUserId, recipientId: userId },
        { senderId: userId, recipientId: currentUserId },
      ],
      order: { createdAt: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      relations: ["sender", "recipient"],
      select: {
        sender: {
          id: true,
          email: true,
        },
        recipient: {
          id: true,
          email: true,
        },
      },
    })

    // Only mark messages as read if autoMarkRead is true
    if (autoMarkRead) {
      const unreadMessages = messages.filter((message) => message.recipientId === currentUserId && !message.isRead)

      if (unreadMessages.length > 0) {
        await Promise.all(
          unreadMessages.map(async (message) => {
            message.isRead = true
            return this.messageRepository.save(message)
          }),
        )
      }
    }

    // Count unread messages for the current user
    const unreadCount = messages.reduce((count, message) => 
      message.recipientId === currentUserId && !message.isRead ? count + 1 : count, 0
    )

    return {
      data: messages,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
        participant: {
          id: otherUser.id,
          email: otherUser.email,
        },
        sortOrder,
      },
    }
  }

  /**
   * Get all conversations for a user
   * @param userId The ID of the user
   * @returns List of conversations with the latest message
   */
  async getConversations(userId: string) {
    // Get all unique users the current user has exchanged messages with
    const query = this.messageRepository
      .createQueryBuilder("message")
      .select("CASE WHEN message.senderId = :userId THEN message.recipientId ELSE message.senderId END", "otherUserId")
      .addSelect("MAX(message.createdAt)", "lastMessageAt")
      .where("message.senderId = :userId OR message.recipientId = :userId", { userId })
      .groupBy("otherUserId")
      .orderBy("lastMessageAt", "DESC")

    const conversations = await query.getRawMany()

    // Get the latest message and user details for each conversation
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId = conv.otherUserId

        // Get the other user's details
        const otherUser = await this.userRepository.findOne({
          where: { id: otherUserId },
          select: ["id", "email", "role"], // Add any other fields you want to include
        })

        if (!otherUser) {
          return null // Skip if user not found (might have been deleted)
        }

        // Get the latest message
        const latestMessage = await this.messageRepository.findOne({
          where: [
            { senderId: userId, recipientId: otherUserId },
            { senderId: otherUserId, recipientId: userId },
          ],
          order: { createdAt: "DESC" },
        })

        // Count unread messages
        const unreadCount = await this.messageRepository.count({
          where: {
            senderId: otherUserId,
            recipientId: userId,
            isRead: false,
          },
        })

        return {
          user: otherUser,
          latestMessage,
          unreadCount,
        }
      }),
    )

    // Filter out any null values (from deleted users)
    return conversationsWithDetails.filter(Boolean)
  }

  /**
   * Mark messages as read
   * @param userId The ID of the current user
   * @param conversationUserId The ID of the other user in the conversation
   * @returns Number of messages marked as read
   */
  async markAsRead(userId: string, conversationUserId: string) {
    const result = await this.messageRepository.update(
      {
        senderId: conversationUserId,
        recipientId: userId,
        isRead: false,
      },
      { isRead: true },
    )

    return { markedAsRead: result.affected || 0 }
  }
}
