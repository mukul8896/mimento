import { NextResponse, type NextRequest } from 'next/server';
import {
  cookieOptions,
  mintOwnerToken,
  OWNER_COOKIE,
  OWNER_MAX_AGE,
  readManageToken,
  readOwnerToken,
  type CookieOptions,
} from '@/lib/auth/owner';
import { webEnv } from '@/lib/env';

const CREATOR_PREFIXES = ['/dashboard', '/new', '/experiences', '/account', '/admin'];

function contentSecurityPolicy(nonce: string, dev: boolean): string {
  const env = webEnv();
  const media = env.MEDIA_ORIGIN ? ` ${env.MEDIA_ORIGIN}` : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Development tooling injects unnonced styles; production requires the nonce.
    dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    // Theme tokens and animations use inline style attributes (no script capability).
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' blob: data:${media}`,
    `connect-src 'self'${media}${dev ? ' ws:' : ''}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(env.WEB_ORIGIN.startsWith('https://') ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

interface PendingCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Runs before every page and BFF request: CSP nonce, security headers, private-page headers
 * for recipient links, and minting an anonymous owner the first time someone builds something.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const dev = process.env.NODE_ENV === 'development';
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  const isCreatorRoute = CREATOR_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isRecipientRoute = pathname.startsWith('/e/');
  const isBff = pathname.startsWith('/bff/');

  const pending: PendingCookie[] = [];
  const writer = {
    set: (name: string, value: string, options: CookieOptions) =>
      pending.push({ name, value, options }),
  };

  // No sign-in step: a visitor who starts building simply becomes an anonymous owner. A manage
  // link already identifies its holder, so it never triggers a mint.
  if (isCreatorRoute && !readOwnerToken(request.cookies) && !readManageToken(request.cookies)) {
    const minted = await mintOwnerToken();
    if (minted) writer.set(OWNER_COOKIE, minted, cookieOptions(OWNER_MAX_AGE));
  }

  // Let downstream handlers see refreshed cookies in this same request.
  for (const c of pending) {
    if (c.options.maxAge > 0) request.cookies.set(c.name, c.value);
    else request.cookies.delete(c.name);
  }
  const csp = contentSecurityPolicy(nonce, dev);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const c of pending) response.cookies.set(c.name, c.value, c.options);

  response.headers.set('content-security-policy', csp);
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set(
    'permissions-policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  response.headers.set('cross-origin-opener-policy', 'same-origin');
  if (webEnv().WEB_ORIGIN.startsWith('https://')) {
    response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }
  if (isRecipientRoute || isBff) {
    // Private links: never indexed, never cached by shared caches, never leaked via Referer.
    response.headers.set('referrer-policy', 'no-referrer');
    response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
    response.headers.set('cache-control', 'no-store, private');
  } else {
    response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  }
  if (isCreatorRoute) response.headers.set('cache-control', 'no-store, private');
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
