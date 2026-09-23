'use client';

import {
  PALETTE_PRESETS,
  themeContrastIssues,
  type ExperienceSettings,
  type Theme,
  type ThemePalette,
} from '@momentpath/contracts';
import { Alert, Field, Select } from '@momentpath/design-system';

const COLOR_FIELDS: { key: keyof ThemePalette; label: string }[] = [
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Card' },
  { key: 'text', label: 'Text' },
  { key: 'accent', label: 'Buttons' },
  { key: 'accentText', label: 'Button text' },
];

export function ThemePanel({
  theme,
  settings,
  onTheme,
  onSettings,
}: {
  theme: Theme;
  settings: ExperienceSettings;
  onTheme: (t: Theme) => void;
  onSettings: (s: ExperienceSettings) => void;
}) {
  const issues = themeContrastIssues(theme.palette);
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-semibold">Colours</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PALETTE_PRESETS).map(([name, palette]) => (
            <button
              key={name}
              type="button"
              onClick={() => onTheme({ ...theme, palette: { ...palette } })}
              className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm capitalize ring-1 ring-ink-200 hover:ring-brand-400"
            >
              <span
                aria-hidden="true"
                className="size-4 rounded-full ring-1 ring-black/10"
                style={{ background: palette.accent }}
              />
              {name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOR_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <input
                type="color"
                value={theme.palette[f.key]}
                onChange={(e) =>
                  onTheme({
                    ...theme,
                    palette: { ...theme.palette, [f.key]: e.target.value.toLowerCase() },
                  })
                }
                className="size-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent"
              />
              {f.label}
            </label>
          ))}
        </div>
        {issues.length > 0 ? (
          <Alert tone="warning">
            {issues.map((i) => (
              <p key={i}>{i}</p>
            ))}
          </Alert>
        ) : null}
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Font">
          {(p) => (
            <Select
              value={theme.font}
              onChange={(e) => onTheme({ ...theme, font: e.target.value as Theme['font'] })}
              {...p}
            >
              <option value="SANS">Clean</option>
              <option value="SERIF">Classic</option>
              <option value="ROUNDED">Rounded</option>
              <option value="MONO">Typewriter</option>
            </Select>
          )}
        </Field>
        <Field label="Text size">
          {(p) => (
            <Select
              value={theme.typeScale}
              onChange={(e) =>
                onTheme({ ...theme, typeScale: e.target.value as Theme['typeScale'] })
              }
              {...p}
            >
              <option value="COMPACT">Compact</option>
              <option value="COMFORTABLE">Comfortable</option>
              <option value="LARGE">Large</option>
            </Select>
          )}
        </Field>
        <Field
          label="Animation"
          hint="Turned off automatically for people who prefer reduced motion."
        >
          {(p) => (
            <Select
              value={theme.animation}
              onChange={(e) =>
                onTheme({ ...theme, animation: e.target.value as Theme['animation'] })
              }
              {...p}
            >
              <option value="NONE">None</option>
              <option value="FADE">Fade</option>
              <option value="SLIDE">Slide</option>
              <option value="POP">Pop</option>
            </Select>
          )}
        </Field>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">Privacy</h3>
        <fieldset className="space-y-2">
          <legend className="sr-only">What you see after they answer</legend>
          {(
            [
              [
                'FULL',
                'Show me each answer',
                'Recipients are told their answers are shared with you.',
              ],
              ['AGGREGATE_ONLY', 'Totals only', 'You see counts, not individual answers.'],
            ] as const
          ).map(([value, title, text]) => (
            <label
              key={value}
              className="flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ring-inset ring-ink-200"
            >
              <input
                type="radio"
                name="response-visibility"
                checked={settings.responseVisibility === value}
                onChange={() => onSettings({ responseVisibility: value })}
                className="mt-1 accent-brand-600"
              />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-ink-600">{text}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>
    </div>
  );
}
