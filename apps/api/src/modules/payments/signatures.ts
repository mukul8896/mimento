import { createHmac, timingSafeEqual } from 'node:crypto';

function equalBytes(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Razorpay webhooks: hex HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyRazorpayWebhook(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const given = Buffer.from(signature.trim(), 'hex');
  return equalBytes(expected, given);
}

/** Five minutes either side, as recommended by the Standard Webhooks spec. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Dodo webhooks follow the Standard Webhooks spec: base64 HMAC-SHA256 of
 * `${webhook-id}.${webhook-timestamp}.${body}`, keyed with the base64 secret after its `whsec_`
 * prefix. The signature header may list several space-separated `v1,<sig>` entries during key
 * rotation; any match is accepted. Old timestamps are rejected so a captured delivery cannot be
 * replayed later.
 */
export function verifyStandardWebhook(
  rawBody: Buffer,
  headers: { id?: string; timestamp?: string; signature?: string },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.`).update(rawBody).digest();
  return signature
    .split(' ')
    .map((entry) => entry.split(','))
    .some(
      ([version, value]) =>
        version === 'v1' && !!value && equalBytes(expected, Buffer.from(value, 'base64')),
    );
}
