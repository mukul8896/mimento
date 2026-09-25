'use client';

import { useState } from 'react';
import type { Schemas } from '@momentpath/api-client';
import { Alert, Button, Card, Field, Input } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';

export type Access = Schemas['AccessSettingsDto_Output'];

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatOpensAt(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

function Saved({ show }: { show: boolean }) {
  return show ? (
    <span role="status" className="self-center text-sm font-medium text-emerald-700">
      ✓ Saved
    </span>
  ) : null;
}

/**
 * Scheduled opening, PIN and short link for one surprise. Every rule (a short link needs a PIN,
 * names are unique, PINs are 4–8 digits) is enforced by the API; this only collects input.
 * `bare` drops the card so it can sit inside the Personalize page's Delivery & Privacy sheet.
 */
export function AccessPanel({
  experienceId,
  initial,
  bare = false,
  onChange,
}: {
  experienceId: string;
  initial: Access;
  bare?: boolean;
  onChange?: (access: Access) => void;
}) {
  const [access, setAccess] = useState(initial);
  const [opensAt, setOpensAt] = useState(toLocalInput(initial.opensAt));
  const [pin, setPin] = useState('');
  const [slug, setSlug] = useState(initial.slug ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ section: string; message: string } | null>(null);
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
      onChange?.(next);
    } catch (err) {
      setError({
        section: name,
        message:
          err instanceof ApiError
            ? (err.problem.issues?.[0]?.message ?? err.problem.detail ?? err.problem.title)
            : 'Something went wrong. Please try again.',
      });
    } finally {
      setBusy(null);
    }
  }

  const problem = (section: string) =>
    error?.section === section ? <Alert tone="danger">{error.message}</Alert> : null;

  // Relative while rendering (the server has no window); made absolute when copied.
  const shortPath = access.slug ? `/p/${access.slug}` : null;
  const buttons = 'grid gap-2 sm:flex sm:flex-wrap';

  const body = (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby={`${experienceId}-opens`}>
        <div>
          <h3 id={`${experienceId}-opens`} className="font-semibold">
            ⏰ Opens at
          </h3>
          <p className="mt-1 text-sm text-ink-600">
            {access.opensAt
              ? `Opens ${formatOpensAt(access.opensAt)}. Until then they see a countdown and nothing else.`
              : 'Opens as soon as they get the link. Pick a time to make them wait for it — they see a countdown until then.'}
          </p>
        </div>
        <Field label="Opening date and time (optional)">
          {(p) => (
            <Input
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              {...p}
            />
          )}
        </Field>
        {problem('opening')}
        <div className={buttons}>
          <Button
            busy={busy === 'opening'}
            disabled={opensAt === toLocalInput(access.opensAt)}
            onClick={() =>
              save('opening', { opensAt: opensAt ? new Date(opensAt).toISOString() : null })
            }
          >
            Save opening time
          </Button>
          {access.opensAt ? (
            <Button
              variant="secondary"
              onClick={() => {
                setOpensAt('');
                void save('opening', { opensAt: null });
              }}
            >
              Open now
            </Button>
          ) : null}
          <Saved show={saved === 'opening'} />
        </div>
      </section>

      <section
        className="space-y-3 border-t border-ink-100 pt-5"
        aria-labelledby={`${experienceId}-pin`}
      >
        <div>
          <h3 id={`${experienceId}-pin`} className="font-semibold">
            🔒 PIN {access.hasPin ? <span className="text-emerald-700">· On</span> : null}
          </h3>
          <p className="mt-1 text-sm text-ink-600">
            They type it before anything is shown, even the title. Ten wrong tries lock the surprise
            for 15 minutes, then they can try again.
          </p>
        </div>
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
          Share the PIN separately from the link.
        </p>
        <Field label={access.hasPin ? 'New PIN' : 'PIN'} hint="4 to 8 digits">
          {(p) => (
            <Input
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 2412"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              {...p}
            />
          )}
        </Field>
        {problem('pin')}
        <div className={buttons}>
          <Button
            busy={busy === 'pin'}
            disabled={!/^\d{4,8}$/.test(pin)}
            onClick={() => save('pin', { pin })}
          >
            {access.hasPin ? 'Change PIN' : 'Set PIN'}
          </Button>
          {access.hasPin ? (
            <Button variant="secondary" onClick={() => save('pin', { pin: null })}>
              Remove PIN
            </Button>
          ) : null}
          <Saved show={saved === 'pin'} />
        </div>
      </section>

      <section
        className="space-y-3 border-t border-ink-100 pt-5"
        aria-labelledby={`${experienceId}-slug`}
      >
        <div>
          <h3 id={`${experienceId}-slug`} className="font-semibold">
            🔗 Short link
          </h3>
          <p className="mt-1 text-sm text-ink-600">
            An easy address to write on a card, like wishrevealer.com/p/happy-birthday-priya.
          </p>
        </div>
        <p className="rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700 ring-1 ring-ink-100">
          Anyone could guess this address, so a short link only works together with a PIN.
        </p>
        <Field
          label="Short link name"
          hint={access.hasPin ? 'Letters, numbers and dashes.' : 'Set a PIN first.'}
        >
          {(p) => (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-ink-500">/p/</span>
              <Input
                placeholder="happy-birthday-priya"
                autoCapitalize="none"
                autoComplete="off"
                maxLength={40}
                value={slug}
                disabled={!access.hasPin}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                {...p}
              />
            </div>
          )}
        </Field>
        {problem('slug')}
        <div className={buttons}>
          <Button
            busy={busy === 'slug'}
            disabled={!access.hasPin || slug.trim() === '' || slug === access.slug}
            onClick={() => save('slug', { slug })}
          >
            Save link
          </Button>
          {access.slug ? (
            <Button variant="secondary" onClick={() => save('slug', { slug: null })}>
              Remove link
            </Button>
          ) : null}
          <Saved show={saved === 'slug'} />
        </div>
        {shortPath ? (
          <div className="flex gap-2 rounded-xl bg-brand-50 p-2 ring-1 ring-brand-100">
            <Input
              readOnly
              value={shortPath}
              aria-label="Short link"
              data-testid="short-link"
              className="bg-white"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
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
    </div>
  );

  if (bare) return <div data-testid="access-panel">{body}</div>;
  return (
    <Card data-testid="access-panel">
      <h2 className="mb-4 font-semibold">Delivery & Privacy</h2>
      {body}
    </Card>
  );
}
