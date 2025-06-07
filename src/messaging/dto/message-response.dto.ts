import { ApiProperty } from "@nestjs/swagger"
import { Type } from "class-transformer"

class UserInfoDto {
  @ApiProperty({
    description: "User ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string

  @ApiProperty({
    description: "User email",
    example: "user@example.com",
  })
  email: string
}

class MessageMetaDto {
  @ApiProperty({
    description: "Total number of messages",
    example: 42,
  })
  total: number

  @ApiProperty({
    description: "Current page number",
    example: 1,
  })
  page: number

  @ApiProperty({
    description: "Number of messages per page",
    example: 20,
  })
  limit: number

  @ApiProperty({
    description: "Total number of pages",
    example: 3,
  })
  totalPages: number

  @ApiProperty({
    description: "Number of unread messages in the conversation",
    example: 5,
  })
  unreadCount: number

  @ApiProperty({
    description: "Information about the other participant",
    type: UserInfoDto,
  })
  @Type(() => UserInfoDto)
  participant: UserInfoDto

  @ApiProperty({
    description: "Current sort order",
    enum: ["ASC", "DESC"],
    example: "DESC",
  })
  sortOrder: "ASC" | "DESC"
}

export class MessageResponseDto {
  @ApiProperty({
    description: "Unique identifier for the message",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string

  @ApiProperty({
    description: "The content of the message",
    example: "Hello, I would like to discuss your project proposal.",
  })
  content: string

  @ApiProperty({
    description: "Information about the sender",
    type: UserInfoDto,
  })
  @Type(() => UserInfoDto)
  sender: UserInfoDto

  @ApiProperty({
    description: "Information about the recipient",
    type: UserInfoDto,
  })
  @Type(() => UserInfoDto)
  recipient: UserInfoDto

  @ApiProperty({
    description: "Whether the message has been read",
    example: false,
  })
  isRead: boolean

  @ApiProperty({
    description: "When the message was sent",
    example: "2023-06-01T12:00:00Z",
  })
  createdAt: Date
}

export class ConversationResponseDto {
  @ApiProperty({
    description: "List of messages",
    type: [MessageResponseDto],
  })
  @Type(() => MessageResponseDto)
  data: MessageResponseDto[]

  @ApiProperty({
    description: "Metadata about the conversation and pagination",
    type: MessageMetaDto,
  })
  @Type(() => MessageMetaDto)
  meta: MessageMetaDto
}
