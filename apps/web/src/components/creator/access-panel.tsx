'use client';

import { useState } from 'react';
import type { Schemas } from '@momentpath/api-client';
import { Alert, Button, Card, Field, Input } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';

type Access = Schemas['AccessSettingsDto_Output'];

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Scheduled opening, PIN and short link for one surprise. Every rule (a short link needs a PIN,
 * names are unique, PINs are 4–8 digits) is enforced by the API; this only collects input.
 */
export function AccessPanel({ experienceId, initial }: { experienceId: string; initial: Access }) {
  const [access, setAccess] = useState(initial);
  const [opensAt, setOpensAt] = useState(toLocalInput(initial.opensAt));
  const [pin, setPin] = useState('');
  const [slug, setSlug] = useState(initial.slug ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function save(name: string, body: Schemas['UpdateAccessRequestDto']) {
    setBusy(name);
    setError(null);
    setSaved(null);
    try {
      const next = unwrap(
        await browserApi().PUT('/api/v1/experiences/{id}/access', {
          params: { path: { id: experienceId } },
          body,
        }),
      );
      setAccess(next);
      setSlug(next.slug ?? '');
      setPin('');
      setSaved(name);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.problem.issues?.[0]?.message ?? err.problem.detail ?? err.problem.title)
          : 'Something went wrong.',
      );
    } finally {
      setBusy(null);
    }
  }

  // Relative while rendering (the server has no window); made absolute when copied.
  const shortPath = access.slug ? `/p/${access.slug}` : null;

  return (
    <Card data-testid="access-panel">
      <h2 className="font-semibold">Opening, PIN and short link</h2>
      {error ? (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      <section className="mt-4 space-y-2">
        <Field
          label="Opens at (optional)"
          hint="Before this, the link shows a countdown and nothing can be opened."
        >
          {(p) => (
            <Input
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              {...p}
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            busy={busy === 'opening'}
            onClick={() =>
              save('opening', { opensAt: opensAt ? new Date(opensAt).toISOString() : null })
            }
          >
            Save opening time
          </Button>
          {access.opensAt ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpensAt('');
                void save('opening', { opensAt: null });
              }}
            >
              Open now
            </Button>
          ) : null}
          {saved === 'opening' ? (
            <span role="status" className="self-center text-sm text-emerald-700">
              Saved
            </span>
          ) : null}
        </div>
      </section>

      <section className="mt-6 space-y-2 border-t border-ink-100 pt-4">
        <h3 className="text-sm font-medium">PIN {access.hasPin ? '(set)' : '(none)'}</h3>
        <p className="text-sm text-ink-600">
          Recipients enter it before anything is shown, even the title. Ten wrong tries lock the
          surprise for 15 minutes. Tell them the PIN separately from the link.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label={access.hasPin ? 'New PIN' : 'PIN'}
            inputMode="numeric"
            placeholder="4–8 digits"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
          <Button
            size="sm"
            busy={busy === 'pin'}
            disabled={!/^\d{4,8}$/.test(pin)}
            onClick={() => save('pin', { pin })}
          >
            {access.hasPin ? 'Change PIN' : 'Set PIN'}
          </Button>
          {access.hasPin ? (
            <Button size="sm" variant="ghost" onClick={() => save('pin', { pin: null })}>
              Remove PIN
            </Button>
          ) : null}
        </div>
        {saved === 'pin' ? (
          <p role="status" className="text-sm text-emerald-700">
            Saved
          </p>
        ) : null}
      </section>

      <section className="mt-6 space-y-2 border-t border-ink-100 pt-4">
        <h3 className="text-sm font-medium">Short link</h3>
        <p className="text-sm text-ink-600">
          An easy address to write on a card. Anyone could guess it, so it only works with the PIN.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-sm text-ink-500">/p/</span>
          <Input
            aria-label="Short link name"
            placeholder="priya-birthday"
            maxLength={40}
            value={slug}
            disabled={!access.hasPin}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
          <Button
            size="sm"
            busy={busy === 'slug'}
            disabled={!access.hasPin || slug.trim() === '' || slug === access.slug}
            onClick={() => save('slug', { slug })}
          >
            Save link
          </Button>
          {access.slug ? (
            <Button size="sm" variant="ghost" onClick={() => save('slug', { slug: null })}>
              Remove
            </Button>
          ) : null}
        </div>
        {!access.hasPin ? <p className="text-xs text-ink-500">Set a PIN first.</p> : null}
        {shortPath ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={shortPath} aria-label="Short link" data-testid="short-link" />
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}${shortPath}`);
                setCopied(true);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        ) : null}
      </section>
    </Card>
  );
}
