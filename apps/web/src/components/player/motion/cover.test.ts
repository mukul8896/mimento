import { describe, expect, it } from 'vitest';
import { coverOf, envelopeColor, openingSeconds } from './cover';

describe('opening cover', () => {
  it('uses the template’s own cover', () => {
    expect(coverOf({ cover: { kind: 'GLOW', emoji: '🪔' } })).toEqual({
      kind: 'GLOW',
      emoji: '🪔',
    });
  });

  it('suits the character of surprises that do not name one', () => {
    expect(coverOf({ motionProfile: 'CINEMATIC' }).kind).toBe('ENVELOPE');
    expect(coverOf({ motionProfile: 'FESTIVE' }).kind).toBe('GLOW');
    expect(coverOf({ motionProfile: 'PLAYFUL' }).kind).toBe('GIFT');
    expect(coverOf({}).kind).toBe('GIFT');
  });

  it('opens at the experience’s pace', () => {
    expect(openingSeconds(0.42, false)).toBeLessThan(openingSeconds(0.85, false));
    expect(openingSeconds(0.85, false)).toBeLessThanOrEqual(2);
    expect(openingSeconds(0.85, true)).toBe(0.25);
  });
});

describe('envelope paper', () => {
  it('stays in the palette’s own hue on dark surprises', () => {
    const midnight = {
      background: '#141827',
      surface: '#1f2540',
      text: '#f5f0e6',
      accent: '#f2c14e',
    };
    const paper = envelopeColor(midnight);
    // Bluish, not the olive a gold mix would give: blue channel above red.
    expect(parseInt(paper.slice(5, 7), 16)).toBeGreaterThan(parseInt(paper.slice(1, 3), 16));
  });
});
