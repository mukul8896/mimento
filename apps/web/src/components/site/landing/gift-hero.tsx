'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const COLORS = ['#ec4899', '#f59e0b', '#8b5cf6', '#10b981', '#3b82f6', '#ef4444'];

/** Deterministic pseudo-random so server and client agree before the box is opened. */
function confetti(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.3;
    const distance = 120 + ((i * 37) % 140);
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 80,
      rotate: (i * 47) % 360,
      color: COLORS[i % COLORS.length]!,
      size: 6 + (i % 4) * 3,
      round: i % 2 === 0,
    };
  });
}

/**
 * The hook: a gift box that begs to be tapped. Opening it bursts confetti and reveals the
 * promise and the call to action. With reduced motion everything is shown at once, no motion.
 */
export function GiftHero() {
  const reduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const pieces = useMemo(() => confetti(36), []);
  const shown = open || reduced;

  return (
    <section
      className="relative flex flex-col items-center py-10 text-center sm:py-16"
      data-testid="gift-hero"
    >
      <p className="text-sm font-medium uppercase tracking-widest text-brand-700">
        No account needed · start in seconds
      </p>
      <h1 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight text-ink-900 sm:text-6xl">
        Create a surprise. Make it personal. <span className="wr-shine">Share the moment.</span>
      </h1>

      <div className="relative mt-8 h-56 w-56">
        <AnimatePresence>
          {open && !reduced
            ? pieces.map((p, i) => (
                <motion.span
                  key={i}
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2"
                  style={{
                    width: p.size,
                    height: p.size,
                    background: p.color,
                    borderRadius: p.round ? '9999px' : '2px',
                  }}
                  initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                  animate={{ x: p.x, y: [0, p.y, p.y + 160], opacity: [1, 1, 0], rotate: p.rotate }}
                  transition={{ duration: 1.8, ease: 'easeOut' }}
                />
              ))
            : null}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={shown}
          aria-label={shown ? 'Gift opened' : 'Tap to open the gift'}
          className={`relative mx-auto block size-56 rounded-3xl focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-brand-500 ${shown ? '' : 'wr-wiggle cursor-pointer'}`}
          data-testid="open-gift"
        >
          <svg viewBox="0 0 200 200" className="size-full drop-shadow-xl" aria-hidden="true">
            <defs>
              <linearGradient id="box" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#f472b6" />
                <stop offset="1" stopColor="#db2777" />
              </linearGradient>
              <linearGradient id="lid" x1="0" x2="1">
                <stop offset="0" stopColor="#fb7185" />
                <stop offset="1" stopColor="#e11d48" />
              </linearGradient>
            </defs>
            <rect x="30" y="92" width="140" height="92" rx="12" fill="url(#box)" />
            <rect x="92" y="92" width="16" height="92" fill="#fde68a" />
            <motion.g
              initial={false}
              animate={
                shown && !reduced ? { y: -70, rotate: -22, opacity: 0.95 } : { y: 0, rotate: 0 }
              }
              transition={{ type: 'spring', stiffness: 160, damping: 12 }}
              style={{ originX: '30%', originY: '100%' }}
            >
              <rect x="22" y="66" width="156" height="32" rx="10" fill="url(#lid)" />
              <rect x="92" y="66" width="16" height="32" fill="#fde68a" />
              <path d="M100 66 C 70 30, 50 50, 100 66 C 150 50, 130 30, 100 66 Z" fill="#fbbf24" />
            </motion.g>
            {shown ? (
              <motion.text
                x="100"
                y="80"
                textAnchor="middle"
                fontSize="44"
                initial={reduced ? false : { y: 110, opacity: 0 }}
                animate={{ y: 70, opacity: 1 }}
                transition={{ delay: 0.25, type: 'spring' }}
              >
                💌
              </motion.text>
            ) : null}
          </svg>
          {shown ? null : (
            <span className="wr-pulse-ring absolute inset-6 rounded-full" aria-hidden="true" />
          )}
        </button>
      </div>

      {shown ? (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4 flex max-w-xl flex-col items-center gap-4"
        >
          <p className="text-lg text-ink-700">
            Messages, photos, quizzes, a No button that runs away — and a gift they unlock at the
            end. Pick a template, make it theirs right in the preview, and share one link.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/new"
              className="rounded-2xl bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-brand-700 active:scale-[0.98]"
            >
              Make one in 2 minutes
            </Link>
            <a
              href="#try"
              className="rounded-2xl bg-white px-7 py-3.5 text-base font-semibold text-brand-700 shadow ring-1 ring-brand-200 transition hover:ring-brand-400"
            >
              Try one yourself ↓
            </a>
          </div>
          <p className="text-sm text-ink-500">
            No sign-up. No app. Nothing to remember but one link.
          </p>
        </motion.div>
      ) : (
        <p className="mt-4 animate-pulse text-base font-semibold text-brand-700">
          👆 Tap the gift — it’s for you
        </p>
      )}
    </section>
  );
}
