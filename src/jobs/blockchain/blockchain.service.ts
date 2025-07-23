import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider, RpcProvider, Contract } from 'starknet';
import { Transaction } from '../entities/transaction.entity';
import { TransactionStatus } from '../enums/transaction-status.enum';

// Define a type for Starknet transaction receipt with relevant properties
interface StarknetTxReceipt {
  finality_status?: string;
  execution_status?: string;
}

// ERC20 ABI fragment for balanceOf
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
];

// Supported tokens metadata
const SUPPORTED_TOKENS = {
  ETH: {
    symbol: 'ETH',
    contractAddress: null, // Native ETH, not ERC20
    decimals: 18,
  },
  USDC: {
    symbol: 'USDC',
    contractAddress: '0xUSDC_CONTRACT_ADDRESS', // Replace with actual
    decimals: 6,
  },
  STRK: {
    symbol: 'STRK',
    contractAddress: '0xSTRK_CONTRACT_ADDRESS', // Replace with actual
    decimals: 18,
  },
  // Add more stablecoins as needed
};

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: Provider;

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {
    const rpcUrl =
      // this should be replaced with your actual RPC URL or use an environment variable
      process.env.STARKNET_RPC_URL || 'https://free-rpc.starknet.io';
    this.provider = new RpcProvider({ nodeUrl: rpcUrl });
    this.logger.log(`Connected to Starknet RPC at ${rpcUrl}`);
  }

  /**
   * This is just an example of a Starknet contract instance.
   */
  getContract(address: string, abi: any): Contract {
    return new Contract(abi, address, this.provider);
  }

  /**
   * Log a transaction to the database
   */
  async logTransaction(data: Partial<Transaction>): Promise<Transaction> {
    const tx = this.transactionRepository.create(data);
    return this.transactionRepository.save(tx);
  }

  /**
   * Make a payment by calling the smart contract
   * @param recipient - Starknet address to send payment to
   * @param amount - Amount to send (as string for precision)
   * @param abi - Contract ABI
   * @param contractAddress - Contract address
   */
  async makePayment(
    recipient: string,
    amount: number,
    abi: any,
    contractAddress: string,
    from: string,
    type = 'payment',
  ): Promise<string> {
    try {
      const contract = this.getContract(contractAddress, abi);
      // Convert amount to number for contract call, but keep as string for DB
      const numericAmount = Number(amount);
      const tx = await contract.invoke('transfer', [recipient, numericAmount]);
      this.logger.log(`Payment transaction sent: ${tx.transaction_hash}`);
      // Log transaction as pending
      await this.logTransaction({
        txHash: tx.transaction_hash,
        status: TransactionStatus.PENDING,
        from,
        to: recipient,
        amount, // store as string
        type,
      });
      return tx.transaction_hash;
    } catch (error) {
      this.logger.error('Payment failed', error);
      throw error;
    }
  }

  /**
   * Update the status of a transaction in the database
   */
  async updateTransactionStatus(
    txHash: string,
    status: TransactionStatus,
  ): Promise<void> {
    await this.transactionRepository.update({ txHash }, { status });
  }

  /**
   * Track the status of a transaction by its hash
   * @param txHash - Transaction hash to check
   * @returns status string (e.g., 'pending', 'confirmed', 'rejected')
   */
  async trackTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      const txReceipt = (await this.provider.getTransactionReceipt(
        txHash,
      )) as StarknetTxReceipt | null;
      let status: TransactionStatus = TransactionStatus.PENDING;
      if (!txReceipt) {
        status = TransactionStatus.PENDING;
      } else {
        const chainStatus =
          txReceipt.finality_status || txReceipt.execution_status || 'unknown';
        switch (chainStatus) {
          case 'ACCEPTED_ON_L1':
          case 'ACCEPTED_ON_L2':
            status = TransactionStatus.CONFIRMED;
            break;
          case 'REJECTED':
            status = TransactionStatus.REJECTED;
            break;
          case 'FAILED':
            status = TransactionStatus.FAILED;
            break;
          default:
            status = TransactionStatus.UNKNOWN;
        }
      }
      await this.updateTransactionStatus(txHash, status);
      this.logger.log(`Transaction ${txHash} status: ${status}`);
      return status;
    } catch (error) {
      this.logger.error('Error tracking transaction status', error);
      throw error;
    }
  }

  /**
   * Get the token balance for a user address
   * @param address - User's wallet address
   * @param token - Token symbol (ETH, USDC, STRK, etc.)
   * @returns balance as a number (in token units)
   */
  async getTokenBalance(address: string, token: string): Promise<number> {
    const tokenMeta = SUPPORTED_TOKENS[token];
    if (!tokenMeta) throw new Error(`Unsupported token: ${token}`);
    if (token === 'ETH') {
      // TODO: Implement actual ETH balance check via Starknet provider
      // For now, mock a balance
      return 10; // Mock: 10 ETH
    }
    if (!tokenMeta.contractAddress)
      throw new Error('Token contract address missing');
    // ERC20 balanceOf
    const contract = this.getContract(tokenMeta.contractAddress, ERC20_ABI);
    // TODO: Replace with actual call to Starknet contract
    // For now, mock a balance
    // const balance = await contract.call('balanceOf', [address]);
    // return Number(balance) / (10 ** tokenMeta.decimals);
    return 1000; // Mock: 1000 units (e.g., USDC, STRK)
  }

  // Escrow methods for the jobs service
  async lockFunds(
    walletAddress: string,
    currency: string,
    amount: number,
  ): Promise<void> {
    this.logger.log(`Locking ${amount} ${currency} from ${walletAddress}`);
    // TODO: Implement actual blockchain fund locking
    // For now, this is a mock implementation
  }

  async releaseFunds(
    walletAddress: string,
    currency: string,
    amount: number,
  ): Promise<void> {
    this.logger.log(`Releasing ${amount} ${currency} to ${walletAddress}`);
    // TODO: Implement actual blockchain fund release
    // For now, this is a mock implementation
  }
}
