import { NextResponse, type NextRequest } from 'next/server';
import { webEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Signature headers each provider sends; nothing else is forwarded. */
const SIGNATURE_HEADERS: Record<string, string[]> = {
  razorpay: ['x-razorpay-signature', 'x-razorpay-event-id'],
  dodo: ['webhook-id', 'webhook-timestamp', 'webhook-signature'],
};

/**
 * Payment webhook pass-through: Razorpay and Dodo post here (the public origin), and the exact
 * bytes go to the API, which verifies the signature. Unlike /bff there is no same-origin check —
 * these requests are cross-site by nature and the signature is their only credential.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const names = SIGNATURE_HEADERS[provider];
  if (!names) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const headers = new Headers({ 'content-type': 'application/json' });
  for (const name of names) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  let upstream: Response;
  try {
    upstream = await fetch(
      new URL(`/api/v1/payments/webhooks/${provider}`, webEnv().API_INTERNAL_URL),
      {
        method: 'POST',
        headers,
        body: await request.arrayBuffer(),
        cache: 'no-store',
      },
    );
  } catch {
    // A non-2xx makes the provider retry later, which is what we want while the API is down.
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
