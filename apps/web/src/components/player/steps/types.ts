import type { Answer, DraftStep, PublicExperience, RevealedGift } from '@momentpath/contracts';

export interface StepProps<T extends DraftStep['type'] = DraftStep['type']> {
  step: Extract<DraftStep, { type: T }>;
  media: PublicExperience['media'];
  busy: boolean;
  reducedMotion: boolean;
  /** Submits an answer; resolves to `correct` (null when not applicable). */
  submit: (answer: Answer) => Promise<boolean | null>;
  reveal: () => Promise<RevealedGift | null>;
  preview: boolean;
}
