import type { CSSProperties } from 'react';
import type { Theme } from '@momentpath/contracts';

/** Maps validated theme tokens to CSS custom properties. No creator CSS is ever injected. */
export function themeStyle(theme: Theme): CSSProperties {
  return {
    '--mp-bg': theme.palette.background,
    '--mp-surface': theme.palette.surface,
    '--mp-text': theme.palette.text,
    '--mp-accent': theme.palette.accent,
    '--mp-accent-text': theme.palette.accentText,
  } as CSSProperties;
}

export function themeClass(theme: Theme): string {
  return `mp-player mp-font-${theme.font} mp-scale-${theme.typeScale}`;
}

/** `mp-cta` adds a gentle glow that invites the tap (see globals.css). */
export const accentButton =
  'mp-cta inline-flex min-h-12 items-center justify-center rounded-2xl px-6 font-semibold shadow-sm transition active:scale-[0.98] ' +
  'bg-[var(--mp-accent)] text-[var(--mp-accent-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mp-accent)] ' +
  'disabled:opacity-60';

export const outlineButton =
  'inline-flex min-h-12 items-center justify-center rounded-2xl px-6 font-semibold transition active:scale-[0.98] ' +
  'bg-[var(--mp-surface)] text-[var(--mp-text)] ring-2 ring-inset ring-[var(--mp-accent)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mp-accent)]';
