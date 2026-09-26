import { z } from 'zod';
import { GiftSecretSchema, type GiftSecret } from './gifts';
import { DraftStepSchema, StepTypeSchema, type DraftStep } from './steps';
import { fillTemplate, TemplateFieldSchema, type TemplateFieldValues } from './template-fields';
import { ThemeSchema, type Theme } from './theme';

/**
 * A template as stored. Steps may contain `{{field}}` placeholders (even in date settings), so
 * they are only validated as steps after `materializeTemplate` fills them in. The seed does
 * that with the example values, so a template that would not produce valid steps never ships.
 */
export const TemplateContentSchema = z.object({
  title: z.string().max(200),
  theme: ThemeSchema,
  occasion: z.string().max(40).default('Other'),
  emoji: z.string().max(8).default('🎁'),
  fields: z.array(TemplateFieldSchema).max(8).default([]),
  steps: z.array(z.looseObject({ key: z.string(), type: StepTypeSchema })).min(1),
  /** Optional starter surprise details (never real vouchers) keyed by gift step key. */
  giftDefaults: z.record(z.string(), z.unknown()).default({}),
});
export type TemplateContent = z.infer<typeof TemplateContentSchema>;

export interface MaterializedTemplate {
  title: string;
  theme: Theme;
  steps: DraftStep[];
  giftDefaults: Record<string, GiftSecret>;
}

/** Fills a template's fields and validates the result as real steps and gift details. */
export function materializeTemplate(
  content: TemplateContent,
  values: TemplateFieldValues,
  mode: 'create' | 'preview' = 'create',
): MaterializedTemplate {
  const filled = fillTemplate(
    {
      title: content.title,
      steps: content.steps,
      giftDefaults: content.giftDefaults,
      cover: content.theme.cover,
    },
    content.fields,
    values,
    mode,
  );
  return {
    title: filled.title.slice(0, 120),
    // The cover's line can greet them by name, like the steps.
    theme: filled.cover
      ? { ...content.theme, cover: { ...filled.cover, line: filled.cover.line?.slice(0, 80) } }
      : content.theme,
    steps: filled.steps.map((s) => DraftStepSchema.parse(s)),
    giftDefaults: Object.fromEntries(
      Object.entries(filled.giftDefaults).map(([k, v]) => [k, GiftSecretSchema.parse(v)]),
    ),
  };
}
export type TemplateContentInput = z.input<typeof TemplateContentSchema>;
