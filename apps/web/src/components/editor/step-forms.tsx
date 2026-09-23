'use client';

import {
  NO_BUTTON_LIMITS,
  type DraftStep,
  type NoButtonConfig,
  type StepConfigOf,
  type StepType,
} from '@momentpath/contracts';
import { Alert, Button, Field, Input, Select, Switch } from '@momentpath/design-system';
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

function MultipleChoiceForm({ step, onChange }: FormProps<'MULTIPLE_CHOICE'>) {
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
        {c.options.map((o, i) => (
          <div key={o.id} className="flex items-center gap-2">
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
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove answer ${i + 1}`}
              disabled={c.options.length <= 2}
              onClick={() => setOptions(c.options.filter((x) => x.id !== o.id))}
            >
              ✕
            </Button>
          </div>
        ))}
        {c.options.length < 6 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setOptions([
                ...c.options,
                { id: `option-${crypto.randomUUID().slice(0, 8)}`, label: '' },
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

function YesNoForm({ step, onChange }: FormProps<'YES_NO_CHOICE'>) {
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
      <Switch
        label="Show a Maybe option"
        checked={c.maybeEnabled}
        onChange={(maybeEnabled) => onChange({ ...c, maybeEnabled })}
      />
      {c.maybeEnabled ? (
        <TextField
          label="Maybe label"
          value={c.maybeLabel}
          maxLength={40}
          onChange={(maybeLabel) => onChange({ ...c, maybeLabel })}
        />
      ) : null}
      <fieldset>
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
      {c.noButton.mode === 'AFTER_ATTEMPTS' ? (
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
      {c.noButton.mode === 'AFTER_DELAY' ? (
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
      <GiftSecretForm key={`${step.key}-${c.kind}`} stepKey={step.key} kind={c.kind} ctx={ctx} />
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
    case 'GIFT_REVEAL':
      return <GiftForm step={step} onChange={onChange} ctx={ctx} />;
  }
}
