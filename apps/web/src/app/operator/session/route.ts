import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, cookieOptions } from '@/lib/auth/owner';
import { webEnv } from '@/lib/env';
import { isSameOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';

/** Operator sign-in: the ADMIN_TOKEN is stored in an HttpOnly cookie and checked by the API. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const form = await request.formData();
  const token = form.get('token');
  const origin = webEnv().WEB_ORIGIN;
  if (typeof token !== 'string' || token.length < 32 || token.length > 512) {
    return NextResponse.redirect(new URL('/operator?error=1', origin), { status: 303 });
  }
  const response = NextResponse.redirect(new URL('/admin', origin), { status: 303 });
  response.cookies.set(ADMIN_COOKIE, token, cookieOptions(8 * 3600));
  return response;
}
