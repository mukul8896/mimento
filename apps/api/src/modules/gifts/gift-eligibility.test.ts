import { describe, expect, it } from 'vitest';
import { giftEligibility, type EligibilityInput } from './gift-eligibility';

const base = (over: Partial<EligibilityInput> = {}): EligibilityInput => ({
  orderedStepKeys: ['a', 'b', 'gift'],
  giftStepKey: 'gift',
  completedStepKeys: new Set(['a', 'b']),
  isGiftStep: true,
  gift: { oneTimeReveal: false, revealedAt: null, revealedBySessionId: null },
  sessionId: 's1',
  ...over,
});

describe('giftEligibility', () => {
  it('allows the reveal once every earlier step is complete', () => {
    expect(giftEligibility(base())).toEqual({ ok: true });
  });
  it('denies when any earlier step is incomplete', () => {
    expect(giftEligibility(base({ completedStepKeys: new Set(['a']) }))).toEqual({
      ok: false,
      reason: 'STEPS_INCOMPLETE',
    });
    expect(giftEligibility(base({ completedStepKeys: new Set() }))).toEqual({
      ok: false,
      reason: 'STEPS_INCOMPLETE',
    });
  });
  it('denies non-gift steps and missing gifts', () => {
    expect(giftEligibility(base({ isGiftStep: false })).ok).toBe(false);
    expect(giftEligibility(base({ gift: null }))).toEqual({ ok: false, reason: 'NO_GIFT' });
    expect(giftEligibility(base({ giftStepKey: 'zzz' })).ok).toBe(false);
  });
  it('one-time gifts: first session may re-view, others are refused', () => {
    const gift = { oneTimeReveal: true, revealedAt: new Date(), revealedBySessionId: 's1' };
    expect(giftEligibility(base({ gift }))).toEqual({ ok: true });
    expect(giftEligibility(base({ gift, sessionId: 's2' }))).toEqual({
      ok: false,
      reason: 'ALREADY_REVEALED',
    });
    expect(
      giftEligibility(base({ gift: { ...gift, oneTimeReveal: false }, sessionId: 's2' })),
    ).toEqual({ ok: true });
  });
});
