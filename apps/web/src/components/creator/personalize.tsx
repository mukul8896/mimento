'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  COVER_KINDS,
  MUSIC_LIBRARY,
  RECORDED_LIBRARY,
  STEP_TYPES,
  type Cover,
  type DraftDocument,
  type PublicExperience,
  type StepType,
} from '@momentpath/contracts';
import type { Schemas } from '@momentpath/api-client';
import { Alert, Button, cx, Dialog, Field, Input, Switch } from '@momentpath/design-system';
import { Player } from '@/components/player/player';
import { Stage } from './stage';
import { EmojiPicker } from '@/components/editor/emoji-picker';
import { coverOf } from '@/components/player/motion/cover';
import { PencilIcon } from '@/components/player/editable';
import { PreviewBackend } from '@/components/player/preview-backend';
import type { MediaItem } from '@/components/editor/media-upload';
import { FlowView } from '@/components/editor/flow-view';
import { HistoryDialog } from '@/components/editor/history-dialog';
import {
  canAdd,
  canDuplicate,
  editorReducer,
  STEP_TYPE_HINT,
  STEP_TYPE_LABEL,
} from '@/components/editor/reducer';
import { RouteEditor } from '@/components/editor/route-editor';
import { StepForm, type StepFormContext } from '@/components/editor/step-forms';
import { MusicPicker, ThemePanel } from '@/components/editor/theme-panel';
import { useAutosave, type SaveStatus } from '@/components/editor/use-autosave';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import {
  browserSignals,
  formatPrice,
  looksIndian,
  suggestedProvider,
  TIER_NAME,
} from '@/lib/payments';
import { AccessPanel, formatOpensAt, type Access } from './access-panel';
import { PlusProCompare } from './plus-pro';
import { PublishFlow } from './publish-flow';

type Detail = Schemas['ExperienceDetailDto_Output'];
type Options = Schemas['CheckoutOptionsResponseDto_Output'];
type Sheet =
  | 'step'
  | 'music'
  | 'cover'
  | 'name'
  | 'delivery'
  | 'pro'
  | 'add'
  | 'flow'
  | 'look'
  | 'history'
  | null;

const STEP_ICON: Record<StepType, string> = {
  MESSAGE: '💌',
  IMAGE: '🖼️',
  MULTIPLE_CHOICE: '❓',
  YES_NO_CHOICE: '💞',
  SCRATCH_REVEAL: '🪄',
  COUNTDOWN: '⏳',
  PUZZLE: '🧩',
  PHOTO_GALLERY: '📸',
  VOICE_NOTE: '🎙️',
  VIDEO: '🎬',
  PLACE_REVEAL: '📍',
  GIFT_REVEAL: '🎁',
};

const SAVE_TEXT: Record<SaveStatus, string> = {
  saved: 'Saved',
  pending: 'Saving…',
  saving: 'Saving…',
  error: 'Not saved',
  conflict: 'Changed elsewhere',
};

/**
 * The form control for a tapped element: `field` is the visible label of its input, or its
 * aria-label. Null when nothing matches, so the whole step is shown instead of a guess.
 */
function controlFor(root: HTMLElement, field: string): HTMLElement | null {
  const label = [...root.querySelectorAll('label')].find((l) => l.textContent?.trim() === field);
  if (label?.htmlFor) {
    const byFor = document.getElementById(label.htmlFor);
    if (byFor) return byFor;
  }
  // Labels that wrap their own control, and rich-text editors labelled by a heading.
  const inside = label?.querySelector<HTMLElement>('input, textarea, select, button');
  if (inside) return inside;
  const byAria = root.querySelector<HTMLElement>(`[aria-label="${CSS.escape(field)}"]`);
  if (byAria) return byAria;
  const heading = [...root.querySelectorAll<HTMLElement>('span, legend, p')].find(
    (el) => el.textContent?.trim() === field,
  );
  return (
    heading?.parentElement?.querySelector<HTMLElement>(
      'input, textarea, [contenteditable="true"], button',
    ) ?? null
  );
}

/**
 * Tap-to-edit shows just the tapped field, so the sheet stays short and the preview above it
 * shows the change as it is typed. Other fields of the step are one tap away ("Show all").
 * Returns false when the field could not be found, and then shows everything.
 */
function showOnly(root: HTMLElement, field: string): boolean {
  const form = root.firstElementChild as HTMLElement | null;
  const target = controlFor(root, field);
  if (!form || !target) return false;
  const owner = [...form.children].find((child) => child.contains(target));
  if (!owner) return false;
  for (const child of form.children) {
    if (child === owner) child.removeAttribute('data-focus-hide');
    else child.setAttribute('data-focus-hide', '');
  }
  target.scrollIntoView({ block: 'nearest' });
  target.focus({ preventScroll: true });
  return true;
}

