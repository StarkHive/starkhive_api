import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt.strategy';
import { ConnectWalletDto } from './connect-wallet.dto';

@ApiTags('Authentication & Wallet')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Existing auth endpoints would be here...

  @Post('connect-wallet')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Connect crypto wallet to freelancer profile',
    description:
      'Connects a cryptocurrency wallet address to the user profile. This is a one-time operation and cannot be modified once set.',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet successfully connected',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        email: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        role: { type: 'string' },
        walletAddress: { type: 'string' },
        walletConnectedAt: { type: 'string', format: 'date-time' },
        isWalletConnected: { type: 'boolean' },
        canModifyWallet: { type: 'boolean' },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Wallet already connected or address already in use',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        error: { type: 'string' },
        statusCode: { type: 'number' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async connectWallet(
    @Request() req: any,
    @Body() connectWalletDto: ConnectWalletDto,
  ) {
    const userId = req.user.id; // Assuming JWT payload contains user id
    return await this.authService.connectWallet(userId, connectWalletDto);
  }

  @Get('wallet-info')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get wallet information',
    description:
      'Retrieves the current wallet information for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        walletAddress: { type: 'string', nullable: true },
        walletConnectedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
        },
        isWalletConnected: { type: 'boolean' },
        canModifyWallet: { type: 'boolean' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async getWalletInfo(@Request() req: any) {
    const userId = req.user.id;
    return await this.authService.getWalletInfo(userId);
  }
}
