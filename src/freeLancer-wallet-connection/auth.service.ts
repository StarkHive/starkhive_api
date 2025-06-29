import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { User } from './entities/user.entity';
import { ConnectWalletDto } from './connect-wallet.dto';
import {
  WalletAddressAlreadyExistsException,
  WalletAlreadyConnectedException,
} from './entities/exceptions/wallet.exceptions';
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // Existing auth methods would be here...

  /**
   * Connect a crypto wallet to user profile
   * @param userId - User ID
   * @param connectWalletDto - Wallet connection data
   * @returns Updated user with wallet information
   */
  async connectWallet(
    userId: number,
    connectWalletDto: ConnectWalletDto,
  ): Promise<Omit<User, 'password'>> {
    // Find the user
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if wallet is already connected (read-only enforcement)
    if (user.walletAddress) {
      throw new WalletAlreadyConnectedException();
    }

    // Normalize wallet address to lowercase for consistency
    const normalizedWalletAddress =
      connectWalletDto.walletAddress.toLowerCase();

    try {
      // Update user with wallet information
      user.walletAddress = normalizedWalletAddress;
      user.walletConnectedAt = new Date();

      const updatedUser = await this.userRepository.save(user);

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;

      return {
        ...userWithoutPassword,
        isWalletConnected: updatedUser.isWalletConnected,
        canModifyWallet: updatedUser.canModifyWallet,
      };
    } catch (error) {
      // Handle unique constraint violation
      if (
        error instanceof QueryFailedError &&
        error.message.includes('duplicate')
      ) {
        throw new WalletAddressAlreadyExistsException();
      }
      throw error;
    }
  }

  /**
   * Get user wallet information
   * @param userId - User ID
   * @returns Wallet information
   */
  async getWalletInfo(userId: number): Promise<{
    walletAddress: string | null;
    walletConnectedAt: Date | null;
    isWalletConnected: boolean;
    canModifyWallet: boolean;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'walletAddress', 'walletConnectedAt'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      walletAddress: user.walletAddress,
      walletConnectedAt: user.walletConnectedAt,
      isWalletConnected: user.isWalletConnected,
      canModifyWallet: user.canModifyWallet,
    };
  }

  /**
   * Check if a wallet address is already in use
   * @param walletAddress - Wallet address to check
   * @returns Boolean indicating if address exists
   */
  async isWalletAddressInUse(walletAddress: string): Promise<boolean> {
    const existingUser = await this.userRepository.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
    });
    return !!existingUser;
  }
}
