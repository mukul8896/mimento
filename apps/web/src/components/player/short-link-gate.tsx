'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import { PinGate } from './access-screens';
import { rememberSession } from './api-backend';

type GateCode = 'PIN_REQUIRED' | 'PIN_INCORRECT' | 'PIN_LOCKED';

export function ShortLinkGate({ slug }: { slug: string }) {
  const router = useRouter();
  const [code, setCode] = useState<GateCode>('PIN_REQUIRED');
  const [lockedUntil, setLockedUntil] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function open(pin: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = unwrap(
        await browserApi().POST('/api/v1/public/links/{slug}/sessions', {
          params: { path: { slug } },
          body: { pin },
        }),
      );
      // Continue on the private link with the session already started, so no second PIN.
      rememberSession(res.shareToken, res.sessionToken);
      router.replace(`/e/${res.shareToken}`);
    } catch (err) {
      const problem = err instanceof ApiError ? err.problem : null;
      if (problem?.code === 'PIN_LOCKED') {
        setCode('PIN_LOCKED');
        setLockedUntil(problem.detail ?? undefined);
      } else if (problem?.code === 'NOT_YET_OPEN') {
        setMessage(
          `This surprise opens on ${new Date(problem.detail ?? '').toLocaleString()}. Come back then.`,
        );
      } else {
        setCode('PIN_INCORRECT');
      }
      setBusy(false);
    }
  }

  return (
    <div
      className="mp-player space-y-4 rounded-3xl bg-white p-6 shadow-lg"
      data-testid="short-link-gate"
    >
      <PinGate code={code} lockedUntil={lockedUntil} busy={busy} onSubmit={open} />
      {message ? (
        <p role="alert" className="text-center font-medium">
          {message}
        </p>
      ) : null}
    </div>
  );
}
