import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { ThrottlerException } from '@nestjs/throttler';
import { Problem, type ProblemIssue } from './problem';

interface ProblemBody {
  type: string;
  title: string;
  status: number;
  code: string;
  requestId: string;
  detail?: string;
  issues?: ProblemIssue[];
}

/** Renders every error as application/problem+json with the request id; never leaks internals. */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger('ProblemFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = String(req.id ?? 'unknown');
    const body = this.toProblem(exception, requestId);

    if (body.status >= 500) {
      // Only the error class and message are logged; request bodies are never included.
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error({
        requestId,
        err: { name: err.name, message: err.message, stack: err.stack },
      });
      if (process.env.TEST_LOG_LEVEL) console.error(err);
    }
    if (res.headersSent) return;
    res.setHeader('cache-control', 'no-store');
    res.status(body.status).type('application/problem+json').json(body);
  }

  private toProblem(exception: unknown, requestId: string): ProblemBody {
    const base = (status: number, code: string, title: string): ProblemBody => ({
      type: `https://momentpath.dev/problems/${code.toLowerCase().replace(/_/g, '-')}`,
      title,
      status,
      code,
      requestId,
    });

    if (exception instanceof Problem) {
      return {
        ...base(exception.httpStatus, exception.code, exception.title),
        ...(exception.detail ? { detail: exception.detail } : {}),
        ...(exception.issues ? { issues: exception.issues } : {}),
      };
    }
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as {
        issues?: { path: PropertyKey[]; message: string }[];
      };
      return {
        ...base(400, 'VALIDATION_FAILED', 'The request is invalid'),
        issues: (zodError.issues ?? []).slice(0, 50).map((i) => ({
          stepKey: null,
          field: i.path.map(String).join('.') || null,
          message: i.message,
        })),
      };
    }
    if (exception instanceof ZodSerializationException) {
      return base(500, 'INTERNAL_ERROR', 'Something went wrong');
    }
    if (exception instanceof ThrottlerException) {
      return base(429, 'RATE_LIMITED', 'Too many requests, please slow down');
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code =
        status === 404
          ? 'NOT_FOUND'
          : status === 401
            ? 'UNAUTHORIZED'
            : status === 403
              ? 'FORBIDDEN'
              : status === 413
                ? 'PAYLOAD_TOO_LARGE'
                : status < 500
                  ? 'BAD_REQUEST'
                  : 'INTERNAL_ERROR';
      const title =
        status < 500
          ? (HttpStatus[status] ?? 'Error').replace(/_/g, ' ').toLowerCase()
          : 'Something went wrong';
      return base(status, code, title.charAt(0).toUpperCase() + title.slice(1));
    }
    return base(500, 'INTERNAL_ERROR', 'Something went wrong');
  }
}
