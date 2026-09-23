import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { TestProject } from 'vitest/node';
import { startTestDatabase } from '@momentpath/test-utils';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** One real, migrated and seeded PostgreSQL database per integration run. */
export default async function setup(project: TestProject) {
  const db = await startTestDatabase();
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'seed'], {
    cwd: path.resolve(import.meta.dirname, '../../..'),
    env: { ...process.env, DATABASE_URL: db.url },
    stdio: 'pipe',
  });
  project.provide('databaseUrl', db.url);
  return async () => {
    await db.stop();
  };
}
