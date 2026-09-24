import { describe, expect, it } from 'vitest';
import {
  DraftStepSchema,
  MultipleChoiceConfigSchema,
  NoButtonConfigSchema,
  YesNoConfigSchema,
  defaultStepConfig,
  STEP_TYPES,
} from './steps';
import { RichTextDocSchema } from './rich-text';
import {
  ThemeSchema,
  DEFAULT_THEME,
  themeContrastIssues,
  contrastRatio,
  themeMediaIds,
} from './theme';

const key = '6a2f9d4e-3b7c-4d1a-9f0e-1c2b3a4d5e6f';

describe('step schemas', () => {
  it('produces a valid default config for every step type', () => {
    for (const type of STEP_TYPES) {
      const parsed = DraftStepSchema.safeParse({ key, type, config: defaultStepConfig(type) });
      expect(parsed.success, type).toBe(true);
    }
  });

  it('rejects unknown step types and unknown config fields', () => {
    expect(DraftStepSchema.safeParse({ key, type: 'SCRIPT', config: {} }).success).toBe(false);
    expect(
      DraftStepSchema.safeParse({
        key,
        type: 'MESSAGE',
        config: { ...defaultStepConfig('MESSAGE'), html: '<script>alert(1)</script>' },
      }).success,
    ).toBe(false);
  });

  it('requires a UUID step key', () => {
    expect(
      DraftStepSchema.safeParse({ key: '1', type: 'MESSAGE', config: defaultStepConfig('MESSAGE') })
        .success,
    ).toBe(false);
  });

  it('validates multiple-choice correctness references', () => {
    const base = {
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    };
    expect(MultipleChoiceConfigSchema.safeParse({ ...base, correctOptionId: 'c' }).success).toBe(
      false,
    );
    expect(
      MultipleChoiceConfigSchema.safeParse({ ...base, correctOptionId: 'a', requireCorrect: true })
        .success,
    ).toBe(true);
    expect(
      MultipleChoiceConfigSchema.safeParse({
        options: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'B' },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('No-button configuration bounds', () => {
  it.each([
    [{ mode: 'IMMEDIATE' }, true],
    [{ mode: 'AFTER_ATTEMPTS', attempts: 1 }, true],
    [{ mode: 'AFTER_ATTEMPTS', attempts: 10 }, true],
    [{ mode: 'AFTER_ATTEMPTS', attempts: 0 }, false],
    [{ mode: 'AFTER_ATTEMPTS', attempts: 11 }, false],
    [{ mode: 'AFTER_ATTEMPTS', attempts: 2.5 }, false],
    [{ mode: 'AFTER_ATTEMPTS' }, false],
    [{ mode: 'AFTER_DELAY', delaySeconds: 1 }, true],
    [{ mode: 'AFTER_DELAY', delaySeconds: 60 }, true],
    [{ mode: 'AFTER_DELAY', delaySeconds: 61 }, false],
    [{ mode: 'EVASIVE' }, true],
    [{ mode: 'EVASIVE', attempts: 3 }, false],
    [{ mode: 'HIDE_CLOSE' }, false],
  ])('%j valid=%s', (config, valid) => {
    expect(NoButtonConfigSchema.safeParse(config).success).toBe(valid);
  });

  it('defaults Yes/No steps to an immediately clickable No without Maybe', () => {
    const cfg = YesNoConfigSchema.parse({ question: 'Dinner?' });
    expect(cfg.noButton).toEqual({ mode: 'IMMEDIATE' });
    expect(cfg.maybeEnabled).toBe(false);
  });
});

describe('rich text', () => {
  it('accepts the allowed subset', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hi' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'hardBreak' },
          ],
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
      ],
    };
    expect(RichTextDocSchema.safeParse(doc).success).toBe(true);
  });

  it.each([
    { type: 'doc', content: [{ type: 'html', content: '<img onerror=x>' }] },
    { type: 'doc', content: [{ type: 'paragraph', attrs: { style: 'color:red' } }] },
    {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:1' } }] },
          ],
        },
      ],
    },
    { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 } }] },
  ])('rejects disallowed content %#', (doc) => {
    expect(RichTextDocSchema.safeParse(doc).success).toBe(false);
  });

  it('enforces the total character limit', () => {
    const para = { type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(4000) }] };
    expect(RichTextDocSchema.safeParse({ type: 'doc', content: [para, para] }).success).toBe(false);
  });
});

