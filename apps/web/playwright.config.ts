import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const WEB = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const root = path.resolve(__dirname, '../..');

/**
 * E2E runs against the real stack: Next.js web + NestJS API + PostgreSQL.
 * PostgreSQL must already be running (CI services, docker compose, or the
 * no-Docker fallbacks described in docs/runbook.md). The API and web are started here unless
 * already running (reused locally).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'mobile',
      dependencies: ['setup'],
      // 360px-wide phone with touch, the acceptance-criteria viewport.
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
      testMatch: /(recipient|creator|mobile)\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'node dist/main.js',
      cwd: path.join(root, 'apps/api'),
      url: 'http://localhost:4000/api/v1/ready',
      reuseExistingServer: !process.env.CI,
      env: { RATE_LIMIT_DISABLED: 'true' },
      timeout: 60_000,
    },
    {
      command: process.env.CI ? 'pnpm start' : 'pnpm dev',
      cwd: path.join(root, 'apps/web'),
      url: WEB,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
