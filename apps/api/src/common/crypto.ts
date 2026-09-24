import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/** 256 bits of CSPRNG output, base64url encoded (43 characters). Used for share and session tokens. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Share and session tokens are fixed-format; reject anything else before touching the DB. */
export function isWellFormedToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export type EncryptionPurpose = 'gift-secret' | 'share-token' | 'manage-token';

/**
 * AES-256-GCM keyring. Each configured master key derives a separate sub-key per purpose via
 * HKDF, so a gift ciphertext can never be decrypted as a share token or vice versa. The
 * additional authenticated data binds a ciphertext to its row (for example version + step).
 * Rotation: add a new key, make it active, re-encrypt lazily; old keys stay for decryption.
 *
 * Format: `<keyId>.<iv>.<tag>.<ciphertext>` (base64url parts).
 */
export class Keyring {
  private readonly masters = new Map<string, Buffer>();

  constructor(
    spec: string,
    private readonly activeKeyId: string,
  ) {
    for (const entry of spec
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      const idx = entry.indexOf(':');
      if (idx <= 0) throw new Error('Encryption keys must be formatted as id:base64key');
      const id = entry.slice(0, idx);
      const key = Buffer.from(entry.slice(idx + 1), 'base64');
      if (key.length !== 32) throw new Error(`Encryption key ${id} must be 32 bytes`);
      if (!/^[a-zA-Z0-9_-]{1,32}$/.test(id)) throw new Error('Invalid encryption key id');
      this.masters.set(id, key);
    }
    if (!this.masters.has(activeKeyId))
      throw new Error('Active encryption key is not in the keyring');
  }

  private subKey(keyId: string, purpose: EncryptionPurpose): Buffer {
    const master = this.masters.get(keyId);
    if (!master) throw new Error('Unknown encryption key id');
    // The HKDF label keeps the working name on purpose: changing it would make every stored
    // ciphertext (gift codes, share and manage links) undecryptable.
    return Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), `momentpath:${purpose}`, 32));
  }

  encrypt(plaintext: string, purpose: EncryptionPurpose, aad: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.subKey(this.activeKeyId, purpose), iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      this.activeKeyId,
      iv.toString('base64url'),
      tag.toString('base64url'),
      ct.toString('base64url'),
    ].join('.');
  }

  decrypt(payload: string, purpose: EncryptionPurpose, aad: string): string {
    const parts = payload.split('.');
    if (parts.length !== 4) throw new Error('Malformed ciphertext');
    const [keyId, iv, tag, ct] = parts as [string, string, string, string];
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.subKey(keyId, purpose),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ct, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}

export const KEYRING = Symbol('KEYRING');
