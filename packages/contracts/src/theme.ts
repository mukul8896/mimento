import { z } from 'zod';

/**
 * Themes are a closed set of design tokens. Creators never supply CSS or JavaScript;
 * the web app maps these tokens to CSS custom properties it controls.
 */

const HexColor = z
  .string()
  .regex(/^#[0-9a-f]{6}$/, 'Use a lowercase 6-digit hex colour such as #aa3355');

export const ThemeFontSchema = z.enum(['SANS', 'SERIF', 'ROUNDED', 'MONO']);
export const ThemeTypeScaleSchema = z.enum(['COMPACT', 'COMFORTABLE', 'LARGE']);
export const ThemeAnimationSchema = z.enum(['NONE', 'FADE', 'SLIDE', 'POP']);

export const ThemePaletteSchema = z.strictObject({
  background: HexColor,
  surface: HexColor,
  text: HexColor,
  accent: HexColor,
  accentText: HexColor,
});

export const ThemeSchema = z
  .strictObject({
    palette: ThemePaletteSchema,
    font: ThemeFontSchema,
    typeScale: ThemeTypeScaleSchema,
    animation: ThemeAnimationSchema,
  })
  .meta({ id: 'Theme' });
export type Theme = z.infer<typeof ThemeSchema>;
export type ThemePalette = z.infer<typeof ThemePaletteSchema>;

export const PALETTE_PRESETS = {
  blush: {
    background: '#fff4f6',
    surface: '#ffffff',
    text: '#3a1d27',
    accent: '#b3264f',
    accentText: '#ffffff',
  },
  midnight: {
    background: '#141827',
    surface: '#1f2540',
    text: '#f3f4fb',
    accent: '#f5c451',
    accentText: '#1a1a1a',
  },
  meadow: {
    background: '#f2f7f0',
    surface: '#ffffff',
    text: '#1f3322',
    accent: '#2f6b3a',
    accentText: '#ffffff',
  },
  sunrise: {
    background: '#fff7ec',
    surface: '#ffffff',
    text: '#3b2410',
    accent: '#b4501b',
    accentText: '#ffffff',
  },
  /** Diwali: deep plum with diya gold. */
  festive: {
    background: '#2b1438',
    surface: '#3a1d4b',
    text: '#fff5e1',
    accent: '#f5b93a',
    accentText: '#2b1438',
  },
  /** Holi: bright magenta on pink. */
  holi: {
    background: '#fff0f8',
    surface: '#ffffff',
    text: '#3b1036',
    accent: '#b0106c',
    accentText: '#ffffff',
  },
  /** Christmas: pine green with berry red. */
  evergreen: {
    background: '#0f2a1f',
    surface: '#173a2c',
    text: '#f4f1e8',
    accent: '#f2c14e',
    accentText: '#10291e',
  },
  /** Eid: night teal with moon gold. */
  crescent: {
    background: '#0e2a2a',
    surface: '#153b3b',
    text: '#f5f0e1',
    accent: '#e3c16f',
    accentText: '#14302f',
  },
  ocean: {
    background: '#eef6fb',
    surface: '#ffffff',
    text: '#0d2c3f',
    accent: '#0b6694',
    accentText: '#ffffff',
  },
  lavender: {
    background: '#f6f2ff',
    surface: '#ffffff',
    text: '#2a1f47',
    accent: '#6d3fc6',
    accentText: '#ffffff',
  },
} as const satisfies Record<string, ThemePalette>;
export type PalettePresetName = keyof typeof PALETTE_PRESETS;

export const DEFAULT_THEME: Theme = {
  palette: { ...PALETTE_PRESETS.blush },
  font: 'SANS',
  typeScale: 'COMFORTABLE',
  animation: 'FADE',
};

function channel(hex: string, offset: number): number {
  const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** WCAG 2.x contrast ratio between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const MIN_TEXT_CONTRAST = 4.5;

/** Returns human-readable contrast problems; publishing is blocked when any exist. */
export function themeContrastIssues(palette: ThemePalette): string[] {
  const issues: string[] = [];
  if (contrastRatio(palette.text, palette.background) < MIN_TEXT_CONTRAST) {
    issues.push('Text colour does not have enough contrast against the background.');
  }
  if (contrastRatio(palette.text, palette.surface) < MIN_TEXT_CONTRAST) {
    issues.push('Text colour does not have enough contrast against the card surface.');
  }
  if (contrastRatio(palette.accentText, palette.accent) < MIN_TEXT_CONTRAST) {
    issues.push('Button text does not have enough contrast against the accent colour.');
  }
  return issues;
}
