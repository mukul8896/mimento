'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ThemePalette } from '@momentpath/contracts';
import { stageColors } from '@/lib/stage';

export interface Launch {
  emoji: string;
  palette: ThemePalette | null;
  label: string;
  /** Where the tapped card was, so the new world grows out of it. */
  from: { top: number; left: number; width: number; height: number } | null;
  /** The tapped card's own colour, which the bloom starts from. */
  fromColor?: string;
  /** The hand-over has begun: the title fades so Personalize can rise in its place. */
  leaving?: boolean;
}

/** Long enough for the bloom to finish, so it never cuts off halfway. */
export const LAUNCH_MS = 1100;
export const HANDOVER_MS = 260;

const EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];

/** A card's box as the clip-path that shows only that box of the full screen. */
function cardClip(from: NonNullable<Launch['from']>) {
  const right = Math.max(0, window.innerWidth - from.left - from.width);
  const bottom = Math.max(0, window.innerHeight - from.top - from.height);
  return `inset(${from.top}px ${right}px ${bottom}px ${from.left}px round 24px)`;
}

/**
 * Choosing a template is the start of the story: the tapped card grows to fill the screen in
 * the template's own colours while the surprise is prepared. Its colour is the one Personalize
 * opens on (lib/stage.ts), so there is no cut — the page simply rises out of it.
 */
export function SceneLaunch({ launch }: { launch: Launch }) {
  const reduced = useReducedMotion() ?? false;
  const bg = launch.palette ? stageColors(launch.palette).bg : '#fbf6f1';
  const text = launch.palette?.text ?? '#2a1830';
  const grow = !reduced && launch.from !== null;
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 px-6 text-center"
      style={{ color: text }}
      initial={
        grow
          ? { clipPath: cardClip(launch.from!), backgroundColor: launch.fromColor ?? bg }
          : { opacity: 0, backgroundColor: bg }
      }
      animate={{ clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1, backgroundColor: bg }}
      transition={{ duration: grow ? 0.85 : 0.25, ease: EASE }}
      role="status"
      aria-live="polite"
      data-testid="scene-launch"
    >
      <motion.div
        className="flex flex-col items-center gap-5"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.94 }}
        animate={
          launch.leaving
            ? { opacity: 0, y: reduced ? 0 : -8, transition: { duration: HANDOVER_MS / 1000 } }
            : { opacity: 1, y: 0, scale: 1 }
        }
        transition={{ delay: grow ? 0.4 : 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-24 items-center justify-center rounded-[2rem] text-5xl shadow-lg"
          style={{ background: launch.palette?.surface ?? '#ffffff' }}
        >
          {launch.emoji}
        </span>
        <p className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          {launch.label}
        </p>
        <p className="text-sm opacity-80">Setting the scene…</p>
      </motion.div>
    </motion.div>
  );
}
