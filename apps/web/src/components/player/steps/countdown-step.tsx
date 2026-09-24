'use client';

import { useEffect, useState } from 'react';
import { RichText } from '@/components/rich-text';
import { accentButton } from '../theme';
import type { StepProps } from './types';

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor(s / 3600) % 24,
    minutes: Math.floor(s / 60) % 60,
    seconds: s % 60,
  };
}

/** Counts down in the recipient's own time. The server enforces "wait for it" as well. */
export function CountdownStep({ step, busy, submit }: StepProps<'COUNTDOWN'>) {
  const target = step.config.targetAt ? new Date(step.config.targetAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = target === null ? 0 : target - now;
  const arrived = left <= 0;
  const { days, hours, minutes, seconds } = parts(left);
  const locked = step.config.waitForIt && !arrived;

  return (
    <div className="space-y-6 text-center">
      <h2 className="text-[1.5em] font-bold leading-tight">{step.config.title}</h2>
      <div
        role="timer"
        aria-live="off"
        aria-label={
          arrived ? 'Time is up' : `${days} days, ${hours} hours, ${minutes} minutes left`
        }
        className="grid grid-cols-4 gap-2"
        data-testid="countdown"
      >
        {[
          [days, 'days'],
          [hours, 'hours'],
          [minutes, 'min'],
          [seconds, 'sec'],
        ].map(([value, unit]) => (
          <div key={unit} className="rounded-2xl bg-black/5 py-3">
            <span className="block text-[1.75em] font-bold tabular-nums">{value}</span>
            <span className="text-xs uppercase tracking-wide opacity-70">{unit}</span>
          </div>
        ))}
      </div>
      <RichText doc={step.config.message} className="space-y-3 leading-relaxed" />
      <button
        type="button"
        className={`${accentButton} w-full sm:w-auto`}
        disabled={busy || locked}
        onClick={() => void submit({ kind: 'ACK' })}
      >
        {locked ? 'Not yet…' : step.config.buttonLabel}
      </button>
    </div>
  );
}
