import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from './entities/user.entity';
import { HashingProvider } from './providers/hashingProvider';
import { BcryptProvider } from './providers/bcrypt';
import { PasswordReset } from './entities/password-reset.entity';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { LogInProvider } from './providers/loginProvider';
import { GenerateTokensProvider } from './providers/generateTokensProvider';
import { Portfolio } from './entities/portfolio.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PasswordReset, Portfolio]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        const refreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
        
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        if (!refreshSecret) {
          throw new Error('JWT_REFRESH_SECRET environment variable is required');
        }
        
        return {
          secret,
          signOptions: { expiresIn: '15m' },
        };
      },
    }),
  ],  
  providers: [
    AuthService,
    LogInProvider,
    GenerateTokensProvider,
    MailService,
    JwtStrategy,
    JwtRefreshStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: HashingProvider,
      useClass: BcryptProvider,
    },
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    TypeOrmModule,
    JwtModule,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    HashingProvider,
    MailService,
    GenerateTokensProvider,
  ],
})
export class AuthModule {}
