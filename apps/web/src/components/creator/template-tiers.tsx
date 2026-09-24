'use client';

import { useState } from 'react';
import type { Schemas } from '@momentpath/api-client';
import { Alert, Card, Select, Switch } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';

type Template = Schemas['AdminTemplateListResponseDto_Output']['items'][number];
type Tier = Template['tier'];

const TIER_LABEL: Record<Tier, string> = {
  FREE: 'Free',
  PLUS: 'Plus (paid)',
  PRO: 'Custom (paid)',
};

/**
 * The operator decides which ready-made templates are free or paid, and which are shown.
 * Changes apply immediately and survive deploys (the seed never overwrites them). Paid tiers
 * only take effect while BILLING_ENABLED is on.
 */
export function TemplateTiers({ initial }: { initial: Template[] }) {
  const [templates, setTemplates] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function update(key: string, change: { tier?: Tier; isActive?: boolean }) {
    setError(null);
    const before = templates;
    setTemplates((ts) => ts.map((t) => (t.key === key ? { ...t, ...change } : t)));
    try {
      unwrap(
        await browserApi().PUT('/api/v1/admin/templates/{key}', {
          params: { path: { key } },
          body: change,
        }),
      );
    } catch (err) {
      setTemplates(before);
      setError(err instanceof ApiError ? err.problem.title : 'Could not save the change.');
    }
  }

  return (
    <Card data-testid="template-tiers">
      <h2 className="font-semibold">Templates: free or paid</h2>
      <p className="mt-1 text-sm text-ink-600">
        Applies straight away and is kept across deploys. Paid tiers only apply while billing is on.
        Hidden templates disappear from the gallery; surprises already made from them keep working.
      </p>
      {error ? (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-ink-100">
        {templates.map((t) => (
          <li key={t.key} className="flex flex-wrap items-center gap-3 py-3">
            <span className="text-xl" aria-hidden="true">
              {t.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{t.name}</span>
              <span className="text-xs text-ink-500">{t.occasion}</span>
            </span>
            <Select
              aria-label={`Tier for ${t.name}`}
              value={t.tier}
              onChange={(e) => void update(t.key, { tier: e.target.value as Tier })}
              className="w-40"
            >
              {(Object.keys(TIER_LABEL) as Tier[]).map((tier) => (
                <option key={tier} value={tier}>
                  {TIER_LABEL[tier]}
                </option>
              ))}
            </Select>
            <Switch
              label="Shown"
              checked={t.isActive}
              onChange={(isActive) => void update(t.key, { isActive })}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
