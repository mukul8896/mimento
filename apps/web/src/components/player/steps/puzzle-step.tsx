'use client';

import { useId, useState } from 'react';
import { accentButton } from '../theme';
import type { StepProps } from './types';
import { Editable } from '../editable';

/** The answer is never in the browser: every guess is checked by the server. */
export function PuzzleStep({ step, busy, submit }: StepProps<'PUZZLE'>) {
  const [guess, setGuess] = useState('');
  const [wrong, setWrong] = useState(false);
  const [hint, setHint] = useState(false);
  const id = useId();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim()) return;
    const correct = await submit({ kind: 'TEXT', value: guess.trim().slice(0, 100) });
    setWrong(correct === false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 text-center">
      <Editable field="Riddle or question" block>
        <label htmlFor={id} className="mp-prompt block text-[1.4em] font-bold leading-tight">
          {step.config.prompt}
        </label>
      </Editable>
      <input
        id={id}
        value={guess}
        maxLength={100}
        autoComplete="off"
        autoCapitalize="none"
        onChange={(e) => {
          setGuess(e.target.value);
          setWrong(false);
        }}
        className="min-h-12 w-full rounded-2xl bg-[var(--mp-surface)] px-4 text-center text-[1.1em] ring-2 ring-inset ring-black/10 focus:outline-none focus:ring-[var(--mp-accent)]"
      />
      <p role="status" aria-live="polite" className="min-h-6 font-medium">
        {wrong ? step.config.wrongMessage : ''}
      </p>
      {step.config.hint ? (
        hint ? (
          <p className="text-sm opacity-80">{step.config.hint}</p>
        ) : (
          <button type="button" className="text-sm underline" onClick={() => setHint(true)}>
            Show a hint
          </button>
        )
      ) : null}
      <Editable field="Button label" block>
        <button type="submit" className={`${accentButton} w-full`} disabled={busy || !guess.trim()}>
          {step.config.buttonLabel}
        </button>
      </Editable>
    </form>
  );
}
