import {
  isDark,
  mixHex,
  type Cover,
  type MotionProfile,
  type Theme,
  type ThemePalette,
} from '@momentpath/contracts';

/**
 * The cover a surprise opens with. Templates name theirs; anything else (older surprises,
 * ones built from scratch) gets one that suits its character.
 */
export function coverOf(theme: Pick<Theme, 'cover' | 'motionProfile'>): Cover {
  if (theme.cover) return theme.cover;
  const byProfile: Partial<Record<MotionProfile, Cover>> = {
    ROMANTIC: { kind: 'ENVELOPE', emoji: '💌' },
    CINEMATIC: { kind: 'ENVELOPE', emoji: '💌' },
    NOSTALGIC: { kind: 'ENVELOPE', emoji: '💌' },
    ELEGANT: { kind: 'ENVELOPE', emoji: '✨' },
    FESTIVE: { kind: 'GLOW', emoji: '✨' },
  };
  return (theme.motionProfile && byProfile[theme.motionProfile]) || { kind: 'GIFT', emoji: '🎁' };
}

/**
 * The envelope's paper: on a dark surprise, a lighter shade of its own hue (mixing in a gold
 * or green accent would go muddy); on a light one, a soft wash of the accent.
 */
export function envelopeColor(p: Pick<ThemePalette, 'background' | 'surface' | 'text' | 'accent'>) {
  return isDark(p.background) ? mixHex(p.surface, p.text, 0.72) : mixHex(p.surface, p.accent, 0.72);
}

/**
 * Seconds the opening takes, following the experience's pace: a playful surprise pops open,
 * a cinematic one takes its time. Reduced motion is a short fade.
 */
export function openingSeconds(sceneDuration: number | null, reducedMotion: boolean): number {
  if (reducedMotion) return 0.25;
  const pace = sceneDuration ?? 0.5;
  return Math.min(2, Math.max(0.9, pace * 2.2));
}
