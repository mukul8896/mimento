'use client';

import { useEffect, useState } from 'react';
import {
  CELEBRATION_LIBRARY,
  CELEBRATIONS,
  MUSIC_LIBRARY,
  MUSIC_TRACKS,
  NO_MUSIC,
  PALETTE_PRESETS,
  themeContrastIssues,
  type Celebration,
  type Music,
  type ExperienceSettings,
  type Theme,
  type ThemePalette,
} from '@momentpath/contracts';
import { Alert, Field, Select, Switch } from '@momentpath/design-system';
import { previewMusic, stopPreview } from '@/components/player/fx/preview';
import { MediaUpload } from './media-upload';
import type { StepFormContext } from './step-forms';

const COLOR_FIELDS: { key: keyof ThemePalette; label: string }[] = [
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Card' },
  { key: 'text', label: 'Text' },
  { key: 'accent', label: 'Buttons' },
  { key: 'accentText', label: 'Button text' },
];

function musicKey(m: Music): string {
  return m.source === 'LIBRARY' ? m.track : m.source;
}

/**
 * Background music: a built-in track (synthesised in the browser, nothing to license), the
 * creator's own upload, or silence. Each track can be heard before choosing it.
 */
export function MusicPicker({
  theme,
  onTheme,
  ctx,
}: {
  theme: Theme;
  onTheme: (t: Theme) => void;
  ctx: StepFormContext;
}) {
  const [listening, setListening] = useState<string | null>(null);
  const [stop, setStop] = useState<(() => void) | null>(null);
  const current = musicKey(theme.music);
  const uploadedId = theme.music.source === 'UPLOAD' ? theme.music.mediaId : null;
  const [ownOpen, setOwnOpen] = useState(uploadedId !== null);
  useEffect(() => stopPreview, []);

  const listen = (key: string, music: Music, url: string | null = null) => {
    stop?.();
    if (listening === key) {
      setListening(null);
      setStop(null);
      return;
    }
    const s = previewMusic(music, url);
    setListening(key);
    setStop(() => s);
    window.setTimeout(() => setListening((k) => (k === key ? null : k)), 20000);
  };
  const choose = (music: Music) => onTheme({ ...theme, music });

  const card = (selected: boolean) =>
    `flex min-h-16 w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 ring-inset transition ${
      selected ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-ink-200 hover:ring-brand-300'
    }`;

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Background music">
        <button
          type="button"
          role="radio"
          aria-checked={current === 'NONE'}
          className={card(current === 'NONE')}
          onClick={() => {
            choose(NO_MUSIC);
            stop?.();
            setListening(null);
          }}
        >
          <span className="text-2xl" aria-hidden="true">
            🔇
          </span>
          <span className="text-sm font-medium">No music</span>
        </button>
        {MUSIC_TRACKS.map((track) => {
          const info = MUSIC_LIBRARY[track];
          const music: Music = { source: 'LIBRARY', track };
          return (
            <div key={track} className="relative">
              <button
                type="button"
                role="radio"
                aria-checked={current === track}
                data-testid={`music-${track}`}
                className={`${card(current === track)} pr-14`}
                onClick={() => {
                  choose(music);
                  if (listening !== track) listen(track, music);
                }}
              >
                <span className="text-2xl" aria-hidden="true">
                  {info.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{info.name}</span>
                  <span className="block text-xs text-ink-600">{info.mood}</span>
                </span>
              </button>
              <button
                type="button"
                aria-label={listening === track ? `Stop ${info.name}` : `Listen to ${info.name}`}
                className="absolute top-1/2 right-2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink-900/5 text-sm hover:bg-ink-900/10"
                onClick={() => listen(track, music)}
              >
                {listening === track ? '■' : '▶'}
              </button>
            </div>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={current === 'UPLOAD'}
          className={card(current === 'UPLOAD')}
          onClick={() => setOwnOpen(true)}
        >
          <span className="text-2xl" aria-hidden="true">
            🎤
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">Your own song</span>
            <span className="block text-xs text-ink-600">Upload an audio file</span>
          </span>
        </button>
      </div>
      {ownOpen ? (
        <div className="rounded-2xl bg-ink-50 p-3">
          <MediaUpload
            experienceId={ctx.experienceId}
            kind="music"
            label="Your song"
            value={uploadedId}
            media={ctx.media}
            onUploaded={(item) => {
              ctx.addMedia(item);
              stop?.();
              setListening(null);
              choose({ source: 'UPLOAD', mediaId: item.id });
            }}
            onClear={() => choose(NO_MUSIC)}
          />
        </div>
      ) : null}
      <p className="text-xs text-ink-500">
        Music starts when they first tap, and they can mute it any time.
      </p>
    </div>
  );
}

export function ThemePanel({
  theme,
  settings,
  onTheme,
  onSettings,
  ctx,
}: {
  theme: Theme;
  settings: ExperienceSettings;
  onTheme: (t: Theme) => void;
  onSettings: (s: ExperienceSettings) => void;
  ctx: StepFormContext;
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
              <option value="RISE">Rise</option>
              <option value="FLIP">Flip card</option>
            </Select>
          )}
        </Field>
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold">Music &amp; sounds</h3>
        <MusicPicker theme={theme} onTheme={onTheme} ctx={ctx} />
        <Switch
          label="Tap and answer sounds (pop, yay, ta-da…)"
          checked={theme.sounds}
          onChange={(sounds) => onTheme({ ...theme, sounds })}
        />
        <fieldset>
          <legend className="text-sm font-medium text-ink-800">Celebration</legend>
          <p className="text-xs text-ink-600">
            Bursts out on taps and happy answers, and showers the screen at the final reveal.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CELEBRATIONS.map((c: Celebration) => {
              const info = CELEBRATION_LIBRARY[c];
              const selected = theme.celebration === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onTheme({ ...theme, celebration: c })}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 ${
                    selected ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-ink-200'
                  }`}
                >
                  <span aria-hidden="true">
                    {c === 'CONFETTI'
                      ? '🎊'
                      : c === 'NONE'
                        ? '⭕'
                        : info.emoji.slice(0, 2).join('')}
                  </span>
                  {info.name}
                </button>
              );
            })}
          </div>
        </fieldset>
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
