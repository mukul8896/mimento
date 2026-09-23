import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './bootstrap';
import { loadEnv } from './config/env';
import { buildOpenApi } from './openapi';

/** Writes the OpenAPI document without starting a server or touching the database. */
async function main(): Promise<void> {
  const out = process.argv[2];
  if (!out) throw new Error('Usage: node dist/openapi-export.js <output.json>');
  const env = loadEnv({
    APP_ENV: 'test',
    DATABASE_URL: 'postgresql://unused@localhost:1/unused',
    WEB_ORIGIN: 'http://localhost:3000',
    APP_ENCRYPTION_KEYS: `export:${Buffer.alloc(32).toString('base64')}`,
    APP_ENCRYPTION_ACTIVE_KEY: 'export',
    STORAGE_SIGNING_SECRET: 'x'.repeat(32),
    MEDIA_PUBLIC_BASE_URL: 'http://localhost:3000/bff',
    OUTBOX_POLL_MS: '0',
    LOG_LEVEL: 'silent',
  });
  const app = await createApp(env, { logger: false });
  const doc = buildOpenApi(app);
  writeFileSync(path.resolve(out), `${JSON.stringify(doc, null, 2)}\n`);
  await app.close();
}

void main();
