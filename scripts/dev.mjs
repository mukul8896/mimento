// One command for local development:
//   docker compose up (postgres, minio) -> wait healthy -> migrate -> seed -> api + web
// Without Docker, run `pnpm local:postgres`, then `pnpm dev:apps` (see docs/runbook.md).
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n✖ ${cmd} ${args.join(' ')} failed`);
    process.exit(result.status ?? 1);
  }
}

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.warn('Created .env from .env.example');
}

const docker = spawnSync('docker', ['info'], { stdio: 'ignore' });
if (docker.status !== 0) {
  console.error(
    'Docker is not running. Start Docker, or follow the no-Docker steps in docs/runbook.md.',
  );
  process.exit(1);
}

run('docker', ['compose', 'up', '-d', '--wait', 'postgres', 'minio']);
run('docker', ['compose', 'run', '--rm', 'minio-init']);
run('pnpm', ['--filter', '@momentpath/contracts', 'build']);
run('pnpm', ['exec', 'prisma', 'generate']);
run('pnpm', ['exec', 'prisma', 'migrate', 'deploy']);
run('pnpm', ['exec', 'prisma', 'db', 'seed']);

const apps = spawn('pnpm', ['dev:apps'], { stdio: 'inherit' });
apps.on('exit', (code) => process.exit(code ?? 0));
