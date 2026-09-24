'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import type { Passkey } from '@momentpath/contracts';
import { Alert, Button } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import { formatDate } from '@/lib/format';

/** A friendly default name, so the list says "iPhone" rather than an id. */
function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android phone';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  return 'This device';
}

/** WebAuthn errors are mostly "the person cancelled"; say that plainly. */
function friendly(err: unknown, fallback: string): string | null {
  if (err instanceof ApiError) return err.problem.detail ?? err.problem.title;
  const name = (err as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return null; // cancelled
  if (name === 'InvalidStateError') return 'This device already has a passkey for your surprises.';
  return fallback;
}

function useSupported(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection runs only in the browser
  useEffect(() => setSupported(browserSupportsWebAuthn()), []);
  return supported;
}

/** Account page: save a passkey on this device, see and remove saved ones. */
export function PasskeysPanel() {
  const supported = useSupported();
  const [items, setItems] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    try {
      setItems(unwrap(await browserApi().GET('/api/v1/passkeys')).items);
    } catch {
      setItems([]);
    }
  }
  useEffect(() => {
    let live = true;
    browserApi()
      .GET('/api/v1/passkeys')
      .then(
        (r) => live && setItems(r.data?.items ?? []),
        () => live && setItems([]),
      );
    return () => {
      live = false;
    };
  }, []);

  async function add() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const api = browserApi();
      const { challengeId, options } = unwrap(
        await api.POST('/api/v1/passkeys/registration-options'),
      );
      const response = await startRegistration({
        optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
      });
      unwrap(
        await api.POST('/api/v1/passkeys', {
          body: {
            challengeId,
            response: response as unknown as { id: string },
            name: deviceName(),
          },
        }),
      );
      setSaved(true);
      await load();
    } catch (err) {
      setError(friendly(err, 'The passkey could not be saved. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      unwrap(await browserApi().DELETE('/api/v1/passkeys/{id}', { params: { path: { id } } }));
      await load();
    } catch (err) {
      setError(friendly(err, 'The passkey could not be removed.'));
    }
  }

  if (supported === false)
    return (
      <p className="text-sm text-ink-500">
        This browser cannot save passkeys. Use your recovery link below instead.
      </p>
    );

  return (
    <div className="space-y-3" data-testid="passkeys">
      {items && items.length > 0 ? (
        <ul className="divide-y divide-ink-100 rounded-xl ring-1 ring-ink-100">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block font-medium">🔑 {p.name}</span>
                <span className="block text-xs text-ink-500">
                  Added {formatDate(p.createdAt)}
                  {p.lastUsedAt ? ` · last used ${formatDate(p.lastUsedAt)}` : ''}
                  {p.backedUp ? ' · syncs to your other devices' : ''}
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => void remove(p.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button busy={busy} onClick={() => void add()} data-testid="add-passkey">
        {items && items.length > 0 ? 'Add another passkey' : 'Save a passkey'}
      </Button>
      {saved ? (
        <Alert tone="success">
          Saved. On a new phone or computer, choose “Sign in” and confirm with Face ID, Touch ID or
          your screen lock.
        </Alert>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

/** The sign-in button: the browser offers whichever passkey it has for Wish Revealer. */
export function PasskeySignIn() {
  const supported = useSupported();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const { challengeId, options } = unwrap(
        await browserApi().POST('/api/v1/passkeys/login-options'),
      );
      const response = await startAuthentication({
        optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
      });
      const res = await fetch('/auth/passkey', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeId, response }),
      });
      if (!res.ok) {
        setError('That passkey is not recognised here. Was it saved on Wish Revealer?');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(friendly(err, 'Signing in did not work. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  if (supported === false)
    return (
      <Alert tone="warning">
        This browser does not support passkeys. Open your recovery link instead.
      </Alert>
    );
  return (
    <div className="space-y-3">
      <Button busy={busy} onClick={() => void signIn()} data-testid="passkey-sign-in">
        Sign in with a passkey
      </Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
