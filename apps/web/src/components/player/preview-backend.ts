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

/** Same path walk as the API (contracts/flow.ts), so the preview follows branches faithfully. */
function progressOf(steps: DraftStep[], answers: ReadonlyMap<string, Answer>): SessionProgress {
  const walk = walkPath(flowSteps(steps), answers);
  const gift = steps.find((s) => s.type === 'GIFT_REVEAL');
  return {
    completedStepKeys: walk.path.filter((key) => answers.has(key)),
    nextStepKey: walk.nextStepKey,
    completed: walk.finished && steps.length > 0,
    giftRevealed: gift ? answers.has(gift.key) : false,
  };
}

/** Local, in-memory backend for the editor preview. Nothing is sent or recorded. */
export class PreviewBackend implements PlayerBackend {
  readonly mode = 'preview' as const;
  private answers = new Map<string, Answer>();

  constructor(private readonly experience: PublicExperience) {}

  async load(): Promise<PlayerState> {
    this.answers = new Map();
    return {
      experience: this.experience,
      progress: progressOf(this.experience.steps, this.answers),
    };
  }

  async answer(stepKey: string, answer: Answer) {
    const step = this.experience.steps.find((s) => s.key === stepKey);
    if (!step) throw new PlayerError('UNKNOWN_STEP', 'Unknown step');
    const check = checkAnswer(step, answer);
    if (!check.ok) {
      if (check.reason === 'INCORRECT')
        return { progress: progressOf(this.experience.steps, this.answers), correct: false };
      throw new PlayerError('INVALID_ANSWER', 'That answer is not allowed here');
    }
    this.answers.set(stepKey, answer);
    return { progress: progressOf(this.experience.steps, this.answers), correct: check.correct };
  }

  async reveal(stepKey: string) {
    this.answers.set(stepKey, { kind: 'ACK' });
    return {
      gift: {
        kind: 'PHYSICAL_MESSAGE' as const,
        message: 'Preview: your surprise details will appear here for the recipient.',
      },
      progress: progressOf(this.experience.steps, this.answers),
    };
  }

  async close() {}

  async report() {}
}
