'use client';

import { createContext, useContext } from 'react';
import type { Reaction, SoundEffect } from '@momentpath/contracts';
import type { Point } from './particles';

/** What steps can use to delight: sounds, emoji bursts and a full-screen celebration. */
export interface Fx {
  effect: (effect: SoundEffect) => void;
  /** Emoji burst from `at` (default: the last tap). An empty emoji uses the theme's style. */
  burst: (options?: {
    emoji?: string;
    at?: Point | Element | null;
    size?: 'small' | 'big';
  }) => void;
  react: (reaction: Reaction, at?: Point | Element | null) => void;
  celebrate: () => void;
  /** Lower the music while the recipient listens to a voice note. */
  duck: (ducked: boolean) => void;
}

const noop = () => {};
export const NO_FX: Fx = { effect: noop, burst: noop, react: noop, celebrate: noop, duck: noop };

export const FxContext = createContext<Fx>(NO_FX);

export function useFx(): Fx {
  return useContext(FxContext);
}

export function SoundToggle({
  muted,
  playing,
  onToggle,
}: {
  muted: boolean;
  playing: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!muted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      data-testid="sound-toggle"
      className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--mp-surface)] text-[var(--mp-text)] shadow-md ring-1 ring-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mp-accent)]"
    >
      {muted ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5 6 9H3v6h3l5 4V5z" />
          <path d="m22 9-6 6M16 9l6 6" />
        </svg>
      ) : playing ? (
        <span aria-hidden="true" className="mp-eq flex h-4 items-end gap-[3px]">
          <span />
          <span />
          <span />
        </span>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5 6 9H3v6h3l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      )}
    </button>
  );
}
