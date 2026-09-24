import { tierAtLeast, type CheckoutOffer, type Tier } from '@momentpath/contracts';
import type { AppEnv } from '../../config/env';

type PaidTier = Exclude<Tier, 'FREE'>;

export interface PriceBook {
  inr: Record<PaidTier, number>;
  usd: Record<PaidTier, number>;
  dodoProducts: { PLUS?: string; PRO?: string; PLUS_TO_PRO?: string };
}

export function priceBook(env: AppEnv): PriceBook {
  return {
    inr: { PLUS: env.PRICE_INR_PLUS, PRO: env.PRICE_INR_PRO },
    usd: { PLUS: env.PRICE_USD_PLUS, PRO: env.PRICE_USD_PRO },
    dodoProducts: {
      PLUS: env.DODO_PRODUCT_PLUS,
      PRO: env.DODO_PRODUCT_PRO,
      PLUS_TO_PRO: env.DODO_PRODUCT_PLUS_TO_PRO,
    },
  };
}

function price(table: Record<PaidTier, number>, tier: Tier): number {
  return tier === 'FREE' ? 0 : table[tier];
}

export interface PricedOffer extends CheckoutOffer {
  /** Dodo product to sell; null for Razorpay, which charges the amount directly. */
  productId: string | null;
}

/**
 * What the creator can buy to publish this draft: the tier it requires, once per provider that
 * is configured. An experience that already holds a lower paid tier pays only the difference.
 * Nothing is offered when the requirement is already met.
 */
export function offersFor(
  state: { required: Tier; held: Tier },
  book: PriceBook,
  configured: { razorpay: boolean; dodo: boolean },
): PricedOffer[] {
  const { required, held } = state;
  if (required === 'FREE' || tierAtLeast(held, required)) return [];
  const offers: PricedOffer[] = [];

  if (configured.razorpay) {
    offers.push({
      provider: 'RAZORPAY',
      tier: required,
      amountMinor: price(book.inr, required) - price(book.inr, held),
      currency: 'INR',
      productId: null,
    });
  }

  if (configured.dodo) {
    // Dodo charges the price of a dashboard product, so an upgrade needs its own product.
    const productId =
      held === 'FREE'
        ? book.dodoProducts[required]
        : held === 'PLUS' && required === 'PRO'
          ? book.dodoProducts.PLUS_TO_PRO
          : undefined;
    if (productId) {
      offers.push({
        provider: 'DODO',
        tier: required,
        amountMinor: price(book.usd, required) - price(book.usd, held),
        currency: 'USD',
        productId,
      });
    }
  }
  return offers;
}
