'use client';

import { useEffect, useState } from 'react';
import type { RevealedGift } from '@momentpath/contracts';
import { RichText } from '@/components/rich-text';
import { accentButton, outlineButton } from '../theme';
import type { StepProps } from './types';

function GiftDetails({ gift }: { gift: RevealedGift }) {
  const [copied, setCopied] = useState(false);
  switch (gift.kind) {
    case 'VOUCHER_CODE':
      return (
        <div className="space-y-3">
          <p className="text-sm opacity-80">Your code</p>
          <p
            className="break-all rounded-2xl bg-[var(--mp-bg)] px-4 py-3 font-mono text-[1.4em] font-bold tracking-wider"
            data-testid="gift-code"
          >
            {gift.code}
          </p>
          {gift.pin ? (
            <p>
              PIN: <span className="font-mono font-semibold">{gift.pin}</span>
            </p>
          ) : null}
          <button
            type="button"
            className={outlineButton}
            onClick={async () => {
              await navigator.clipboard.writeText(gift.code);
              setCopied(true);
            }}
          >
            {copied ? 'Copied!' : 'Copy code'}
          </button>
          {gift.redeemUrl ? (
            <p>
              <a
                href={gift.redeemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                Where to redeem
              </a>
            </p>
          ) : null}
          {gift.instructions ? <p className="whitespace-pre-line">{gift.instructions}</p> : null}
        </div>
      );
    case 'URL':
      return (
        <div className="space-y-3">
          <a href={gift.url} target="_blank" rel="noopener noreferrer" className={accentButton}>
            Open your gift
          </a>
          {gift.instructions ? <p className="whitespace-pre-line">{gift.instructions}</p> : null}
        </div>
      );
    case 'QR_IMAGE':
      return (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gift.imageUrl}
            alt="Gift QR code"
            referrerPolicy="no-referrer"
            className="mx-auto w-full max-w-64 rounded-xl bg-white p-2"
          />
          {gift.instructions ? <p className="whitespace-pre-line">{gift.instructions}</p> : null}
        </div>
      );
    case 'INSTRUCTION':
      return <p className="whitespace-pre-line text-[1.2em] font-medium">{gift.instructions}</p>;
    case 'PHYSICAL_MESSAGE':
      return <p className="whitespace-pre-line text-[1.2em] font-medium">{gift.message}</p>;
  }
}

/** Ticks every second until `at`, then stops; null when there is nothing to wait for. */
function useTimeLeft(at: string | null): number | null {
  const target = at ? new Date(at).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target === null || target <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [target]);
  return target === null ? null : Math.max(0, target - now);
}

function formatLeft(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor(s / 60) % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`;
}

export function GiftStep({ step, busy, reveal }: StepProps<'GIFT_REVEAL'>) {
  const [gift, setGift] = useState<RevealedGift | null>(null);
  const cfg = step.config;
  // Scheduled reveal: the server refuses early reveals too; this only explains the wait.
  const left = useTimeLeft(cfg.revealAt);
  const waiting = left !== null && left > 0;
  return (
    <div className="space-y-5 text-center">
      <h2 className="text-[1.75em] font-bold leading-tight">{cfg.title}</h2>
      <RichText doc={cfg.message} className="space-y-3" />
      {gift ? (
        <div
          className="rounded-3xl bg-[var(--mp-surface)] p-5 shadow-md"
          data-testid="gift-revealed"
          aria-live="polite"
        >
          <GiftDetails gift={gift} />
        </div>
      ) : (
        <>
          {waiting ? (
            <p className="space-y-1" data-testid="gift-waiting">
              <span className="block">Your surprise unlocks in</span>
              <span role="timer" className="block text-[1.75em] font-bold tabular-nums">
                {formatLeft(left)}
              </span>
            </p>
          ) : null}
          <button
            type="button"
            className={`${accentButton} w-full sm:w-auto`}
            disabled={busy || waiting}
            onClick={async () => setGift(await reveal())}
          >
            {cfg.revealButtonLabel}
          </button>
          {cfg.oneTimeReveal ? (
            <p className="text-sm opacity-80">This surprise can only be opened on one device.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
