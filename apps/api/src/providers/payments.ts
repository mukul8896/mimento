import type { PaymentProvider as ProviderName } from '@momentpath/contracts';

/**
 * Payment provider port. Both adapters use the provider's hosted checkout page, so no provider
 * script runs inside our strict CSP and card/UPI details never touch our servers.
 *
 * Adapters only speak to the provider. What a payment unlocks, and whether a result is
 * trusted, is decided in PaymentsService.
 */
export interface PaymentGateway {
  readonly name: ProviderName;
  /**
   * True when the provider reports exactly what we asked it to charge, so a different amount
   * means tampering. False for a merchant of record that adds tax or converts currency.
   */
  readonly exactAmount: boolean;

  createCheckout(input: {
    orderId: string;
    amountMinor: number;
    currency: string;
    /** Dodo sells products defined in its dashboard; Razorpay charges the amount directly. */
    productId: string | null;
    description: string;
    returnUrl: string;
  }): Promise<{ providerOrderId: string; checkoutUrl: string }>;

  /**
   * Asks the provider what happened. `paymentId` comes from the return URL when the provider
   * cannot be queried by our own order reference (Dodo).
   */
  lookup(input: { providerOrderId: string; paymentId: string | null }): Promise<PaymentLookup>;

  /** Verifies a webhook delivery and turns it into a provider-neutral event, or null to ignore. */
  parseWebhook(rawBody: Buffer, headers: WebhookHeaders): WebhookEvent | null;
}

export type WebhookHeaders = Record<string, string | undefined>;

export type PaymentLookup =
  | {
      state: 'PAID';
      paymentId: string;
      /** Our order id as echoed back by the provider, when it echoes one. */
      orderReference: string | null;
      providerOrderId: string | null;
      /** Null when the provider may add tax or convert currency (Dodo), so no exact check. */
      amountMinor: number | null;
      currency: string | null;
    }
  /** Not paid yet. `attemptFailed`: the buyer's last try was declined; the checkout is still open. */
  | { state: 'PENDING'; attemptFailed?: boolean }
  | { state: 'CLOSED' };

export interface WebhookEvent {
  /** Provider's unique delivery id, used to acknowledge retries without reprocessing. */
  eventId: string;
  type: string;
  result: PaymentLookup;
  orderReference: string | null;
  providerOrderId: string | null;
}

export class WebhookSignatureError extends Error {
  constructor() {
    super('Invalid webhook signature');
  }
}

export class ProviderUnavailableError extends Error {}

export const PAYMENT_GATEWAYS = Symbol('PAYMENT_GATEWAYS');
export type PaymentGateways = Partial<Record<ProviderName, PaymentGateway>>;
