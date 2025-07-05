import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { User } from '../entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import * as bcrypt from 'bcrypt';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<User> {
    const user = await this.authService.validateUserById(payload.sub);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.refreshToken) {
      throw new UnauthorizedException('No refresh token found for user');
    }

    // Get the refresh token from the request body
    const body = req.body as { refreshToken?: string };
    const refreshToken = body?.refreshToken;
    
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    // Verify the refresh token matches the stored one
    const isRefreshTokenMatching = await bcrypt.compare(
      refreshToken,
      user.refreshToken
    );

    if (!isRefreshTokenMatching) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return user;
  }
}
