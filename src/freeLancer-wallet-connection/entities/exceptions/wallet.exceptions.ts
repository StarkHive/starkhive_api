import { HttpException, HttpStatus } from '@nestjs/common';

export class WalletAlreadyConnectedException extends HttpException {
  constructor() {
    super(
      {
        message: 'Wallet is already connected and cannot be modified',
        error: 'WALLET_ALREADY_CONNECTED',
        statusCode: HttpStatus.CONFLICT,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class WalletAddressAlreadyExistsException extends HttpException {
  constructor() {
    super(
      {
        message: 'This wallet address is already connected to another account',
        error: 'WALLET_ADDRESS_EXISTS',
        statusCode: HttpStatus.CONFLICT,
      },
      HttpStatus.CONFLICT,
    );
  }
}
