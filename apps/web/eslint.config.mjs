import nextVitals from 'eslint-config-next/core-web-vitals';
import base from '@momentpath/config/eslint';

const config = [
  ...base,
  ...nextVitals,
  { ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
];

export default config;
