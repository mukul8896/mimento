import { isDark, mixHex, type SceneTransition, type ThemePalette } from '@momentpath/contracts';

/**
 * The veil's colour, always from the surprise's own palette so the screen never flashes
 * a colour that is not part of its world: through dark deepens the background; through light
 * lifts it — on a dark surprise that is a soft haze of its own hue, never white.
 */
export function veilColor(kind: SceneTransition, palette: ThemePalette): string {
  const bg = palette.background;
  if (kind === 'FADE_THROUGH_DARK') return mixHex(bg, '#000000', 0.45);
  return isDark(bg) ? mixHex(bg, palette.text, 0.8) : mixHex(bg, '#ffffff', 0.35);
}
