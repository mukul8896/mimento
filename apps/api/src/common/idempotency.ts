import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { from, of, switchMap, type Observable } from 'rxjs';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sha256 } from './crypto';
import { Problem } from './problem';

const TTL_MS = 24 * 3600 * 1000;

/**
 * Replays the stored result when a creator retries a request with the same Idempotency-Key.
 * Reusing a key for a different request is rejected. Only successful responses are stored.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const key = req.header('idempotency-key');
    const principal = req.principal;
    if (!key || !principal) return next.handle();
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) {
      throw Problem.badRequest(
        'INVALID_IDEMPOTENCY_KEY',
        'Idempotency-Key must be 8-100 URL-safe characters',
      );
    }
    const requestHash = sha256(
      `${req.method} ${req.originalUrl.split('?')[0]} ${JSON.stringify(req.body ?? null)}`,
    );

    return from(
      this.prisma.idempotencyRecord.findUnique({
        where: { userId_key: { userId: principal.userId, key } },
      }),
    ).pipe(
      switchMap((existing) => {
        if (existing && existing.expiresAt > new Date()) {
          if (existing.requestHash !== requestHash) {
            throw Problem.unprocessable(
              'IDEMPOTENCY_KEY_REUSED',
              'This Idempotency-Key was used for a different request',
            );
          }
          res.status(existing.responseStatus);
          res.setHeader('idempotent-replayed', 'true');
          return of(existing.responseBody === null ? undefined : existing.responseBody);
        }
        return next.handle().pipe(
          switchMap((body: unknown) =>
            from(
              this.prisma.idempotencyRecord
                .upsert({
                  where: { userId_key: { userId: principal.userId, key } },
                  create: {
                    userId: principal.userId,
                    key,
                    requestHash,
                    responseStatus: res.statusCode,
                    responseBody:
                      body === undefined ? Prisma.JsonNull : (body as Prisma.InputJsonValue),
                    expiresAt: new Date(Date.now() + TTL_MS),
                  },
                  update: {
                    requestHash,
                    responseStatus: res.statusCode,
                    responseBody:
                      body === undefined ? Prisma.JsonNull : (body as Prisma.InputJsonValue),
                    expiresAt: new Date(Date.now() + TTL_MS),
                  },
                })
                .then(() => body),
            ),
          ),
        );
      }),
    );
  }
}

export const Idempotent = () =>
  applyDecorators(
    UseInterceptors(IdempotencyInterceptor),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: 'Retry-safe request key (8-100 chars)',
    }),
  );
