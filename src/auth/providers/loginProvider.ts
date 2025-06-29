import {
  forwardRef,
  Inject,
  Injectable,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LogInDto } from '../dto/loginDto';
import { HashingProvider } from './hashingProvider';
import { GenerateTokensProvider } from './generateTokensProvider';
import { AuthService } from '../auth.service';

/**
 * Signin provider class
 */
@ApiTags('Authentication')
@Injectable()
export class LogInProvider {
  constructor(
    /**
     * Injecting UserService repository
     */
    /**
     * Injecting hashing dependency
     */
    private readonly hashingProvider: HashingProvider,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,

    /**
     * Injecting GenerateTokensProvider
     */
    private readonly generateTokenProvider: GenerateTokensProvider,
  ) {}

  /**
   * Sign in method
   * @param signInDto - User credentials
   * @returns Access and refresh tokens
   */
  @ApiOperation({ summary: 'User sign-in' })
  @ApiResponse({ status: 200, description: 'Successfully signed in' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({ status: 408, description: 'Database connection timeout' })
  public async Login(loginDto: LogInDto) {
    // Check if user exists in database
    const user = await this.authService.getOneByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    // Compare password
    let isCheckedPassword: boolean = false;

    try {
      isCheckedPassword = await this.hashingProvider.comparePasswords(
        loginDto.password,
        user.password,
      );
    } catch (error) {
      throw new RequestTimeoutException(error, {
        description: 'error connecting to the database',
      });
    }

    if (!isCheckedPassword) {
      throw new UnauthorizedException('email or password is incorrect');
    }

    // Generate tokens
    return await this.generateTokenProvider.generateTokens(user);
  }
}
