import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // `server-only` throws when imported outside a server component; tests import those modules
      // directly, so it is stubbed out here.
      'server-only': path.resolve(import.meta.dirname, 'test/server-only-stub.ts'),
    },
  },
  test: { include: ['src/**/*.test.ts'] },
});
