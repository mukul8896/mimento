'use client';

import { setNonce } from 'get-nonce';

/**
 * Libraries that inject <style> tags at runtime (Radix's scroll lock via react-style-singleton)
 * read their CSP nonce from get-nonce. Setting it during render runs before any dialog opens.
 */
export function CspNonce({ nonce }: { nonce: string | null }) {
  if (nonce && typeof window !== 'undefined') setNonce(nonce);
  return null;
}
