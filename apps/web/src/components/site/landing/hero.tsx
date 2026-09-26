'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import type { PublicExperience } from '@momentpath/contracts';
import { PhoneDemo } from '@/components/player/phone-demo';

const LINES = ['Create a surprise.', 'Make it personal.', 'Share the moment.'];

/**
 * The first impression: the promise in three lines, and a real surprise playing in a phone —
 * exactly what the person receiving one gets. Tap inside the phone to play it; nothing is saved.
 */
export function Hero({ demo, demoGift }: { demo: PublicExperience; demoGift?: string }) {
  const reduced = useReducedMotion() ?? false;
  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 22, filter: 'blur(8px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { delay, duration: 0.9, ease: [0.16, 1, 0.3, 1] as const },
        };
  return (
    <section
      className="relative grid items-center gap-10 pt-6 pb-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:pt-14 lg:pb-20"
      data-testid="hero"
    >
      <div className="text-center lg:text-left">
        <motion.p
          {...rise(0)}
          className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-brand-700 shadow-sm ring-1 ring-rose-200 backdrop-blur"
        >
          <span aria-hidden="true">✨</span> No account needed · start in seconds
        </motion.p>
        <h1 className="mt-5 text-[2.6rem] font-semibold leading-[1.05] text-ink-900 sm:text-6xl lg:text-7xl">
          {LINES.map((line, i) => (
            <motion.span key={line} {...rise(0.12 + i * 0.14)} className="block">
              {i === 2 ? <span className="wr-rose-text italic">{line}</span> : line}
            </motion.span>
          ))}
        </h1>
        <motion.p
          {...rise(0.6)}
          className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-ink-600 lg:mx-0"
        >
          A little journey of messages, memories and one last reveal — made by you, opened on their
          phone with one private link.
        </motion.p>
        <motion.div
          {...rise(0.75)}
          className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
        >
          <Link
            href="/new"
            className="wr-press inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-8 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 sm:w-auto"
            data-testid="hero-start"
          >
            Start free <span aria-hidden="true">→</span>
          </Link>
          <a
            href="#watch"
            className="wr-press inline-flex min-h-13 w-full items-center justify-center rounded-2xl bg-white/80 px-8 text-base font-semibold text-ink-800 shadow-sm ring-1 ring-ink-200 transition hover:ring-rose-300 sm:w-auto"
          >
            See one play ↓
          </a>
        </motion.div>
        <motion.ul
          {...rise(0.9)}
          className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-600 lg:justify-start"
        >
          <li>💝 Free templates</li>
          <li>🔒 One private link</li>
          <li>📱 No app to install</li>
        </motion.ul>
      </div>

      <motion.div
        id="watch"
        className="relative flex scroll-mt-6 justify-center"
        initial={reduced ? false : { opacity: 0, y: 40, rotate: 0 }}
        animate={{ opacity: 1, y: 0, rotate: reduced ? 0 : -2.5 }}
        transition={{ delay: 0.35, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* The light breathes; the phone itself stays still so its buttons are easy to tap. */}
        <div
          aria-hidden="true"
          className={`wr-halo absolute inset-x-6 top-10 bottom-16 rounded-full ${reduced ? '' : 'wr-breathe'}`}
        />
        <div className="relative">
          <PhoneDemo
            experience={demo}
            giftMessage={demoGift}
            label="A surprise, playing"
            frameClassName="h-[min(560px,74dvh)] w-[min(310px,80vw)]"
          />
        </div>
      </motion.div>
    </section>
  );
}
