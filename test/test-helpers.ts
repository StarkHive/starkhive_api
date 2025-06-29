import { JwtService } from '@nestjs/jwt';
import { User } from '../src/auth/entities/user.entity';
import { UserRole } from '../src/auth/enums/userRole.enum';

export function getJwtTokenForUser(user: Partial<User>): string {
  const jwtService = new JwtService({
    secret: process.env.JWT_SECRET || 'testsecret',
  });
  return jwtService.sign({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
}
