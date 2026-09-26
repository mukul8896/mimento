'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { PublicExperience } from '@momentpath/contracts';
import { Alert, Dialog } from '@momentpath/design-system';
import { browserApi, unwrap } from '@/lib/api/browser';
import { PhoneDemo } from '@/components/player/phone-demo';
import { TemplateCard, type TemplateSummary } from './template-card';

export function occasionsOf(templates: TemplateSummary[]): string[] {
  return [...new Set(templates.map((t) => t.occasion))];
}

export function OccasionChips({
  occasions,
  value,
  onChange,
}: {
  occasions: string[];
  value: string;
  onChange: (occasion: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Occasions"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {['All', ...occasions].map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${value === o ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-ink-200 hover:ring-ink-400'}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** Loads a template's playable preview and shows it in a phone frame. */
export function TemplatePreviewDialog({
  template,
  onClose,
  action,
}: {
  template: TemplateSummary | null;
  onClose: () => void;
  action: (t: TemplateSummary) => React.ReactNode;
}) {
  const [loaded, setLoaded] = useState<{ key: string; experience: PublicExperience } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const key = template?.key ?? null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    browserApi()
      .GET('/api/v1/templates/{key}/preview', { params: { path: { key } } })
      .then((res) => {
        const p = unwrap(res);
        if (!cancelled) {
          setLoaded({
            key,
            experience: {
              ...p,
              versionNumber: 0,
              responsesVisibleToCreator: false,
              branded: false,
            } as PublicExperience,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(key);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  const error = failed !== null && failed === key ? 'This demo could not be loaded.' : null;

  return (
    <Dialog
      open={template !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={template ? `${template.emoji} ${template.name}` : ''}
      description="Play it like the recipient would. Nothing is saved."
      className="sm:max-w-md"
      footer={template ? action(template) : null}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {template && loaded?.key === template.key ? (
        <PhoneDemo experience={loaded.experience} label={`${template.name} demo`} />
      ) : !error ? (
        <p className="py-10 text-center text-sm text-ink-500" role="status">
          Loading the demo…
        </p>
      ) : null}
    </Dialog>
  );
}

/** Landing-page gallery: every template is playable before anyone creates anything. */
export function TemplateGallery({ templates }: { templates: TemplateSummary[] }) {
  const [occasion, setOccasion] = useState('All');
  const [preview, setPreview] = useState<TemplateSummary | null>(null);
  const occasions = useMemo(() => occasionsOf(templates), [templates]);
  // Free templates first: the easiest way to try it.
  const ordered = useMemo(
    () => [...templates].sort((a, b) => Number(a.tier !== 'FREE') - Number(b.tier !== 'FREE')),
    [templates],
  );
  const shown = occasion === 'All' ? ordered : ordered.filter((t) => t.occasion === occasion);
  const use = (t: TemplateSummary) => (
    <Link
      href={`/new?template=${encodeURIComponent(t.key)}`}
      className="block w-full rounded-2xl bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white shadow hover:bg-brand-700"
    >
      Use Template
    </Link>
  );

  return (
    <section id="templates" aria-labelledby="templates-heading" className="py-12">
      <h2 id="templates-heading" className="text-3xl font-bold tracking-tight text-ink-900">
        Ready-made for every moment
      </h2>
      <p className="mt-2 text-ink-600">
        Tap any card to play it first. Then make it theirs — change the words, photos and music
        right in the preview — and publish.
      </p>
      <div className="mt-5">
        <OccasionChips occasions={occasions} value={occasion} onChange={setOccasion} />
      </div>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="template-gallery">
        {shown.map((t) => (
          <li key={t.key}>
            <TemplateCard
              template={t}
              onSelect={() => setPreview(t)}
              hint="▶ Tap to play"
              action={use(t)}
            />
          </li>
        ))}
      </ul>
      <TemplatePreviewDialog template={preview} onClose={() => setPreview(null)} action={use} />
    </section>
  );
}
