import path from 'node:path';
import type { NextConfig } from 'next';

// One .env at the repository root serves the API and the web app in development.
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'));
} catch {
  // Containers and CI inject environment variables directly.
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  output: 'standalone',
  outputFileTracingRoot: path.resolve(import.meta.dirname, '../..'),
  transpilePackages: ['@momentpath/api-client', '@momentpath/design-system'],
};

export default nextConfig;
