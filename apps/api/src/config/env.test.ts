import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const base = {
  APP_ENV: 'development',
  DATABASE_URL: 'postgresql://x@localhost/x',
  WEB_ORIGIN: 'http://localhost:3000',
  APP_ENCRYPTION_KEYS: `k1:${Buffer.alloc(32).toString('base64')}`,
  APP_ENCRYPTION_ACTIVE_KEY: 'k1',
  STORAGE_SIGNING_SECRET: 's'.repeat(40),
  MEDIA_PUBLIC_BASE_URL: 'http://localhost:3000/bff/api',
};

describe('payment configuration', () => {
  it('starts with no payment provider configured', () => {
    expect(() => loadEnv(base)).not.toThrow();
  });

  it('accepts Razorpay test keys and Dodo test mode outside production', () => {
    const env = loadEnv({
      ...base,
      RAZORPAY_KEY_ID: 'rzp_test_abc',
      RAZORPAY_KEY_SECRET: 'secret',
      DODO_API_KEY: 'dodo',
      DODO_PRODUCT_PLUS: 'pdt_1',
    });
    expect(env.DODO_ENVIRONMENT).toBe('test');
    expect(env.PRICE_INR_PLUS).toBe(9900);
  });

  it('refuses live money outside production', () => {
    expect(() =>
      loadEnv({ ...base, RAZORPAY_KEY_ID: 'rzp_live_abc', RAZORPAY_KEY_SECRET: 'secret' }),
    ).toThrow(/RAZORPAY_KEY_ID/);
    expect(() => loadEnv({ ...base, DODO_ENVIRONMENT: 'live' })).toThrow(/DODO_ENVIRONMENT/);
  });

  it('treats blank values from an env file as not set', () => {
    const env = loadEnv({
      ...base,
      RAZORPAY_KEY_ID: '',
      RAZORPAY_KEY_SECRET: '',
      DODO_API_KEY: '',
    });
    expect(env.RAZORPAY_KEY_ID).toBeUndefined();
    expect(env.DODO_API_KEY).toBeUndefined();
  });

  it('refuses half-configured providers', () => {
    expect(() => loadEnv({ ...base, RAZORPAY_KEY_ID: 'rzp_test_abc' })).toThrow(
      /RAZORPAY_KEY_SECRET/,
    );
    expect(() => loadEnv({ ...base, DODO_API_KEY: 'dodo' })).toThrow(/DODO_PRODUCT_PLUS/);
  });
});
