import { z } from 'zod';
import { StepRoutingSchema } from './flow';
import { EMPTY_RICH_TEXT, RichTextDocSchema } from './rich-text';

/**
 * Step configuration is stored as JSONB but always passes through these discriminated
 * schemas on the way in (draft save) and again at publish time (stricter rules in
 * `publish-rules.ts`). Draft schemas allow incomplete content so autosave never blocks.
 */

export const STEP_TYPES = [
  'MESSAGE',
  'IMAGE',
  'MULTIPLE_CHOICE',
  'YES_NO_CHOICE',
  'SCRATCH_REVEAL',
  'GIFT_REVEAL',
] as const;
export const StepTypeSchema = z.enum(STEP_TYPES);
export type StepType = z.infer<typeof StepTypeSchema>;

export const MAX_STEPS = 30;

const shortText = (max: number) => z.string().max(max);
const label = (fallback: string) => z.string().trim().min(1).max(40).default(fallback);

export const MessageConfigSchema = z.strictObject({
  heading: shortText(120).default(''),
  body: RichTextDocSchema.default(EMPTY_RICH_TEXT),
  buttonLabel: label('Continue'),
});

export const ImageConfigSchema = z.strictObject({
  mediaId: z.uuid().nullable().default(null),
  alt: shortText(250).default(''),
  caption: shortText(300).default(''),
  buttonLabel: label('Continue'),
});

export const OptionIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/, 'Invalid option id');

export const MultipleChoiceConfigSchema = z
  .strictObject({
    question: shortText(200).default(''),
    options: z
      .array(z.strictObject({ id: OptionIdSchema, label: shortText(80) }))
      .min(2)
      .max(6),
    correctOptionId: OptionIdSchema.nullable().default(null),
    requireCorrect: z.boolean().default(false),
    wrongAnswerMessage: shortText(160).default('Not quite — try again!'),
  })
  .superRefine((cfg, ctx) => {
    const ids = cfg.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Option ids must be unique' });
    }
    if (cfg.correctOptionId !== null && !ids.includes(cfg.correctOptionId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['correctOptionId'],
        message: 'Correct option must be one of the options',
      });
    }
  });

/**
 * No-button behaviour. Every mode keeps the separate Close control untouched; these modes
 * only change how the No choice itself responds.
 */
export const NO_BUTTON_MODES = ['IMMEDIATE', 'AFTER_ATTEMPTS', 'AFTER_DELAY', 'EVASIVE'] as const;
export const NoButtonModeSchema = z.enum(NO_BUTTON_MODES);
export type NoButtonMode = z.infer<typeof NoButtonModeSchema>;

export const NO_BUTTON_LIMITS = {
  attempts: { min: 1, max: 10, default: 3 },
  delaySeconds: { min: 1, max: 60, default: 5 },
} as const;

export const NoButtonConfigSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('IMMEDIATE') }),
  z.strictObject({
    mode: z.literal('AFTER_ATTEMPTS'),
    attempts: z
      .number()
      .int()
      .min(NO_BUTTON_LIMITS.attempts.min)
      .max(NO_BUTTON_LIMITS.attempts.max),
  }),
  z.strictObject({
    mode: z.literal('AFTER_DELAY'),
    delaySeconds: z
      .number()
      .int()
      .min(NO_BUTTON_LIMITS.delaySeconds.min)
      .max(NO_BUTTON_LIMITS.delaySeconds.max),
  }),
  z.strictObject({ mode: z.literal('EVASIVE') }),
]);
export type NoButtonConfig = z.infer<typeof NoButtonConfigSchema>;

export const YesNoConfigSchema = z.strictObject({
  question: shortText(200).default(''),
  yesLabel: label('Yes'),
  noLabel: label('No'),
  maybeEnabled: z.boolean().default(false),
  maybeLabel: label('Maybe'),
  noButton: NoButtonConfigSchema.default({ mode: 'IMMEDIATE' }),
  evasiveMessage: shortText(120).default('Nice try!'),
});

export const ScratchRevealConfigSchema = z.strictObject({
  instructions: shortText(120).default('Scratch to reveal'),
  coverLabel: label('Scratch here'),
  hiddenText: shortText(300).default(''),
  hiddenMediaId: z.uuid().nullable().default(null),
  hiddenMediaAlt: shortText(250).default(''),
  buttonLabel: label('Continue'),
});

export const GIFT_KINDS = [
  'VOUCHER_CODE',
  'URL',
  'QR_IMAGE',
  'INSTRUCTION',
  'PHYSICAL_MESSAGE',
] as const;
export const GiftKindSchema = z.enum(GIFT_KINDS);
export type GiftKind = z.infer<typeof GiftKindSchema>;

/**
 * Public part of the final gift step. The secret (code, link, QR image, instructions)
 * lives in the encrypted Gift record and is only returned by the reveal endpoint.
 */
export const GiftRevealConfigSchema = z.strictObject({
  title: shortText(120).default('Your surprise'),
  message: RichTextDocSchema.default(EMPTY_RICH_TEXT),
  kind: GiftKindSchema.default('PHYSICAL_MESSAGE'),
  revealButtonLabel: label('Reveal my surprise'),
  oneTimeReveal: z.boolean().default(false),
});

export const StepConfigSchemas = {
  MESSAGE: MessageConfigSchema,
  IMAGE: ImageConfigSchema,
  MULTIPLE_CHOICE: MultipleChoiceConfigSchema,
  YES_NO_CHOICE: YesNoConfigSchema,
  SCRATCH_REVEAL: ScratchRevealConfigSchema,
  GIFT_REVEAL: GiftRevealConfigSchema,
} as const;

export const StepKeySchema = z.uuid();

/** Optional branching after the step (see flow.ts); absent means "continue to the next step". */
const Next = StepRoutingSchema.optional();

export const DraftStepSchema = z
  .discriminatedUnion('type', [
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('MESSAGE'),
      config: MessageConfigSchema,
      next: Next,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('IMAGE'),
      config: ImageConfigSchema,
      next: Next,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('MULTIPLE_CHOICE'),
      config: MultipleChoiceConfigSchema,
      next: Next,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('YES_NO_CHOICE'),
      config: YesNoConfigSchema,
      next: Next,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('SCRATCH_REVEAL'),
      config: ScratchRevealConfigSchema,
      next: Next,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('GIFT_REVEAL'),
      config: GiftRevealConfigSchema,
      next: Next,
    }),
  ])
  .meta({ id: 'Step' });
export type DraftStep = z.infer<typeof DraftStepSchema>;
export type StepOf<T extends StepType> = Extract<DraftStep, { type: T }>;
export type StepConfigOf<T extends StepType> = StepOf<T>['config'];

/** Media ids referenced by a step's public configuration. */
export function referencedMediaIds(step: DraftStep): string[] {
  switch (step.type) {
    case 'IMAGE':
      return step.config.mediaId ? [step.config.mediaId] : [];
    case 'SCRATCH_REVEAL':
      return step.config.hiddenMediaId ? [step.config.hiddenMediaId] : [];
    default:
      return [];
  }
}

/** A fresh, valid config for a newly added step of the given type. */
export function defaultStepConfig<T extends StepType>(type: T): StepConfigOf<T> {
  if (type === 'MULTIPLE_CHOICE') {
    return MultipleChoiceConfigSchema.parse({
      options: [
        { id: 'option-1', label: '' },
        { id: 'option-2', label: '' },
      ],
    }) as StepConfigOf<T>;
  }
  return StepConfigSchemas[type].parse({}) as StepConfigOf<T>;
}
