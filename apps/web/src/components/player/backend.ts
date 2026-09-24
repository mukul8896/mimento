import type {
  Answer,
  PublicExperience,
  RevealedGift,
  SessionProgress,
} from '@momentpath/contracts';

export interface PlayerState {
  experience: PublicExperience;
  progress: SessionProgress;
}

/** What the player needs from its environment: the live recipient API or a local preview. */
export interface PlayerBackend {
  readonly mode: 'live' | 'preview';
  /** `pin` is sent only when the surprise asked for one (PIN_REQUIRED). */
  load(options?: { pin?: string }): Promise<PlayerState>;
  answer(
    stepKey: string,
    answer: Answer,
  ): Promise<{ progress: SessionProgress; correct: boolean | null }>;
  reveal(stepKey: string): Promise<{ gift: RevealedGift; progress: SessionProgress }>;
  close(): Promise<void>;
  report(category: string, details: string): Promise<void>;
}

export class PlayerError extends Error {
  constructor(
    readonly code: string,
    message: string,
    /** Server detail, e.g. the ISO time a surprise opens or a PIN lock ends. */
    readonly detail?: string,
  ) {
    super(message);
  }
}
