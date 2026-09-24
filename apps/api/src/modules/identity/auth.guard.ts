import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Problem } from '../../common/problem';
import { IS_PUBLIC, REQUIRES_ADMIN } from './decorators';
import { IdentityService } from './identity.service';
import {
  ADMIN_TOKEN_HEADER,
  MANAGE_TOKEN_HEADER,
  OWNER_TOKEN_HEADER,
  type Principal,
} from './principal';

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Global guard: every route needs a secret creator token unless marked @Public().
 * There are no accounts — the principal is derived from the token alone, never from input.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly identity: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const principal = await this.resolve(req);
    if (!principal) throw Problem.unauthorized();
    req.principal = principal;

    if (this.reflector.getAllAndOverride<boolean>(REQUIRES_ADMIN, targets) && !principal.isAdmin) {
      throw Problem.forbidden();
    }
    return true;
  }

  /**
   * A browser can hold both an owner token (everything it created) and a manage token (one
   * experience, possibly someone else's, opened from a manage link). The owner token is used
   * unless the request is about the managed experience of a different owner; when both belong
   * to the same owner the owner token already covers everything, so no scope applies.
   */
  private async resolve(req: Request): Promise<Principal | null> {
    const admin = header(req, ADMIN_TOKEN_HEADER);
    if (admin) return this.identity.resolveAdmin(admin);

    const manageToken = header(req, MANAGE_TOKEN_HEADER);
    const ownerToken = header(req, OWNER_TOKEN_HEADER);
    const [managed, owner] = await Promise.all([
      manageToken ? this.identity.resolveManageToken(manageToken) : null,
      ownerToken ? this.identity.resolveOwner(ownerToken) : null,
    ]);
    if (!managed) return owner;
    if (!owner) return managed;
    if (owner.userId === managed.userId) return owner;
    const params = req.params as Record<string, string | undefined>;
    const target = params.id ?? params.experienceId;
    return target === managed.scopeExperienceId
      ? managed
      : { ...owner, alsoManagedExperienceId: managed.scopeExperienceId };
  }
}
