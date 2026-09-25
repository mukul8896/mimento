'use client';

import {
  MAX_GALLERY_ITEMS,
  NO_BUTTON_LIMITS,
  parseVideoUrl,
  emojiOnly,
  SOUND_EFFECT_LABELS,
  SOUND_EFFECTS,
  type DraftStep,
  type Reaction,
  type SoundEffect,
  type NoButtonConfig,
  type StepConfigOf,
  type StepType,
} from '@momentpath/contracts';
import { Alert, Button, Field, Input, Select, Switch, Textarea } from '@momentpath/design-system';
import { previewEffect } from '@/components/player/fx/preview';
import { GiftSecretForm } from './gift-secret-form';
import { MediaUpload, type MediaItem } from './media-upload';
import { RichTextEditor } from './rich-text-editor';

export interface StepFormContext {
  experienceId: string;
  media: MediaItem[];
  addMedia: (item: MediaItem) => void;
  /** Saves the draft now; the gift secret endpoint needs the step to exist server-side. */
  flush: () => Promise<boolean>;
  hasGiftSecret: (stepKey: string) => boolean;
  setGiftSecretSaved: (stepKey: string, saved: boolean) => void;
  /**
   * Personalising a template (PLUS): words, photos, labels and the gift can change; controls
   * that change how the experience works — answer choices, Maybe, No-button behaviour, waiting
   * for a countdown — are hidden. The API refuses structural changes regardless.
   */
  locked?: boolean;
}

interface FormProps<T extends StepType> {
  step: Extract<DraftStep, { type: T }>;
  onChange: (config: StepConfigOf<T>) => void;
  ctx: StepFormContext;
}

function TextField({
  label,
  value,
  onChange,
  maxLength,
  hint,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  hint?: string;
  required?: boolean;
}) {
  return (
    <Field
      label={label}
      hint={hint}
      error={required && value.trim() === '' ? 'Required before publishing' : null}
    >
      {(p) => (
        <Input
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          {...p}
        />
      )}
    </Field>
  );
}

