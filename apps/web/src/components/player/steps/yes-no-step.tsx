'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { noButtonState } from '@momentpath/contracts';
import { accentButton, outlineButton } from '../theme';
import type { StepProps } from './types';

interface Position {
  left: number;
  top: number;
}

/**
 * Yes / No / Maybe with the creator-configured No behaviour. The No button only ever evades
 * inside this bounded arena, so it can never cover the player's Close control. With reduced
 * motion it does not move; it simply stays unavailable and says why.
 */
export function YesNoStep({ step, busy, submit, reducedMotion }: StepProps<'YES_NO_CHOICE'>) {
  const cfg = step.config;
  const [attempts, setAttempts] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [position, setPosition] = useState<Position | null>(null);
  const [message, setMessage] = useState('');
  const arena = useRef<HTMLDivElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const suppressClick = useRef(false);
  const hintId = useId();

  const state = noButtonState(cfg.noButton, { attempts, elapsedMs: now - startedAt });

  useEffect(() => {
    if (cfg.noButton.mode !== 'AFTER_DELAY' || state.clickable) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [cfg.noButton.mode, state.clickable]);

  const evade = useCallback(() => {
    setAttempts((a) => a + 1);
    setMessage(cfg.evasiveMessage);
    if (reducedMotion) return;
    const box = arena.current?.getBoundingClientRect();
    const btn = noRef.current?.getBoundingClientRect();
    const yes = yesRef.current?.getBoundingClientRect();
    if (!box || !btn) return;
    const maxLeft = Math.max(0, box.width - btn.width);
    const maxTop = Math.max(0, box.height - btn.height);
    for (let i = 0; i < 12; i++) {
      const candidate = { left: Math.random() * maxLeft, top: Math.random() * maxTop };
      const overlapsYes =
        yes &&
        candidate.left < yes.right - box.left + 8 &&
        candidate.left + btn.width > yes.left - box.left - 8 &&
        candidate.top < yes.bottom - box.top + 8 &&
        candidate.top + btn.height > yes.top - box.top - 8;
      if (!overlapsYes || i === 11) {
        setPosition(candidate);
        return;
      }
    }
  }, [cfg.evasiveMessage, reducedMotion]);

  // Once No becomes a normal button it returns to its natural place and the teasing stops.
  const floating = state.clickable ? null : position;
  const shownMessage = state.clickable ? '' : message;

  const noHint =
    cfg.noButton.mode === 'EVASIVE'
      ? 'This option cannot be chosen. You can close the experience at any time.'
      : cfg.noButton.mode === 'AFTER_DELAY' && !state.clickable
        ? `Available in ${state.remainingSeconds ?? 0} seconds.`
        : cfg.noButton.mode === 'AFTER_ATTEMPTS' && !state.clickable
          ? 'Keep trying to choose this option.'
          : '';

  return (
    <div className="space-y-6">
      <h2 className="text-center text-[1.75em] font-bold leading-tight">{cfg.question}</h2>
      <div
        ref={arena}
        className="relative min-h-44 w-full overflow-hidden rounded-3xl p-1"
        data-testid="choice-arena"
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            ref={yesRef}
            type="button"
            className={`${accentButton} min-w-28`}
            disabled={busy}
            onClick={() => void submit({ kind: 'CHOICE', value: 'YES' })}
          >
            {cfg.yesLabel}
          </button>
          {cfg.maybeEnabled ? (
            <button
              type="button"
              className={`${outlineButton} min-w-28`}
              disabled={busy}
              onClick={() => void submit({ kind: 'CHOICE', value: 'MAYBE' })}
            >
              {cfg.maybeLabel}
            </button>
          ) : null}
          {/* Placeholder keeps the layout stable while No is floating. */}
          {floating ? <span aria-hidden="true" className="min-h-12 min-w-28" /> : null}
          <button
            ref={noRef}
            type="button"
            data-testid="no-button"
            data-clickable={state.clickable}
            aria-disabled={!state.clickable || undefined}
            aria-describedby={noHint ? hintId : undefined}
            className={`${outlineButton} min-w-28 ${state.clickable ? '' : 'opacity-80'} ${
              floating ? 'absolute transition-[left,top] duration-200 ease-out' : ''
            }`}
            style={floating ? { left: floating.left, top: floating.top } : undefined}
            disabled={busy}
            onPointerEnter={(e) => {
              if (!state.clickable && e.pointerType === 'mouse') evade();
            }}
            onPointerDown={(e) => {
              if (!state.clickable && e.pointerType !== 'mouse') {
                e.preventDefault();
                suppressClick.current = true;
                evade();
              }
            }}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              if (state.clickable) void submit({ kind: 'CHOICE', value: 'NO' });
              else evade();
            }}
          >
            {cfg.noLabel}
          </button>
        </div>
      </div>
      <p id={hintId} className="sr-only">
        {noHint}
      </p>
      {/* Reserved height keeps the buttons from shifting when a message appears. */}
      <p role="status" aria-live="polite" className="min-h-[3.25em] text-center font-medium">
        {shownMessage}
        {cfg.noButton.mode === 'AFTER_DELAY' && !state.clickable ? (
          <span className="block text-sm font-normal opacity-80">
            {cfg.noLabel} available in {state.remainingSeconds}s
          </span>
        ) : null}
      </p>
    </div>
  );
}
