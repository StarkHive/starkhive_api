import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, Length } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ description: 'ID of the message receiver' })
  @IsNotEmpty()
  @IsUUID()
  receiverId: string;

  @ApiProperty({
    description: 'Content of the message',
    minLength: 1,
    maxLength: 1000,
  })
  @IsNotEmpty()
  @IsString()
  @Length(1, 1000, { message: 'Message must be between 1 and 1000 characters' })
  message: string;
}
