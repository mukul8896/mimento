import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

/** scrypt parameters; a PIN has little entropy, so lockout (not hashing) is the main defence. */
const PARAMS = { N: 16_384, r: 8, p: 1 };
const KEY_LENGTH = 32;

/** `scrypt$<salt>$<hash>` (base64url). A fresh salt per PIN, so equal PINs hash differently. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, KEY_LENGTH, PARAMS);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scryptAsync(pin, Buffer.from(salt, 'base64url'), expected.length, PARAMS);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
