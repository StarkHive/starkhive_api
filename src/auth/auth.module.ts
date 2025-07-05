import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from './entities/user.entity';
import { HashingProvider } from './providers/hashingProvider';
import { BcryptProvider } from './providers/bcrypt';
import { PasswordReset } from './entities/password-reset.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from 'src/mail/mail.module';
import { LogInProvider } from './providers/loginProvider';
import { GenerateTokensProvider } from './providers/generateTokensProvider';
import { Portfolio } from './entities/portfolio.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { EmailToken } from './entities/email-token.entity';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { TeamActivity } from './entities/team-activity.entity';
import { TeamService } from './services/team.service';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeyService } from './services/api-key.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyController } from './controllers/api-key.controller';
import { PerformanceService } from './performance.service';
import { Application } from 'src/applications/entities/application.entity';
import { Job } from 'src/jobs/entities/job.entity';
import { SkillVerification } from './entities/skills-verification.entity';

@Module({
  imports: [
    MailModule,
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      User,
      PasswordReset,
      Portfolio,
      EmailToken,
      Team,
      Job,
      TeamMember,
      TeamActivity,
      Application,
      ApiKey,
      SkillVerification,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
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
      global: true,
    }),
  ],
  controllers: [AuthController, ApiKeyController],
  providers: [
    AuthService,
    TeamService,
    PerformanceService,
    LogInProvider,
    GenerateTokensProvider,
    {
      provide: HashingProvider,
      useClass: BcryptProvider,
    },
    JwtStrategy,
    JwtRefreshStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    ApiKeyService,
    ApiKeyGuard,
  ],
  exports: [
    AuthService,
    TeamService,
    PerformanceService,
    TypeOrmModule,
    JwtModule,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    HashingProvider,
    GenerateTokensProvider,
  ],
})
export class AuthModule {}