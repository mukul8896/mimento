/**
 * Payment provider port — Phase 2 (Razorpay first). Declared now so that module boundaries
 * are fixed; there is intentionally no implementation in Phase 1.
 */
export interface PaymentProvider {
  createOrder(input: {
    amountMinor: number;
    currency: string;
    reference: string;
  }): Promise<{ providerOrderId: string }>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}
