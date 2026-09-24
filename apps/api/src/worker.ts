import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

/**
 * Background worker: the same modules as the API without an HTTP listener. Timers in the outbox
 * processor, media pipeline and payment reconciler start because PROCESS_ROLE is not `api`.
 * Jobs are claimed with FOR UPDATE SKIP LOCKED, so running several workers is safe.
 */
async function main(): Promise<void> {
  const rootEnv = path.resolve(__dirname, '../../../.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const env = loadEnv({ ...process.env, PROCESS_ROLE: process.env.PROCESS_ROLE ?? 'worker' });
  if (env.PROCESS_ROLE === 'api') throw new Error('The worker cannot run with PROCESS_ROLE=api');
  const app = await NestFactory.createApplicationContext(AppModule.register(env), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // Job timers are unref'd so they never hold the API open; without an HTTP listener this
  // interval is what keeps the worker alive until it is told to stop.
  const keepAlive = setInterval(() => undefined, 60_000);
  const stop = async () => {
    clearInterval(keepAlive);
    await app.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => void stop());
  process.once('SIGINT', () => void stop());
  app.get(Logger).log('Worker started');
}

void main();
