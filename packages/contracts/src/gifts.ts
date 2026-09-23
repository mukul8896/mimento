import { z } from 'zod';
import { GiftKind } from './steps';

/**
 * Gift secrets are what the recipient finally receives. They are encrypted at rest with
 * AES-256-GCM and never appear in list endpoints, draft payloads, logs or initial HTML.
 * Phase 1 gifts are always externally obtained: MomentPath issues no stored value.
 */

const httpsUrl = z.url({ protocol: /^https$/, message: 'Use a secure https:// link' }).max(2000);
const instructions = z.string().trim().max(2000);

export const GiftSecretSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('VOUCHER_CODE'),
      code: z.string().trim().min(1).max(200),
      pin: z.string().trim().max(50).default(''),
      redeemUrl: httpsUrl.or(z.literal('')).default(''),
      instructions: instructions.default(''),
    }),
    z.strictObject({
      kind: z.literal('URL'),
      url: httpsUrl,
      instructions: instructions.default(''),
    }),
    z.strictObject({
      kind: z.literal('QR_IMAGE'),
      mediaId: z.uuid(),
      instructions: instructions.default(''),
    }),
    z.strictObject({
      kind: z.literal('INSTRUCTION'),
      instructions: instructions.min(1),
    }),
    z.strictObject({
      kind: z.literal('PHYSICAL_MESSAGE'),
      message: z.string().trim().min(1).max(2000),
    }),
  ])
  .meta({ id: 'GiftSecret' });
export type GiftSecret = z.infer<typeof GiftSecretSchema>;

export function giftSecretMatchesKind(secret: GiftSecret, kind: GiftKind): boolean {
  return secret.kind === kind;
}

/** What the reveal endpoint returns. The QR media id is replaced by a short-lived URL. */
export const RevealedGiftSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('VOUCHER_CODE'),
      code: z.string(),
      pin: z.string(),
      redeemUrl: z.string(),
      instructions: z.string(),
    }),
    z.strictObject({ kind: z.literal('URL'), url: z.string(), instructions: z.string() }),
    z.strictObject({ kind: z.literal('QR_IMAGE'), imageUrl: z.string(), instructions: z.string() }),
    z.strictObject({ kind: z.literal('INSTRUCTION'), instructions: z.string() }),
    z.strictObject({ kind: z.literal('PHYSICAL_MESSAGE'), message: z.string() }),
  ])
  .meta({ id: 'RevealedGift' });
export type RevealedGift = z.infer<typeof RevealedGiftSchema>;
