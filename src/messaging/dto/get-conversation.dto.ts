import { ApiProperty } from "@nestjs/swagger"
import { IsUUID, IsOptional, IsInt, Min, Max, IsBoolean, IsIn } from "class-validator"
import { Type } from "class-transformer"

export class GetConversationDto {
  @ApiProperty({
    description: "The ID of the other user in the conversation",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: true,
  })
  @IsUUID()
  userId: string

  @ApiProperty({
    description: "Page number (1-indexed)",
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiProperty({
    description: "Number of messages per page",
    example: 20,
    default: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20

  @ApiProperty({
    description: "Sort order of messages",
    example: "DESC",
    enum: ["ASC", "DESC"],
    default: "DESC",
    required: false,
  })
  @IsOptional()
  @IsIn(["ASC", "DESC"])
  sortOrder?: "ASC" | "DESC" = "DESC"

  @ApiProperty({
    description: "Whether to automatically mark messages as read when retrieving them",
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  autoMarkRead?: boolean = false
}
