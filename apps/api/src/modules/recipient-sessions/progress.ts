import type { DraftStep, SessionProgress } from '@momentpath/contracts';

/** Linear progress: the next step is the first one this session has not completed. */
export function computeProgress(
  steps: DraftStep[],
  completed: ReadonlySet<string>,
): SessionProgress {
  const next = steps.find((s) => !completed.has(s.key)) ?? null;
  const gift = steps.find((s) => s.type === 'GIFT_REVEAL');
  return {
    completedStepKeys: steps.filter((s) => completed.has(s.key)).map((s) => s.key),
    nextStepKey: next?.key ?? null,
    completed: next === null && steps.length > 0,
    giftRevealed: gift ? completed.has(gift.key) : false,
  };
}

/** Removes data the recipient's browser must not receive before answering (quiz answers). */
export function publicStep(step: DraftStep): DraftStep {
  if (step.type === 'MULTIPLE_CHOICE') {
    return { ...step, config: { ...step.config, correctOptionId: null } };
  }
  return step;
}
