'use client';

import { useEffect, useRef, useState } from 'react';
import { useFx } from '../fx/fx';
import { accentButton, outlineButton } from '../theme';
import type { StepProps } from './types';

const REVEAL_THRESHOLD = 0.45;

/**
 * Scratch card on a canvas for pointer users, with an equivalent "Reveal" button for keyboard,
 * switch and screen-reader users. The hidden content is not exposed to assistive technology
 * until it is revealed.
 */
export function ScratchStep({ step, media, busy, submit }: StepProps<'SCRATCH_REVEAL'>) {
  const cfg = step.config;
  const [revealed, setRevealed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const image = media.find((m) => m.id === cfg.hiddenMediaId);
  const fx = useFx();
  const card = useRef<HTMLDivElement>(null);
  const celebrated = useRef(false);

  useEffect(() => {
    if (!revealed || celebrated.current) return;
    celebrated.current = true;
    fx.effect('SPARKLE');
    fx.burst({ at: card.current, size: 'big' });
  }, [revealed, fx]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || revealed) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = el.getBoundingClientRect();
    el.width = rect.width * ratio;
    el.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    const styles = getComputedStyle(el);
    ctx.fillStyle = styles.getPropertyValue('--mp-accent') || '#999';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = styles.getPropertyValue('--mp-accent-text') || '#fff';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.coverLabel, rect.width / 2, rect.height / 2);
  }, [cfg.coverLabel, revealed]);

  function scratch(e: React.PointerEvent<HTMLCanvasElement>) {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx || !drawing.current) return;
    const rect = el.getBoundingClientRect();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(e.clientX - rect.left, e.clientY - rect.top, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  function checkCleared() {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const { data } = ctx.getImageData(0, 0, el.width, el.height);
    let clear = 0;
    for (let i = 3; i < data.length; i += 16) if (data[i] === 0) clear++;
    if (clear / (data.length / 16) > REVEAL_THRESHOLD) setRevealed(true);
  }

  return (
    <div className="space-y-5 text-center">
      <h2 className="text-[1.5em] font-bold leading-tight">{cfg.instructions}</h2>
      <div
        ref={card}
        className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-3xl bg-[var(--mp-surface)] shadow-md"
      >
        <div
          aria-hidden={!revealed}
          className="flex h-full flex-col items-center justify-center gap-3 p-4"
          data-testid="scratch-content"
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt={revealed ? cfg.hiddenMediaAlt : ''}
              referrerPolicy="no-referrer"
              className="max-h-40 max-w-full rounded-xl object-contain"
            />
          ) : null}
          {cfg.hiddenText ? <p className="text-[1.25em] font-semibold">{cfg.hiddenText}</p> : null}
        </div>
        {!revealed ? (
          <canvas
            ref={canvas}
            aria-hidden="true"
            className="absolute inset-0 size-full touch-none cursor-crosshair"
            onPointerDown={(e) => {
              drawing.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              scratch(e);
            }}
            onPointerMove={scratch}
            onPointerUp={() => {
              drawing.current = false;
              checkCleared();
            }}
            onPointerCancel={() => {
              drawing.current = false;
            }}
          />
        ) : null}
      </div>
      <div aria-live="polite" className="sr-only">
        {revealed ? `Revealed: ${cfg.hiddenText || cfg.hiddenMediaAlt}` : ''}
      </div>
      {revealed ? (
        <button
          type="button"
          className={`${accentButton} w-full sm:w-auto`}
          disabled={busy}
          onClick={() => void submit({ kind: 'ACK' })}
        >
          {cfg.buttonLabel}
        </button>
      ) : (
        <button
          type="button"
          className={`${outlineButton} w-full sm:w-auto`}
          onClick={() => setRevealed(true)}
        >
          Reveal without scratching
        </button>
      )}
    </div>
  );
}
