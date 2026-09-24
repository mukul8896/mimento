import {
  flowSteps,
  walkPath,
  type Answer,
  type DraftStep,
  type SessionProgress,
} from '@momentpath/contracts';

/**
 * Where a recipient is, from their answers. The path is walked through the step routing (see
 * contracts/flow.ts), so steps on branches they did not take are neither "next" nor required.
 */
export function computeProgress(
  steps: DraftStep[],
  answers: ReadonlyMap<string, Answer>,
  now: Date = new Date(),
): SessionProgress {
  const walk = walkPath(flowSteps(steps), answers, now);
  const gift = steps.find((s) => s.type === 'GIFT_REVEAL');
  return {
    completedStepKeys: walk.path.filter((key) => answers.has(key)),
    nextStepKey: walk.nextStepKey,
    completed: walk.finished && steps.length > 0,
    giftRevealed: gift ? answers.has(gift.key) : false,
  };
}

/**
 * Removes data the recipient's browser must not receive before answering: quiz and puzzle
 * answers, and
 * routing, which could give away which answer leads to the surprise.
 */
export function publicStep(step: DraftStep): DraftStep {
  const { next: _routing, ...rest } = step;
  if (rest.type === 'MULTIPLE_CHOICE') {
    return { ...rest, config: { ...rest.config, correctOptionId: null } };
  }
  if (rest.type === 'PUZZLE') return { ...rest, config: { ...rest.config, answer: '' } };
  return rest as DraftStep;
}
