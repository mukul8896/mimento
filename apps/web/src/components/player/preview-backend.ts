import {
  checkAnswer,
  type Answer,
  type DraftStep,
  type PublicExperience,
  type SessionProgress,
} from '@momentpath/contracts';
import { PlayerError, type PlayerBackend, type PlayerState } from './backend';

function progressOf(steps: DraftStep[], completed: Set<string>): SessionProgress {
  const next = steps.find((s) => !completed.has(s.key)) ?? null;
  const gift = steps.find((s) => s.type === 'GIFT_REVEAL');
  return {
    completedStepKeys: steps.filter((s) => completed.has(s.key)).map((s) => s.key),
    nextStepKey: next?.key ?? null,
    completed: next === null && steps.length > 0,
    giftRevealed: gift ? completed.has(gift.key) : false,
  };
}

/** Local, in-memory backend for the editor preview. Nothing is sent or recorded. */
export class PreviewBackend implements PlayerBackend {
  readonly mode = 'preview' as const;
  private completed = new Set<string>();

  constructor(private readonly experience: PublicExperience) {}

  async load(): Promise<PlayerState> {
    this.completed = new Set();
    return {
      experience: this.experience,
      progress: progressOf(this.experience.steps, this.completed),
    };
  }

  async answer(stepKey: string, answer: Answer) {
    const step = this.experience.steps.find((s) => s.key === stepKey);
    if (!step) throw new PlayerError('UNKNOWN_STEP', 'Unknown step');
    const check = checkAnswer(step, answer);
    if (!check.ok) {
      if (check.reason === 'INCORRECT')
        return { progress: progressOf(this.experience.steps, this.completed), correct: false };
      throw new PlayerError('INVALID_ANSWER', 'That answer is not allowed here');
    }
    this.completed.add(stepKey);
    return { progress: progressOf(this.experience.steps, this.completed), correct: check.correct };
  }

  async reveal(stepKey: string) {
    this.completed.add(stepKey);
    return {
      gift: {
        kind: 'PHYSICAL_MESSAGE' as const,
        message: 'Preview: your surprise details will appear here for the recipient.',
      },
      progress: progressOf(this.experience.steps, this.completed),
    };
  }

  async close() {}

  async report() {}
}
