'use client';

import { useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { noButtonState } from '@momentpath/contracts';
import { useFx } from '../fx/fx';
import { accentButton, outlineButton } from '../theme';
import type { StepProps } from './types';
import { EditContext, Editable } from '../editable';
import { SceneHeading } from '../motion/scene';

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
  const fx = useFx();
  // While personalising, a tap on No edits its label instead of teasing.
  const editing = useContext(EditContext) !== null;

  const state = noButtonState(cfg.noButton, { attempts, elapsedMs: now - startedAt });

  useEffect(() => {
    if (cfg.noButton.mode !== 'AFTER_DELAY' || state.clickable) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [cfg.noButton.mode, state.clickable]);

  const evade = useCallback(() => {
    if (editing) return;
    setAttempts((a) => a + 1);
    setMessage(cfg.evasiveMessage);
    fx.effect('BOING');
    fx.burst({ emoji: '😜', at: noRef.current });
    if (reducedMotion) return;
    const box = arena.current?.getBoundingClientRect();
    const btn = noRef.current?.getBoundingClientRect();
    const yes = yesRef.current?.getBoundingClientRect();
    if (!box || !btn) return;
    const maxLeft = Math.max(0, box.width - btn.width);
    const maxTop = Math.max(0, box.height - btn.height);
    const from = { left: btn.left - box.left, top: btn.top - box.top };
    // Of a handful of free spots, jump to the farthest from the finger: a dodge must be
    // unmistakable, never a nudge of a few pixels that looks like a dead button.
    let best: Position | null = null;
    let bestDistance = -1;
    for (let i = 0; i < 16; i++) {
      const candidate = { left: Math.random() * maxLeft, top: Math.random() * maxTop };
      const overlapsYes =
        yes &&
        candidate.left < yes.right - box.left + 8 &&
        candidate.left + btn.width > yes.left - box.left - 8 &&
        candidate.top < yes.bottom - box.top + 8 &&
        candidate.top + btn.height > yes.top - box.top - 8;
      if (overlapsYes) continue;
      const distance = Math.hypot(candidate.left - from.left, candidate.top - from.top);
      if (distance > bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    setPosition(best ?? { left: from.left < maxLeft / 2 ? maxLeft : 0, top: maxTop });
    // A squash and a wiggle as it hops away, so it reads as running, not as disabled.
    noRef.current?.animate(
      [
        { scale: '1', rotate: '0deg' },
        { scale: '0.82', rotate: '-10deg', offset: 0.35 },
        { scale: '1.06', rotate: '6deg', offset: 0.7 },
        { scale: '1', rotate: '0deg' },
      ],
      { duration: 380, easing: 'ease-out' },
    );
  }, [cfg.evasiveMessage, reducedMotion, fx, editing]);

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
      <Editable field="Question" block>
        <SceneHeading className="text-center text-[1.75em] font-bold leading-tight">
          {cfg.question}
        </SceneHeading>
      </Editable>
      <div
        ref={arena}
        className="relative min-h-44 w-full overflow-hidden rounded-3xl p-1"
        data-testid="choice-arena"
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Editable field="Yes label">
            <button
              ref={yesRef}
              type="button"
              className={`${accentButton} min-w-28`}
              disabled={busy}
              onClick={() => void submit({ kind: 'CHOICE', value: 'YES' })}
            >
              {cfg.yesLabel}
            </button>
          </Editable>
          {cfg.maybeEnabled ? (
            <Editable field="Maybe label">
              <button
                type="button"
                className={`${outlineButton} min-w-28`}
                disabled={busy}
                onClick={() => void submit({ kind: 'CHOICE', value: 'MAYBE' })}
              >
                {cfg.maybeLabel}
              </button>
            </Editable>
          ) : null}
          {/* Placeholder keeps the layout stable while No is floating. */}
          {floating ? <span aria-hidden="true" className="min-h-12 min-w-28" /> : null}
          <Editable field="No label">
            <button
              ref={noRef}
              type="button"
              data-testid="no-button"
              data-clickable={state.clickable}
              aria-disabled={!state.clickable || undefined}
              aria-describedby={noHint ? hintId : undefined}
              className={`${outlineButton} min-w-28 ${
                // Evasive No looks as tempting as Yes; only the waiting modes look paused.
                state.clickable || cfg.noButton.mode === 'EVASIVE' ? '' : 'opacity-80'
              } ${
                floating
                  ? 'absolute transition-[left,top] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]'
                  : ''
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
          </Editable>
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
