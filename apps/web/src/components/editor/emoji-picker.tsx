'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { emojiOnly } from '@momentpath/contracts';
import { cx } from '@momentpath/design-system';

/** A small, warm set that fits most surprises; anything else can be typed. */
export const SUGGESTED_EMOJI = [
  '❤️',
  '💖',
  '💕',
  '💌',
  '💍',
  '🌹',
  '🥰',
  '😍',
  '🎁',
  '🎀',
  '🎂',
  '🎉',
  '🥳',
  '🎈',
  '✨',
  '🌟',
  '💫',
  '🪔',
  '🌙',
  '🎄',
  '❄️',
  '🌸',
  '🌷',
  '🌻',
  '🍀',
  '🏆',
  '🎓',
  '👶',
  '🙏',
  '🤗',
  '😊',
  '🥺',
] as const;

/**
 * An emoji box that is easy on every device: tap it to pick from a grid, or type your own in
 * the field below (which keeps only emoji). Typing an emoji is awkward on a laptop keyboard
 * and fiddly on phones, so the grid is the main way in.
 */
export function EmojiPicker({
  label,
  value,
  onChange,
  optional = false,
  compact = false,
  testId,
}: {
  label: string;
  value: string;
  onChange: (emoji: string) => void;
  /** Can be left empty (a "none" choice is offered). */
  optional?: boolean;
  /** A small square, for rows like multiple-choice answers. */
  compact?: boolean;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // The grid opens in place (never clipped by the sheet's edge) and scrolls into view.
  useEffect(() => {
    if (open) panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc, true);
    };
  }, [open]);

  const pick = (emoji: string) => {
    onChange(emoji);
    setTyped('');
    setOpen(false);
  };

  return (
    // Compact pickers sit in a wrapping row: `contents` lets the grid drop onto its own line.
    <div ref={box} className={compact ? 'contents' : 'w-full'}>
      <button
        type="button"
        aria-label={`${label}: ${value || 'none'}. Change`}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'inline-flex items-center justify-center gap-2 rounded-xl bg-white ring-1 ring-inset ring-ink-200 transition hover:ring-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          compact ? 'h-11 w-14 shrink-0 text-xl' : 'min-h-12 w-full px-3 text-2xl',
          open && 'ring-2 ring-brand-600',
        )}
      >
        {value ? (
          <span aria-hidden="true">{value}</span>
        ) : (
          <span aria-hidden="true" className="text-sm text-ink-500">
            {compact ? '＋' : 'Pick an emoji'}
          </span>
        )}
        {compact ? null : (
          <span aria-hidden="true" className="ml-auto text-sm font-medium text-brand-700">
            Change
          </span>
        )}
      </button>

      {open ? (
        <div
          ref={panel}
          id={panelId}
          role="group"
          aria-label={label}
          className="mt-2 w-full basis-full rounded-2xl bg-white p-3 shadow-lg ring-1 ring-ink-100"
        >
          <div className="grid grid-cols-8 justify-items-center gap-1">
            {SUGGESTED_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                aria-label={e}
                aria-pressed={value === e}
                onClick={() => pick(e)}
                className={cx(
                  'inline-flex size-8 items-center justify-center rounded-lg text-xl transition hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-brand-600',
                  value === e && 'bg-brand-50 ring-2 ring-brand-600',
                )}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              aria-label="Or type your own emoji"
              placeholder="Or type your own"
              value={typed}
              inputMode="text"
              className="min-h-11 min-w-0 flex-1 rounded-xl px-3 text-base ring-1 ring-inset ring-ink-200 focus-visible:outline-2 focus-visible:outline-brand-600"
              onChange={(e) => setTyped(emojiOnly(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && typed) {
                  e.preventDefault();
                  pick(typed);
                }
              }}
            />
            <button
              type="button"
              disabled={!typed}
              onClick={() => pick(typed)}
              className="min-h-11 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              Use
            </button>
          </div>
          {optional && value ? (
            <button
              type="button"
              onClick={() => pick('')}
              className="mt-2 min-h-11 w-full rounded-xl text-sm font-medium text-ink-700 hover:bg-ink-100"
            >
              No emoji
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
