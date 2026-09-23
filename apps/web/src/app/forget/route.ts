import { NextResponse, type NextRequest } from 'next/server';
import { cookieOptions, MANAGE_COOKIE, OWNER_COOKIE } from '@/lib/auth/owner';
import { webEnv } from '@/lib/env';
import { isSameOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * Clears the creator credentials on this device. Replaces sign-out: nothing is revoked server
 * side, because the token *is* the identity — the experiences stay reachable by manage link.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const response = NextResponse.redirect(new URL('/', webEnv().WEB_ORIGIN), { status: 303 });
  response.cookies.set(OWNER_COOKIE, '', cookieOptions(0));
  response.cookies.set(MANAGE_COOKIE, '', cookieOptions(0));
  return response;
}
