import { describe, expect, it } from 'vitest';
import { offersFor, type PriceBook } from './pricing';

const book: PriceBook = {
  inr: { PLUS: 9900, PRO: 19900 },
  usd: { PLUS: 299, PRO: 499 },
  dodoProducts: { PLUS: 'pdt_plus', PRO: 'pdt_pro' },
};
const both = { razorpay: true, dodo: true };

describe('offersFor', () => {
  it('offers nothing when the draft is free or already unlocked', () => {
    expect(offersFor({ required: 'FREE', held: 'FREE' }, book, both)).toEqual([]);
    expect(offersFor({ required: 'PLUS', held: 'PRO' }, book, both)).toEqual([]);
    expect(offersFor({ required: 'PRO', held: 'PRO' }, book, both)).toEqual([]);
  });

  it('prices the required tier in INR for Razorpay and USD for Dodo', () => {
    expect(offersFor({ required: 'PLUS', held: 'FREE' }, book, both)).toEqual([
      { provider: 'RAZORPAY', tier: 'PLUS', amountMinor: 9900, currency: 'INR', productId: null },
      { provider: 'DODO', tier: 'PLUS', amountMinor: 299, currency: 'USD', productId: 'pdt_plus' },
    ]);
  });

  it('charges only the difference for an upgrade', () => {
    const [razorpay] = offersFor({ required: 'PRO', held: 'PLUS' }, book, both);
    expect(razorpay).toMatchObject({ provider: 'RAZORPAY', amountMinor: 10000 });
  });

  it('offers Dodo for an upgrade only when an upgrade product exists', () => {
    expect(offersFor({ required: 'PRO', held: 'PLUS' }, book, both).map((o) => o.provider)).toEqual(
      ['RAZORPAY'],
    );
    const withUpgrade = { ...book, dodoProducts: { ...book.dodoProducts, PLUS_TO_PRO: 'pdt_up' } };
    expect(offersFor({ required: 'PRO', held: 'PLUS' }, withUpgrade, both)[1]).toMatchObject({
      provider: 'DODO',
      amountMinor: 200,
      productId: 'pdt_up',
    });
  });

  it('skips providers that are not configured or lack a product', () => {
    expect(
      offersFor({ required: 'PLUS', held: 'FREE' }, book, { razorpay: false, dodo: true }),
    ).toHaveLength(1);
    const noPlus = { ...book, dodoProducts: { PRO: 'pdt_pro' } };
    expect(
      offersFor({ required: 'PLUS', held: 'FREE' }, noPlus, { razorpay: false, dodo: true }),
    ).toEqual([]);
  });
});
