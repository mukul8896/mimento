import {
  checkAnswer,
  flowSteps,
  walkPath,
  type Answer,
  type DraftStep,
  type PublicExperience,
  type SessionProgress,
} from '@momentpath/contracts';
import { PlayerError, type PlayerBackend, type PlayerState } from './backend';

/**
 * Same path walk as the API (contracts/flow.ts), so the preview follows branches faithfully.
 * `from` starts the walk at a later step (the one being edited); the steps before it count as
 * done so the progress bar reads right.
 */
export function progressOf(
  steps: DraftStep[],
  answers: ReadonlyMap<string, Answer>,
  from = 0,
): SessionProgress {
  const walk = walkPath(flowSteps(steps.slice(from)), answers);
  const gift = steps.find((s) => s.type === 'GIFT_REVEAL');
  return {
    completedStepKeys: [
      ...steps.slice(0, from).map((s) => s.key),
      ...walk.path.filter((key) => answers.has(key)),
    ],
    nextStepKey: walk.nextStepKey,
    completed: walk.finished && steps.length > 0,
    giftRevealed: gift ? answers.has(gift.key) : false,
  };
}

/** Local, in-memory backend for the editor preview. Nothing is sent or recorded. */
export class PreviewBackend implements PlayerBackend {
  readonly mode = 'preview' as const;
  private answers = new Map<string, Answer>();

  constructor(
    private readonly experience: PublicExperience,
    /** Demos (landing page, template gallery) can show a real-looking gift message. */
    private readonly giftMessage = 'Preview: your surprise details will appear here for the recipient.',
    /** Start at this step instead of the first (the editor previews the step being edited). */
    startAt: string | null = null,
  ) {
    this.from = Math.max(
      0,
      experience.steps.findIndex((s) => s.key === startAt),
    );
  }

  private readonly from: number;

  async load(): Promise<PlayerState> {
    this.answers = new Map();
    return {
      experience: this.experience,
      progress: progressOf(this.experience.steps, this.answers, this.from),
    };
  }

  async answer(stepKey: string, answer: Answer) {
    const step = this.experience.steps.find((s) => s.key === stepKey);
    if (!step) throw new PlayerError('UNKNOWN_STEP', 'Unknown step');
    const check = checkAnswer(step, answer);
    if (!check.ok) {
      if (check.reason === 'INCORRECT')
        return {
          progress: progressOf(this.experience.steps, this.answers, this.from),
          correct: false,
        };
      throw new PlayerError('INVALID_ANSWER', 'That answer is not allowed here');
    }
    this.answers.set(stepKey, answer);
    return {
      progress: progressOf(this.experience.steps, this.answers, this.from),
      correct: check.correct,
    };
  }

  async reveal(stepKey: string) {
    this.answers.set(stepKey, { kind: 'ACK' });
    return {
      gift: {
        kind: 'PHYSICAL_MESSAGE' as const,
        message: this.giftMessage,
      },
      progress: progressOf(this.experience.steps, this.answers, this.from),
    };
  }

  async close() {}

  async report() {}
}
