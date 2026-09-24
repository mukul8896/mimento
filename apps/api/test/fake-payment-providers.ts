import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

interface Link {
  id: string;
  status: string;
  amount: number;
  amount_paid: number;
  currency: string;
  reference_id: string;
  payments: { payment_id: string; status: string }[] | null;
}

interface DodoPayment {
  payment_id: string;
  status: string;
  checkout_session_id: string;
  metadata: Record<string, string>;
  total_amount: number;
  currency: string;
}

export const RAZORPAY_KEY_ID = 'rzp_test_fakekey';
export const RAZORPAY_KEY_SECRET = 'fake-key-secret';
export const RAZORPAY_WEBHOOK_SECRET = 'fake-rzp-webhook-secret';
export const DODO_API_KEY = 'fake-dodo-key';
const DODO_KEY = Buffer.alloc(32, 9);
export const DODO_WEBHOOK_SECRET = `whsec_${DODO_KEY.toString('base64')}`;

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

/**
 * In-process stand-in for the Razorpay and Dodo APIs, so the real adapters (HTTP, auth headers,
 * response parsing) run in integration tests. Only the endpoints the adapters call exist.
 */
export async function startFakeProviders() {
  const links = new Map<string, Link>();
  const sessions = new Map<string, { productId: string; metadata: Record<string, string> }>();
  const payments = new Map<string, DodoPayment>();
  let seq = 0;
  let down = false;
  const calls: string[] = [];

  const server: Server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://fake');
      calls.push(`${req.method} ${url.pathname}`);
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (down) return send(503, { error: 'unavailable' });

      if (url.pathname.startsWith('/v1/payment_links')) {
        const expected = `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`;
        if (req.headers.authorization !== expected) return send(401, { error: 'auth' });
        if (req.method === 'POST') {
          const body = await readJson(req);
          const link: Link = {
            id: `plink_${++seq}`,
            status: 'created',
            amount: body.amount as number,
            amount_paid: 0,
            currency: body.currency as string,
            reference_id: body.reference_id as string,
            payments: null,
          };
          links.set(link.id, link);
          return send(200, { ...link, short_url: `https://rzp.example/i/${link.id}` });
        }
        const link = links.get(url.pathname.split('/').pop() ?? '');
        return link ? send(200, link) : send(404, { error: 'not found' });
      }

      if (req.headers.authorization !== `Bearer ${DODO_API_KEY}`) return send(401, {});
      if (url.pathname === '/checkouts' && req.method === 'POST') {
        const body = await readJson(req);
        const cart = body.product_cart as { product_id: string }[];
        const id = `cks_${++seq}`;
        sessions.set(id, {
          productId: cart[0]!.product_id,
          metadata: body.metadata as Record<string, string>,
        });
        return send(200, { session_id: id, checkout_url: `https://dodo.example/session/${id}` });
      }
      if (url.pathname.startsWith('/payments/')) {
        const payment = payments.get(url.pathname.split('/').pop() ?? '');
        return payment ? send(200, payment) : send(404, {});
      }
      send(404, {});
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    base,
    calls,
    setDown: (value: boolean) => (down = value),
    links,
    /** Marks a Razorpay link paid, optionally reporting a different amount (tampering). */
    payLink(id: string, amountPaid?: number) {
      const link = links.get(id)!;
      link.status = 'paid';
      link.amount_paid = amountPaid ?? link.amount;
      link.payments = [{ payment_id: `pay_${id}`, status: 'captured' }];
      return link;
    },
    /** Completes a Dodo checkout session and returns the payment id Dodo would append. */
    payDodo(sessionId: string) {
      const session = sessions.get(sessionId)!;
      const payment: DodoPayment = {
        payment_id: `pay_dodo_${++seq}`,
        status: 'succeeded',
        checkout_session_id: sessionId,
        metadata: session.metadata,
        total_amount: 329, // includes tax the merchant of record added
        currency: 'USD',
      };
      payments.set(payment.payment_id, payment);
      return payment;
    },
    razorpayWebhook(event: string, link: Link, eventId: string) {
      const body = Buffer.from(
        JSON.stringify({
          entity: 'event',
          event,
          payload: {
            payment_link: { entity: link },
            ...(link.payments ? { payment: { entity: { id: link.payments[0]!.payment_id } } } : {}),
          },
        }),
      );
      const signature = createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
      return {
        body,
        headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId },
      };
    },
    dodoWebhook(
      type: string,
      payment: DodoPayment,
      eventId: string,
      timestamp = Math.floor(Date.now() / 1000),
    ) {
      const body = Buffer.from(JSON.stringify({ business_id: 'bus_1', type, data: payment }));
      const signature = createHmac('sha256', DODO_KEY)
        .update(`${eventId}.${timestamp}.`)
        .update(body)
        .digest('base64');
      return {
        body,
        headers: {
          'webhook-id': eventId,
          'webhook-timestamp': String(timestamp),
          'webhook-signature': `v1,${signature}`,
        },
      };
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export type FakeProviders = Awaited<ReturnType<typeof startFakeProviders>>;
