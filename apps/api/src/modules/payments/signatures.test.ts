import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyRazorpayWebhook, verifyStandardWebhook } from './signatures';

const body = Buffer.from('{"event":"payment_link.paid"}');

describe('verifyRazorpayWebhook', () => {
  const secret = 'rzp-webhook-secret';
  const good = createHmac('sha256', secret).update(body).digest('hex');

  it('accepts the hex HMAC of the raw body', () => {
    expect(verifyRazorpayWebhook(body, good, secret)).toBe(true);
  });
  it('rejects a wrong secret, an altered body and garbage', () => {
    expect(verifyRazorpayWebhook(body, good, 'other')).toBe(false);
    expect(verifyRazorpayWebhook(Buffer.from(`${body} `), good, secret)).toBe(false);
    expect(verifyRazorpayWebhook(body, 'not-hex', secret)).toBe(false);
    expect(verifyRazorpayWebhook(body, '', secret)).toBe(false);
  });
});

describe('verifyStandardWebhook', () => {
  const key = Buffer.alloc(24, 3);
  const secret = `whsec_${key.toString('base64')}`;
  const now = 1_790_000_000;
  const sign = (id: string, ts: number, payload = body) =>
    createHmac('sha256', key).update(`${id}.${ts}.`).update(payload).digest('base64');
  const headers = (id: string, ts: number, sig: string) => ({
    id,
    timestamp: String(ts),
    signature: sig,
  });

  it('accepts a v1 signature over id.timestamp.body', () => {
    expect(
      verifyStandardWebhook(body, headers('msg_1', now, `v1,${sign('msg_1', now)}`), secret, now),
    ).toBe(true);
  });
  it('accepts any matching entry during key rotation', () => {
    const sig = `v1,${Buffer.alloc(32).toString('base64')} v1,${sign('msg_1', now)}`;
    expect(verifyStandardWebhook(body, headers('msg_1', now, sig), secret, now)).toBe(true);
  });
  it('rejects a tampered body, another id, a stale timestamp and missing headers', () => {
    const sig = `v1,${sign('msg_1', now)}`;
    expect(verifyStandardWebhook(Buffer.from('{}'), headers('msg_1', now, sig), secret, now)).toBe(
      false,
    );
    expect(verifyStandardWebhook(body, headers('msg_2', now, sig), secret, now)).toBe(false);
    const old = now - 301;
    expect(
      verifyStandardWebhook(body, headers('msg_1', old, `v1,${sign('msg_1', old)}`), secret, now),
    ).toBe(false);
    expect(verifyStandardWebhook(body, { id: 'msg_1' }, secret, now)).toBe(false);
    expect(
      verifyStandardWebhook(body, headers('msg_1', now, `v2,${sign('msg_1', now)}`), secret, now),
    ).toBe(false);
  });
});
