import 'server-only';
import { webEnv } from '../env';

/**
 * There are no accounts. A creator is whoever holds an owner token, kept in an HttpOnly cookie
 * and minted on demand the first time someone starts building. A manage token, carried in an
 * experience's recovery link, authorises that one experience instead.
 */
export const OWNER_COOKIE = 'mp_owner';
export const MANAGE_COOKIE = 'mp_manage';
/** Operator credential (ADMIN_TOKEN) for the moderation pages. Not a user account. */
export const ADMIN_COOKIE = 'mp_admin';
/** Owner cookies are the only way back to a draft, so they outlive a browsing session. */
export const OWNER_MAX_AGE = 400 * 24 * 3600;

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict';
  path: string;
  maxAge: number;
}

export interface CookieWriter {
  set(name: string, value: string, options: CookieOptions): void;
}
export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

export function cookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: webEnv().WEB_ORIGIN.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

/** Share and manage tokens are fixed-format; reject anything else before sending it upstream. */
export function isWellFormedToken(value: string | undefined): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function readOwnerToken(cookies: CookieReader): string | null {
  const value = cookies.get(OWNER_COOKIE)?.value;
  return isWellFormedToken(value) ? value : null;
}

export function readManageToken(cookies: CookieReader): string | null {
  const value = cookies.get(MANAGE_COOKIE)?.value;
  return isWellFormedToken(value) ? value : null;
}

/**
 * Headers that authenticate the request upstream, most specific first: the operator credential,
 * then a manage link (one experience), then the owner token (everything this browser made).
 */
export function creatorHeaders(cookies: CookieReader): Record<string, string> {
  const admin = cookies.get(ADMIN_COOKIE)?.value;
  if (admin) return { 'x-admin-token': admin };
  const manage = readManageToken(cookies);
  if (manage) return { 'x-manage-token': manage };
  const owner = readOwnerToken(cookies);
  return owner ? { 'x-owner-token': owner } : {};
}

/** Mints a new anonymous owner. Called the first time a visitor reaches a creator route. */
export async function mintOwnerToken(): Promise<string | null> {
  try {
    const res = await fetch(new URL('/api/v1/owners', webEnv().API_INTERNAL_URL), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { ownerToken?: string };
    return isWellFormedToken(body.ownerToken) ? body.ownerToken : null;
  } catch {
    return null;
  }
}
