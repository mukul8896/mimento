/**
 * Buttons that move with the music. Each frame turns the music's energy into a small float
 * (a few pixels up), a slower sway and a lift on every beat, written as CSS variables on the
 * player; CSS moves the buttons with `translate` and `rotate` only (compositor work, no layout).
 * Quiet or muted music falls back to a slow idle float.
 */
export interface DanceStyle {
  /** Largest lift, in pixels. */
  bob: number;
  /** Largest sway, in degrees. */
  sway: number;
}

export interface DanceFrame {
  bobA: number;
  bobB: number;
  sway: number;
}

const IDLE = 0.45;

/**
 * One frame. `smooth` is the running average of energy, `energy` the reading now: the
 * difference between them is a beat, which gives the extra lift that reads as dancing.
 */
export function danceFrame(
  seconds: number,
  energy: number,
  smooth: number,
  style: DanceStyle,
): DanceFrame {
  const phase = (seconds * 2 * Math.PI) / 2.4;
  const intensity = Math.max(IDLE, Math.min(1, smooth * 2.2));
  const beat = Math.max(0, Math.min(1, (energy - smooth) * 4));
  const lift = (offset: number) =>
    -style.bob * (intensity * (0.5 + 0.5 * Math.sin(phase + offset)) + beat * 0.6);
  return {
    bobA: round(lift(0)),
    bobB: round(lift(Math.PI * 0.6)),
    sway: round(style.sway * intensity * Math.sin(phase / 2)),
  };
}

const round = (v: number) => Math.round(v * 100) / 100;

export const STILL: DanceFrame = { bobA: 0, bobB: 0, sway: 0 };
