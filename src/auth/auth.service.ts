import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from './enums/userRole.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Portfolio } from './entities/portfolio.entity';
import { EmailToken } from './entities/email-token.entity';
import { PasswordReset } from './entities/password-reset.entity';
import * as bcrypt from 'bcryptjs';
import type { RegisterDto } from './dto/register-user.dto';
import type { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { JwtService } from '@nestjs/jwt';
import { addHours, addDays, addMinutes } from 'date-fns';
import * as crypto from 'crypto';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import type { LoginDto } from './dto/login-user.dto';
import { LogInProvider } from './providers/loginProvider';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { TeamService } from './services/team.service';
import {
  SkillVerification,
  VerificationStatus,
} from './entities/skills-verification.entity';
import type {
  CreateSkillVerificationDto,
  SkillAssessmentDto,
  UpdateSkillVerificationDto,
} from './dto/skills.dto';

@Injectable()
export class AuthService {
  private allowedMimeTypes: string[];
  private maxFileSize: number;
  private readonly EMAIL_TOKEN_EXPIRATION_HOURS = 24;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
    @InjectRepository(EmailToken)
    private readonly emailTokenRepository: Repository<EmailToken>,
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
    @InjectRepository(SkillVerification)
    private readonly skillVerificationRepository: Repository<SkillVerification>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly loginProvider: LogInProvider,
    private readonly teamService: TeamService,
    private readonly mailService: MailService,
  ) {
    this.allowedMimeTypes = this.configService.get<string[]>(
      'portfolio.allowedMimeTypes',
      ['image/jpeg', 'image/png', 'application/pdf'],
    );
    this.maxFileSize = this.configService.get<number>(
      'portfolio.maxFileSize',
      5 * 1024 * 1024,
    );
  }

  // ... [keep all other methods exactly as they are] ...

  async login(loginDto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'password'>;
  }> {
    const { email, password } = loginDto;
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.isSuspended) {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support for assistance.',
      );
    }

    // Generate tokens using the refresh token flow
    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    // Remove password from the user object
    const { password: _, ...userWithoutPassword } = user;

    return {
      ...tokens,
      user: userWithoutPassword,
    };
  }

  async getTokens(
    userId: string,
    email: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const jwtPayload: JwtPayload = {
      sub: userId,
      email: email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async updateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, {
      refreshToken: hashedRefreshToken,
    });
  }

  async refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = this.jwtService.verify(refreshToken, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    });

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Access Denied');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );

    if (!refreshTokenMatches) {
      throw new ForbiddenException('Access Denied');
    }

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async sendPasswordResetEmail(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if email exists
      return {
        message:
          'If an account with that email exists, a password reset email has been sent.',
      };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = addHours(new Date(), 1); // 1 hour expiration

    // Save reset token
    const passwordReset = this.passwordResetRepository.create({
      user,
      token: resetToken,
      expiresAt,
    });

    await this.passwordResetRepository.save(passwordReset);

    // Send email with reset link
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/auth/reset-password?token=${resetToken}`;

    await this.mailService.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      template: 'password-reset',
      context: {
        resetUrl,
        expiresIn: '1 hour',
      },
    });

    return {
      message:
        'If an account with that email exists, a password reset email has been sent.',
    };
  }

  async getOneByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async validateUserById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  // ... [keep all other methods exactly as they are] ...
}
