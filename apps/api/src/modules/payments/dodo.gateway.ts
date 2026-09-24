import { z } from 'zod';
import {
  WebhookSignatureError,
  type PaymentGateway,
  type PaymentLookup,
  type WebhookEvent,
  type WebhookHeaders,
} from '../../providers/payments';
import { parseJsonBody, providerJson } from './http';
import { verifyStandardWebhook } from './signatures';

export const DODO_BASE_URLS = {
  test: 'https://test.dodopayments.com',
  live: 'https://live.dodopayments.com',
} as const;

const SessionSchema = z.object({
  session_id: z.string().min(1).max(200),
  checkout_url: z.url(),
});

const PaymentSchema = z.object({
  payment_id: z.string(),
  status: z.string().nullish(),
  checkout_session_id: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  total_amount: z.number().int().nullish(),
  currency: z.string().nullish(),
});

const WebhookSchema = z.object({ type: z.string(), data: PaymentSchema.partial() });

export interface DodoConfig {
  apiKey: string;
  webhookSecret: string | undefined;
  apiBase: string;
}

/**
 * Dodo Payments checkout sessions. Dodo is the merchant of record: its hosted page collects the
 * customer's details and adds local sales tax, so the charged amount can differ from our list
 * price and is not compared exactly. Test and live mode differ by API key and base URL.
 */
export class DodoGateway implements PaymentGateway {
  readonly name = 'DODO' as const;
  readonly exactAmount = false;

  constructor(private readonly config: DodoConfig) {}

  private get auth(): Record<string, string> {
    return { authorization: `Bearer ${this.config.apiKey}` };
  }

  async createCheckout(input: { orderId: string; productId: string | null; returnUrl: string }) {
    if (!input.productId) throw new Error('Dodo checkout needs a product id');
    const session = await providerJson(
      'dodo',
      `${this.config.apiBase}/checkouts`,
      {
        method: 'POST',
        headers: this.auth,
        body: {
          product_cart: [{ product_id: input.productId, quantity: 1 }],
          return_url: input.returnUrl,
          metadata: { order_id: input.orderId },
        },
      },
      SessionSchema,
    );
    return { providerOrderId: session.session_id, checkoutUrl: session.checkout_url };
  }

  /** Dodo is queried by payment id, which only the return URL or a webhook tells us. */
  async lookup(input: { paymentId: string | null }): Promise<PaymentLookup> {
    if (!input.paymentId) return { state: 'PENDING' };
    const payment = await providerJson(
      'dodo',
      `${this.config.apiBase}/payments/${encodeURIComponent(input.paymentId)}`,
      { method: 'GET', headers: this.auth },
      PaymentSchema,
    );
    return toLookup(payment);
  }

  parseWebhook(rawBody: Buffer, headers: WebhookHeaders): WebhookEvent | null {
    const eventId = headers['webhook-id'];
    if (
      !this.config.webhookSecret ||
      !verifyStandardWebhook(
        rawBody,
        {
          id: eventId,
          timestamp: headers['webhook-timestamp'],
          signature: headers['webhook-signature'],
        },
        this.config.webhookSecret,
      )
    ) {
      throw new WebhookSignatureError();
    }
    const body = WebhookSchema.safeParse(parseJsonBody(rawBody));
    if (!body.success || !eventId || !body.data.type.startsWith('payment.')) return null;
    const data = body.data.data;
    if (!data.payment_id) return null;
    const result =
      body.data.type === 'payment.succeeded'
        ? toLookup({ ...data, payment_id: data.payment_id, status: 'succeeded' })
        : ({ state: 'PENDING' } as const);
    return {
      eventId,
      type: body.data.type,
      result,
      orderReference: orderReferenceOf(data.metadata),
      providerOrderId: data.checkout_session_id ?? null,
    };
  }
}

function orderReferenceOf(metadata: Record<string, unknown> | null | undefined): string | null {
  const ref = metadata?.order_id;
  return typeof ref === 'string' ? ref : null;
}

function toLookup(payment: z.infer<typeof PaymentSchema>): PaymentLookup {
  // A failed attempt leaves the session open for another try, so it is not a closed order.
  if (payment.status !== 'succeeded') return { state: 'PENDING' };
  return {
    state: 'PAID',
    paymentId: payment.payment_id,
    orderReference: orderReferenceOf(payment.metadata),
    providerOrderId: payment.checkout_session_id ?? null,
    amountMinor: payment.total_amount ?? null,
    currency: payment.currency ?? null,
  };
}
