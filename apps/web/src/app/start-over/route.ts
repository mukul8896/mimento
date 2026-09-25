import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, cookieOptions, MANAGE_COOKIE, OWNER_COOKIE } from '@/lib/auth/owner';
import { hasSession, serverApi } from '@/lib/api/server';
import { webEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Where a creator lands when their saved key no longer works (for example it expired after a
 * year without use). The cookies are cleared only after the API has confirmed they are no longer
 * valid, so a link to this page cannot sign anyone out; the next page mints a fresh owner.
 */
export async function GET() {
  const origin = webEnv().WEB_ORIGIN;
  // Nothing to clear (minting failed): go home rather than bounce between pages.
  if (!(await hasSession())) return NextResponse.redirect(new URL('/', origin));
  const { response } = await (await serverApi()).GET('/api/v1/me');
  if (response.status !== 401) return NextResponse.redirect(new URL('/new', origin));
  const res = NextResponse.redirect(new URL('/new', origin));
  for (const name of [OWNER_COOKIE, MANAGE_COOKIE, ADMIN_COOKIE])
    res.cookies.set(name, '', cookieOptions(0));
  return res;
}
