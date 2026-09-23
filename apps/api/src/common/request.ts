import type { Request } from 'express';

export function requestId(req: Request): string | null {
  return req.id ? String(req.id) : null;
}
