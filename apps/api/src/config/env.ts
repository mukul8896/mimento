import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
/** `KEY=` in an env file means "not set", so an unused provider can stay listed but blank. */
const blankAsUnset = (v: unknown) => (v === '' ? undefined : v);
const optionalSecret = z.preprocess(blankAsUnset, z.string().min(1).optional());

/**
 * All API configuration comes from the environment and is validated once at start-up.
 * The process refuses to boot with missing or malformed security settings.
 */
export const EnvSchema = z
  .object({
    APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1),
    API_PORT: z.coerce.number().int().default(4000),
    WEB_ORIGIN: z.url(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),

    /**
     * Operator credential for the moderation endpoints. There are no accounts, so this is the
     * only privileged identity. Unset leaves /admin unreachable rather than open.
     */
    ADMIN_TOKEN: z.string().min(32).optional(),

    APP_ENCRYPTION_KEYS: z.string().min(1),
    APP_ENCRYPTION_ACTIVE_KEY: z.string().min(1),

    STORAGE_DRIVER: z.enum(['filesystem', 's3']).default('filesystem'),
    STORAGE_FS_ROOT: z.string().default('.local/storage'),
    STORAGE_SIGNING_SECRET: z.string().min(32).optional(),
    MEDIA_PUBLIC_BASE_URL: z.url().optional(),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool.default(false),

    /**
     * Enforce paid tiers at publish time. Off by default so the product runs end to end before
     * a payment provider exists; turning it on without one leaves upgrades to the operator.
     */
    BILLING_ENABLED: bool.default(false),

    /**
     * Payments. A provider is offered only when its credentials are set, so test and live mode
     * differ only in these values — never in code. Razorpay serves India (UPI, INR); Dodo
     * Payments is the merchant of record for everyone else and handles their sales tax.
     */
    RAZORPAY_KEY_ID: optionalSecret,
    RAZORPAY_KEY_SECRET: optionalSecret,
    RAZORPAY_WEBHOOK_SECRET: optionalSecret,
    RAZORPAY_API_BASE: z.url().default('https://api.razorpay.com'),
    DODO_API_KEY: optionalSecret,
    DODO_WEBHOOK_SECRET: optionalSecret,
    DODO_ENVIRONMENT: z.enum(['test', 'live']).default('test'),
    /** Overrides the base URL DODO_ENVIRONMENT picks (tests point it at a local fake). */
    DODO_API_BASE: z.preprocess(blankAsUnset, z.url().optional()),
    /** Dodo product ids differ between test and live mode; create them in the Dodo dashboard. */
    DODO_PRODUCT_PLUS: optionalSecret,
    DODO_PRODUCT_PRO: optionalSecret,
    /** Optional product for an experience that already holds PLUS. Without it Dodo is not offered. */
    DODO_PRODUCT_PLUS_TO_PRO: optionalSecret,
    /** Prices in minor units. USD prices must match the Dodo products; they are shown, not charged. */
    PRICE_INR_PLUS: z.coerce.number().int().min(100).default(9900),
    PRICE_INR_PRO: z.coerce.number().int().min(100).default(19900),
    PRICE_USD_PLUS: z.coerce.number().int().min(50).default(299),
    PRICE_USD_PRO: z.coerce.number().int().min(50).default(499),
    /** How often unfinished checkouts are checked with the provider. 0 disables. */
    PAYMENTS_RECONCILE_MS: z.coerce.number().int().min(0).default(300_000),

    /**
     * What this process does. `api` serves HTTP only; `worker` runs background jobs only (outbox,
     * media pipeline, payment reconciliation); `all` does both (development and tests).
     */
    PROCESS_ROLE: z.enum(['all', 'api', 'worker']).default('all'),
    /** clamd for malware scanning of uploads. Required in production wherever jobs run. */
    CLAMAV_HOST: z.preprocess(blankAsUnset, z.string().min(1).optional()),
    CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(3310),
    /** How often the media pipeline looks for new uploads to scan and resize. 0 disables. */
    MEDIA_PIPELINE_MS: z.coerce.number().int().min(0).default(3000),

    /**
     * Surprises nobody (creator or recipient) has used for this many days are deleted, and so are
     * owners with nothing left who have not been back for as long. 0 turns retention off.
     */
    RETENTION_DAYS: z.coerce.number().int().min(0).max(3650).default(365),
    /** How often the worker looks for surprises past retention. 0 disables the sweep. */
    RETENTION_SWEEP_MS: z.coerce.number().int().min(0).default(3_600_000),

    RATE_LIMIT_DISABLED: bool.default(false),
    OUTBOX_POLL_MS: z.coerce.number().int().min(0).default(5000),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === 'production' && env.STORAGE_DRIVER === 'filesystem') {
      ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'Use s3 in production' });
    }
    if (env.APP_ENV === 'production' && !env.ADMIN_TOKEN) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADMIN_TOKEN'],
        message: 'Required in production so takedowns are possible',
      });
    }
    if (env.APP_ENV === 'production' && env.RATE_LIMIT_DISABLED) {
      ctx.addIssue({
        code: 'custom',
        path: ['RATE_LIMIT_DISABLED'],
        message: 'Not allowed in production',
      });
    }
    if (env.STORAGE_DRIVER === 'filesystem') {
      if (!env.STORAGE_SIGNING_SECRET) {
        ctx.addIssue({ code: 'custom', path: ['STORAGE_SIGNING_SECRET'], message: 'Required' });
      }
      if (!env.MEDIA_PUBLIC_BASE_URL) {
        ctx.addIssue({ code: 'custom', path: ['MEDIA_PUBLIC_BASE_URL'], message: 'Required' });
      }
    }
    if (env.APP_ENV === 'production' && env.PROCESS_ROLE !== 'api' && !env.CLAMAV_HOST) {
      ctx.addIssue({
        code: 'custom',
        path: ['CLAMAV_HOST'],
        message: 'Required in production so uploads are scanned before anyone sees them',
      });
    }
    if (Boolean(env.RAZORPAY_KEY_ID) !== Boolean(env.RAZORPAY_KEY_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['RAZORPAY_KEY_SECRET'],
        message: 'Set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or neither',
      });
    }
    if (env.DODO_API_KEY && !env.DODO_PRODUCT_PLUS && !env.DODO_PRODUCT_PRO) {
      ctx.addIssue({
        code: 'custom',
        path: ['DODO_PRODUCT_PLUS'],
        message: 'Dodo needs at least one product id',
      });
    }
    // Real money only in production: a live key on a laptop or in CI is a mistake.
    if (env.APP_ENV !== 'production') {
      if (env.RAZORPAY_KEY_ID?.startsWith('rzp_live_')) {
        ctx.addIssue({
          code: 'custom',
          path: ['RAZORPAY_KEY_ID'],
          message: 'Live Razorpay keys are only allowed in production',
        });
      }
      if (env.DODO_ENVIRONMENT === 'live') {
        ctx.addIssue({
          code: 'custom',
          path: ['DODO_ENVIRONMENT'],
          message: 'Live Dodo mode is only allowed in production',
        });
      }
    }
    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'Required for s3' });
      }
    }
  });

export type AppEnv = z.infer<typeof EnvSchema>;

export const APP_ENV = Symbol('APP_ENV');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid API configuration: ${problems}`);
  }
  return parsed.data;
}
