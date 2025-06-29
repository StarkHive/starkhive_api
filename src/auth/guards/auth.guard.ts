import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { authTypes } from '../enums/authTypes.enum';
import { Reflector } from '@nestjs/core';
import { AccessTokenGuard } from './accessToken.guard';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AUTH_TYPE_KEY } from '../constants/auth.constants';

@Injectable()
export class AuthGuardGuard implements CanActivate {
  private static readonly defaultAuthType = authTypes.Bearer;

  private readonly authTypeGuardMap: Record<
    authTypes,
    CanActivate | CanActivate[]
  >;

  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenGuard: AccessTokenGuard,
  ) {
    this.authTypeGuardMap = {
      [authTypes.Bearer]: this.accessTokenGuard,
      [authTypes.None]: { canActivate: () => true },
    };
  }

  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authTypes = this.reflector.getAllAndOverride(AUTH_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [AuthGuardGuard.defaultAuthType];

    const guards = authTypes.map((type) => this.authTypeGuardMap[type]);

    for (const instance of guards) {
      const canActivate = await Promise.resolve(
        instance.canActivate(context),
      ).catch((err) => {
        throw new UnauthorizedException(err);
      });

      if (canActivate) {
        return true;
      }
    }

    throw new UnauthorizedException();
  }
}
