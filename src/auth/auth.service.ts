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
import type { LogInDto } from './dto/loginDto';
import { LogInProvider } from './providers/loginProvider';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { TeamService } from './services/team.service';
import { SkillVerification, VerificationStatus } from './entities/skills-verification.entity';
import type { 
  CreateSkillVerificationDto, 
  SkillAssessmentDto, 
  UpdateSkillVerificationDto 
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

  async login(loginDto: LogInDto): Promise<{ 
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
      user: userWithoutPassword
    };
  }

  // ... [keep all other methods exactly as they are] ...
}