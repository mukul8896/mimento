import { z } from 'zod';
import { StepRoutingSchema } from './flow';
import { EMPTY_RICH_TEXT, RichTextDocSchema } from './rich-text';
import { DEFAULT_REACTIONS, ReactionSchema } from './sound';
import { SceneSchema } from './scene';

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
  'COUNTDOWN',
  'PUZZLE',
  'PHOTO_GALLERY',
  'VOICE_NOTE',
  'VIDEO',
  'PLACE_REVEAL',
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
      .array(
        z.strictObject({
          id: OptionIdSchema,
          label: shortText(80),
          /** Bursts from the option when it is picked. */
          emoji: z.string().trim().max(16).default(''),
        }),
      )
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
  /** Emoji burst and sound for each answer. */
  yesReaction: ReactionSchema.default(DEFAULT_REACTIONS.yes),
  noReaction: ReactionSchema.default(DEFAULT_REACTIONS.no),
  maybeReaction: ReactionSchema.default(DEFAULT_REACTIONS.maybe),
});

export const ScratchRevealConfigSchema = z.strictObject({
  instructions: shortText(120).default('Scratch to reveal'),
  coverLabel: label('Scratch here'),
  hiddenText: shortText(300).default(''),
  hiddenMediaId: z.uuid().nullable().default(null),
  hiddenMediaAlt: shortText(250).default(''),
  buttonLabel: label('Continue'),
});

/** A countdown to a moment; optionally the recipient cannot continue until it arrives. */
export const CountdownConfigSchema = z.strictObject({
  title: shortText(120).default('Counting down…'),
  targetAt: z.iso.datetime({ offset: true }).nullable().default(null),
  message: RichTextDocSchema.default(EMPTY_RICH_TEXT),
  waitForIt: z.boolean().default(true),
  buttonLabel: label('Continue'),
});

/**
 * A riddle or secret word. The answer is checked on the server and never sent to the
 * recipient's browser (like a quiz's correct option).
 */
export const PuzzleConfigSchema = z.strictObject({
  prompt: shortText(300).default(''),
  hint: shortText(200).default(''),
  answer: shortText(60).default(''),
  wrongMessage: shortText(160).default('Not quite — try again!'),
  buttonLabel: label('Check'),
});

export const MAX_GALLERY_ITEMS = 12;
export const PhotoGalleryConfigSchema = z.strictObject({
  title: shortText(120).default(''),
  items: z
    .array(
      z.strictObject({
        mediaId: z.uuid(),
        alt: shortText(250).default(''),
        caption: shortText(300).default(''),
      }),
    )
    .max(MAX_GALLERY_ITEMS)
    .default([]),
  buttonLabel: label('Continue'),
});

/** An uploaded voice note or song clip. The transcript helps people who cannot listen. */
export const VoiceNoteConfigSchema = z.strictObject({
  title: shortText(120).default(''),
  mediaId: z.uuid().nullable().default(null),
  transcript: shortText(2000).default(''),
  buttonLabel: label('Continue'),
});

/** A YouTube or Vimeo video, embedded from its link (videos are not uploaded). */
export const VideoConfigSchema = z.strictObject({
  title: shortText(120).default(''),
  url: shortText(300).default(''),
  caption: shortText(300).default(''),
  buttonLabel: label('Continue'),
});

/** Where and when: revealed on tap, with a link to open the place in a maps app. */
export const PlaceRevealConfigSchema = z.strictObject({
  title: shortText(120).default('Guess where we are going'),
  revealLabel: label('Reveal'),
  placeName: shortText(120).default(''),
  address: shortText(300).default(''),
  when: z.iso.datetime({ offset: true }).nullable().default(null),
  note: shortText(300).default(''),
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
  /** Scheduled reveal: the gift stays locked until this moment (enforced by the server). */
  revealAt: z.iso.datetime({ offset: true }).nullable().default(null),
});

export const StepConfigSchemas = {
  MESSAGE: MessageConfigSchema,
  IMAGE: ImageConfigSchema,
  MULTIPLE_CHOICE: MultipleChoiceConfigSchema,
  YES_NO_CHOICE: YesNoConfigSchema,
  SCRATCH_REVEAL: ScratchRevealConfigSchema,
  COUNTDOWN: CountdownConfigSchema,
  PUZZLE: PuzzleConfigSchema,
  PHOTO_GALLERY: PhotoGalleryConfigSchema,
  VOICE_NOTE: VoiceNoteConfigSchema,
  VIDEO: VideoConfigSchema,
  PLACE_REVEAL: PlaceRevealConfigSchema,
  GIFT_REVEAL: GiftRevealConfigSchema,
} as const;

