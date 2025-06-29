import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { REQUEST_USER_KEY } from '../constants/auth.constants';
import jwtConfig from '../authconfig/jwt.config';

/**
 * @class AccessTokenGuard
 * @description Guard responsible for validating access tokens in incoming requests.
 */
@Injectable()
/**AccessToken guard class */
export class AccessTokenGuard implements CanActivate {
  /**
   * @constructor
   * @param {JwtService} jwtService - The service used for JWT operations.
   * @param {ConfigType<typeof jwtConfig>} jwtConfiguration - Configuration settings for JWT.
   */
  constructor(
    private readonly jwtService: JwtService,

    /**inject jwt configuration */
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  /**
   * Determines whether the request is authorized based on the access token.
   * @param {ExecutionContext} context - The execution context containing request data.
   * @returns {Promise<boolean>} - Returns true if the request is authorized, otherwise throws an exception.
   * @throws {UnauthorizedException} If the token is invalid or missing.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Extract the request from the execution context
    const request = context.switchToHttp().getRequest();
    // Extract the token from the header
    const token = this.extractRequestFromHeader(request);
    // Validate the token
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(
        token,
        this.jwtConfiguration,
      );
      request[REQUEST_USER_KEY] = payload;
    } catch (error) {
      throw new UnauthorizedException(error);
    }
    return true;
  }

  /**
   * Extracts the token from the request header.
   * @param {Request} request - The incoming HTTP request.
   * @returns {string | undefined} - The extracted token or undefined if not found.
   */
  private extractRequestFromHeader(request: Request): string | undefined {
    const [_, token] = request.headers.authorization?.split(' ') ?? [];
    return token;
  }
}
