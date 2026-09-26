import { describe, expect, it } from 'vitest';
import { contrastRatio, isDark, PALETTE_PRESETS } from '@momentpath/contracts';
import { veilColor } from './veil';
import { stageColors } from '@/lib/stage';

const palettes = Object.entries(PALETTE_PRESETS);

describe('scene veils stay inside the surprise’s world', () => {
  it.each(palettes)('%s: fading through light never flashes white on a dark surprise', (_, p) => {
    const veil = veilColor('FADE_THROUGH_LIGHT', p);
    if (!isDark(p.background)) return;
    // Far from white, and close to its own background: the scene breathes, it does not flash.
    expect(contrastRatio(veil, '#ffffff')).toBeGreaterThan(3);
    expect(contrastRatio(veilColor('FADE_THROUGH_DARK', p), p.background)).toBeLessThan(2);
  });
});

describe('the personalise stage', () => {
  it.each(palettes)(
    '%s: words on the page stay readable, and the preview keeps its edge',
    (_, p) => {
      const { bg } = stageColors(p);
      expect(contrastRatio(p.text, bg)).toBeGreaterThanOrEqual(4.5);
      if (isDark(p.background)) expect(contrastRatio(bg, p.background)).toBeGreaterThan(1.5);
    },
  );
});