describe('theme', () => {
  it('accepts the default theme and rejects arbitrary CSS', () => {
    expect(ThemeSchema.safeParse(DEFAULT_THEME).success).toBe(true);
    expect(
      ThemeSchema.safeParse({
        ...DEFAULT_THEME,
        palette: { ...DEFAULT_THEME.palette, background: 'url(javascript:alert(1))' },
      }).success,
    ).toBe(false);
    expect(ThemeSchema.safeParse({ ...DEFAULT_THEME, css: 'body{}' }).success).toBe(false);
    expect(ThemeSchema.safeParse({ ...DEFAULT_THEME, animation: 'SPIN' }).success).toBe(false);
  });

  it('computes WCAG contrast and flags low-contrast palettes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(themeContrastIssues(DEFAULT_THEME.palette)).toEqual([]);
    expect(
      themeContrastIssues({ ...DEFAULT_THEME.palette, text: '#eeeeee', background: '#ffffff' }),
    ).not.toEqual([]);
  });
});

describe('sound and celebration settings', () => {
  it('older themes and steps get sensible defaults', () => {
    const legacy = {
      palette: DEFAULT_THEME.palette,
      font: 'SANS',
      typeScale: 'COMFORTABLE',
      animation: 'POP',
    };
    expect(ThemeSchema.parse(legacy)).toMatchObject({
      music: { source: 'NONE' },
      sounds: true,
      celebration: 'CONFETTI',
    });
    expect(YesNoConfigSchema.parse({})).toMatchObject({
      yesReaction: { emoji: '😍', sound: 'YAY' },
      noReaction: { emoji: '🥺', sound: 'WOMP' },
    });
    const mc = MultipleChoiceConfigSchema.parse({
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B', emoji: '🍕' },
      ],
    });
    expect(mc.options.map((o: { emoji: string }) => o.emoji)).toEqual(['', '🍕']);
    expect(themeMediaIds(ThemeSchema.parse(legacy))).toEqual([]);
  });

  it('accepts library and uploaded music, and rejects anything else', () => {
    const id = '6f1c2a55-7a0e-4b8e-9d1f-2b3c4d5e6f70';
    const upload = ThemeSchema.parse({
      ...DEFAULT_THEME,
      music: { source: 'UPLOAD', mediaId: id },
    });
    expect(themeMediaIds(upload)).toEqual([id]);
    expect(
      ThemeSchema.safeParse({ ...DEFAULT_THEME, music: { source: 'LIBRARY', track: 'JINGLE' } })
        .success,
    ).toBe(true);
    expect(
      ThemeSchema.safeParse({ ...DEFAULT_THEME, music: { source: 'LIBRARY', track: 'TOP40' } })
        .success,
    ).toBe(false);
    expect(
      ThemeSchema.safeParse({ ...DEFAULT_THEME, music: { source: 'URL', url: 'https://x' } })
        .success,
    ).toBe(false);
  });
});

describe('emojiOnly', () => {
  it('keeps emoji (including joined and flag ones) and drops ordinary text', async () => {
    const { emojiOnly } = await import('./sound.js');
    expect(emojiOnly('hello 🍕 world')).toBe('🍕');
    expect(emojiOnly('❤️👩‍❤️‍👨')).toBe('❤️👩‍❤️‍👨');
    expect(emojiOnly('🇮🇳👍🏽')).toBe('🇮🇳👍🏽');
    expect(emojiOnly('abc 123')).toBe('');
  });
});
