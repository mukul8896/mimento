'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { suggestedDate, type TemplateField } from '@momentpath/contracts';
import { Alert, Button, Dialog, Field, Input } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
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
 * the surprise opens in the editor afterwards, where anything can still be changed.
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
      description="Just the personal bits — you can change anything later."
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
            Create my surprise
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
          💡 Make it yours: in the editor you can add a photo gallery, a voice note or a video, and
          put a real e-gift code (Amazon, Flipkart, Swiggy, Zomato…) in the final surprise.
        </p>
      </form>
    </Dialog>
  );
}

export function NewExperience({
  templates,
  initialTemplate,
}: {
  templates: TemplateSummary[];
  initialTemplate?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [occasion, setOccasion] = useState('All');
  const [personalising, setPersonalising] = useState<TemplateSummary | null>(
    () => templates.find((t) => t.key === initialTemplate && t.fields.length > 0) ?? null,
  );
  const [preview, setPreview] = useState<TemplateSummary | null>(null);
  const occasions = useMemo(() => occasionsOf(templates), [templates]);
  const shown = occasion === 'All' ? templates : templates.filter((t) => t.occasion === occasion);

  async function create(templateKey: string | null, fields?: Record<string, string>) {
    setBusy(templateKey ?? 'blank');
    setError(null);
    try {
      const exp = unwrap(
        await browserApi().POST('/api/v1/experiences', {
          body: { templateKey, ...(fields ? { fields } : {}) },
        }),
      );
      router.push(`/experiences/${exp.id}/edit`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.problem.issues?.[0]?.message ?? err.problem.detail ?? err.problem.title)
          : 'Could not create the experience.',
      );
      setBusy(null);
    }
  }

  // Templates with personal details open the sheet; the rest are created straight away.
  const use = (t: TemplateSummary) => {
    setPreview(null);
    if (t.fields.length > 0) {
      setError(null);
      setPersonalising(t);
    } else {
      void create(t.key);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      {error && !personalising ? <Alert tone="danger">{error}</Alert> : null}
      <OccasionChips occasions={occasions} value={occasion} onChange={setOccasion} />
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t) => (
          <li key={t.key}>
            <TemplateCard
              template={t}
              busy={busy !== null}
              onSelect={() => use(t)}
              hint={busy === t.key ? 'Creating…' : `${t.stepCount} steps · Use this template`}
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
        ))}
        <li>
          <button
            type="button"
            onClick={() => create(null)}
            disabled={busy !== null}
            className="flex h-full min-h-48 w-full flex-col rounded-3xl border-2 border-dashed border-ink-200 p-5 text-left hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-60"
          >
            <span className="text-3xl" aria-hidden="true">
              ✏️
            </span>
            <span className="mt-2 font-semibold">
              Blank
              <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
                Custom
              </span>
            </span>
            <span className="mt-1 text-sm text-ink-600">
              Start with an empty sequence and add your own steps.
            </span>
            <span className="mt-auto pt-3 text-xs text-ink-500">
              {busy === 'blank' ? 'Creating…' : 'Start from scratch'}
            </span>
          </button>
        </li>
      </ul>
      <TemplatePreviewDialog
        template={preview}
        onClose={() => setPreview(null)}
        action={(t) => <Button onClick={() => use(t)}>Use this template</Button>}
      />
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
