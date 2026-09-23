import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

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
