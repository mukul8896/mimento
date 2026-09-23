import { z } from 'zod';
import { OptionIdSchema, type DraftStep } from './steps';

/**
 * Recipient answers. Continuing past a message/image/scratch card is an explicit ACK.
 * A choice answer is only ever produced by an explicit button activation; closing the
 * experience submits nothing and is never translated into YES or NO.
 */
export const ChoiceValueSchema = z.enum(['YES', 'NO', 'MAYBE']);
export type ChoiceValue = z.infer<typeof ChoiceValueSchema>;

export const AnswerSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('ACK') }),
    z.strictObject({ kind: z.literal('OPTION'), optionId: OptionIdSchema }),
    z.strictObject({ kind: z.literal('CHOICE'), value: ChoiceValueSchema }),
  ])
  .meta({ id: 'Answer' });
export type Answer = z.infer<typeof AnswerSchema>;

export type AnswerCheck =
  | { ok: true; correct: boolean | null }
  | { ok: false; reason: 'WRONG_KIND' | 'UNKNOWN_OPTION' | 'NOT_ALLOWED' | 'INCORRECT' };

/**
 * Validate an answer against the published step it targets. Pure so it can be unit-tested
 * and reused by the API as the single source of truth.
 */
export function checkAnswer(step: DraftStep, answer: Answer): AnswerCheck {
  switch (step.type) {
    case 'MESSAGE':
    case 'IMAGE':
    case 'SCRATCH_REVEAL':
      return answer.kind === 'ACK'
        ? { ok: true, correct: null }
        : { ok: false, reason: 'WRONG_KIND' };
    case 'MULTIPLE_CHOICE': {
      if (answer.kind !== 'OPTION') return { ok: false, reason: 'WRONG_KIND' };
      if (!step.config.options.some((o) => o.id === answer.optionId)) {
        return { ok: false, reason: 'UNKNOWN_OPTION' };
      }
      const correct =
        step.config.correctOptionId === null
          ? null
          : step.config.correctOptionId === answer.optionId;
      if (step.config.requireCorrect && correct === false)
        return { ok: false, reason: 'INCORRECT' };
      return { ok: true, correct };
    }
    case 'YES_NO_CHOICE': {
      if (answer.kind !== 'CHOICE') return { ok: false, reason: 'WRONG_KIND' };
      if (answer.value === 'MAYBE' && !step.config.maybeEnabled) {
        return { ok: false, reason: 'NOT_ALLOWED' };
      }
      // A permanently evasive No can never be submitted. The recipient can still close.
      if (answer.value === 'NO' && step.config.noButton.mode === 'EVASIVE') {
        return { ok: false, reason: 'NOT_ALLOWED' };
      }
      return { ok: true, correct: null };
    }
    case 'GIFT_REVEAL':
      // The gift step is completed through the dedicated reveal endpoint only.
      return { ok: false, reason: 'WRONG_KIND' };
  }
}