function showAll(root: HTMLElement) {
  root.querySelectorAll('[data-focus-hide]').forEach((el) => el.removeAttribute('data-focus-hide'));
}

type CoverKind = Cover['kind'];

const COVER_ICON: Record<CoverKind, string> = { ENVELOPE: '✉️', GIFT: '🎁', GLOW: '✨' };
const COVER_NAME: Record<CoverKind, string> = {
  ENVELOPE: 'Envelope',
  GIFT: 'Gift box',
  GLOW: 'Glowing light',
};
const COVER_HINT: Record<CoverKind, string> = {
  ENVELOPE: 'A sealed letter — for love, thanks and heartfelt words',
  GIFT: 'A wrapped present — for birthdays and celebrations',
  GLOW: 'A light that blooms — for festivals and big nights',
};

/** Choose how the surprise is opened: the style, and the emoji on the seal, box or light. */
function CoverPicker({ cover, onChange }: { cover: Cover; onChange: (next: Cover) => void }) {
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Cover style" className="grid gap-2">
        {COVER_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={cover.kind === kind}
            data-testid={`cover-${kind}`}
            onClick={() => onChange({ ...cover, kind })}
            className={cx(
              'flex min-h-16 items-center gap-3 rounded-2xl p-3 text-left transition',
              cover.kind === kind
                ? 'bg-brand-50 ring-2 ring-brand-600'
                : 'bg-white ring-1 ring-ink-100 hover:ring-brand-300',
            )}
          >
            <span aria-hidden="true" className="text-2xl">
              {COVER_ICON[kind]}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-ink-900">{COVER_NAME[kind]}</span>
              <span className="block text-sm text-ink-600">{COVER_HINT[kind]}</span>
            </span>
          </button>
        ))}
      </div>
      <Field
        label="Line on the cover"
        hint="A teaser — keep the first step’s words for the reveal."
      >
        {(p) => (
          <Input
            value={cover.line ?? ''}
            maxLength={80}
            placeholder="A letter, sealed just for you"
            data-testid="cover-line-input"
            onChange={(e) => onChange({ ...cover, line: e.target.value })}
            {...p}
          />
        )}
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-800">Emoji on it</p>
        <EmojiPicker
          label="Emoji on the cover"
          value={cover.emoji}
          testId="cover-emoji"
          onChange={(emoji) => onChange({ ...cover, emoji })}
        />
        <p className="mt-1.5 text-xs text-ink-600">Shown on the seal, the box or in the light.</p>
      </div>
    </div>
  );
}

function Row({
  icon,
  title,
  value,
  onClick,
  testId,
}: {
  icon: string;
  title: string;
  value?: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:outline-none"
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink-900">{title}</span>
        {value ? <span className="block truncate text-sm text-ink-600">{value}</span> : null}
      </span>
      <span className="shrink-0 text-lg text-ink-400" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink-100">
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-semibold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-600">{subtitle}</p> : null}
      </div>
      <div className="divide-y divide-ink-100">{children}</div>
    </section>
  );
}

/**
 * One editor for both levels. PLUS: a ready-made template, personalised right inside its own
 * preview. PRO (built from scratch, or a template customised with PRO) is the same screen with
 * the building tools switched on: add, move, duplicate and delete steps, branching, the flow
 * map, the look and version history.
 *
 * PLUS details: a ready-made template, personalised right inside its own preview. The structure stays
 * as designed (the API enforces it); words, photos, button labels, music and the gift change.
 * Preview → Personalize → Delivery & Privacy → Publish all live on this one page, with Publish
 * always in reach and a clear way into PRO for people who want to change the experience itself.
 */
