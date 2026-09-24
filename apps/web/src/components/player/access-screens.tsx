'use client';

import { useEffect, useId, useState } from 'react';
import { accentButton } from './theme';

/** Asks for the surprise's PIN. Wrong PINs and the shared lockout come back as `code`. */
export function PinGate({
  code,
  lockedUntil,
  busy,
  onSubmit,
}: {
  code: 'PIN_REQUIRED' | 'PIN_INCORRECT' | 'PIN_LOCKED';
  lockedUntil?: string;
  busy?: boolean;
  onSubmit: (pin: string) => void;
}) {
  const [pin, setPin] = useState('');
  const id = useId();
  const message =
    code === 'PIN_INCORRECT'
      ? 'That PIN is not right. Check the link and PIN, then try again.'
      : code === 'PIN_LOCKED'
        ? `Too many wrong tries. Try again${lockedUntil ? ` after ${new Date(lockedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' later'}.`
        : '';
  return (
    <form
      className="space-y-5 text-center"
      data-testid="pin-gate"
      onSubmit={(e) => {
        e.preventDefault();
        if (/^\d{4,8}$/.test(pin)) onSubmit(pin);
      }}
    >
      <p className="text-[2.5em]" aria-hidden="true">
        🔒
      </p>
      <h1 className="text-[1.5em] font-bold">This surprise has a PIN</h1>
      <label htmlFor={id} className="block">
        Enter the PIN you were given
      </label>
      <input
        id={id}
        value={pin}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{4,8}"
        maxLength={8}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        className="mx-auto block min-h-12 w-48 rounded-2xl bg-[var(--mp-surface)] text-center font-mono text-[1.5em] tracking-[0.3em] ring-2 ring-inset ring-black/10 focus:outline-none focus:ring-[var(--mp-accent)]"
      />
      <p role="status" aria-live="polite" className="min-h-6 font-medium">
        {message}
      </p>
      <button
        type="submit"
        className={`${accentButton} w-full`}
        disabled={busy || code === 'PIN_LOCKED' || !/^\d{4,8}$/.test(pin)}
      >
        Open
      </button>
    </form>
  );
}

function remaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor(s / 60) % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`;
}

/** Scheduled opening: counts down, then asks the player to try again by itself. */
export function OpeningSoon({ opensAt, onOpen }: { opensAt: string; onOpen: () => void }) {
  const target = new Date(opensAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (now >= target) onOpen();
  }, [now, target, onOpen]);
  return (
    <div className="space-y-4 text-center" data-testid="opening-soon">
      <p className="text-[2.5em]" aria-hidden="true">
        ⏳
      </p>
      <h1 className="text-[1.5em] font-bold">Not yet!</h1>
      <p>
        This surprise opens on{' '}
        <strong>
          {new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(
            new Date(opensAt),
          )}
        </strong>
        .
      </p>
      <p role="timer" className="text-[1.75em] font-bold tabular-nums">
        {remaining(target - now)}
      </p>
      <p className="text-sm opacity-70">Keep this page open and it will start by itself.</p>
    </div>
  );
}
