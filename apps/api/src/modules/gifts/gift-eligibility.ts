export interface EligibilityInput {
  /** Published step keys in order. */
  orderedStepKeys: string[];
  giftStepKey: string;
  completedStepKeys: ReadonlySet<string>;
  isGiftStep: boolean;
  gift: {
    oneTimeReveal: boolean;
    revealedAt: Date | null;
    revealedBySessionId: string | null;
  } | null;
  sessionId: string;
}

export type Eligibility =
  | { ok: true }
  | { ok: false; reason: 'NOT_A_GIFT_STEP' | 'NO_GIFT' | 'STEPS_INCOMPLETE' | 'ALREADY_REVEALED' };

/**
 * The single rule deciding whether a recipient session may receive the gift secret:
 * every step before the gift step must be completed by this session, and a one-time gift
 * may only be revealed to the session that revealed it first (so a refresh still works).
 */
export function giftEligibility(input: EligibilityInput): Eligibility {
  if (!input.isGiftStep) return { ok: false, reason: 'NOT_A_GIFT_STEP' };
  if (!input.gift) return { ok: false, reason: 'NO_GIFT' };
  const index = input.orderedStepKeys.indexOf(input.giftStepKey);
  if (index < 0) return { ok: false, reason: 'NOT_A_GIFT_STEP' };
  const required = input.orderedStepKeys.slice(0, index);
  if (!required.every((key) => input.completedStepKeys.has(key))) {
    return { ok: false, reason: 'STEPS_INCOMPLETE' };
  }
  if (
    input.gift.oneTimeReveal &&
    input.gift.revealedAt !== null &&
    input.gift.revealedBySessionId !== input.sessionId
  ) {
    return { ok: false, reason: 'ALREADY_REVEALED' };
  }
  return { ok: true };
}
