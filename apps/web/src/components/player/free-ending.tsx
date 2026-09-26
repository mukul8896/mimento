'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { accentButton, outlineButton } from './theme';

/**
 * After a FREE surprise has fully ended (and had a few seconds to breathe): a quiet
 * continuation, never an interruption. Paid surprises never show it. "See it again" returns to
 * the ending they were on.
 */
export function FreeEnding({
  onBack,
  reducedMotion,
  preview = false,
}: {
  onBack: () => void;
  reducedMotion: boolean;
  /** In the creator's preview the button explains itself instead of leaving the page. */
  preview?: boolean;
}) {
  const rise = (delay: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
        };
  return (
    <section className="space-y-5 px-2 text-center" data-testid="free-ending">
      <motion.p aria-hidden="true" className="text-[2.6em]" {...rise(0)}>
        ✨
      </motion.p>
      <motion.h1 className="text-[1.6em] font-bold leading-tight" {...rise(0.15)}>
        Someone made this for you with Wish Revealer
      </motion.h1>
      <motion.p className="text-[1.05em] opacity-85" {...rise(0.35)}>
        Now create a little surprise for someone you care about.
      </motion.p>
      <motion.div className="flex flex-col items-center gap-3 pt-2" {...rise(0.55)}>
        <Link
          href="/?ref=surprise-ending"
          className={`${accentButton} w-full max-w-xs`}
          data-testid="free-ending-cta"
          onClick={(e) => {
            if (preview) e.preventDefault();
          }}
          title={preview ? 'Opens Wish Revealer for the person who receives it' : undefined}
        >
          Create a surprise
        </Link>
        <button type="button" className={`${outlineButton} w-full max-w-xs`} onClick={onBack}>
          See it again
        </button>
      </motion.div>
    </section>
  );
}
