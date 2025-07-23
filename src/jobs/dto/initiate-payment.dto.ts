import { IsEnum, IsNotEmpty, IsNumber, IsUUID } from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID()
  jobId: string;

  @IsUUID()
  recruiterId: string;

  @IsUUID()
  freelancerId: string;

  @IsNumber()
  amount: number;

  @IsEnum(['ETH', 'USDC', 'STRK'])
  currency: 'ETH' | 'USDC' | 'STRK';
}

export class CreateEscrowDto extends InitiatePaymentDto {}
