import { describe, expect, it } from 'vitest';
import { checkAnswer } from './answers';
import { noButtonState } from './no-button';
import { publishIssues } from './publish-rules';
import { richTextFromParagraphs } from './rich-text';
import { DraftStepSchema, type DraftStep } from './steps';
import { DEFAULT_THEME } from './theme';
import { GiftSecretSchema } from './gifts';

const k = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const step = (raw: unknown): DraftStep => DraftStepSchema.parse(raw);

const message = step({
  key: k(1),
  type: 'MESSAGE',
  config: { heading: 'Hi', body: richTextFromParagraphs('Hello') },
});
const yesNo = (noButton: unknown, maybeEnabled = false) =>
  step({ key: k(2), type: 'YES_NO_CHOICE', config: { question: 'Date?', noButton, maybeEnabled } });
const gift = step({ key: k(3), type: 'GIFT_REVEAL', config: { kind: 'PHYSICAL_MESSAGE' } });

describe('checkAnswer', () => {
  it('accepts ACK only for passive steps', () => {
    expect(checkAnswer(message, { kind: 'ACK' })).toEqual({ ok: true, correct: null });
    expect(checkAnswer(message, { kind: 'CHOICE', value: 'YES' }).ok).toBe(false);
  });

  it('never accepts an answer for the gift step', () => {
    expect(checkAnswer(gift, { kind: 'ACK' }).ok).toBe(false);
  });

  it('rejects Maybe unless the creator enabled it', () => {
    expect(checkAnswer(yesNo({ mode: 'IMMEDIATE' }), { kind: 'CHOICE', value: 'MAYBE' }).ok).toBe(
      false,
    );
    expect(
      checkAnswer(yesNo({ mode: 'IMMEDIATE' }, true), { kind: 'CHOICE', value: 'MAYBE' }).ok,
    ).toBe(true);
  });

  it('rejects No when the No button is permanently evasive, but accepts Yes', () => {
    const s = yesNo({ mode: 'EVASIVE' });
    expect(checkAnswer(s, { kind: 'CHOICE', value: 'NO' })).toEqual({
      ok: false,
      reason: 'NOT_ALLOWED',
    });
    expect(checkAnswer(s, { kind: 'CHOICE', value: 'YES' }).ok).toBe(true);
  });

  it('accepts No for the other modes', () => {
    for (const cfg of [
      { mode: 'IMMEDIATE' },
      { mode: 'AFTER_ATTEMPTS', attempts: 3 },
      { mode: 'AFTER_DELAY', delaySeconds: 5 },
    ]) {
      expect(checkAnswer(yesNo(cfg), { kind: 'CHOICE', value: 'NO' }).ok).toBe(true);
    }
  });

  it('enforces required correct answers', () => {
    const quiz = step({
      key: k(4),
      type: 'MULTIPLE_CHOICE',
      config: {
        question: 'Where did we meet?',
        options: [
          { id: 'a', label: 'Cafe' },
          { id: 'b', label: 'Park' },
        ],
        correctOptionId: 'b',
        requireCorrect: true,
      },
    });
    expect(checkAnswer(quiz, { kind: 'OPTION', optionId: 'a' })).toEqual({
      ok: false,
      reason: 'INCORRECT',
    });
    expect(checkAnswer(quiz, { kind: 'OPTION', optionId: 'b' })).toEqual({
      ok: true,
      correct: true,
    });
    expect(checkAnswer(quiz, { kind: 'OPTION', optionId: 'z' }).ok).toBe(false);
  });
});

describe('noButtonState', () => {
  it('IMMEDIATE is always clickable', () => {
    expect(noButtonState({ mode: 'IMMEDIATE' }, { attempts: 0, elapsedMs: 0 }).clickable).toBe(
      true,
    );
  });
  it('AFTER_ATTEMPTS becomes clickable after the configured attempts', () => {
    const cfg = { mode: 'AFTER_ATTEMPTS' as const, attempts: 3 };
    expect(noButtonState(cfg, { attempts: 2, elapsedMs: 99999 })).toMatchObject({
      clickable: false,
      remainingAttempts: 1,
    });
    expect(noButtonState(cfg, { attempts: 3, elapsedMs: 0 }).clickable).toBe(true);
  });
  it('AFTER_DELAY becomes clickable after the delay', () => {
    const cfg = { mode: 'AFTER_DELAY' as const, delaySeconds: 5 };
    expect(noButtonState(cfg, { attempts: 50, elapsedMs: 4001 })).toMatchObject({
      clickable: false,
      remainingSeconds: 1,
    });
    expect(noButtonState(cfg, { attempts: 0, elapsedMs: 5000 }).clickable).toBe(true);
  });
  it('EVASIVE is never clickable', () => {
    expect(noButtonState({ mode: 'EVASIVE' }, { attempts: 1e6, elapsedMs: 1e9 }).clickable).toBe(
      false,
    );
  });
});

describe('publishIssues', () => {
  const base = { title: 'For you', theme: DEFAULT_THEME, giftStepKeysWithSecret: new Set([k(3)]) };

  it('passes a complete experience', () => {
    expect(
      publishIssues({ ...base, steps: [message, yesNo({ mode: 'IMMEDIATE' }), gift] }),
    ).toEqual([]);
  });

  it('requires steps, a title and a gift secret', () => {
    expect(publishIssues({ ...base, title: ' ', steps: [] }).map((i) => i.field)).toEqual([
      'title',
      'steps',
    ]);
    expect(
      publishIssues({ ...base, giftStepKeysWithSecret: new Set(), steps: [gift] }).map(
        (i) => i.field,
      ),
    ).toEqual(['secret']);
  });

  it('requires the gift to be last and unique', () => {
    const issues = publishIssues({ ...base, steps: [gift, message] });
    expect(issues.some((i) => i.field === 'position')).toBe(true);
  });

  it('requires a correct option when correctness is required', () => {
    const quiz = step({
      key: k(6),
      type: 'MULTIPLE_CHOICE',
      config: {
        question: 'Q',
        options: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        requireCorrect: true,
      },
    });
    expect(publishIssues({ ...base, steps: [quiz] }).map((i) => i.field)).toEqual([
      'correctOptionId',
    ]);
  });

  it('requires image alt text and an uploaded image', () => {
    const img = step({ key: k(5), type: 'IMAGE', config: {} });
    expect(publishIssues({ ...base, steps: [img] }).map((i) => i.field)).toEqual([
      'mediaId',
      'alt',
    ]);
  });
});

describe('gift secrets', () => {
  it('only accepts https links', () => {
    expect(
      GiftSecretSchema.safeParse({ kind: 'URL', url: 'https://shop.example/redeem' }).success,
    ).toBe(true);
    expect(GiftSecretSchema.safeParse({ kind: 'URL', url: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(GiftSecretSchema.safeParse({ kind: 'URL', url: 'http://shop.example' }).success).toBe(
      false,
    );
  });
  it('requires a code for vouchers', () => {
    expect(GiftSecretSchema.safeParse({ kind: 'VOUCHER_CODE', code: '' }).success).toBe(false);
    expect(GiftSecretSchema.parse({ kind: 'VOUCHER_CODE', code: 'ABC-123' })).toMatchObject({
      pin: '',
      redeemUrl: '',
    });
  });
});
