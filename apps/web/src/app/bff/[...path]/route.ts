import { NextResponse, type NextRequest } from 'next/server';
import { creatorHeaders } from '@/lib/auth/owner';
import { webEnv } from '@/lib/env';
import { isSameOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';

const FORWARD_REQUEST_HEADERS = [
  'content-type',
  'idempotency-key',
  'x-recipient-session',
  'x-request-id',
  'accept',
];
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'x-robots-tag',
  'idempotent-replayed',
  'content-security-policy',
  'x-content-type-options',
];
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function problem(status: number, code: string, title: string) {
  return NextResponse.json(
    {
      type: `https://momentpath.dev/problems/${code.toLowerCase()}`,
      title,
      status,
      code,
      requestId: 'bff',
    },
    {
      status,
      headers: { 'content-type': 'application/problem+json', 'cache-control': 'no-store' },
    },
  );
}

/**
 * Backend-for-frontend pass-through: forwards /bff/api/v1/* to the API, attaching the creator's
 * owner or manage token from their HttpOnly cookie. It contains no business logic. Mutations must
 * originate from our own pages (CSRF protection for the cookie-based credential).
 */
async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path[0] !== 'api' || path[1] !== 'v1' || path.some((p) => p === '..' || p === '.')) {
    return problem(404, 'NOT_FOUND', 'Not found');
  }
  if (MUTATING.has(request.method) && !isSameOrigin(request)) {
    return problem(403, 'CSRF_REJECTED', 'Cross-site request rejected');
  }

  const env = webEnv();
  const target = new URL(
    `/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`,
    env.API_INTERNAL_URL,
  );
  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  for (const [name, value] of Object.entries(creatorHeaders(request.cookies)))
    headers.set(name, value);
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor.split(',')[0]!.trim());

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await request.arrayBuffer(),
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return problem(502, 'UPSTREAM_UNAVAILABLE', 'The service is temporarily unavailable');
  }
  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  if (!responseHeaders.has('cache-control')) responseHeaders.set('cache-control', 'no-store');
  return new NextResponse(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export { forward as GET, forward as POST, forward as PUT, forward as DELETE };
