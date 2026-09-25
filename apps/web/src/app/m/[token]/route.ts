import { NextResponse } from 'next/server';
import { cookieOptions, isWellFormedToken, MANAGE_COOKIE, OWNER_MAX_AGE } from '@/lib/auth/owner';
import { webEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Which surprise a private management link opens, asked of the API with the link itself. */
async function managedExperience(token: string): Promise<string | null> {
  try {
    const res = await fetch(new URL('/api/v1/me', webEnv().API_INTERNAL_URL), {
      headers: { 'x-manage-token': token },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const me = (await res.json()) as { managedExperienceId?: string | null };
    return typeof me.managedExperienceId === 'string' ? me.managedExperienceId : null;
  } catch {
    return null;
  }
}

/**
 * Private management link: straight to "Manage Surprise" for that one experience — there is no
 * account or list in between. The token goes into an HttpOnly cookie, which keeps it out of the
 * address bar (and so out of Referer headers and history) for every later request. A link that
 * does not work sets nothing.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const origin = webEnv().WEB_ORIGIN;
  const experienceId = isWellFormedToken(token) ? await managedExperience(token) : null;
  if (!experienceId) return NextResponse.redirect(new URL('/?manage=invalid', origin));

  const response = NextResponse.redirect(new URL(`/experiences/${experienceId}`, origin));
  response.cookies.set(MANAGE_COOKIE, token, cookieOptions(OWNER_MAX_AGE));
  return response;
}
