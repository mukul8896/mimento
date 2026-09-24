import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { AppEnv } from './config/env';

/** Builds the configured application. Shared by main.ts and the OpenAPI exporter. */
export async function createApp(
  env: AppEnv,
  options: { logger?: boolean } = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(env), {
    bodyParser: false,
    bufferLogs: options.logger !== false,
    logger: options.logger === false ? false : undefined,
  });
  if (options.logger !== false) app.useLogger(app.get(Logger));
  return configureApp(app, env);
}

/** HTTP hardening and routing shared by production and integration tests. */
export function configureApp(app: NestExpressApplication, env: AppEnv): NestExpressApplication {
  // The web BFF is the only expected proxy hop; X-Forwarded-For beyond it is not trusted.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      strictTransportSecurity: env.APP_ENV === 'production',
    }),
  );
  // Raw bodies only where a signature covers the exact bytes: signed filesystem uploads and
  // payment webhooks. JSON everywhere else with a small limit.
  app.use('/api/v1/media/blob', express.raw({ type: () => true, limit: '10mb' }));
  app.use('/api/v1/payments/webhooks', express.raw({ type: () => true, limit: '256kb' }));
  app.use(express.json({ limit: '256kb' }));
  app.enableCors({
    origin: [env.WEB_ORIGIN],
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: [
      'authorization',
      'content-type',
      'idempotency-key',
      'x-recipient-session',
      'x-request-id',
    ],
    maxAge: 600,
  });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  return app;
}
