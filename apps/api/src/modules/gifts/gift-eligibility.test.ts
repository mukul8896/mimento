import { describe, expect, it } from 'vitest';
import { giftEligibility, type EligibilityInput } from './gift-eligibility';

const base = (over: Partial<EligibilityInput> = {}): EligibilityInput => ({
  giftStepKey: 'gift',
  path: ['a', 'b', 'gift'],
  isGiftStep: true,
  gift: { oneTimeReveal: false, revealedAt: null, revealedBySessionId: null },
  sessionId: 's1',
  ...over,
});

describe('giftEligibility', () => {
  it('allows the reveal once the gift is on the path (every earlier step answered)', () => {
    expect(giftEligibility(base())).toEqual({ ok: true });
  });
  it('denies while an earlier step on the path is unanswered, or on a branch without the gift', () => {
    expect(giftEligibility(base({ path: ['a', 'b'] }))).toEqual({
      ok: false,
      reason: 'STEPS_INCOMPLETE',
    });
    expect(giftEligibility(base({ path: ['a'] }))).toEqual({
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
  it('keeps a scheduled gift locked until its time, then allows it', () => {
    const revealAt = new Date('2026-12-25T00:00:00Z');
    expect(giftEligibility(base({ revealAt, now: new Date('2026-12-24T23:59:00Z') }))).toEqual({
      ok: false,
      reason: 'NOT_YET',
    });
    expect(giftEligibility(base({ revealAt, now: revealAt }))).toEqual({ ok: true });
  });
});
