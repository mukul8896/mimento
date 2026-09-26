import type { DanceStyle } from './dance';
import type { MotionProfile, SceneEntrance, SceneTransition, Theme } from '@momentpath/contracts';

/**
 * A motion profile is a template's character: how scenes enter and leave, how fast, and how
 * loudly ordinary taps are acknowledged. The big moments (climaxes) are separate and reserved
 * for the peak of an experience, so profiles stay restrained on purpose.
 */
export interface Profile {
  entrance: SceneEntrance;
  transition: SceneTransition;
  /** Seconds for a scene to enter (leaving takes a little less). */
  duration: number;
  ease: [number, number, number, number];
  /** Seconds between the pieces of a scene appearing (title, text, then the controls). */
  stagger: number;
  /** What a plain Continue does: a burst and a pop, just a soft pop, or nothing. */
  continueFx: 'burst' | 'pop' | 'none';
  /** Yes answers: a full-screen shower (playful) or a small burst where the finger was. */
  yesFx: 'shower' | 'burst';
  /** Floating background glyphs: none, a few, or the full celebration set. */
  ambient: 'none' | 'faint' | 'full';
  /** Buttons that move with the music: how much. */
  dance: DanceStyle;
  /** Seconds an answer's reaction line stays before the story moves on. */
  reactionHold: number;
}

const GENTLE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SLOW_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const PROFILES: Record<MotionProfile, Profile> = {
  PLAYFUL: {
    entrance: 'SOFT_SCALE',
    transition: 'SOFT_SLIDE',
    duration: 0.42,
    ease: [0.34, 1.4, 0.64, 1],
    stagger: 0.07,
    continueFx: 'burst',
    yesFx: 'shower',
    ambient: 'full',
    dance: { bob: 7, sway: 2 },
    reactionHold: 1.0,
  },
  FESTIVE: {
    entrance: 'FADE_UP',
    transition: 'CROSSFADE',
    duration: 0.5,
    ease: GENTLE,
    stagger: 0.09,
    continueFx: 'pop',
    yesFx: 'burst',
    ambient: 'full',
    dance: { bob: 6, sway: 1.6 },
    reactionHold: 1.3,
  },
  WARM: {
    entrance: 'FADE_UP',
    transition: 'CROSSFADE',
    duration: 0.5,
    ease: GENTLE,
    stagger: 0.09,
    continueFx: 'pop',
    yesFx: 'burst',
    ambient: 'faint',
    dance: { bob: 5, sway: 1.2 },
    reactionHold: 1.4,
  },
  ROMANTIC: {
    entrance: 'BLUR_REVEAL',
    transition: 'FADE_THROUGH_LIGHT',
    duration: 0.75,
    ease: SLOW_OUT,
    stagger: 0.16,
    continueFx: 'none',
    yesFx: 'burst',
    ambient: 'faint',
    dance: { bob: 5, sway: 1.1 },
    reactionHold: 1.8,
  },
  CINEMATIC: {
    entrance: 'BLUR_REVEAL',
    transition: 'FADE_THROUGH_DARK',
    duration: 0.85,
    ease: [0.65, 0, 0.35, 1],
    stagger: 0.18,
    continueFx: 'none',
    yesFx: 'burst',
    ambient: 'none',
    dance: { bob: 5, sway: 1 },
    reactionHold: 2.0,
  },
  ELEGANT: {
    entrance: 'FADE',
    transition: 'CROSSFADE',
    duration: 0.6,
    ease: GENTLE,
    stagger: 0.12,
    continueFx: 'none',
    yesFx: 'burst',
    ambient: 'none',
    dance: { bob: 3.5, sway: 0.6 },
    reactionHold: 1.6,
  },
  NOSTALGIC: {
    entrance: 'BLUR_REVEAL',
    transition: 'BLUR',
    duration: 0.7,
    ease: SLOW_OUT,
    stagger: 0.14,
    continueFx: 'none',
    yesFx: 'burst',
    ambient: 'faint',
    dance: { bob: 4, sway: 0.8 },
    reactionHold: 1.8,
  },
};

/**
 * The profile to use, or null for an experience made before scenes existed: those keep their
 * original animation (theme.animation) and feedback exactly as they were published.
 */
export function profileOf(theme: Pick<Theme, 'motionProfile'>): Profile | null {
  return theme.motionProfile ? PROFILES[theme.motionProfile] : null;
}
