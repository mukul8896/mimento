import 'server-only';
import { z } from 'zod';

const Schema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WEB_ORIGIN: z.url(),
  API_INTERNAL_URL: z.url(),
  /** Extra origins allowed in CSP img-src/connect-src (e.g. the S3/MinIO endpoint). */
  MEDIA_ORIGIN: z.string().optional(),
  /** Shown on the contact, refund and privacy pages. Payment providers require one. */
  SUPPORT_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.email().optional()),
  /** The person or business that runs the site, as registered with the payment providers. */
  OPERATOR_NAME: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(1).max(120).default('MomentPath'),
  ),
});

export type WebEnv = z.infer<typeof Schema>;

let cached: WebEnv | undefined;

/** Server-only configuration, validated on first use. Never imported by client components. */
export function webEnv(): WebEnv {
  if (!cached) {
    const parsed = Schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `Invalid web configuration: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
      );
    }
    cached = parsed.data;
  }
  return cached;
}
