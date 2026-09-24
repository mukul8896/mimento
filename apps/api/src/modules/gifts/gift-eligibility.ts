export interface EligibilityInput {
  giftStepKey: string;
  /** The recipient's path so far (contracts walkPath): every key before the last is answered. */
  path: readonly string[];
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
 * The single rule deciding whether a recipient session may receive the gift secret: the gift
 * step must be on this session's own path, which means every step before it on that path is
 * answered (branches not taken are not required). A one-time gift may only be revealed to the
 * session that revealed it first, so a refresh still works.
 */
export function giftEligibility(input: EligibilityInput): Eligibility {
  if (!input.isGiftStep) return { ok: false, reason: 'NOT_A_GIFT_STEP' };
  if (!input.gift) return { ok: false, reason: 'NO_GIFT' };
  if (!input.path.includes(input.giftStepKey)) return { ok: false, reason: 'STEPS_INCOMPLETE' };
  if (
    input.gift.oneTimeReveal &&
    input.gift.revealedAt !== null &&
    input.gift.revealedBySessionId !== input.sessionId
  ) {
    return { ok: false, reason: 'ALREADY_REVEALED' };
  }
  return { ok: true };
}
