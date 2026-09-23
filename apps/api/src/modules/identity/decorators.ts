import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { Problem } from '../../common/problem';
import type { Principal } from './principal';

export const IS_PUBLIC = 'momentpath:isPublic';
export const REQUIRES_ADMIN = 'momentpath:requiresAdmin';

/** Route needs no creator authentication (health checks, recipient endpoints). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Route requires the operator credential (ADMIN_TOKEN). */
export const AdminOnly = () => SetMetadata(REQUIRES_ADMIN, true);

export const CurrentPrincipal = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Principal => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.principal) throw Problem.unauthorized();
    return req.principal;
  },
);
