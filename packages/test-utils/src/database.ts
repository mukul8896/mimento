import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export interface TestDatabase {
  url: string;
  stop(): Promise<void>;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const address = srv.address();
      srv.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('no port')),
      );
    });
  });
}

function repoRoot(): string {
  return path.resolve(import.meta.dirname, '../../..');
}

/** Applies the real Prisma migrations, including the hand-written integrity triggers. */
export function migrate(url: string): void {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: repoRoot(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}

/**
 * A real, ephemeral PostgreSQL database for integration tests.
 * - With TEST_DATABASE_SERVER_URL (e.g. the CI Postgres service), creates a uniquely named DB.
 * - Otherwise starts an embedded PostgreSQL cluster in a temp directory (no Docker needed).
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const pg = await import('pg').catch(() => null);
  const server = process.env.TEST_DATABASE_SERVER_URL;
  const name = `momentpath_test_${randomBytes(4).toString('hex')}`;

  if (server) {
    if (!pg) throw new Error('pg is required to create test databases');
    const admin = new pg.default.Client({ connectionString: server });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${name}`);
    await admin.end();
    const url = new URL(server);
    url.pathname = `/${name}`;
    migrate(url.toString());
    return {
      url: url.toString(),
      stop: async () => {
        const c = new pg.default.Client({ connectionString: server });
        await c.connect();
        await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
        await c.end();
      },
    };
  }

  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'momentpath-pg-'));
  const port = await freePort();
  const cluster = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'test',
    password: 'test',
    port,
    persistent: false,
    onLog: () => {},
  });
  await cluster.initialise();
  await cluster.start();
  await cluster.createDatabase(name);
  const url = `postgresql://test:test@localhost:${port}/${name}`;
  migrate(url);
  return {
    url,
    stop: async () => {
      await cluster.stop();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