export const StepKeySchema = z.uuid();

/** Optional branching after the step (see flow.ts); absent means "continue to the next step". */
const Next = StepRoutingSchema.optional();
/** Optional presentation (see scene.ts); absent means the classic card. */
const SceneOptional = SceneSchema.optional();

export const DraftStepSchema = z
  .discriminatedUnion('type', [
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('MESSAGE'),
      config: MessageConfigSchema,
      next: Next,
      scene: SceneOptional,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('IMAGE'),
      config: ImageConfigSchema,
      next: Next,
      scene: SceneOptional,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('MULTIPLE_CHOICE'),
      config: MultipleChoiceConfigSchema,
      next: Next,
      scene: SceneOptional,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('YES_NO_CHOICE'),
      config: YesNoConfigSchema,
      next: Next,
      scene: SceneOptional,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('SCRATCH_REVEAL'),
      config: ScratchRevealConfigSchema,
      next: Next,
      scene: SceneOptional,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('COUNTDOWN'),
      config: CountdownConfigSchema,
      next: Next,
      scene: SceneOptional,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('PUZZLE'),
      config: PuzzleConfigSchema,
      next: Next,
      scene: SceneOptional,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('PHOTO_GALLERY'),
      config: PhotoGalleryConfigSchema,
      next: Next,
      scene: SceneOptional,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('VOICE_NOTE'),
      config: VoiceNoteConfigSchema,
      next: Next,
      scene: SceneOptional,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('VIDEO'),
      config: VideoConfigSchema,
      next: Next,
      scene: SceneOptional,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('PLACE_REVEAL'),
      config: PlaceRevealConfigSchema,
      next: Next,
      scene: SceneOptional,
    }),
    z.strictObject({
      key: StepKeySchema,
      type: z.literal('GIFT_REVEAL'),
      config: GiftRevealConfigSchema,
      next: Next,
      scene: SceneOptional,
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
    case 'PHOTO_GALLERY':
      return step.config.items.map((i) => i.mediaId);
    case 'VOICE_NOTE':
      return step.config.mediaId ? [step.config.mediaId] : [];
    default:
      return [];
  }
}

/** Which kind of file each referenced media id must be. */
export function referencedMediaKinds(step: DraftStep): Map<string, 'image' | 'audio'> {
  const kind = step.type === 'VOICE_NOTE' ? 'audio' : 'image';
  return new Map(referencedMediaIds(step).map((id) => [id, kind]));
}

export type VideoRef = { provider: 'youtube' | 'vimeo'; id: string };

/**
 * Recognises YouTube and Vimeo links and extracts the video id. Only these two providers can
 * be embedded (they are the only ones the recipient page's CSP allows as frames).
 */
export function parseVideoUrl(input: string): VideoRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  const yt = /^[A-Za-z0-9_-]{11}$/;
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1);
    return yt.test(id) ? { provider: 'youtube', id } : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      url.searchParams.get('v') ??
      /^\/(?:embed|shorts|live)\/([^/?#]+)/.exec(url.pathname)?.[1] ??
      '';
    return yt.test(id) ? { provider: 'youtube', id } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = /^\/(?:video\/)?(\d{6,12})(?:\/|$)/.exec(url.pathname)?.[1];
    return id ? { provider: 'vimeo', id } : null;
  }
  return null;
}

/** Embed address for a parsed video; YouTube uses its privacy-enhanced (no-cookie) domain. */
export function videoEmbedUrl(ref: VideoRef): string {
  return ref.provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${ref.id}?rel=0`
    : `https://player.vimeo.com/video/${ref.id}?dnt=1`;
}

/** Normalises a typed puzzle answer: case, accents, punctuation and extra spaces do not count. */
export function normalizePuzzleAnswer(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** A fresh, valid config for a newly added step of the given type. */
export function defaultStepConfig<T extends StepType>(type: T): StepConfigOf<T> {
  if (type === 'MULTIPLE_CHOICE') {
    return MultipleChoiceConfigSchema.parse({
      options: [
        { id: 'option-1', label: '', emoji: '' },
        { id: 'option-2', label: '', emoji: '' },
      ],
    }) as StepConfigOf<T>;
  }
  return StepConfigSchemas[type].parse({}) as StepConfigOf<T>;
}