/** Picks a sound effect, with a button to hear it. */
export function SoundPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SoundEffect;
  onChange: (v: SoundEffect) => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <Field label={label}>
          {(p) => (
            <Select
              value={value}
              onChange={(e) => {
                const next = e.target.value as SoundEffect;
                onChange(next);
                previewEffect(next);
              }}
              {...p}
            >
              {SOUND_EFFECTS.map((effect) => (
                <option key={effect} value={effect}>
                  {SOUND_EFFECT_LABELS[effect]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Button
        variant="secondary"
        aria-label={`Play ${label.toLowerCase()}`}
        disabled={value === 'NONE'}
        onClick={() => previewEffect(value)}
      >
        ▶
      </Button>
    </div>
  );
}

function ReactionFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: Reaction;
  onChange: (v: Reaction) => void;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-end gap-2 rounded-xl p-3 ring-1 ring-inset ring-ink-200">
      <Field label={`${title} emoji`}>
        {(p) => (
          <Input
            value={value.emoji}
            maxLength={16}
            placeholder="🎉"
            className="text-center text-xl"
            onChange={(e) => onChange({ ...value, emoji: emojiOnly(e.target.value) })}
            {...p}
          />
        )}
      </Field>
      <SoundPicker
        label={`${title} sound`}
        value={value.sound}
        onChange={(sound) => onChange({ ...value, sound })}
      />
    </div>
  );
}

function MessageForm({ step, onChange }: FormProps<'MESSAGE'>) {
  const c = step.config;
  return (
    <div className="space-y-4">
      <TextField
        label="Heading"
        value={c.heading}
        maxLength={120}
        onChange={(heading) => onChange({ ...c, heading })}
      />
      <RichTextEditor
        label="Message"
        value={c.body}
        onChange={(body) => onChange({ ...c, body })}
      />
      <TextField
        label="Button label"
        value={c.buttonLabel}
        maxLength={40}
        onChange={(buttonLabel) => onChange({ ...c, buttonLabel })}
      />
    </div>
  );
}

function ImageForm({ step, onChange, ctx }: FormProps<'IMAGE'>) {
  const c = step.config;
  return (
    <div className="space-y-4">
      <MediaUpload
        label="Photo"
        experienceId={ctx.experienceId}
        value={c.mediaId}
        media={ctx.media}
        onUploaded={(item) => {
          ctx.addMedia(item);
          onChange({ ...c, mediaId: item.id });
        }}
        onClear={() => onChange({ ...c, mediaId: null })}
      />
      <TextField
        label="Image description (alt text)"
        hint="Describe the photo for people who use screen readers."
        value={c.alt}
        maxLength={250}
        required
        onChange={(alt) => onChange({ ...c, alt })}
      />
      <TextField
        label="Caption"
        value={c.caption}
        maxLength={300}
        onChange={(caption) => onChange({ ...c, caption })}
      />
      <TextField
        label="Button label"
        value={c.buttonLabel}
        maxLength={40}
        onChange={(buttonLabel) => onChange({ ...c, buttonLabel })}
      />
    </div>
  );
}

function MultipleChoiceForm({ step, onChange, ctx }: FormProps<'MULTIPLE_CHOICE'>) {
  const c = step.config;
  const setOptions = (options: typeof c.options) => {
    const correctOptionId = options.some((o) => o.id === c.correctOptionId)
      ? c.correctOptionId
      : null;
    onChange({
      ...c,
      options,
      correctOptionId,
      requireCorrect: correctOptionId ? c.requireCorrect : false,
    });
  };
  return (
    <div className="space-y-4">
      <TextField
        label="Question"
        value={c.question}
        maxLength={200}
        required
        onChange={(question) => onChange({ ...c, question })}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-800">Answers</legend>
        <p className="text-xs text-ink-600">
          Optional: put an emoji in the small box next to an answer — it bursts out on their screen
          when they pick that answer.
        </p>
        {c.options.map((o, i) => (
          <div key={o.id} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Input
                aria-label={`Answer ${i + 1}`}
                value={o.label}
                maxLength={80}
                onChange={(e) =>
                  setOptions(
                    c.options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)),
                  )
                }
              />
            </div>
            <div className="w-14 shrink-0">
              <Input
                aria-label={`Emoji for answer ${i + 1}`}
                title="Emoji that bursts out when this answer is picked (optional)"
                value={o.emoji}
                maxLength={16}
                placeholder="Emoji"
                className="px-1 text-center placeholder:text-xs"
                onChange={(e) =>
                  setOptions(
                    c.options.map((x) =>
                      x.id === o.id ? { ...x, emoji: emojiOnly(e.target.value) } : x,
                    ),
                  )
                }
              />
            </div>
            {ctx.locked ? null : (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove answer ${i + 1}`}
                disabled={c.options.length <= 2}
                onClick={() => setOptions(c.options.filter((x) => x.id !== o.id))}
              >
                ✕
              </Button>
            )}
          </div>
        ))}
        {c.options.length < 6 && !ctx.locked ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setOptions([
                ...c.options,
                { id: `option-${crypto.randomUUID().slice(0, 8)}`, label: '', emoji: '' },
              ])
            }
          >
            Add answer
          </Button>
        ) : null}
      </fieldset>
      <Field label="Correct answer (optional)" hint="Turns the question into a quiz.">
        {(p) => (
          <Select
            value={c.correctOptionId ?? ''}
            onChange={(e) => {
              const correctOptionId = e.target.value || null;
              onChange({
                ...c,
                correctOptionId,
                requireCorrect: correctOptionId ? c.requireCorrect : false,
              });
            }}
            {...p}
          >
            <option value="">No correct answer</option>
            {c.options.map((o, i) => (
              <option key={o.id} value={o.id}>
                {o.label || `Answer ${i + 1}`}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {c.correctOptionId ? (
        <>
          <Switch
            label="Must answer correctly to continue"
            checked={c.requireCorrect}
            onChange={(requireCorrect) => onChange({ ...c, requireCorrect })}
          />
          {c.requireCorrect ? (
            <TextField
              label="Message for a wrong answer"
              value={c.wrongAnswerMessage}
              maxLength={160}
              onChange={(wrongAnswerMessage) => onChange({ ...c, wrongAnswerMessage })}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const NO_MODES: { mode: NoButtonConfig['mode']; title: string; text: string }[] = [
  { mode: 'IMMEDIATE', title: 'Normal', text: 'No works like any other button.' },
  {
    mode: 'AFTER_ATTEMPTS',
    title: 'Plays hard to get',
    text: 'Dodges a few times, then can be clicked.',
  },
  {
    mode: 'AFTER_DELAY',
    title: 'Wait a moment',
    text: 'Unavailable for a few seconds, then clickable.',
  },
  { mode: 'EVASIVE', title: 'Always dodges', text: 'No can never be chosen.' },
];

function YesNoForm({ step, onChange, ctx }: FormProps<'YES_NO_CHOICE'>) {
  const c = step.config;
  const setMode = (mode: NoButtonConfig['mode']) => {
    const noButton: NoButtonConfig =
      mode === 'AFTER_ATTEMPTS'
        ? { mode, attempts: NO_BUTTON_LIMITS.attempts.default }
        : mode === 'AFTER_DELAY'
          ? { mode, delaySeconds: NO_BUTTON_LIMITS.delaySeconds.default }
          : { mode };
    onChange({ ...c, noButton });
  };
  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.round(v || min)));
  return (
    <div className="space-y-4">
      <TextField
        label="Question"
        value={c.question}
        maxLength={200}
        required
        onChange={(question) => onChange({ ...c, question })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Yes label"
          value={c.yesLabel}
          maxLength={40}
          onChange={(yesLabel) => onChange({ ...c, yesLabel })}
        />
        <TextField
          label="No label"
          value={c.noLabel}
          maxLength={40}
          onChange={(noLabel) => onChange({ ...c, noLabel })}
        />
      </div>
      {ctx.locked ? null : (
        <Switch
          label="Show a Maybe option"
          checked={c.maybeEnabled}
          onChange={(maybeEnabled) => onChange({ ...c, maybeEnabled })}
        />
      )}
      {c.maybeEnabled ? (
        <TextField
          label="Maybe label"
          value={c.maybeLabel}
          maxLength={40}
          onChange={(maybeLabel) => onChange({ ...c, maybeLabel })}
        />
      ) : null}
      <fieldset hidden={ctx.locked}>
        <legend className="text-sm font-medium text-ink-800">No button behaviour</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {NO_MODES.map((m) => (
            <label
              key={m.mode}
              className={`flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ring-inset ${c.noButton.mode === m.mode ? 'bg-brand-50 ring-brand-500' : 'ring-ink-200'}`}
            >
              <input
                type="radio"
                name={`no-mode-${step.key}`}
                checked={c.noButton.mode === m.mode}
                onChange={() => setMode(m.mode)}
                className="mt-1 accent-brand-600"
              />
              <span>
                <span className="block text-sm font-medium">{m.title}</span>
                <span className="block text-xs text-ink-600">{m.text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {c.noButton.mode === 'AFTER_ATTEMPTS' && !ctx.locked ? (
        <Field
          label="Dodges before No can be clicked"
          hint={`Between ${NO_BUTTON_LIMITS.attempts.min} and ${NO_BUTTON_LIMITS.attempts.max}.`}
        >
          {(p) => (
            <Input
              type="number"
              inputMode="numeric"
              min={NO_BUTTON_LIMITS.attempts.min}
              max={NO_BUTTON_LIMITS.attempts.max}
              value={c.noButton.mode === 'AFTER_ATTEMPTS' ? c.noButton.attempts : 0}
              onChange={(e) =>
                onChange({
                  ...c,
                  noButton: {
                    mode: 'AFTER_ATTEMPTS',
                    attempts: clamp(
                      Number(e.target.value),
                      NO_BUTTON_LIMITS.attempts.min,
                      NO_BUTTON_LIMITS.attempts.max,
                    ),
                  },
                })
              }
              {...p}
            />
          )}
        </Field>
      ) : null}
      {c.noButton.mode === 'AFTER_DELAY' && !ctx.locked ? (
        <Field
          label="Seconds before No can be clicked"
          hint={`Between ${NO_BUTTON_LIMITS.delaySeconds.min} and ${NO_BUTTON_LIMITS.delaySeconds.max}.`}
        >
          {(p) => (
            <Input
              type="number"
              inputMode="numeric"
              min={NO_BUTTON_LIMITS.delaySeconds.min}
              max={NO_BUTTON_LIMITS.delaySeconds.max}
              value={c.noButton.mode === 'AFTER_DELAY' ? c.noButton.delaySeconds : 0}
              onChange={(e) =>
                onChange({
                  ...c,
                  noButton: {
                    mode: 'AFTER_DELAY',
                    delaySeconds: clamp(
                      Number(e.target.value),
                      NO_BUTTON_LIMITS.delaySeconds.min,
                      NO_BUTTON_LIMITS.delaySeconds.max,
                    ),
                  },
                })
              }
              {...p}
            />
          )}
        </Field>
      ) : null}
      {c.noButton.mode !== 'IMMEDIATE' ? (
        <TextField
          label="Message when No dodges"
          value={c.evasiveMessage}
          maxLength={120}
          onChange={(evasiveMessage) => onChange({ ...c, evasiveMessage })}
        />
      ) : null}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-800">Reactions</legend>
        <p className="text-xs text-ink-600">
          What bursts out, and what they hear, when they pick each answer.
        </p>
        <ReactionFields
          title="Yes"
          value={c.yesReaction}
          onChange={(yesReaction) => onChange({ ...c, yesReaction })}
        />
        <ReactionFields
          title="No"
          value={c.noReaction}
          onChange={(noReaction) => onChange({ ...c, noReaction })}
        />
        {c.maybeEnabled ? (
          <ReactionFields
            title="Maybe"
            value={c.maybeReaction}
            onChange={(maybeReaction) => onChange({ ...c, maybeReaction })}
          />
        ) : null}
      </fieldset>
      <Alert tone="info">
        Whatever you choose, the recipient can always close the experience. Closing never counts as
        Yes or No.
      </Alert>
    </div>
  );
}

function ScratchForm({ step, onChange, ctx }: FormProps<'SCRATCH_REVEAL'>) {
  const c = step.config;
  return (
    <div className="space-y-4">
      <TextField
        label="Instructions"
        value={c.instructions}
        maxLength={120}
        onChange={(instructions) => onChange({ ...c, instructions })}
      />
      <TextField
        label="Text on the scratch layer"
        value={c.coverLabel}
        maxLength={40}
        onChange={(coverLabel) => onChange({ ...c, coverLabel })}
      />
      <TextField
        label="Hidden message"
        value={c.hiddenText}
        maxLength={300}
        onChange={(hiddenText) => onChange({ ...c, hiddenText })}
      />
      <MediaUpload
        label="Hidden image (optional)"
        experienceId={ctx.experienceId}
        value={c.hiddenMediaId}
        media={ctx.media}
        onUploaded={(item) => {
          ctx.addMedia(item);
          onChange({ ...c, hiddenMediaId: item.id });
        }}
        onClear={() => onChange({ ...c, hiddenMediaId: null })}
      />
      {c.hiddenMediaId ? (
        <TextField
          label="Hidden image description"
          value={c.hiddenMediaAlt}
          maxLength={250}
          required
          onChange={(hiddenMediaAlt) => onChange({ ...c, hiddenMediaAlt })}
        />
      ) : null}
      <TextField
        label="Button label"
        value={c.buttonLabel}
        maxLength={40}
        onChange={(buttonLabel) => onChange({ ...c, buttonLabel })}
      />
      <p className="text-xs text-ink-500">
        Recipients who cannot scratch get a “Reveal” button instead.
      </p>
    </div>
  );
}

const GIFT_KIND_LABEL = {
  PHYSICAL_MESSAGE: 'A message about a physical gift or plan',
  INSTRUCTION: 'Instructions (for example, where to find it)',
  VOUCHER_CODE: 'A voucher code you bought elsewhere',
  URL: 'A link (e-gift card, booking, playlist…)',
  QR_IMAGE: 'A QR code image',
} as const;

function GiftForm({ step, onChange, ctx }: FormProps<'GIFT_REVEAL'>) {
  const c = step.config;
  return (
    <div className="space-y-4">
      <TextField
        label="Title"
        value={c.title}
        maxLength={120}
        onChange={(title) => onChange({ ...c, title })}
      />
      <RichTextEditor
        label="Message before the reveal"
        value={c.message}
        onChange={(message) => onChange({ ...c, message })}
      />
      <TextField
        label="Reveal button label"
        value={c.revealButtonLabel}
        maxLength={40}
        onChange={(revealButtonLabel) => onChange({ ...c, revealButtonLabel })}
      />
      <Field label="Type of surprise" hint="Changing the type clears saved surprise details.">
        {(p) => (
          <Select
            value={c.kind}
            onChange={(e) => onChange({ ...c, kind: e.target.value as typeof c.kind })}
            {...p}
          >
            {Object.entries(GIFT_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Switch
        label="Reveal only once"
        description="Only the first device that opens the surprise can see it. Screenshots can’t be prevented."
        checked={c.oneTimeReveal}
        onChange={(oneTimeReveal) => onChange({ ...c, oneTimeReveal })}
      />
      <DateTimeField
        label="Unlock on or after (optional)"
        hint="For birthdays at midnight: everything else can be played, but the gift waits until then."
        value={c.revealAt}
        onChange={(revealAt) => onChange({ ...c, revealAt })}
      />
      <GiftSecretForm key={`${step.key}-${c.kind}`} stepKey={step.key} kind={c.kind} ctx={ctx} />
    </div>
  );
}

/** `<input type="datetime-local">` works in local time without a zone; the API stores ISO. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function DateTimeField({
  label,
  value,
  onChange,
  hint,
  required,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  hint?: string;
  required?: boolean;
}) {
  return (
    <Field
      label={label}
      hint={hint}
      error={required && !value ? 'Required before publishing' : null}
    >
      {(p) => (
        <Input
          type="datetime-local"
          value={toLocalInput(value)}
          onChange={(e) => onChange(fromLocalInput(e.target.value))}
          {...p}
        />
      )}
    </Field>
  );
}

function ButtonLabel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <TextField label="Button label" value={value} maxLength={40} onChange={onChange} />;
}

function CountdownForm({ step, onChange, ctx }: FormProps<'COUNTDOWN'>) {
  const c = step.config;
  return (
    <div className="space-y-4">
      <TextField
        label="Title"
        value={c.title}
        maxLength={120}
        onChange={(title) => onChange({ ...c, title })}
      />
      <DateTimeField
        label="Count down to"
        hint="Shown in the recipient's own time zone."
        value={c.targetAt}
        required
        onChange={(targetAt) => onChange({ ...c, targetAt })}
      />
      <RichTextEditor
        label="Message"
        value={c.message}
        onChange={(message) => onChange({ ...c, message })}
      />
      {ctx.locked ? null : (
        <Switch
          label="Wait for it"
          description="They can only continue once the countdown reaches zero."
          checked={c.waitForIt}
          onChange={(waitForIt) => onChange({ ...c, waitForIt })}
        />
      )}
      <ButtonLabel
        value={c.buttonLabel}
        onChange={(buttonLabel) => onChange({ ...c, buttonLabel })}
      />
    </div>
  );
}

function PuzzleForm({ step, onChange }: FormProps<'PUZZLE'>) {
  const c = step.config;
  return (
    <div className="space-y-4">
      <TextField
        label="Riddle or question"
        value={c.prompt}
        maxLength={300}
        required
        onChange={(prompt) => onChange({ ...c, prompt })}
      />
      <TextField
        label="Answer"
        hint="Checked privately; capitals, accents and punctuation do not matter. The recipient's browser never sees it."
        value={c.answer}
        maxLength={60}
        required
        onChange={(answer) => onChange({ ...c, answer })}
      />
      <TextField
        label="Hint (optional)"
        value={c.hint}
        maxLength={200}
        onChange={(hint) => onChange({ ...c, hint })}
      />
      <TextField
        label="Message for a wrong answer"
        value={c.wrongMessage}
        maxLength={160}
        onChange={(wrongMessage) => onChange({ ...c, wrongMessage })}
      />
      <ButtonLabel
        value={c.buttonLabel}
        onChange={(buttonLabel) => onChange({ ...c, buttonLabel })}
      />
    </div>
  );
}

function GalleryForm({ step, onChange, ctx }: FormProps<'PHOTO_GALLERY'>) {
  const c = step.config;
  const setItems = (items: typeof c.items) => onChange({ ...c, items });
  return (
    <div className="space-y-4">
      <TextField
        label="Title"
        value={c.title}
        maxLength={120}
        onChange={(title) => onChange({ ...c, title })}
      />
      <ol className="space-y-3" data-testid="gallery-items">
        {c.items.map((item, i) => {
          const media = ctx.media.find((m) => m.id === item.mediaId);
          return (
            <li key={item.mediaId} className="space-y-2 rounded-xl p-3 ring-1 ring-ink-100">
              <div className="flex items-center gap-3">
                {media ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.url} alt="" className="size-16 rounded-lg object-cover" />
                ) : null}
                <span className="text-sm font-medium">Photo {i + 1}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setItems(c.items.filter((x) => x.mediaId !== item.mediaId))}
                >
                  Remove
                </Button>
              </div>
              <TextField
                label={`Description of photo ${i + 1} (alt text)`}
                value={item.alt}
                maxLength={250}
                required
                onChange={(alt) =>
                  setItems(c.items.map((x) => (x.mediaId === item.mediaId ? { ...x, alt } : x)))
                }
              />
              <TextField
                label={`Caption for photo ${i + 1}`}
                value={item.caption}
                maxLength={300}
                onChange={(caption) =>
                  setItems(c.items.map((x) => (x.mediaId === item.mediaId ? { ...x, caption } : x)))
                }
              />
            </li>
          );
        })}
      </ol>
      {c.items.length < MAX_GALLERY_ITEMS ? (
        <MediaUpload
          label={c.items.length === 0 ? 'Photos' : 'Add another photo'}
          experienceId={ctx.experienceId}
          value={null}
          media={ctx.media}
          onUploaded={(item) => {
            ctx.addMedia(item);
            setItems([...c.items, { mediaId: item.id, alt: '', caption: '' }]);
          }}
          onClear={() => undefined}
        />
      ) : (
        <p className="text-sm text-ink-600">A gallery holds up to {MAX_GALLERY_ITEMS} photos.</p>
      )}
      <ButtonLabel
        value={c.buttonLabel}
        onChange={(buttonLabel) => onChange({ ...c, buttonLabel })}
      />
    </div>
  );
}

function VoiceNoteForm({ step, onChange, ctx }: FormProps<'VOICE_NOTE'>) {
  const c = step.config;
  return (
    <div className="space-y-4">
      <TextField
        label="Title"
        value={c.title}
        maxLength={120}
        onChange={(title) => onChange({ ...c, title })}
      />
      <MediaUpload
        kind="audio"
        label="Voice note"
        experienceId={ctx.experienceId}
        value={c.mediaId}
        media={ctx.media}
        onUploaded={(item) => {
          ctx.addMedia(item);
          onChange({ ...c, mediaId: item.id });
        }}
        onClear={() => onChange({ ...c, mediaId: null })}
      />
      <Field
        label="Transcript (optional)"
        hint="Lets people read it if they cannot listen right now."
      >
        {(p) => (
          <Textarea
            value={c.transcript}
            maxLength={2000}
            rows={4}
            onChange={(e) => onChange({ ...c, transcript: e.target.value })}
            {...p}
          />
        )}
      </Field>
      <ButtonLabel
        value={c.buttonLabel}
        onChange={(buttonLabel) => onChange({ ...c, buttonLabel })}
      />
    </div>
  );
}

function VideoForm({ step, onChange }: FormProps<'VIDEO'>) {
  const c = step.config;
  const valid = c.url.trim() === '' || parseVideoUrl(c.url) !== null;
  return (
    <div className="space-y-4">
      <TextField
        label="Title"
        value={c.title}
        maxLength={120}
        onChange={(title) => onChange({ ...c, title })}
      />
      <Field
        label="YouTube or Vimeo link"
        hint="Paste the address of the video. It plays inside the surprise; nothing is uploaded."
        error={valid ? null : 'Use a YouTube or Vimeo link that starts with https://'}
      >
        {(p) => (
          <Input
            type="url"
            inputMode="url"
            value={c.url}
            maxLength={300}
            placeholder="https://youtu.be/…"
            onChange={(e) => onChange({ ...c, url: e.target.value })}
            {...p}
          />
        )}
      </Field>
      <TextField
        label="Caption"
        value={c.caption}
        maxLength={300}
        onChange={(caption) => onChange({ ...c, caption })}
      />
      <ButtonLabel
        value={c.buttonLabel}
        onChange={(buttonLabel) => onChange({ ...c, buttonLabel })}
      />
    </div>
  );
}

function PlaceForm({ step, onChange }: FormProps<'PLACE_REVEAL'>) {
  const c = step.config;
  return (
    <div className="space-y-4">
      <TextField
        label="Title"
        value={c.title}
        maxLength={120}
        onChange={(title) => onChange({ ...c, title })}
      />
      <TextField
        label="Place"
        value={c.placeName}
        maxLength={120}
        required
        onChange={(placeName) => onChange({ ...c, placeName })}
      />
      <TextField
        label="Address (optional)"
        hint="Adds an “Open in Maps” link."
        value={c.address}
        maxLength={300}
        onChange={(address) => onChange({ ...c, address })}
      />
      <DateTimeField
        label="When (optional)"
        value={c.when}
        onChange={(when) => onChange({ ...c, when })}
      />
      <TextField
        label="Note (optional)"
        value={c.note}
        maxLength={300}
        onChange={(note) => onChange({ ...c, note })}
      />
      <TextField
        label="Reveal button label"
        value={c.revealLabel}
        maxLength={40}
        onChange={(revealLabel) => onChange({ ...c, revealLabel })}
      />
      <ButtonLabel
        value={c.buttonLabel}
        onChange={(buttonLabel) => onChange({ ...c, buttonLabel })}
      />
    </div>
  );
}

export function StepForm({
  step,
  onChange,
  ctx,
}: {
  step: DraftStep;
  onChange: (config: DraftStep['config']) => void;
  ctx: StepFormContext;
}) {
  switch (step.type) {
    case 'MESSAGE':
      return <MessageForm step={step} onChange={onChange} ctx={ctx} />;
    case 'IMAGE':
      return <ImageForm step={step} onChange={onChange} ctx={ctx} />;
    case 'MULTIPLE_CHOICE':
      return <MultipleChoiceForm step={step} onChange={onChange} ctx={ctx} />;
    case 'YES_NO_CHOICE':
      return <YesNoForm step={step} onChange={onChange} ctx={ctx} />;
    case 'SCRATCH_REVEAL':
      return <ScratchForm step={step} onChange={onChange} ctx={ctx} />;
    case 'COUNTDOWN':
      return <CountdownForm step={step} onChange={onChange} ctx={ctx} />;
    case 'PUZZLE':
      return <PuzzleForm step={step} onChange={onChange} ctx={ctx} />;
    case 'PHOTO_GALLERY':
      return <GalleryForm step={step} onChange={onChange} ctx={ctx} />;
    case 'VOICE_NOTE':
      return <VoiceNoteForm step={step} onChange={onChange} ctx={ctx} />;
    case 'VIDEO':
      return <VideoForm step={step} onChange={onChange} ctx={ctx} />;
    case 'PLACE_REVEAL':
      return <PlaceForm step={step} onChange={onChange} ctx={ctx} />;
    case 'GIFT_REVEAL':
      return <GiftForm step={step} onChange={onChange} ctx={ctx} />;
  }
}
