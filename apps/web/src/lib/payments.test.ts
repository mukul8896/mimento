import { describe, expect, it } from 'vitest';
import { formatPrice, looksIndian, suggestedProvider } from './payments';

describe('looksIndian', () => {
  it('recognises Indian time zones and en-IN / hi-IN languages', () => {
    expect(looksIndian({ timeZone: 'Asia/Kolkata' })).toBe(true);
    expect(looksIndian({ timeZone: 'Europe/London', languages: ['hi-IN', 'en'] })).toBe(true);
    expect(looksIndian({ timeZone: 'America/New_York', languages: ['en-US'] })).toBe(false);
    expect(looksIndian({})).toBe(false);
  });
});

describe('suggestedProvider', () => {
  const both = [{ provider: 'RAZORPAY' as const }, { provider: 'DODO' as const }];
  it('prefers Razorpay in India and Dodo elsewhere', () => {
    expect(suggestedProvider(both, true)).toBe('RAZORPAY');
    expect(suggestedProvider(both, false)).toBe('DODO');
  });
  it('falls back to whatever is offered', () => {
    expect(suggestedProvider([{ provider: 'RAZORPAY' as const }], false)).toBe('RAZORPAY');
    expect(suggestedProvider([], true)).toBeNull();
  });
});

describe('formatPrice', () => {
  it('formats minor units without needless decimals', () => {
    expect(formatPrice(9900, 'INR')).toBe('₹99');
    expect(formatPrice(299, 'USD')).toBe('$2.99');
    expect(formatPrice(500, 'USD')).toBe('$5');
  });
});
