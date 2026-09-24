import { z } from 'zod';
import {
  WebhookSignatureError,
  type PaymentGateway,
  type PaymentLookup,
  type WebhookEvent,
  type WebhookHeaders,
} from '../../providers/payments';
import { parseJsonBody, providerJson } from './http';
import { verifyRazorpayWebhook } from './signatures';

/** Razorpay's minimum is 15 minutes; a little longer leaves room to finish a UPI approval. */
const LINK_LIFETIME_SECONDS = 30 * 60;

const LinkSchema = z.object({
  id: z.string().min(1).max(100),
  short_url: z.url(),
});

const LinkStatusSchema = z.object({
  id: z.string(),
  status: z.string(),
  reference_id: z.string().nullish(),
  amount_paid: z.number().int().nullish(),
  currency: z.string().nullish(),
  payments: z.array(z.object({ payment_id: z.string(), status: z.string().nullish() })).nullish(),
});

const WebhookSchema = z.object({
  event: z.string(),
  payload: z
    .object({
      payment_link: z
        .object({
          entity: z.object({
            id: z.string(),
            status: z.string(),
            reference_id: z.string().nullish(),
            amount_paid: z.number().int().nullish(),
            currency: z.string().nullish(),
          }),
        })
        .optional(),
      payment: z.object({ entity: z.object({ id: z.string() }) }).optional(),
    })
    .optional(),
});

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string | undefined;
  apiBase: string;
}

/**
 * Razorpay Payment Links: a hosted page with UPI, cards, net banking and wallets. Test and live
 * mode differ only by key (rzp_test_ / rzp_live_), so going live is a configuration change.
 */
export class RazorpayGateway implements PaymentGateway {
  readonly name = 'RAZORPAY' as const;
  readonly exactAmount = true;

  constructor(private readonly config: RazorpayConfig) {}

  private get auth(): Record<string, string> {
    const basic = Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString('base64');
    return { authorization: `Basic ${basic}` };
  }

  async createCheckout(input: {
    orderId: string;
    amountMinor: number;
    currency: string;
    description: string;
    returnUrl: string;
  }) {
    const link = await providerJson(
      'razorpay',
      `${this.config.apiBase}/v1/payment_links`,
      {
        method: 'POST',
        headers: this.auth,
        body: {
          amount: input.amountMinor,
          currency: input.currency,
          reference_id: input.orderId,
          description: input.description,
          callback_url: input.returnUrl,
          callback_method: 'get',
          expire_by: Math.floor(Date.now() / 1000) + LINK_LIFETIME_SECONDS,
          notes: { order_id: input.orderId },
        },
      },
      LinkSchema,
    );
    return { providerOrderId: link.id, checkoutUrl: link.short_url };
  }

  async lookup(input: { providerOrderId: string }): Promise<PaymentLookup> {
    const link = await providerJson(
      'razorpay',
      `${this.config.apiBase}/v1/payment_links/${encodeURIComponent(input.providerOrderId)}`,
      { method: 'GET', headers: this.auth },
      LinkStatusSchema,
    );
    const attempts = link.payments ?? [];
    const allFailed = attempts.length > 0 && attempts.every((p) => p.status === 'failed');
    return toLookup(link.status, {
      attemptFailed: allFailed,
      providerOrderId: link.id,
      reference: link.reference_id ?? null,
      paymentId:
        link.payments?.find((p) => p.status === 'captured')?.payment_id ??
        link.payments?.[0]?.payment_id ??
        null,
      amountPaid: link.amount_paid ?? null,
      currency: link.currency ?? null,
    });
  }

  parseWebhook(rawBody: Buffer, headers: WebhookHeaders): WebhookEvent | null {
    const signature = headers['x-razorpay-signature'];
    if (
      !this.config.webhookSecret ||
      !signature ||
      !verifyRazorpayWebhook(rawBody, signature, this.config.webhookSecret)
    ) {
      throw new WebhookSignatureError();
    }
    const body = WebhookSchema.safeParse(parseJsonBody(rawBody));
    const link = body.success ? body.data.payload?.payment_link?.entity : undefined;
    if (!body.success || !link || !body.data.event.startsWith('payment_link.')) return null;

    const eventId = headers['x-razorpay-event-id'];
    if (!eventId) return null;
    return {
      eventId,
      type: body.data.event,
      orderReference: link.reference_id ?? null,
      providerOrderId: link.id,
      result: toLookup(link.status, {
        attemptFailed: false,
        providerOrderId: link.id,
        reference: link.reference_id ?? null,
        paymentId: body.data.payload?.payment?.entity.id ?? null,
        amountPaid: link.amount_paid ?? null,
        currency: link.currency ?? null,
      }),
    };
  }
}

function toLookup(
  status: string,
  link: {
    attemptFailed: boolean;
    providerOrderId: string;
    reference: string | null;
    paymentId: string | null;
    amountPaid: number | null;
    currency: string | null;
  },
): PaymentLookup {
  if (status === 'paid' && link.paymentId) {
    return {
      state: 'PAID',
      paymentId: link.paymentId,
      orderReference: link.reference,
      providerOrderId: link.providerOrderId,
      amountMinor: link.amountPaid,
      currency: link.currency,
    };
  }
  if (status === 'expired' || status === 'cancelled') return { state: 'CLOSED' };
  return { state: 'PENDING', attemptFailed: link.attemptFailed };
}
