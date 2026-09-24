'use client';

import { useMemo, useState } from 'react';
import type { DraftStep, ExperienceSettings, PublicExperience, Theme } from '@momentpath/contracts';
import { Player } from '@/components/player/player';
import { PreviewBackend } from '@/components/player/preview-backend';
import type { MediaItem } from './media-upload';

export function PreviewPane({
  title,
  theme,
  settings,
  steps,
  media,
  startAt = null,
}: {
  /** The step being edited: the preview opens on it so changes show straight away. */
  startAt?: string | null;
  title: string;
  theme: Theme;
  settings: ExperienceSettings;
  steps: DraftStep[];
  media: MediaItem[];
}) {
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [run, setRun] = useState(0);
  // "Play from the start" ignores the selected step until another one is picked.
  const [fromStartFor, setFromStartFor] = useState<string | null>(null);
  const start = startAt !== null && fromStartFor !== startAt ? startAt : null;
  const experience: PublicExperience = useMemo(
    () => ({
      title,
      theme,
      versionNumber: 0,
      responsesVisibleToCreator: settings.responseVisibility === 'FULL',
      steps,
      media,
    }),
    [title, theme, settings, steps, media],
  );
  // A new backend restarts the preview whenever the content or the selected step changes.
  const backend = useMemo(
    () => new PreviewBackend(experience, undefined, start),
    [experience, start],
  );

  return (
    <div className="flex h-full min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Preview size"
          className="inline-flex rounded-xl bg-ink-100 p-1 text-sm"
        >
          {(['mobile', 'desktop'] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
              className={`rounded-lg px-3 py-1.5 capitalize ${device === d ? 'bg-white shadow-sm' : 'text-ink-600'}`}
            >
              {d}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="text-sm font-medium text-brand-700 underline"
          onClick={() => {
            setFromStartFor(startAt);
            setRun((r) => r + 1);
          }}
        >
          Play from the start
        </button>
      </div>
      <div
        className="flex min-w-0 flex-1 justify-center overflow-auto rounded-2xl bg-ink-200/60 p-3"
        data-testid="preview"
      >
        <div
          className={`overflow-hidden rounded-[2rem] shadow-xl ring-8 ring-ink-900 ${device === 'mobile' ? 'h-[640px] w-full max-w-[360px]' : 'h-[560px] w-full'}`}
        >
          <div className="h-full overflow-y-auto">
            <Player key={run} backend={backend} initialTheme={theme} embedded />
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-ink-500">
        Preview only — nothing is recorded and the real surprise is not shown.
      </p>
    </div>
  );
}
