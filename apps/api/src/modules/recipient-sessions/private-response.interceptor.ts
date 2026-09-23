import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';

/** Recipient responses must never be cached by shared caches, indexed, or leak the token via Referer. */
@Injectable()
export class PrivateResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    res.setHeader('cache-control', 'no-store, private');
    res.setHeader('x-robots-tag', 'noindex, nofollow, noarchive');
    res.setHeader('referrer-policy', 'no-referrer');
    return next.handle();
  }
}
