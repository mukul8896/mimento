// Runs a persistent local PostgreSQL without Docker (development fallback).
// Uses the embedded-postgres binaries from @momentpath/test-utils. Data lives in .local/postgres.
// Usage: pnpm local:postgres   (Ctrl+C to stop)
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(path.resolve('packages/test-utils/package.json'));
const { default: EmbeddedPostgres } = await import(require.resolve('embedded-postgres'));

const databaseDir = path.resolve('.local/postgres');
const firstRun = !existsSync(path.join(databaseDir, 'PG_VERSION'));
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'momentpath',
  password: 'momentpath',
  port: Number(process.env.LOCAL_PG_PORT ?? 5432),
  persistent: true,
  onLog: () => {},
});

if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) {
  await pg.createDatabase('momentpath');
}
console.warn(
  `PostgreSQL ready on port ${process.env.LOCAL_PG_PORT ?? 5432} (data: ${databaseDir})`,
);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
