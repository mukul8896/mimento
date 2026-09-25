export type Provider = 'RAZORPAY' | 'DODO';

const INDIAN_TIME_ZONES = new Set(['Asia/Kolkata', 'Asia/Calcutta']);

/**
 * Best guess at whether the buyer pays from India, from what the browser already says about
 * itself. It only picks the default: the buyer can always switch, and the server prices each
 * provider itself, so a wrong guess costs one tap, never money.
 */
export function looksIndian(signals: {
  timeZone?: string;
  languages?: readonly string[];
}): boolean {
  if (signals.timeZone && INDIAN_TIME_ZONES.has(signals.timeZone)) return true;
  return (signals.languages ?? []).some((l) => /-IN$/i.test(l));
}

export function browserSignals(): { timeZone?: string; languages?: readonly string[] } {
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    languages: navigator.languages,
  };
}

/** The offer to show first: Razorpay for India when offered, otherwise Dodo, otherwise any. */
export function suggestedProvider<T extends { provider: Provider }>(
  offers: readonly T[],
  indian: boolean,
): Provider | null {
  const preferred: Provider = indian ? 'RAZORPAY' : 'DODO';
  return (offers.find((o) => o.provider === preferred) ?? offers[0])?.provider ?? null;
}

export function formatPrice(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}

export const TIER_NAME = { FREE: 'Free', PLUS: 'PLUS', PRO: 'PRO' } as const;

/** One line on what each paid tier buys, used wherever a price is shown. */
export const TIER_PITCH = {
  FREE: 'Free to share',
  PLUS: 'Your personalised template, shared on its own private link',
  PRO: 'Your own custom experience, built step by step',
} as const;

export const PAYMENT_METHODS: Record<Provider, string> = {
  RAZORPAY: 'UPI, cards, net banking or wallets',
  DODO: 'Card, Apple Pay or Google Pay — local tax may be added',
};
