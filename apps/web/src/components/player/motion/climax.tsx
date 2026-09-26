'use client';

import { motion } from 'motion/react';
import { useEffect } from 'react';
import type { Climax } from '@momentpath/contracts';
import type { Cue } from '../fx/effects';
import { Illustration, type IllustrationName } from './illustration';

interface ClimaxPlan {
  illustration: IllustrationName | null;
  /** A warm light that blooms from the centre of the screen. */
  light: string;
  /** Heartbeat, a hush, then the swell: the proposal's shape. Others go straight to the swell. */
  heartbeat: boolean;
  /** Full-screen shower of the experience's celebration glyphs. */
  shower: boolean;
  /** Milliseconds the moment holds before the story moves on. */
  hold: number;
}

const PLANS: Record<Exclude<Climax, 'NONE'>, ClimaxPlan> = {
  PROPOSAL: { illustration: 'ring', light: '#ffe1ea', heartbeat: true, shower: true, hold: 3800 },
  ROMANTIC: { illustration: 'heart', light: '#ffd3e0', heartbeat: true, shower: true, hold: 3200 },
  BIRTHDAY: { illustration: null, light: '#ffe08a', heartbeat: false, shower: true, hold: 2600 },
  FESTIVAL: { illustration: null, light: '#ffc766', heartbeat: false, shower: true, hold: 2800 },
  LIGHT_BURST: {
    illustration: null,
    light: '#fff3d6',
    heartbeat: false,
    shower: false,
    hold: 2200,
  },
};

export interface ClimaxControls {
  cue: (cue: Cue, delaySeconds?: number) => void;
  setLevel: (level: number) => void;
  celebrate: () => void;
}

/**
 * The peak of an experience — used once, for the moment everything was leading to. It pauses,
 * lets the music fall away (and the heart beat, for love), blooms warm light across the
 * screen, swells the music and shows the illustration, then hands over to the final scene.
 * Taps are ignored while it plays; with reduced motion it is a simple, short fade.
 */
export function ClimaxLayer({
  kind,
  text,
  reducedMotion,
  controls,
  onDone,
}: {
  kind: Exclude<Climax, 'NONE'>;
  text: string;
  reducedMotion: boolean;
  controls: ClimaxControls;
  onDone: () => void;
}) {
  const plan = PLANS[kind];
  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    controls.setLevel(0.12);
    if (plan.heartbeat) controls.cue('HEARTBEAT', 0.25);
    const bloom = plan.heartbeat ? 1500 : 350;
    at(bloom, () => {
      controls.cue('SWELL');
      controls.setLevel(0.85);
    });
    if (plan.shower && !reducedMotion) at(bloom + 700, () => controls.celebrate());
    at(bloom + 900, () => controls.cue('REVEAL'));
    at(reducedMotion ? 1400 : bloom + plan.hold, onDone);
    return () => timers.forEach((t) => window.clearTimeout(t));
    // Runs once for the moment it was started for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bloomDelay = plan.heartbeat ? 1.5 : 0.35;
  return (
    <motion.div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden px-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8 } }}
      transition={{ duration: 0.4 }}
      data-testid="climax"
      data-kind={kind}
      aria-live="polite"
    >
      {/* The hush: the scene dims before the light arrives. */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-[#140d18]"
        initial={{ opacity: 0 }}
        animate={{ opacity: reducedMotion ? 0.4 : [0, 0.78, 0.78, 0.25] }}
        transition={{ duration: bloomDelay + 1.4, times: [0, 0.25, 0.6, 1] }}
      />
      {reducedMotion ? null : (
        <motion.div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 size-[140vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: `radial-gradient(circle, ${plan.light} 0%, ${plan.light}00 62%)` }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: [0, 0.95, 0.7] }}
          transition={{ delay: bloomDelay, duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      {plan.heartbeat && !reducedMotion ? (
        <motion.div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25"
          animate={{ scale: [1, 1.35, 1.05, 1.28, 1], opacity: [0.2, 0.6, 0.3, 0.55, 0] }}
          transition={{ delay: 0.25, duration: 1.2 }}
        />
      ) : null}
      <motion.div
        className="relative flex flex-col items-center gap-3"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          delay: reducedMotion ? 0.1 : bloomDelay + 0.35,
          duration: 0.8,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {plan.illustration ? (
          <Illustration
            name={plan.illustration}
            reducedMotion={reducedMotion}
            className="size-44"
          />
        ) : null}
        {text ? (
          <p className="max-w-xs text-[2em] font-bold leading-tight text-[#2a1320] drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
            {text}
          </p>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
