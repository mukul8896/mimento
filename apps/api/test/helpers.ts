import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { inject } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { loadEnv, type AppEnv } from '../src/config/env';
import { OutboxProcessor } from '../src/modules/outbox/outbox.processor';
import { PrismaService } from '../src/prisma/prisma.service';

/** Fixed operator credential for the moderation endpoints in tests. */
export const TEST_ADMIN_TOKEN = 'a'.repeat(40);

export interface TestContext {
  app: NestExpressApplication;
  http: ReturnType<typeof request>;
  prisma: PrismaService;
  outbox: OutboxProcessor;
  env: AppEnv;
  close(): Promise<void>;
}

export async function createTestContext(
  overrides: Partial<Record<string, string>> = {},
): Promise<TestContext> {
  const env = loadEnv({
    APP_ENV: 'test',
    LOG_LEVEL: process.env.TEST_LOG_LEVEL ?? 'silent',
    DATABASE_URL: inject('databaseUrl'),
    WEB_ORIGIN: 'http://localhost:3000',
    ADMIN_TOKEN: TEST_ADMIN_TOKEN,
    APP_ENCRYPTION_KEYS: `t1:${Buffer.alloc(32, 7).toString('base64')}`,
    APP_ENCRYPTION_ACTIVE_KEY: 't1',
    STORAGE_DRIVER: 'filesystem',
    STORAGE_FS_ROOT: mkdtempSync(path.join(os.tmpdir(), 'momentpath-storage-')),
    STORAGE_SIGNING_SECRET: 's'.repeat(40),
    MEDIA_PUBLIC_BASE_URL: 'http://localhost:3000/bff/api',
    RATE_LIMIT_DISABLED: 'true',
    OUTBOX_POLL_MS: '0',
    MEDIA_PIPELINE_MS: '0',
    RETENTION_SWEEP_MS: '0',
    PAYMENTS_RECONCILE_MS: '0',
    ...overrides,
  });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(env)],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: false,
  });
  configureApp(app, env);
  await app.init();
  app.getHttpServer().setMaxListeners(100);
  return {
    app,
    http: request(app.getHttpServer()),
    prisma: app.get(PrismaService),
    outbox: app.get(OutboxProcessor),
    env,
    close: () => app.close(),
  };
}

export const API = '/api/v1';

/**
 * A creator identity. There is no registration: an anonymous owner is minted and its token is
 * the credential. `admin: true` uses the operator credential instead.
 */
export async function creator(ctx: TestContext, options: { admin?: boolean } = {}) {
  let token: string;
  let auth: Record<string, string>;
  if (options.admin) {
    token = TEST_ADMIN_TOKEN;
    auth = { 'x-admin-token': token };
  } else {
    const res = await ctx.http.post(`${API}/owners`).send({});
    if (res.status !== 201) throw new Error(`Owner mint failed (${res.status})`);
    token = res.body.ownerToken as string;
    auth = { 'x-owner-token': token };
  }
  return {
    token,
    auth,
    get: (url: string) => ctx.http.get(`${API}${url}`).set(auth),
    post: (url: string, body?: object) => ctx.http.post(`${API}${url}`).set(auth).send(body),
    put: (url: string, body?: object) => ctx.http.put(`${API}${url}`).set(auth).send(body),
    del: (url: string) => ctx.http.delete(`${API}${url}`).set(auth),
  };
}

export type Creator = Awaited<ReturnType<typeof creator>>;

/** Recipient-side calls for one share token. */
export function recipient(ctx: TestContext, shareToken: string) {
  let session = '';
  const base = `${API}/public/experiences/${shareToken}`;
  return {
    get session() {
      return session;
    },
    async start() {
      const res = await ctx.http.post(`${base}/sessions`).send();
      if (res.status === 201) session = res.body.sessionToken;
      return res;
    },
    meta: () => ctx.http.get(`${base}/meta`),
    resume: () => ctx.http.get(`${base}/session`).set('x-recipient-session', session),
    answer: (stepKey: string, answer: object) =>
      ctx.http
        .post(`${base}/session/answers`)
        .set('x-recipient-session', session)
        .send({ stepKey, answer }),
    close: () => ctx.http.post(`${base}/session/close`).set('x-recipient-session', session).send(),
    reveal: (stepKey: string) =>
      ctx.http.post(`${base}/session/gift`).set('x-recipient-session', session).send({ stepKey }),
    report: (category: string, details = '') =>
      ctx.http.post(`${base}/reports`).send({ category, details }),
  };
}

/** Creates an experience from a template and publishes it; returns ids and the share token. */
export async function publishedFromTemplate(
  ctx: TestContext,
  owner: Creator,
  templateKey = 'date-invitation',
) {
  const created = await owner.post('/experiences', { templateKey });
  if (created.status !== 201)
    throw new Error(`create failed ${created.status} ${JSON.stringify(created.body)}`);
  const id: string = created.body.id;
  const published = await owner.post(`/experiences/${id}/publish`);
  if (published.status !== 200) throw new Error(`publish failed ${JSON.stringify(published.body)}`);
  const link = await owner.get(`/experiences/${id}/share-link`);
  const draft = await owner.get(`/experiences/${id}/draft`);
  return { id, shareToken: link.body.shareToken as string, draft: draft.body };
}
