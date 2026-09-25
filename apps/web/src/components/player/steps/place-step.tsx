'use client';

import { useState } from 'react';
import { useFx } from '../fx/fx';
import { accentButton, outlineButton } from '../theme';
import type { StepProps } from './types';
import { Editable } from '../editable';

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function PlaceStep({ step, busy, submit }: StepProps<'PLACE_REVEAL'>) {
  const [revealed, setRevealed] = useState(false);
  const c = step.config;
  const fx = useFx();
  const maps = c.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.placeName} ${c.address}`)}`
    : null;
  return (
    <div className="space-y-5 text-center">
      <Editable field="Title" block>
        <h2 className="text-[1.5em] font-bold leading-tight">{c.title}</h2>
      </Editable>
      {revealed ? (
        <div className="space-y-2 rounded-2xl bg-black/5 p-4" data-testid="place-revealed">
          <p className="text-[1.6em] font-bold">📍 {c.placeName}</p>
          {c.address ? <p>{c.address}</p> : null}
          {c.when ? <p className="font-medium">{formatWhen(c.when)}</p> : null}
          {c.note ? <p className="opacity-80">{c.note}</p> : null}
          {maps ? (
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              className={`${outlineButton} mt-2 w-full sm:w-auto`}
            >
              Open in Maps
            </a>
          ) : null}
        </div>
      ) : (
        <Editable field="Place" block>
          <button
            type="button"
            className={`${outlineButton} w-full`}
            onClick={(e) => {
              fx.effect('WHOOSH');
              fx.burst({ emoji: '📍✨', at: e.currentTarget, size: 'big' });
              setRevealed(true);
            }}
          >
            {c.revealLabel}
          </button>
        </Editable>
      )}
      <Editable field="Button label" block>
        <button
          type="button"
          className={`${accentButton} w-full sm:w-auto`}
          disabled={busy || !revealed}
          onClick={() => void submit({ kind: 'ACK' })}
        >
          {c.buttonLabel}
        </button>
      </Editable>
    </div>
  );
}
