import { NextResponse } from 'next/server';
import { cookieOptions, isWellFormedToken, MANAGE_COOKIE, OWNER_MAX_AGE } from '@/lib/auth/owner';
import { webEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Manage link: the way back to one experience without an account. Storing the token in an
 * HttpOnly cookie keeps it out of the address bar (and so out of Referer headers and history)
 * for every later request.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const origin = webEnv().WEB_ORIGIN;
  if (!isWellFormedToken(token)) return NextResponse.redirect(new URL('/?manage=invalid', origin));

  const response = NextResponse.redirect(new URL('/dashboard', origin));
  response.cookies.set(MANAGE_COOKIE, token, cookieOptions(OWNER_MAX_AGE));
  return response;
}
