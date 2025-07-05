import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UserRole } from './enums/userRole.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Portfolio } from './entities/portfolio.entity';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from './dto/register-user.dto';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { addDays, addMinutes } from 'date-fns';
import { PasswordReset } from './entities/password-reset.entity';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { HashingProvider } from './providers/hashingProvider';
import { LogInDto } from './dto/loginDto';
import { LogInProvider } from './providers/loginProvider';
import { JwtPayload } from './interfaces/jwt-payload.interface';

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
 
  constructor(
    private readonly mailService: MailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
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
    if (existing) throw new Error('Email already exists');
  
    const hashed = await bcrypt.hash(password, 10);
  
    const user = this.userRepository.create({ email, password: hashed, role });
    const saved = await this.userRepository.save(user);
  
    const { password: _, ...safeUser } = saved;
    return safeUser;
  }

  async getOneByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }
  
    

  async validateUser(email: string, password: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshToken) {
        throw new Error('Invalid refresh token');
      }

      const isRefreshTokenValid = await bcrypt.compare(
        refreshToken,
        user.refreshToken,
      );

      if (!isRefreshTokenValid) {
        throw new Error('Refresh token is not valid');
      }

      const tokens = await this.getTokens(user.id, user.email);
      await this.updateRefreshToken(user.id, tokens.refreshToken);
      return tokens;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async validateUserById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async getTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: '15m',
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, {
      refreshToken: hashedRefreshToken,
    });
  }

  async login(loginDto: LogInDto): Promise<{ accessToken: string; refreshToken: string }> {
    const { email, password } = loginDto;
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
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

