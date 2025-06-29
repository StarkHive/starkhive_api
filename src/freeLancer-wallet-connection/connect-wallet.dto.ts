import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConnectWalletDto {
  @ApiProperty({
    description: 'Cryptocurrency wallet address (Ethereum format)',
    example: '0x742d35Cc6634C0532925a3b8D5F4E8B8B6D8c4f3',
    pattern: '^0x[a-fA-F0-9]{40}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Wallet address must be a valid Ethereum address format',
  })
  @Length(42, 42, {
    message: 'Wallet address must be exactly 42 characters long',
  })
  walletAddress: string;
}
