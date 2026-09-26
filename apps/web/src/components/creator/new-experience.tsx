'use client';

import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_THEME, suggestedDate, type TemplateField } from '@momentpath/contracts';
import { Alert, Button, Dialog, Field, Input } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import { PlusProCompare } from './plus-pro';
import { HANDOVER_MS, LAUNCH_MS, SceneLaunch, type Launch } from './scene-launch';
import { clearStage, setStage } from '@/lib/stage';
import { TemplateCard, type TemplateSummary } from '@/components/site/landing/template-card';
import {
  OccasionChips,
  occasionsOf,
  TemplatePreviewDialog,
} from '@/components/site/landing/template-gallery';

function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialValues(fields: TemplateField[]): Record<string, string> {
  return Object.fromEntries(
    fields.map((f) => [f.key, f.kind === 'datetime' ? toLocalInput(suggestedDate(f.suggest)) : '']),
  );
}

/**
 * The few details a template needs ("Their name", "From", a date). Everything else is ready;
 * the surprise then opens in its preview, where every word, photo and button can be changed.
 */
function PersonaliseSheet({
  template,
  onClose,
  onCreate,
  busy,
  error,
}: {
  template: TemplateSummary | null;
  onClose: () => void;
  onCreate: (values: Record<string, string>) => void;
  busy: boolean;
  error: string | null;
}) {
  const fields = useMemo(() => template?.fields ?? [], [template]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [forKey, setForKey] = useState<string | null>(null);
  // Fresh values (and date suggestions) whenever a different template is opened.
  if (template && forKey !== template.key) {
    setForKey(template.key);
    setValues(initialValues(fields));
  }
  const missing = fields.some((f) => f.required && !(values[f.key] ?? '').trim());

  return (
    <Dialog
      open={template !== null}
      onOpenChange={(open) => !open && onClose()}
      title={template ? `${template.emoji} ${template.name}` : ''}
      description="Just the personal bits to start. Next you will see it exactly as they will."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            busy={busy}
            disabled={missing}
            data-testid="personalise-create"
            onClick={() =>
              onCreate(
                Object.fromEntries(
                  fields.map((f) => {
                    const v = (values[f.key] ?? '').trim();
                    return [f.key, f.kind === 'datetime' && v ? new Date(v).toISOString() : v];
                  }),
                ),
              )
            }
          >
            Continue
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        data-testid="personalise-form"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {fields.map((f) => (
          <Field
            key={f.key}
            label={`${f.label}${f.required ? '' : ' (optional)'}`}
            hint={f.kind === 'datetime' ? 'In your time zone.' : undefined}
          >
            {(p) => (
              <Input
                {...p}
                type={f.kind === 'datetime' ? 'datetime-local' : 'text'}
                value={values[f.key] ?? ''}
                maxLength={f.maxLength}
                placeholder={f.kind === 'text' ? `e.g. ${f.placeholder}` : undefined}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            )}
          </Field>
        ))}
        <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
          💡 Next: tap any words, photos or buttons in the preview to change them, pick the music,
          and put a real e-gift code (Amazon, Flipkart, Swiggy, Zomato…) in the final surprise.
        </p>
      </form>
    </Dialog>
  );
}

export interface InProgress {
  id: string;
  templateKey: string | null;
  mode: 'TEMPLATE' | 'CUSTOM';
  title: string;
  editedAt: string;
}

/** A template's own work in progress, or the one built from scratch. */
const SCRATCH = '__scratch';
const originOf = (item: InProgress) => item.templateKey ?? SCRATCH;

function editedAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  if (minutes < 60 * 24) return rtf.format(-Math.round(minutes / 60), 'hour');
  return rtf.format(-Math.round(minutes / (60 * 24)), 'day');
}

const pathOf = (item: InProgress) =>
  `/experiences/${item.id}/${item.mode === 'TEMPLATE' ? 'personalize' : 'edit'}`;

/**
 * Create Experience. Browsing is free: opening a template and leaving it unchanged leaves
 * nothing behind. Once something is changed it is kept — at most one per template plus one
 * from scratch — and coming back to that template asks "Continue, or start over?".
 */
