'use client';

import { useMemo, useState } from 'react';
import type { PublicExperience } from '@momentpath/contracts';
import { Player } from './player';
import { PreviewBackend } from './preview-backend';

/**
 * A playable surprise in a phone frame. Runs entirely in the browser with the preview backend:
 * nothing is sent or recorded, so visitors can try the product before creating anything.
 */
export function PhoneDemo({
  experience,
  giftMessage,
  label = 'Demo surprise',
  frameClassName = 'h-[min(600px,78dvh)] w-[min(340px,86vw)]',
  replay = true,
}: {
  experience: PublicExperience;
  giftMessage?: string;
  label?: string;
  /** Size of the phone; it always fits the screen it is shown on. */
  frameClassName?: string;
  replay?: boolean;
}) {
  const [run, setRun] = useState(0);
  // Remounting the player (key) calls backend.load(), which starts again from the first step.
  const backend = useMemo(
    () => new PreviewBackend(experience, giftMessage),
    [experience, giftMessage],
  );
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="region"
        aria-label={label}
        className={`${frameClassName} max-w-full overflow-hidden rounded-[2.25rem] bg-black shadow-2xl ring-8 ring-ink-900`}
        data-testid="phone-demo"
      >
        <div className="h-full overflow-y-auto">
          <Player key={run} backend={backend} initialTheme={experience.theme} embedded hideIntro />
        </div>
      </div>
      {replay ? (
        <button
          type="button"
          className="min-h-11 text-sm font-medium text-brand-700 underline"
          onClick={() => setRun((r) => r + 1)}
        >
          Play again
        </button>
      ) : null}
    </div>
  );
}
