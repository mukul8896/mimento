import { NextResponse, type NextRequest } from 'next/server';
import {
  cookieOptions,
  isWellFormedToken,
  OWNER_COOKIE,
  OWNER_MAX_AGE,
  readOwnerToken,
} from '@/lib/auth/owner';
import { webEnv } from '@/lib/env';
import { isSameOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * Finishes a passkey sign-in: the API verifies the passkey and issues an owner key for this
 * device, which goes straight into the HttpOnly cookie. The browser's script never sees it.
 * The browser's current (throwaway) key is sent along so anything made with it is kept.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const current = readOwnerToken(request.cookies);
  const upstream = await fetch(new URL('/api/v1/passkeys/login', webEnv().API_INTERNAL_URL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(current ? { 'x-owner-token': current } : {}),
    },
    body: await request.text(),
    cache: 'no-store',
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ ok: false, code: 'NETWORK' }, { status: 502 });
  const body = (await upstream.json().catch(() => ({}))) as { ownerToken?: string; code?: string };
  if (!upstream.ok || !isWellFormedToken(body.ownerToken)) {
    return NextResponse.json(
      { ok: false, code: body.code ?? 'PASSKEY_FAILED' },
      { status: upstream.status >= 400 ? upstream.status : 400 },
    );
  }
  const response = NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
  response.cookies.set(OWNER_COOKIE, body.ownerToken, cookieOptions(OWNER_MAX_AGE));
  return response;
}
