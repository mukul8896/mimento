import { describe, expect, it } from 'vitest';
import { danceFrame } from './dance';

const style = { bob: 4, sway: 1 };

describe('buttons moving with the music', () => {
  it('floats gently when there is no music, and never further than its style allows', () => {
    for (let t = 0; t < 5; t += 0.1) {
      const f = danceFrame(t, 0, 0, style);
      expect(f.bobA).toBeLessThanOrEqual(0);
      expect(f.bobA).toBeGreaterThanOrEqual(-style.bob * 0.46);
      expect(Math.abs(f.sway)).toBeLessThanOrEqual(style.sway * 0.46);
    }
  });

  it('moves more with loud music, and lifts on a beat', () => {
    const quiet = Math.min(...[0, 0.3, 0.6, 0.9].map((t) => danceFrame(t, 0, 0, style).bobA));
    const loud = Math.min(...[0, 0.3, 0.6, 0.9].map((t) => danceFrame(t, 0.7, 0.7, style).bobA));
    expect(loud).toBeLessThan(quiet);
    const steady = danceFrame(1, 0.4, 0.4, style).bobA;
    const onBeat = danceFrame(1, 0.8, 0.4, style).bobA;
    expect(onBeat).toBeLessThan(steady);
  });

  it('keeps the two alternating buttons out of step', () => {
    const f = danceFrame(0.3, 0.5, 0.5, style);
    expect(f.bobA).not.toBe(f.bobB);
  });
});
