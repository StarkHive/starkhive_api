import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from './enums/userRole.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Portfolio } from './entities/portfolio.entity';
import { EmailToken } from './entities/email-token.entity';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from './dto/register-user.dto';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { addHours } from 'date-fns';
import { PasswordReset } from './entities/password-reset.entity';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { HashingProvider } from './providers/hashingProvider';
import { LogInDto } from './dto/loginDto';
import { LogInProvider } from './providers/loginProvider';

@Injectable()
export class AuthService {
  /**
   * Promote a user to admin. Only super admins can perform this action.
   * @param requesterId - ID of the user making the request
   * @param targetUserId - ID of the user to be promoted
   */
  async promoteToAdmin(requesterId: string, targetUserId: string): Promise<User> {
    // Get the requesting user
    const requester = await this.userRepository.findOne({ where: { id: requesterId } });
    if (!requester || requester.role !== UserRole.SUPER_ADMIN) {
      throw new UnauthorizedException('Only super admins can promote users to admin');
    }
    // Get the target user
    const targetUser = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new BadRequestException('Target user does not exist');
    }
    // Update the role
    targetUser.role = UserRole.ADMIN;
    await this.userRepository.save(targetUser);
    return targetUser;
  }

  // TODO: Move allowedMimeTypes and maxFileSize to configuration
  private allowedMimeTypes: string[];
  private maxFileSize: number;
 
  private readonly EMAIL_TOKEN_EXPIRATION_HOURS = 24; // 24 hours

  constructor(
    private readonly mailService: MailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
    @InjectRepository(EmailToken)
    private readonly emailTokenRepository: Repository<EmailToken>,
    private readonly jwtService: JwtService,
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
    private readonly configService: ConfigService,
    private readonly loginProvider: LogInProvider
  ) {
    this.allowedMimeTypes = this.configService.get<string[]>('portfolio.allowedMimeTypes', ['image/jpeg', 'image/png', 'application/pdf']);
    this.maxFileSize = this.configService.get<number>('portfolio.maxFileSize', 5 * 1024 * 1024);
  }

  async register(registerDto: RegisterDto): Promise<Omit<User, 'password'>> {
    const { email, password, role } = registerDto;
  
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) throw new BadRequestException('Email already exists');
  
    const hashed = await bcrypt.hash(password, 10);
  
    const user = this.userRepository.create({ 
      email, 
      password: hashed, 
      role,
      isEmailVerified: false 
    });
    
    const saved = await this.userRepository.save(user);
    await this.sendVerificationEmail(user.email);
  
    const { password: _, ...safeUser } = saved;
    return safeUser;
  }

  async sendVerificationEmail(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Invalidate any existing tokens
    await this.emailTokenRepository.update(
      { userId: user.id, used: false },
      { used: true }
    );

    // Generate new token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = addHours(new Date(), this.EMAIL_TOKEN_EXPIRATION_HOURS);

    // Save token
    const emailToken = this.emailTokenRepository.create({
      token,
      expiresAt,
      user,
      used: false
    });

    await this.emailTokenRepository.save(emailToken);

    // Send verification email
    const verificationUrl = `${this.configService.get('FRONTEND_URL')}/verify-email?token=${token}`;
    await this.mailService.sendVerificationEmail(user.email, verificationUrl);
  }

  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const emailToken = await this.emailTokenRepository.findOne({
      where: { token, used: false },
      relations: ['user']
    });

    if (!emailToken) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const now = new Date();
    if (emailToken.expiresAt < now) {
      throw new BadRequestException('Verification token has expired');
    }

    // Mark token as used
    emailToken.used = true;
    await this.emailTokenRepository.save(emailToken);

    // Update user's email verification status
    await this.userRepository.update(emailToken.userId, { isEmailVerified: true });

    return {
      success: true,
      message: 'Email verified successfully. You can now log in.'
    };
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    await this.sendVerificationEmail(email);
  }

  async getOneByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }
  
    

  async login(loginDto: LogInDto): Promise<string> {
    const { email, password } = loginDto;
    const user = await this.userRepository.findOneBy({ email: email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role
    };
    return this.jwtService.sign(payload);
  }

  public async sendPasswordResetEmail(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) return; // don't reveal user existence
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = addMinutes(new Date(), 15);
    const reset = this.passwordResetRepository.create({ user: user, token, expiresAt });
    await this.passwordResetRepository.save(reset);
    const resetLink = `https://your-app.com/reset-password?token=${token}`;
    await this.mailService.sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      body: `Click the link to reset your password: ${resetLink}`,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const reset = await this.passwordResetRepository.findOne({
      where: { token },
      relations: ['user'],
    });
    if (!reset || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    reset.user.password = hashedPassword;
    await this.userRepository.save(reset.user);
    await this.passwordResetRepository.delete({ id: reset.id });
  }

  // --- Portfolio Methods ---
  async createPortfolio(userId: string, dto: CreatePortfolioDto, file: any): Promise<Portfolio> {
    if (!file) throw new BadRequestException('File is required');
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, and PDF are allowed.');
    }
    if (file.size > this.maxFileSize) {
      throw new BadRequestException('File size exceeds the 5MB limit.');
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    const fileUrl = `/uploads/portfolio/${encodeURIComponent(file.filename)}`;
    const portfolio = this.portfolioRepository.create({
      title: dto.title,
      description: dto.description,
      fileUrl,
      user,
    });
    return this.portfolioRepository.save(portfolio);
  }

  async updatePortfolio(userId: string, portfolioId: string, dto: Partial<CreatePortfolioDto>, file?: any): Promise<Portfolio> {
    const portfolio = await this.portfolioRepository.findOne({ where: { id: portfolioId }, relations: ['user'] });
    if (!portfolio || portfolio.user.id !== userId) {
      throw new UnauthorizedException('Portfolio not found or access denied');
    }
    if (dto.title) portfolio.title = dto.title;
    if (dto.description) portfolio.description = dto.description;
    if (file) {
      if (!this.allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Invalid file type. Only JPEG, PNG, and PDF are allowed.');
      }
      if (file.size > this.maxFileSize) {
        throw new BadRequestException('File size exceeds the 5MB limit.');
      }
      portfolio.fileUrl = `/uploads/portfolio/${file.filename}`;
    }
    return this.portfolioRepository.save(portfolio);
  }

  async deletePortfolio(userId: string, portfolioId: string): Promise<void> {
    const portfolio = await this.portfolioRepository.findOne({ where: { id: portfolioId }, relations: ['user'] });
    if (!portfolio || portfolio.user.id !== userId) {
      throw new UnauthorizedException('Portfolio not found or access denied');
    }
    await this.portfolioRepository.remove(portfolio);
  }

  async getUserPortfolios(userId: string): Promise<Portfolio[]> {
    return this.portfolioRepository.find({ where: { user: { id: userId } }, order: { createdAt: 'DESC' } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }
  
}

