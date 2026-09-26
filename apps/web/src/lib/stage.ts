import { isDark, mixHex, type ThemePalette } from '@momentpath/contracts';

/**
 * The immersive stage: while a surprise is being personalised, the site around it takes on
 * the surprise's colours (background, header, the words sitting on the background). Cards,
 * sheets, inputs and Publish keep the site's own look, so the tools stay easy to read.
 * globals.css does the rest from these variables, and fades between worlds.
 */
const VARS = ['--wr-stage-bg', '--wr-stage-ink', '--wr-stage-accent', '--wr-stage-frame'] as const;
const SITE_THEME_COLOR = '#fbf6f1';

function themeColor(value: string) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value);
}

/**
 * The page colour for a palette. A dark surprise sits on a lifted shade of its own hue, so
 * the phone preview (in the true colour) keeps a clear edge against the page.
 */
export function stageColors(palette: Pick<ThemePalette, 'background' | 'surface' | 'text'>) {
  if (!isDark(palette.background)) return { bg: palette.background, frame: null };
  return {
    bg: mixHex(palette.surface, palette.text, 0.86),
    frame: mixHex(palette.text, palette.background, 0.3),
  };
}

export function setStage(
  palette: Pick<ThemePalette, 'background' | 'surface' | 'text' | 'accent'>,
) {
  const root = document.documentElement;
  const { bg, frame } = stageColors(palette);
  root.style.setProperty('--wr-stage-bg', bg);
  root.style.setProperty('--wr-stage-ink', palette.text);
  root.style.setProperty('--wr-stage-accent', palette.accent);
  if (frame) root.style.setProperty('--wr-stage-frame', frame);
  else root.style.removeProperty('--wr-stage-frame');
  root.dataset.stage = '';
  themeColor(bg);
}

export function clearStage() {
  const root = document.documentElement;
  for (const v of VARS) root.style.removeProperty(v);
  delete root.dataset.stage;
  themeColor(SITE_THEME_COLOR);
}
