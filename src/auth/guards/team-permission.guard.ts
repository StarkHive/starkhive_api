import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { TeamService } from '../services/team.service';

export const TEAM_PERMISSION_KEY = 'teamPermission';
export const TeamPermission = (permission: string) =>
  Reflect.metadata(TEAM_PERMISSION_KEY, permission);

@Injectable()
export class TeamPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private teamService: TeamService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      TEAM_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const teamId = request.params.teamId;

    if (!user || !teamId) {
      throw new BadRequestException('User or team ID not found');
    }
    // Ensure requiredPermission is a valid TeamMember permission key
    if (
      ![
        'canCreateJobs',
        'canEditJobs',
        'canDeleteJobs',
        'canViewApplications',
        'canManageApplications',
        'canInviteMembers',
        'canRemoveMembers',
      ].includes(requiredPermission)
    ) {
      throw new BadRequestException('Invalid team permission');
    }
    const hasPermission = await this.teamService.checkTeamPermission(
      teamId,
      user.id,
      requiredPermission as
        | 'canCreateJobs'
        | 'canEditJobs'
        | 'canDeleteJobs'
        | 'canViewApplications'
        | 'canManageApplications'
        | 'canInviteMembers'
        | 'canRemoveMembers',
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions: ${requiredPermission} required`,
      );
    }

    return true;
  }
}
