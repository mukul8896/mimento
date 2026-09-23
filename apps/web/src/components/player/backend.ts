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
  load(): Promise<PlayerState>;
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
  ) {
    super(message);
  }
}
