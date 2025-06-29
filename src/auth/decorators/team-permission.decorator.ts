import { SetMetadata } from '@nestjs/common';

export const TEAM_PERMISSION_KEY = 'teamPermission';

/**
 * Decorator to specify required team permission for an endpoint
 * @param permission The permission key (e.g., 'canCreateJobs', 'canManageApplications')
 */
export const RequireTeamPermission = (permission: string) =>
  SetMetadata(TEAM_PERMISSION_KEY, permission);