export function NewExperience({
  templates,
  initialTemplate,
  inProgress: initialInProgress = [],
}: {
  templates: TemplateSummary[];
  initialTemplate?: string;
  /** This browser's changed-but-unpublished surprises, newest first. */
  inProgress?: InProgress[];
}) {
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const [inProgress, setInProgress] = useState<InProgress[]>(initialInProgress);
  // Newest first, so the first one per origin is the one to continue.
  const byOrigin = useMemo(() => {
    const map = new Map<string, InProgress>();
    for (const item of inProgress) if (!map.has(originOf(item))) map.set(originOf(item), item);
    return map;
  }, [inProgress]);
  const linked = templates.find((t) => t.key === initialTemplate) ?? null;
  const linkedWork = linked ? (byOrigin.get(linked.key) ?? null) : null;
  const [personalising, setPersonalising] = useState<TemplateSummary | null>(
    linked && !linkedWork && linked.fields.length > 0 ? linked : null,
  );
  // "You've already started this one": the work, and the template to start fresh (null: scratch).
  const [resume, setResume] = useState<{
    item: InProgress;
    template: TemplateSummary | null;
  } | null>(linked && linkedWork ? { item: linkedWork, template: linked } : null);
  const [discarding, setDiscarding] = useState(false);
  // The bloom into the chosen template while the surprise is prepared (see SceneLaunch).
  const [launch, setLaunch] = useState<Launch | null>(null);
  // Back from a surprise's stage: the page fades home to the site's own colours.
  useEffect(() => clearStage(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [occasion, setOccasion] = useState('All');
  const [preview, setPreview] = useState<TemplateSummary | null>(null);
  const occasions = useMemo(() => occasionsOf(templates), [templates]);
  // Free templates first, so trying one costs nothing and is easy to find.
  const ordered = useMemo(
    () => [...templates].sort((a, b) => Number(a.tier !== 'FREE') - Number(b.tier !== 'FREE')),
    [templates],
  );
  const shown = occasion === 'All' ? ordered : ordered.filter((t) => t.occasion === occasion);

  /**
   * Grows the tapped card into the template's world (SceneLaunch) and sets the page's stage to
   * the same colours, so the next page opens on them. Resolves when the bloom has played.
   */
  function beginLaunch(template: TemplateSummary | null): Promise<void> {
    const card = document.querySelector(
      `[data-testid="${template ? `template-${template.key}` : 'create-from-scratch'}"]`,
    );
    const box = card?.getBoundingClientRect();
    const visible = box && box.bottom > 0 && box.top < window.innerHeight;
    // From scratch opens the builder on the default look, so the bloom lands on it too.
    const palette = template?.theme.palette ?? DEFAULT_THEME.palette;
    setLaunch({
      emoji: template?.emoji ?? '✏️',
      palette,
      fromColor: template ? palette.background : '#2a1830',
      label: template ? template.name : 'Your own experience',
      from: visible ? { top: box.top, left: box.left, width: box.width, height: box.height } : null,
    });
    setStage(palette);
    return new Promise((r) => window.setTimeout(r, reduced ? 250 : LAUNCH_MS));
  }

  /** The title fades as the next page is fetched; the stage colour carries across. */
  function handOver(path: string) {
    setLaunch((l) => (l ? { ...l, leaving: true } : l));
    window.setTimeout(() => router.push(path), reduced ? 0 : HANDOVER_MS);
  }

  async function create(templateKey: string | null, fields?: Record<string, string>) {
    setBusy(templateKey ?? 'blank');
    setError(null);
    const chosen = templateKey ? (templates.find((t) => t.key === templateKey) ?? null) : null;
    setPersonalising(null);
    const bloom = beginLaunch(chosen);
    try {
      const exp = unwrap(
        await browserApi().POST('/api/v1/experiences', {
          body: { templateKey, ...(fields ? { fields } : {}) },
        }),
      );
      // Templates are personalised in their preview; a blank start opens the PRO builder.
      await bloom;
      handOver(`/experiences/${exp.id}/${templateKey ? 'personalize' : 'edit'}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.problem.issues?.[0]?.message ?? err.problem.detail ?? err.problem.title)
          : 'Could not create the experience.',
      );
      setLaunch(null);
      clearStage();
      setBusy(null);
    }
  }

  /** Start over: that template's earlier work is deleted, then it starts fresh. */
  async function startOver() {
    if (!resume) return;
    setDiscarding(true);
    try {
      unwrap(
        await browserApi().DELETE('/api/v1/experiences/{id}', {
          params: {
            path: { id: resume.item.id },
            header: { 'Idempotency-Key': crypto.randomUUID() },
          },
        }),
      );
      setInProgress((items) => items.filter((i) => i.id !== resume.item.id));
      const { template } = resume;
      setResume(null);
      if (template) startTemplate(template);
      else void create(null);
    } catch {
      setError('That surprise could not be removed. Please try again.');
      setResume(null);
    } finally {
      setDiscarding(false);
    }
  }

  // Templates with personal details open the sheet; the rest are created straight away.
  const startTemplate = (t: TemplateSummary) => {
    setPreview(null);
    if (t.fields.length > 0) {
      setError(null);
      setPersonalising(t);
    } else {
      void create(t.key);
    }
  };
  /** Only a template (or scratch) with its own changed work asks anything. */
  const open = (template: TemplateSummary | null) => {
    setPreview(null);
    const item = byOrigin.get(template?.key ?? SCRATCH);
    if (item) setResume({ item, template });
    else if (template) startTemplate(template);
    else void create(null);
  };
  const use = (t: TemplateSummary) => open(t);
  const scratchWork = byOrigin.get(SCRATCH) ?? null;

  return (
    <div className="mt-6 space-y-5">
      {error && !personalising ? <Alert tone="danger">{error}</Alert> : null}

      <motion.button
        type="button"
        onClick={() => open(null)}
        disabled={busy !== null}
        data-testid="create-from-scratch"
        whileHover={reduced ? undefined : { y: -3 }}
        whileTap={reduced ? undefined : { scale: 0.985 }}
        className="group relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-ink-950 via-ink-900 to-[#6b2349] p-5 text-left text-white shadow-lg shadow-ink-900/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60 sm:p-6"
      >
        {/* Decorative: soft light and a few floating pieces of what you can build. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-rose-300/25 blur-2xl"
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          {[
            ['🧩', 'right-6 top-5 text-3xl', 0],
            ['✨', 'right-4 top-24 text-xl', 0.6],
            ['🎁', 'right-8 bottom-16 text-2xl', 1.2],
          ].map(([glyph, place, delay]) => (
            <motion.span
              key={glyph as string}
              className={`absolute ${place as string} drop-shadow`}
              animate={reduced ? undefined : { y: [0, -6, 0], rotate: [0, 6, 0] }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: delay as number,
              }}
            >
              {glyph}
            </motion.span>
          ))}
        </span>
        <span className="relative block max-w-[16rem] sm:max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full bg-gold-300/20 px-2.5 py-1 text-[11px] font-bold tracking-widest text-gold-200 ring-1 ring-gold-300/40 backdrop-blur">
            PRO
          </span>
          <span className="mt-3 block font-display text-3xl leading-tight font-semibold">
            Create from Scratch
          </span>
          <span className="mt-1 block text-sm text-white/85">
            Your idea, your way — build a surprise step by step.
          </span>
        </span>
        <span className="relative mt-4 flex flex-wrap gap-1.5 text-xs font-medium">
          {['＋ Any steps', '🧭 Your own flow', '🎨 Your own look'].map((f) => (
            <span key={f} className="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20">
              {f}
            </span>
          ))}
        </span>
        <span className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-white/85" suppressHydrationWarning>
            {scratchWork ? `✎ In progress · edited ${editedAgo(scratchWork.editedAt)}` : ''}
          </span>
          <span className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-ink-900 shadow-md transition group-hover:gap-3">
            {busy === 'blank' ? 'Creating…' : scratchWork ? 'Continue building' : 'Start building'}
            <span aria-hidden="true">→</span>
          </span>
        </span>
      </motion.button>
      <h2 className="pt-2 text-lg font-semibold">
        Or pick a ready-made template{' '}
        <span className="font-sans text-sm font-normal text-ink-500">
          — personalise it with PLUS
        </span>
      </h2>
      <OccasionChips occasions={occasions} value={occasion} onChange={setOccasion} />
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t) => {
          const work = byOrigin.get(t.key);
          return (
            <li key={t.key}>
              <TemplateCard
                template={t}
                busy={busy !== null}
                onSelect={() => use(t)}
                progress={work ? `In progress · edited ${editedAgo(work.editedAt)}` : null}
                hint={
                  busy === t.key
                    ? 'Creating…'
                    : work
                      ? 'Continue →'
                      : t.tier === 'FREE'
                        ? `${t.stepCount} steps · Try it free`
                        : `${t.stepCount} steps · Use Template`
                }
                action={
                  <button
                    type="button"
                    className="w-full rounded-2xl bg-black/5 px-4 py-2.5 text-sm font-semibold"
                    onClick={() => setPreview(t)}
                  >
                    ▶ Play demo
                  </button>
                }
              />
            </li>
          );
        })}
      </ul>
      <PlusProCompare className="mx-auto max-w-2xl" />
      <TemplatePreviewDialog
        template={preview}
        onClose={() => setPreview(null)}
        action={(t) => <Button onClick={() => use(t)}>Use Template</Button>}
      />
      <Dialog
        open={resume !== null}
        onOpenChange={(o) => !o && setResume(null)}
        title="You’ve already started this one"
        description={
          resume
            ? `“${resume.item.title || 'Untitled surprise'}” · edited ${editedAgo(resume.item.editedAt)}. Carry on where you left off, or start it fresh?`
            : ''
        }
        footer={
          <>
            <Button
              variant="secondary"
              busy={discarding}
              data-testid="start-over"
              onClick={() => void startOver()}
            >
              Start over
            </Button>
            <Button
              data-testid="continue-in-progress"
              onClick={() => {
                if (!resume) return;
                const path = pathOf(resume.item);
                setResume(null);
                void beginLaunch(resume.template).then(() => handOver(path));
              }}
            >
              Continue
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Starting over removes your changes to this one. Your other surprises stay as they are.
        </p>
      </Dialog>
      {launch ? <SceneLaunch launch={launch} /> : null}
      <PersonaliseSheet
        template={personalising}
        busy={busy !== null}
        error={personalising ? error : null}
        onClose={() => setPersonalising(null)}
        onCreate={(values) => personalising && create(personalising.key, values)}
      />
    </div>
  );
}
