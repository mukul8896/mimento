'use client';

import { motion, type Variants } from 'motion/react';
import { createContext, useContext } from 'react';
import {
  DEFAULT_SCENE,
  type DraftStep,
  type Scene,
  type SceneEntrance,
  type SceneTransition,
  type ThemePalette,
} from '@momentpath/contracts';
import type { Profile } from './profiles';
import { veilColor } from './veil';

/**
 * Scene direction for the step on screen. Step components read it to present headings
 * (word by word, or as the one line that owns the screen) without knowing anything about the
 * template they belong to.
 */
export interface SceneState {
  scene: Scene;
  entrance: SceneEntrance;
  reducedMotion: boolean;
}

export const SceneContext = createContext<SceneState | null>(null);
export const useScene = () => useContext(SceneContext);

export function sceneOf(step: DraftStep | null): Scene {
  return step?.scene ?? DEFAULT_SCENE;
}

/** The layout's wrapper classes; CARD is the classic surface. */
export function layoutClass(scene: Scene): string {
  switch (scene.layout) {
    case 'FOCUS':
      return 'mp-focus px-1 py-8';
    case 'FLOAT':
      return 'mp-float px-1 py-4';
    default:
      return 'rounded-3xl bg-[var(--mp-surface)] p-5 shadow-lg sm:p-7';
  }
}

/** CSS variables and classes that stagger a scene's pieces in (see globals.css). */
export function entranceStyle(profile: Profile, entrance: SceneEntrance) {
  return {
    className: `mp-scene mp-e-${entrance}`,
    style: {
      '--mp-step': `${profile.stagger}s`,
      '--mp-dur': `${profile.duration}s`,
      '--mp-ease': `cubic-bezier(${profile.ease.join(',')})`,
    } as React.CSSProperties,
  };
}

/**
 * The scene as a whole: a short enter, and an exit chosen by the scene being left (passed to
 * AnimatePresence as `custom`), so each hand-over can have its own character.
 */
export function sceneVariants(profile: Profile, reducedMotion: boolean): Variants {
  const d = reducedMotion ? 0.2 : profile.duration;
  const ease = profile.ease;
  return {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 },
    animate: {
      opacity: 1,
      scale: 1,
      x: 0,
      filter: 'blur(0px)',
      transition: { duration: d * 0.6, ease },
    },
    exit: (leaving: SceneTransition | undefined) => {
      const t = { duration: d * 0.55, ease };
      if (reducedMotion) return { opacity: 0, transition: t };
      switch (leaving) {
        case 'SOFT_SLIDE':
          return { opacity: 0, x: -36, transition: t };
        case 'BLUR':
          return { opacity: 0, filter: 'blur(10px)', transition: t };
        case 'ZOOM_THROUGH':
          return { opacity: 0, scale: 1.08, transition: t };
        default:
          return { opacity: 0, transition: t };
      }
    },
  };
}

/**
 * Between scenes that fade through dark or light, a veil covers the screen for a moment:
 * the story "breathes" instead of cutting straight to the next card.
 */
export function Veil({
  kind,
  run,
  duration,
  palette,
}: {
  kind: SceneTransition | null;
  run: number;
  duration: number;
  palette: ThemePalette;
}) {
  if (kind !== 'FADE_THROUGH_DARK' && kind !== 'FADE_THROUGH_LIGHT') return null;
  return (
    <motion.div
      key={run}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20"
      style={{ background: veilColor(kind, palette) }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.85, 0.85, 0] }}
      transition={{ duration: duration * 2.2, times: [0, 0.35, 0.55, 1], ease: 'easeInOut' }}
    />
  );
}

/**
 * A heading that can land word by word. Screen readers get the whole sentence at once; the
 * words are presentation only. Long personalised text simply wraps — timing is per word, so
 * longer lines take a little longer but never clip.
 */
export function SceneHeading({
  children,
  className = '',
  as: Tag = 'h2',
}: {
  children: string;
  className?: string;
  as?: 'h2' | 'p';
}) {
  const scene = useScene();
  if (!scene || scene.entrance !== 'WORD_REVEAL' || scene.reducedMotion) {
    return <Tag className={className}>{children}</Tag>;
  }
  const words = children.split(/(\s+)/);
  // Cap the total so a long heading still finishes in about a second and a half.
  const step = Math.min(0.12, 1.4 / Math.max(1, words.length / 2));
  let i = 0;
  return (
    <Tag className={className} aria-label={children}>
      {words.map((w, k) =>
        /^\s+$/.test(w) ? (
          <span key={k}>{w}</span>
        ) : (
          <span
            key={k}
            aria-hidden="true"
            className="mp-word"
            style={{ animationDelay: `${0.15 + i++ * step}s` }}
          >
            {w}
          </span>
        ),
      )}
    </Tag>
  );
}

/** Shown for a moment after an answer: the story acknowledges them before moving on. */
export function ReactionMoment({ text, reducedMotion }: { text: string; reducedMotion: boolean }) {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-6 text-center"
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, filter: 'blur(6px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.2 : 0.55, ease: [0.16, 1, 0.3, 1] }}
      data-testid="reaction"
    >
      <p className="max-w-xs text-[1.9em] font-bold leading-tight">{text}</p>
    </motion.div>
  );
}
