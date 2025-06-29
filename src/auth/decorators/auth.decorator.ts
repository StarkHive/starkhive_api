import { SetMetadata } from '@nestjs/common';
import { AUTH_TYPE_KEY } from '../constants/auth.constants';
import { authTypes } from '../enums/authTypes.enum';

/**auth constants */
export const Auth = (...authTypes: authTypes[]) =>
  SetMetadata(AUTH_TYPE_KEY, authTypes);
