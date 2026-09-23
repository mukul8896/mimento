import { describe, expect, it } from 'vitest';
import { DraftStepSchema, type DraftStep } from '@momentpath/contracts';
import { computeProgress, publicStep } from './progress';

const k = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const steps: DraftStep[] = [
  DraftStepSchema.parse({ key: k(1), type: 'MESSAGE', config: { heading: 'hi' } }),
  DraftStepSchema.parse({
    key: k(2),
    type: 'MULTIPLE_CHOICE',
    config: {
      question: 'q',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      correctOptionId: 'b',
      requireCorrect: true,
    },
  }),
  DraftStepSchema.parse({ key: k(3), type: 'GIFT_REVEAL', config: {} }),
];

describe('computeProgress', () => {
  it('points at the first incomplete step', () => {
    expect(computeProgress(steps, new Set())).toMatchObject({
      nextStepKey: k(1),
      completed: false,
      giftRevealed: false,
    });
    expect(computeProgress(steps, new Set([k(1)])).nextStepKey).toBe(k(2));
  });
  it('is complete only when the gift has been revealed', () => {
    expect(computeProgress(steps, new Set([k(1), k(2)]))).toMatchObject({
      nextStepKey: k(3),
      completed: false,
    });
    expect(computeProgress(steps, new Set([k(1), k(2), k(3)]))).toMatchObject({
      nextStepKey: null,
      completed: true,
      giftRevealed: true,
    });
  });
  it('ignores unknown completed keys', () => {
    expect(computeProgress(steps, new Set(['bogus'])).completedStepKeys).toEqual([]);
  });
});

describe('publicStep', () => {
  it('never sends the correct quiz answer to the browser', () => {
    const pub = publicStep(steps[1]!);
    expect(pub.type === 'MULTIPLE_CHOICE' && pub.config.correctOptionId).toBeNull();
    expect(pub.type === 'MULTIPLE_CHOICE' && pub.config.requireCorrect).toBe(true);
  });
});
