import { describe, expect, it } from 'vitest';
import { generateToken, isWellFormedToken, Keyring, sha256 } from './crypto';

const key = (fill: number) => Buffer.alloc(32, fill).toString('base64');

describe('tokens', () => {
  it('generates 256-bit url-safe tokens that are unique', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateToken));
    expect(tokens.size).toBe(1000);
    for (const t of tokens) expect(isWellFormedToken(t)).toBe(true);
    expect(Buffer.from([...tokens][0]!, 'base64url')).toHaveLength(32);
  });
  it('rejects malformed tokens and hashes deterministically', () => {
    expect(isWellFormedToken('short')).toBe(false);
    expect(isWellFormedToken(`${'a'.repeat(42)}/`)).toBe(false);
    expect(sha256('x')).toBe(sha256('x'));
  });
});

describe('Keyring (AES-256-GCM)', () => {
  const ring = new Keyring(`k1:${key(1)}`, 'k1');

  it('round-trips and never contains the plaintext', () => {
    const ct = ring.encrypt('VOUCHER-123', 'gift-secret', 'gift:v1:s1');
    expect(ct).not.toContain('VOUCHER');
    expect(ring.decrypt(ct, 'gift-secret', 'gift:v1:s1')).toBe('VOUCHER-123');
    expect(ring.encrypt('same', 'gift-secret', 'a')).not.toBe(
      ring.encrypt('same', 'gift-secret', 'a'),
    );
  });

  it('fails authentication for tampering, wrong AAD or wrong purpose', () => {
    const ct = ring.encrypt('secret', 'gift-secret', 'gift:v1:s1');
    expect(() => ring.decrypt(ct, 'gift-secret', 'gift:v2:s1')).toThrow();
    expect(() => ring.decrypt(ct, 'share-token', 'gift:v1:s1')).toThrow();
    const parts = ct.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => ring.decrypt(parts.join('.'), 'gift-secret', 'gift:v1:s1')).toThrow();
  });

  it('supports rotation: old ciphertexts decrypt after a new key becomes active', () => {
    const old = ring.encrypt('legacy', 'gift-secret', 'aad');
    const rotated = new Keyring(`k2:${key(2)},k1:${key(1)}`, 'k2');
    expect(rotated.decrypt(old, 'gift-secret', 'aad')).toBe('legacy');
    expect(rotated.encrypt('new', 'gift-secret', 'aad').startsWith('k2.')).toBe(true);
  });

  it('validates key configuration', () => {
    expect(() => new Keyring('k1:short', 'k1')).toThrow();
    expect(() => new Keyring(`k1:${key(1)}`, 'k9')).toThrow();
  });
});
