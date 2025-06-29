import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/userRole.enum';

export const ROLES_KEY = 'roles';
/**
 * Roles decorator for specifying required user roles on route handlers.
 * Usage: @Roles(UserRole.ADMIN, UserRole.RECRUITER)
 */
export const Roles = (...roles: [UserRole, ...UserRole[]]) =>
  SetMetadata(ROLES_KEY, roles);
