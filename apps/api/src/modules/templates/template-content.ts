import { z } from 'zod';
import { DraftStepSchema, GiftSecretSchema, ThemeSchema } from '@momentpath/contracts';

/** Stored template structure. Keys are placeholders; fresh UUIDs are issued per experience. */
export const TemplateContentSchema = z.object({
  title: z.string().max(120),
  theme: ThemeSchema,
  steps: z.array(DraftStepSchema).min(1),
  /** Optional starter surprise details (never real vouchers) keyed by gift step key. */
  giftDefaults: z.record(z.string(), GiftSecretSchema).default({}),
});
export type TemplateContent = z.infer<typeof TemplateContentSchema>;
