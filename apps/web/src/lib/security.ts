import 'server-only';
import type { NextRequest } from 'next/server';
import { webEnv } from './env';

/**
 * CSRF defence for cookie-authenticated mutations: the browser-supplied Origin (or, as a
 * fallback, Sec-Fetch-Site) must show the request came from our own pages.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (origin) return origin === webEnv().WEB_ORIGIN;
  return request.headers.get('sec-fetch-site') === 'same-origin';
}
