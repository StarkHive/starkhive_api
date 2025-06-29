import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    description: 'The content of the message',
    example: 'Hello, I would like to discuss your project proposal.',
    maxLength: 2000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000, { message: 'Message content cannot exceed 2000 characters' })
  content: string;

  @ApiProperty({
    description: 'The ID of the recipient user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  recipientId: string;
}
