import type { AppEnv } from '../../config/env';
import type { PaymentGateways } from '../../providers/payments';
import { DODO_BASE_URLS, DodoGateway } from './dodo.gateway';
import { RazorpayGateway } from './razorpay.gateway';

/** A provider exists only when its credentials are configured. */
export function createGateways(env: AppEnv): PaymentGateways {
  const gateways: PaymentGateways = {};
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    gateways.RAZORPAY = new RazorpayGateway({
      keyId: env.RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
      apiBase: env.RAZORPAY_API_BASE.replace(/\/$/, ''),
    });
  }
  if (env.DODO_API_KEY) {
    gateways.DODO = new DodoGateway({
      apiKey: env.DODO_API_KEY,
      webhookSecret: env.DODO_WEBHOOK_SECRET,
      apiBase: (env.DODO_API_BASE ?? DODO_BASE_URLS[env.DODO_ENVIRONMENT]).replace(/\/$/, ''),
    });
  }
  return gateways;
}
