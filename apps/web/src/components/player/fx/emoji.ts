import { CELEBRATION_LIBRARY, type Celebration } from '@momentpath/contracts';
import type { Point } from './particles';

/** Emoji for bursts; confetti is drawn as paper, so it has none. */
export function burstGlyphs(celebration: Celebration): readonly string[] {
  return celebration === 'CONFETTI' ? [] : CELEBRATION_LIBRARY[celebration].emoji;
}

export function ambientGlyphs(celebration: Celebration): readonly string[] {
  return celebration === 'CONFETTI' ? ['🎉', '✨', '🎊'] : CELEBRATION_LIBRARY[celebration].emoji;
}

/** Splits "😍🔥" or "🎉 ❤️" into separate emoji so each particle gets one. */
export function splitEmoji(value: string): string[] {
  const text = value.trim();
  if (!text) return [];
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  const parts = Segmenter
    ? Array.from(
        new Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
        (s) => s.segment,
      )
    : Array.from(text);
  return parts.filter((p) => p.trim() !== '');
}

export function centerOf(target: Point | Element | null | undefined): Point | null {
  if (!target) return null;
  if ('x' in target && 'y' in target && !(target instanceof Element)) return target;
  const r = (target as Element).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