export function Personalize({ draft, detail }: { draft: DraftDocument; detail: Detail }) {
  const router = useRouter();
  // PRO: the structure is the creator's own (the API enforces the difference too).
  const pro = draft.mode === 'CUSTOM';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, dispatch] = useReducer(editorReducer, {
    title: draft.title,
    theme: draft.theme,
    settings: draft.settings,
    steps: draft.steps,
    selectedKey: draft.steps[0]?.key ?? null,
  });
  const [media, setMedia] = useState<MediaItem[]>(draft.media);
  const [secrets, setSecrets] = useState<Record<string, boolean>>(
    Object.fromEntries(draft.gifts.map((g) => [g.stepKey, g.hasSecret])),
  );
  const [mode, setMode] = useState<'edit' | 'play'>('edit');
  const [run, setRun] = useState(0);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [focus, setFocus] = useState<string | null>(null);
  // True while the step sheet shows only the tapped field.
  const [single, setSingle] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [access, setAccess] = useState<Access>(detail.access);
  const [live, setLive] = useState(detail.status === 'PUBLISHED');
  const [options, setOptions] = useState<Options | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [customizeError, setCustomizeError] = useState<string | null>(null);
  const sheetBody = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLOListElement>(null);

  const content = useMemo(
    () => ({
      title: state.title,
      theme: state.theme,
      settings: state.settings,
      steps: state.steps,
    }),
    [state.title, state.theme, state.settings, state.steps],
  );
  const { status, message, flush } = useAutosave(draft.experienceId, content, draft.revision);

  const steps = state.steps;
  const index = Math.max(
    0,
    steps.findIndex((s) => s.key === state.selectedKey),
  );
  const current = steps[index] ?? null;

  // What publishing costs, shown next to the Publish button from the start.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = unwrap(
          await browserApi().GET('/api/v1/experiences/{id}/checkout', {
            params: { path: { id: draft.experienceId } },
          }),
        );
        if (!cancelled) setOptions(res);
      } catch {
        /* the price is shown again in the publish sheet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.experienceId]);

  const offer = useMemo(() => {
    if (!options?.billingEnabled || options.tier.satisfied) return null;
    const provider = suggestedProvider(options.offers, looksIndian(browserSignals()));
    return options.offers.find((o) => o.provider === provider) ?? null;
  }, [options]);

  const tierRequired = detail.tier.required;
  // Never says "free" for a paid surprise: while the price loads, or if it cannot be loaded,
  // it names the level and leaves the price to the publish sheet.
  const tierName = TIER_NAME[tierRequired];
  const free = tierRequired === 'FREE';
  const priceLabel = free
    ? 'Free to share'
    : !options
      ? tierName
      : !options.billingEnabled
        ? `${tierName} · free for now`
        : options.tier.satisfied
          ? `${tierName} · paid ✓`
          : offer
            ? `${tierName} · ${formatPrice(offer.amountMinor, offer.currency)}`
            : `${tierName} · price at checkout`;
  const priceHint = live
    ? 'Live · publish to share changes'
    : free || options?.tier.satisfied || options?.billingEnabled === false
      ? 'No payment needed'
      : 'Review everything before paying';

  // The preview opens on the chosen step while personalising; Play runs it from the start.
  const experience: PublicExperience = useMemo(
    () => ({
      title: state.title,
      theme: state.theme,
      versionNumber: 0,
      responsesVisibleToCreator: state.settings.responseVisibility === 'FULL',
      // The creator sees the ending their recipient will: the invitation only on free ones.
      branded: detail.tier.required === 'FREE',
      steps,
      media,
    }),
    [state.title, state.theme, state.settings, steps, media, detail.tier.required],
  );
  const startKey = mode === 'edit' ? (current?.key ?? null) : null;
  const backend = useMemo(
    () =>
      new PreviewBackend(
        experience,
        'Preview: the gift you add is revealed here — only to them.',
        startKey,
      ),
    [experience, startKey],
  );

  const ctx: StepFormContext = {
    experienceId: draft.experienceId,
    media,
    addMedia: (item) => setMedia((m) => [...m.filter((x) => x.id !== item.id), item]),
    flush,
    hasGiftSecret: (key) => secrets[key] === true,
    setGiftSecretSaved: (key, saved) => setSecrets((s) => ({ ...s, [key]: saved })),
    locked: !pro,
  };

  function addStep(stepType: StepType) {
    const key = crypto.randomUUID();
    dispatch({ type: 'add', stepType, key });
    setFocus(null);
    setSingle(false);
    setMode('edit');
    setSheet('step');
  }

  function removeCurrent() {
    if (!current) return;
    const neighbour = steps[index + 1] ?? steps[index - 1] ?? null;
    dispatch({ type: 'remove', key: current.key });
    dispatch({ type: 'select', key: neighbour?.key ?? null });
    setConfirmDelete(false);
    setSheet(null);
  }

  // The opening cover comes before step 1: selecting it shows the cover in the preview.
  const [coverSelected, setCoverSelected] = useState(false);
  const cover = coverOf(state.theme);
  const showCover = useCallback(() => {
    setCoverSelected(true);
    setMode('edit');
    strip.current?.querySelector('li')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, []);

  const goTo = useCallback(
    (key: string) => {
      setCoverSelected(false);
      dispatch({ type: 'select', key });
      setConfirmDelete(false);
      setMode('edit');
      const i = steps.findIndex((s) => s.key === key);
      const chips = strip.current?.querySelectorAll('li');
      chips?.[i]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    },
    [steps],
  );

  const onEdit = useCallback((stepKey: string, field: string) => {
    dispatch({ type: 'select', key: stepKey });
    setFocus(field);
    setSingle(true);
    setSheet('step');
  }, []);

  // Once the sheet is on screen: just the tapped field, with the cursor in it.
  useEffect(() => {
    if (sheet !== 'step' || !focus) return;
    const timer = setTimeout(() => {
      const root = sheetBody.current;
      if (root && !showOnly(root, focus)) setSingle(false);
    }, 60);
    return () => clearTimeout(timer);
  }, [sheet, focus]);

  async function customize() {
    setCustomizing(true);
    setCustomizeError(null);
    try {
      if (!(await flush())) throw new Error('Your latest changes could not be saved yet.');
      unwrap(
        await browserApi().POST('/api/v1/experiences/{id}/customize', {
          params: { path: { id: draft.experienceId } },
        }),
      );
      router.push(`/experiences/${draft.experienceId}/edit`);
    } catch (err) {
      setCustomizeError(
        err instanceof ApiError
          ? (err.problem.detail ?? err.problem.title)
          : (err as Error).message,
      );
      setCustomizing(false);
    }
  }

  const music = state.theme.music;
  const musicName =
    music.source === 'LIBRARY'
      ? `${MUSIC_LIBRARY[music.track].emoji} ${MUSIC_LIBRARY[music.track].name}`
      : music.source === 'RECORDED'
        ? `${RECORDED_LIBRARY[music.track].emoji} ${RECORDED_LIBRARY[music.track].name}`
        : music.source === 'UPLOAD'
          ? '🎤 Your own song'
          : 'No music';
  const stepName = (i: number) => `Step ${i + 1} · ${STEP_TYPE_LABEL[steps[i]!.type]}`;
  const templateName = detail.template?.name ?? 'Template';

  const publishButton = (testId: string, className = '') => (
    <Button
      size="lg"
      className={cx('shrink-0', className)}
      onClick={() => setPublishing(true)}
      disabled={status === 'conflict'}
      data-testid={testId}
    >
      {live ? 'Publish changes' : 'Publish'}
      <span aria-hidden="true">→</span>
    </Button>
  );

  return (
    <div
      className="mx-auto max-w-6xl px-4 pt-3 pb-36 sm:px-6 lg:pb-12"
      data-testid={pro ? 'builder' : 'personalize'}
    >
      <Stage palette={state.theme.palette} />
      {/* Top bar: where you are and that your work is safe */}
      <div className="flex items-center gap-2">
        <Link
          href="/new"
          aria-label="Back to templates"
          className="wr-on-stage -ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-lg text-ink-600 hover:bg-ink-100"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="wr-on-stage-muted flex items-center gap-2 text-xs font-medium text-ink-500">
            <span
              className={cx(
                'rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest text-white',
                pro ? 'bg-ink-900' : 'bg-brand-600',
              )}
            >
              {pro ? 'PRO' : tierRequired === 'FREE' ? 'FREE' : 'PLUS'}
            </span>
            <span className="truncate">
              {pro
                ? detail.template
                  ? `From ${detail.template.name}`
                  : 'Built from scratch'
                : templateName}
            </span>
          </p>
          <h1 className="wr-on-stage truncate text-lg font-semibold leading-tight">
            {state.title || 'Your surprise'}
          </h1>
        </div>
        <span
          role="status"
          aria-live="polite"
          data-testid="save-status"
          data-status={status}
          className={cx(
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
            status === 'error' || status === 'conflict'
              ? 'bg-red-50 text-red-800'
              : 'bg-emerald-50 text-emerald-800',
          )}
        >
          {status === 'saved' ? '✓ ' : ''}
          {SAVE_TEXT[status]}
        </span>
      </div>
      {status === 'error' || status === 'conflict' ? (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {message}{' '}
          {status === 'conflict' ? (
            <button type="button" className="underline" onClick={() => window.location.reload()}>
              Reload
            </button>
          ) : null}
        </p>
      ) : null}

      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-8">
        {/* Preview: the real experience, edited in place */}
        <section aria-label="Preview" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <div
            role="group"
            aria-label="Preview mode"
            className="wr-stage-track grid grid-cols-2 gap-1 rounded-2xl bg-ink-100 p-1"
          >
            {(
              [
                ['edit', pro ? 'Edit' : 'Personalize'],
                ['play', 'Play it'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                data-testid={`mode-${m}`}
                onClick={() => {
                  setMode(m);
                  setRun((r) => r + 1);
                }}
                className={cx(
                  'min-h-11 rounded-xl text-sm font-semibold transition',
                  mode === m ? 'bg-white text-ink-900 shadow-sm' : 'wr-on-stage text-ink-600',
                )}
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  {m === 'edit' ? (
                    <PencilIcon className="size-4" />
                  ) : (
                    <span aria-hidden="true">▶</span>
                  )}
                  {label}
                </span>
              </button>
            ))}
          </div>
          <p
            className="wr-on-stage-muted mt-1.5 text-center text-xs text-ink-600 sm:mt-2 sm:text-sm"
            aria-live="polite"
          >
            {mode === 'edit' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 font-medium text-ink-700 ring-1 ring-ink-100 sm:gap-2 sm:bg-white sm:px-3 sm:py-1 sm:shadow-sm">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-brand-600 text-white sm:size-5">
                  <PencilIcon className="size-2.5 sm:size-3" />
                </span>
                Tap a pencil to edit
              </span>
            ) : (
              'This is exactly what they will see. Nothing is recorded.'
            )}
          </p>

          <div className="mx-auto mt-3 w-full max-w-[400px]">
            <div
              className="wr-stage-frame h-[min(600px,68dvh)] overflow-hidden rounded-[2rem] bg-white shadow-xl ring-[6px] ring-ink-900"
              data-testid="preview"
            >
              {steps.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-brand-50 to-white p-6 text-center">
                  <p className="text-5xl" aria-hidden="true">
                    ✨
                  </p>
                  <p className="text-lg font-semibold">Your surprise starts here</p>
                  <p className="text-sm text-ink-600">
                    Add a first step — a message, a photo, a question — and it appears right here.
                  </p>
                  <Button size="lg" onClick={() => setSheet('add')} data-testid="add-first-step">
                    ＋ Add your first step
                  </Button>
                </div>
              ) : (
                <div className="h-full overflow-y-auto overscroll-contain">
                  <Player
                    key={`${run}-${mode}-${coverSelected && mode === 'edit' ? 'cover' : 'steps'}`}
                    backend={backend}
                    initialTheme={state.theme}
                    embedded
                    hideIntro
                    onEdit={mode === 'edit' ? onEdit : undefined}
                    onEditCover={
                      mode === 'edit' && coverSelected ? () => setSheet('cover') : undefined
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* Steps: to move around while personalising. The order itself is fixed. */}
          <nav aria-label="Steps" className="mt-3 flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous step"
              disabled={coverSelected && mode === 'edit'}
              onClick={() => (index > 0 ? goTo(steps[index - 1]!.key) : showCover())}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm ring-1 ring-ink-100 disabled:opacity-40"
            >
              ‹
            </button>
            <ol
              ref={strip}
              className="flex min-w-0 flex-1 snap-x gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]"
            >
              <li className="snap-center">
                <button
                  type="button"
                  aria-label="Opening cover"
                  aria-current={coverSelected && mode === 'edit' ? 'step' : undefined}
                  data-testid="cover-chip"
                  onClick={showCover}
                  className={cx(
                    'inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3 text-sm font-semibold transition',
                    coverSelected && mode === 'edit'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white text-ink-700 ring-1 ring-ink-100',
                  )}
                >
                  <span aria-hidden="true">{COVER_ICON[cover.kind]}</span>
                  <span aria-hidden="true">Cover</span>
                </button>
              </li>
              {steps.map((s, i) => (
                <li key={s.key} className="snap-center">
                  <button
                    type="button"
                    aria-label={`${stepName(i)}${s.next ? ' (branches)' : ''}`}
                    aria-current={
                      i === index && mode === 'edit' && !coverSelected ? 'step' : undefined
                    }
                    onClick={() => goTo(s.key)}
                    className={cx(
                      'inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3 text-sm font-semibold transition',
                      i === index && mode === 'edit' && !coverSelected
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-white text-ink-700 ring-1 ring-ink-100',
                    )}
                  >
                    <span aria-hidden="true">{STEP_ICON[s.type]}</span>
                    <span aria-hidden="true">{i + 1}</span>
                    {s.next ? (
                      <span aria-hidden="true" className="text-xs opacity-80">
                        ↳
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
              {pro ? (
                <li className="snap-center">
                  <button
                    type="button"
                    aria-label="Add a step"
                    data-testid="add-step"
                    onClick={() => setSheet('add')}
                    className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border-2 border-dashed border-brand-300 px-3 text-lg font-bold text-brand-700 transition hover:bg-brand-50 active:scale-95"
                  >
                    ＋
                  </button>
                </li>
              ) : null}
            </ol>
            <button
              type="button"
              aria-label="Next step"
              disabled={!(coverSelected && mode === 'edit') && index >= steps.length - 1}
              onClick={() =>
                coverSelected && mode === 'edit'
                  ? steps[0] && goTo(steps[0].key)
                  : current && index < steps.length - 1 && goTo(steps[index + 1]!.key)
              }
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm ring-1 ring-ink-100 disabled:opacity-40"
            >
              ›
            </button>
          </nav>
          <p
            className="wr-on-stage-muted mt-1 text-center text-xs text-ink-500"
            data-testid="step-position"
          >
            {coverSelected && mode === 'edit'
              ? 'Opening cover — before step 1'
              : current
                ? `${stepName(index)} of ${steps.length}`
                : ''}
          </p>
        </section>

        {/* Personalize → Delivery & Privacy → PRO → Publish */}
        <div className="min-w-0 space-y-4">
          <Section
            title={pro ? 'Build' : 'Personalize'}
            subtitle={
              pro
                ? 'Tap ✎ in the preview, or build it step by step.'
                : 'Make it theirs — the steps stay as designed.'
            }
          >
            {coverSelected && mode === 'edit' ? (
              <Row
                icon="✏️"
                title="Edit the cover"
                value="What they tap to open it"
                testId="edit-step"
                onClick={() => setSheet('cover')}
              />
            ) : current ? (
              <Row
                icon="✏️"
                title="Edit this step"
                value={stepName(index)}
                testId="edit-step"
                onClick={() => {
                  setFocus(null);
                  setSingle(false);
                  setSheet('step');
                }}
              />
            ) : null}
            {pro ? (
              <>
                <Row
                  icon="➕"
                  title="Add a step"
                  value={`${steps.length} of 30 steps`}
                  testId="build-add"
                  onClick={() => setSheet('add')}
                />
                <Row
                  icon="🧭"
                  title="Flow"
                  value="See the whole journey, and where answers lead"
                  testId="build-flow"
                  onClick={() => setSheet('flow')}
                />
                <Row
                  icon="🎨"
                  title="Look & feel"
                  value="Colours, font, animation, sounds, celebration"
                  testId="build-look"
                  onClick={() => setSheet('look')}
                />
              </>
            ) : null}
            <Row
              icon="🎵"
              title="Music"
              value={musicName}
              testId="edit-music"
              onClick={() => setSheet('music')}
            />
            <Row
              icon={COVER_ICON[cover.kind]}
              title="Opening cover"
              value={`${COVER_NAME[cover.kind]} · ${cover.emoji}`}
              testId="edit-cover"
              onClick={() => {
                showCover();
                setSheet('cover');
              }}
            />
            <Row
              icon="🏷️"
              title="Private label · only you see this"
              value={state.title || 'Untitled surprise'}
              testId="edit-name"
              onClick={() => setSheet('name')}
            />
            {pro ? (
              <Row
                icon="🕘"
                title="History"
                value="Go back to a version you published"
                testId="build-history"
                onClick={async () => {
                  await flush();
                  setSheet('history');
                }}
              />
            ) : null}
          </Section>

          <Section title="Delivery & Privacy" subtitle="When it opens and who can open it.">
            <Row
              icon="⏰"
              title="Opens at"
              value={access.opensAt ? formatOpensAt(access.opensAt) : 'Right away'}
              testId="edit-opens-at"
              onClick={() => setSheet('delivery')}
            />
            <Row
              icon="🔒"
              title="PIN"
              value={access.hasPin ? 'On — they need it to open' : 'Off'}
              testId="edit-pin"
              onClick={() => setSheet('delivery')}
            />
            <Row
              icon="🔗"
              title="Short link"
              value={access.slug ? `/p/${access.slug}` : access.hasPin ? 'Not set' : 'Needs a PIN'}
              testId="edit-short-link"
              onClick={() => setSheet('delivery')}
            />
          </Section>

          {/* Desktop: Publish sits right after the settings, above the PRO offer */}
          <div className="hidden rounded-3xl bg-white p-5 shadow-lg ring-1 ring-ink-100 lg:block">
            <p className="text-sm text-ink-600">
              {live ? 'It’s live. Publish again to share your changes.' : 'Happy with it?'}
            </p>
            <p className="mt-1 text-lg font-semibold" data-testid="price-label-desktop">
              {priceLabel}
            </p>
            {publishButton('publish-side', 'mt-3 w-full')}
            <p className="mt-2 text-center text-xs text-ink-500">
              You review everything before paying.
            </p>
          </div>

          {pro ? null : (
            <section
              className="rounded-3xl bg-gradient-to-br from-ink-900 to-ink-800 p-5 text-white shadow-sm"
              data-testid="pro-card"
            >
              <p className="text-xs font-bold tracking-widest text-brand-200">PRO</p>
              <h2 className="mt-1 text-lg font-semibold">Want to change the experience itself?</h2>
              <p className="mt-1 text-sm text-ink-200">
                Add steps, remove steps, change the flow, or create something completely different
                with PRO.
              </p>
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={() => setSheet('pro')}
                data-testid="customize-with-pro"
              >
                Customize with PRO
              </Button>
            </section>
          )}
        </div>
      </div>

      {/* Mobile: Publish is always one thumb away */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,15,21,0.06)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" data-testid="price-label">
              {priceLabel}
            </p>
            <p className="truncate text-xs text-ink-500">{priceHint}</p>
          </div>
          {publishButton('publish')}
        </div>
      </div>

      {/* Sheets */}
      <Dialog
        side
        open={sheet === 'step' && current !== null}
        onOpenChange={(o) => !o && setSheet(null)}
        title={current ? (single && focus ? focus : stepName(index)) : 'Step'}
        description={
          single
            ? 'Watch it change in the preview. It saves by itself.'
            : 'Changes show in the preview straight away and save by themselves.'
        }
        autoFocus={false}
        lightOverlay={single}
        footer={
          <>
            {single ? (
              <Button
                variant="secondary"
                data-testid="show-all-fields"
                onClick={() => {
                  if (sheetBody.current) showAll(sheetBody.current);
                  setSingle(false);
                }}
              >
                Show all of this step
              </Button>
            ) : null}
            <Button onClick={() => setSheet(null)} data-testid="step-done">
              Done
            </Button>
          </>
        }
      >
        {pro && current && !single ? (
          <div className="mb-4 space-y-2" data-testid="step-tools">
            <div className="grid grid-cols-4 gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                className="flex-col gap-0 py-1.5 text-xs"
                aria-label="Move step earlier"
                disabled={index === 0}
                onClick={() => dispatch({ type: 'move', key: current.key, direction: -1 })}
              >
                <span aria-hidden="true">←</span>Earlier
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-col gap-0 py-1.5 text-xs"
                aria-label="Move step later"
                disabled={index >= steps.length - 1}
                onClick={() => dispatch({ type: 'move', key: current.key, direction: 1 })}
              >
                <span aria-hidden="true">→</span>Later
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-col gap-0 py-1.5 text-xs"
                disabled={!canDuplicate(current) || !canAdd(state, current.type)}
                onClick={() => {
                  dispatch({ type: 'duplicate', key: current.key, newKey: crypto.randomUUID() });
                }}
              >
                <span aria-hidden="true">⧉</span>Duplicate
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-col gap-0 py-1.5 text-xs text-danger-700"
                onClick={() => setConfirmDelete(true)}
              >
                <span aria-hidden="true">🗑</span>Delete
              </Button>
            </div>
            {confirmDelete ? (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-2 text-sm ring-1 ring-red-200">
                <span className="flex-1 text-red-900">Delete this step?</span>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={removeCurrent}
                  data-testid="confirm-delete-step"
                >
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div ref={sheetBody}>
          {current ? (
            <StepForm
              key={current.key}
              step={current}
              ctx={ctx}
              onChange={(config) => dispatch({ type: 'update', key: current.key, config })}
            />
          ) : null}
        </div>
        {pro && current && !single ? (
          <div className="mt-6 border-t border-ink-100 pt-6">
            <RouteEditor
              step={current}
              steps={steps}
              onChange={(next) => dispatch({ type: 'route', key: current.key, next })}
            />
          </div>
        ) : null}
      </Dialog>

      <Dialog
        side
        open={sheet === 'music'}
        autoFocus={false}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Music"
        description="Tap ▶ to listen. It starts when they first tap, and they can mute it."
        footer={<Button onClick={() => setSheet(null)}>Done</Button>}
      >
        <MusicPicker
          theme={state.theme}
          onTheme={(theme) => dispatch({ type: 'setTheme', theme })}
          ctx={ctx}
        />
      </Dialog>

      <Dialog
        side
        open={sheet === 'cover'}
        autoFocus={false}
        lightOverlay
        onOpenChange={(o) => !o && setSheet(null)}
        title="Opening cover"
        description="What they tap to open it. That tap also starts the music from the very first step."
        footer={<Button onClick={() => setSheet(null)}>Done</Button>}
      >
        <CoverPicker
          cover={cover}
          onChange={(next) =>
            dispatch({ type: 'setTheme', theme: { ...state.theme, cover: next } })
          }
        />
      </Dialog>

      <Dialog
        side
        open={sheet === 'name'}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Private label"
        description="Only you see this — it helps you find this surprise on your success page, your management page and the details you save. They never see it."
        footer={<Button onClick={() => setSheet(null)}>Done</Button>}
      >
        <Field label="Label for this surprise (just for you)">
          {(p) => (
            <Input
              value={state.title}
              maxLength={120}
              onChange={(e) => dispatch({ type: 'setTitle', title: e.target.value })}
              {...p}
            />
          )}
        </Field>
      </Dialog>

      <Dialog
        side
        open={sheet === 'delivery'}
        autoFocus={false}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Delivery & Privacy"
        description="Each setting saves on its own. You can change them after publishing too."
        footer={<Button onClick={() => setSheet(null)}>Done</Button>}
      >
        <div className="space-y-6">
          <AccessPanel
            experienceId={draft.experienceId}
            initial={access}
            bare
            onChange={setAccess}
          />
          <div className="border-t border-ink-100 pt-5">
            <Switch
              label="👀 Show me each answer"
              description={
                state.settings.responseVisibility === 'FULL'
                  ? 'They are told their answers are shared with you.'
                  : 'You see totals only, not individual answers.'
              }
              checked={state.settings.responseVisibility === 'FULL'}
              onChange={(on) =>
                dispatch({
                  type: 'setSettings',
                  settings: { responseVisibility: on ? 'FULL' : 'AGGREGATE_ONLY' },
                })
              }
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        side
        open={sheet === 'pro'}
        autoFocus={false}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Customize with PRO"
        description="Change the experience itself, not just what it says."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSheet(null)}>
              Stay with {tierRequired === 'FREE' ? 'this template' : 'PLUS'}
            </Button>
            <Button busy={customizing} onClick={customize} data-testid="confirm-customize">
              Customize with PRO
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <PlusProCompare />
          <ul className="space-y-2 text-sm text-ink-700">
            <li className="flex gap-2">
              <span aria-hidden="true">✓</span>
              Everything you have personalised comes with you.
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">✓</span>
              The original template stays exactly as it is — this becomes your own version.
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">✓</span>
              You pay when you publish, after you have seen it all.
            </li>
            <li className="flex gap-2 text-ink-500">
              <span aria-hidden="true">ⓘ</span>
              This surprise stays a PRO build from then on.
            </li>
          </ul>
          {customizeError ? <Alert tone="danger">{customizeError}</Alert> : null}
        </div>
      </Dialog>

      <Dialog
        side
        open={sheet === 'add'}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Add a step"
        description="It goes before the final surprise. You can move it afterwards."
        autoFocus={false}
      >
        <div className="grid gap-2 sm:grid-cols-2" data-testid="step-types">
          {STEP_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              disabled={!canAdd(state, t)}
              onClick={() => addStep(t)}
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-ink-200 transition hover:ring-brand-400 active:scale-[0.98] disabled:opacity-40"
            >
              <span className="text-2xl" aria-hidden="true">
                {STEP_ICON[t]}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{STEP_TYPE_LABEL[t]}</span>
                <span className="block text-xs text-ink-600">{STEP_TYPE_HINT[t]}</span>
              </span>
            </button>
          ))}
        </div>
      </Dialog>

      <Dialog
        side
        open={sheet === 'flow'}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Flow"
        description="Tap a step to edit it. On a computer, drag from one step to another to choose where it leads."
        className="sm:max-w-3xl"
        autoFocus={false}
        footer={<Button onClick={() => setSheet(null)}>Done</Button>}
      >
        {sheet === 'flow' ? (
          <FlowView
            steps={steps}
            selectedKey={current?.key ?? null}
            onSelect={(key) => {
              goTo(key);
              setFocus(null);
              setSingle(false);
              setSheet('step');
            }}
            onConnect={(source, target) => {
              const step = steps.find((x) => x.key === source);
              dispatch({
                type: 'route',
                key: source,
                next: { rules: step?.next?.rules ?? [], otherwise: target },
              });
            }}
          />
        ) : null}
      </Dialog>

      <Dialog
        side
        open={sheet === 'look'}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Look & feel"
        description="Changes show in the preview straight away."
        autoFocus={false}
        lightOverlay
        footer={<Button onClick={() => setSheet(null)}>Done</Button>}
      >
        <ThemePanel
          theme={state.theme}
          settings={state.settings}
          onTheme={(theme) => dispatch({ type: 'setTheme', theme })}
          onSettings={(settings) => dispatch({ type: 'setSettings', settings })}
          ctx={ctx}
        />
      </Dialog>

      <HistoryDialog
        experienceId={draft.experienceId}
        open={sheet === 'history'}
        onOpenChange={(o) => !o && setSheet(null)}
      />

      <PublishFlow
        experienceId={draft.experienceId}
        open={publishing}
        onOpenChange={setPublishing}
        flush={flush}
        stepCount={steps.length}
        access={access}
        onFixStep={(key) => {
          goTo(key);
          setFocus(null);
          setSingle(false);
          setSheet('step');
        }}
        onEditDelivery={() => setSheet('delivery')}
        stepLabel={(key) => {
          const i = steps.findIndex((s) => s.key === key);
          return i >= 0 ? stepName(i) : 'Step';
        }}
        onPublished={() => setLive(true)}
      />
    </div>
  );
}
