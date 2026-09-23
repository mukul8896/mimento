'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';

type Tier = 'FREE' | 'PLUS' | 'PRO';

interface Template {
  key: string;
  name: string;
  description: string;
  stepCount: number;
  tier: Tier;
}

const TIER_LABEL: Record<Tier, string | null> = {
  FREE: null,
  PLUS: 'Plus',
  PRO: 'Custom',
};

/** Shown on the card so the price is visible before someone invests time building. */
function TierBadge({ tier }: { tier: Tier }) {
  const label = TIER_LABEL[tier];
  if (!label) return null;
  return (
    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
      {label}
    </span>
  );
}

export function NewExperience({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(templateKey: string | null) {
    setBusy(templateKey ?? 'blank');
    setError(null);
    try {
      const exp = unwrap(await browserApi().POST('/api/v1/experiences', { body: { templateKey } }));
      router.push(`/experiences/${exp.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : 'Could not create the experience.');
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <ul className="grid gap-4 sm:grid-cols-2">
        {templates.map((t) => (
          <li key={t.key}>
            <button
              type="button"
              onClick={() => create(t.key)}
              disabled={busy !== null}
              className="flex h-full w-full flex-col rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-ink-100 transition hover:ring-brand-300 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-60"
            >
              <span className="font-semibold">
                {t.name}
                <TierBadge tier={t.tier} />
              </span>
              <span className="mt-1 text-sm text-ink-600">{t.description}</span>
              <span className="mt-3 text-xs text-ink-500">
                {busy === t.key ? 'Creating…' : `${t.stepCount} steps · Use this template`}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => create(null)}
            disabled={busy !== null}
            className="flex h-full w-full flex-col rounded-2xl border-2 border-dashed border-ink-200 p-5 text-left hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-60"
          >
            <span className="font-semibold">
              Blank
              <TierBadge tier="PRO" />
            </span>
            <span className="mt-1 text-sm text-ink-600">
              Start with an empty sequence and add your own steps.
            </span>
            <span className="mt-3 text-xs text-ink-500">
              {busy === 'blank' ? 'Creating…' : 'Start from scratch'}
            </span>
          </button>
        </li>
      </ul>
    </div>
  );
}
