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
import { MailService} from '../mail/mail.service';
import { LogInProvider } from './providers/loginProvider';
import { GenerateTokensProvider } from './providers/generateTokensProvider';
import { Portfolio } from './entities/portfolio.entity';
import { EmailToken } from './entities/email-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PasswordReset, Portfolio, EmailToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: { expiresIn: '1h' },
        };
      },
    }),
  ],  
  providers: [
    AuthService,
    LogInProvider,
    GenerateTokensProvider,
    JwtService,
    MailService,
    {
      provide: HashingProvider, // Use the abstract class as a token
      useClass: BcryptProvider, // Bind it to the concrete implementation
    },
  ],
  controllers: [AuthController],
  exports: [AuthService, TypeOrmModule, HashingProvider, MailService, JwtService, GenerateTokensProvider],
})
export class AuthModule {}
