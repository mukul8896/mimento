import { NextResponse } from 'next/server';
import { cookieOptions, isWellFormedToken, OWNER_COOKIE, OWNER_MAX_AGE } from '@/lib/auth/owner';
import { webEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Recovery link for the whole creator identity — the way back after clearing browser data or
 * moving to a new device. Unlike a manage link (one experience), this restores the owner token
 * itself, so it reaches everything this person has made. Stored straight into the HttpOnly
 * cookie and redirected away, so the token does not linger in history or Referer headers.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const origin = webEnv().WEB_ORIGIN;
  if (!isWellFormedToken(token)) {
    return NextResponse.redirect(new URL('/?recover=invalid', origin));
  }
  const response = NextResponse.redirect(new URL('/dashboard', origin));
  response.cookies.set(OWNER_COOKIE, token, cookieOptions(OWNER_MAX_AGE));
  return response;
}
