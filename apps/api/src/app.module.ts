import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { IdempotencyInterceptor } from './common/idempotency';
import { KEYRING, Keyring } from './common/crypto';
import { loggerParams } from './common/logging';
import { ProblemFilter } from './common/problem.filter';
import { APP_ENV, type AppEnv } from './config/env';
import { AdministrationModule } from './modules/administration/administration.module';
import { AuditModule } from './modules/audit/audit.module';
import { ExperiencesModule } from './modules/experiences/experiences.module';
import { GiftsModule } from './modules/gifts/gifts.module';
import { HealthController } from './modules/health/health.controller';
import { IdentityModule } from './modules/identity/identity.module';
import { MediaModule } from './modules/media/media.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { PublishingModule } from './modules/publishing/publishing.module';
import { RecipientSessionsModule } from './modules/recipient-sessions/recipient-sessions.module';
import { ResponsesModule } from './modules/responses/responses.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { PrismaModule } from './prisma/prisma.module';

@Global()
@Module({})
class CoreModule {
  static register(env: AppEnv): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: APP_ENV, useValue: env },
        {
          provide: KEYRING,
          useValue: new Keyring(env.APP_ENCRYPTION_KEYS, env.APP_ENCRYPTION_ACTIVE_KEY),
        },
      ],
      exports: [APP_ENV, KEYRING],
    };
  }
}

@Module({})
export class AppModule {
  static register(env: AppEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.register(env),
        LoggerModule.forRoot(loggerParams(env)),
        // In-memory rate limits (single instance in Phase 1); Phase 4 moves storage to Redis.
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
          skipIf: () => env.RATE_LIMIT_DISABLED,
        }),
        PrismaModule,
        AuditModule,
        OutboxModule,
        IdentityModule,
        TemplatesModule,
        MediaModule,
        GiftsModule,
        ExperiencesModule,
        PublishingModule,
        RecipientSessionsModule,
        ResponsesModule,
        AdministrationModule,
      ],
      controllers: [HealthController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
        { provide: APP_FILTER, useClass: ProblemFilter },
        IdempotencyInterceptor,
      ],
    };
  }
}
