'use client';

import { motion, type Transition } from 'motion/react';
import { useState } from 'react';
import type { Cover } from '@momentpath/contracts';
import { PencilIcon } from '../editable';

/**
 * The first thing a recipient sees: their surprise, still closed — a sealed envelope, a
 * wrapped gift or a glowing light in the template's colours. Tapping it opens it, and that tap
 * is also what lets the browser play the music from the very first scene. The Close control
 * stays in the player's header above it; opening records nothing.
 */
/** Said when a cover has no line of its own. */
const DEFAULT_LINE: Record<Cover['kind'], string> = {
  ENVELOPE: 'A letter, sealed just for you',
  GIFT: 'Something wrapped, just for you',
  GLOW: 'A little light, lit just for you',
};
/** A quiet instruction, not a button: the letter, gift or light is what they tap. */
const HINT: Record<Cover['kind'], string> = {
  ENVELOPE: 'Tap the letter to open it',
  GIFT: 'Tap the gift to unwrap it',
  GLOW: 'Tap the light to begin',
};

export function OpeningCover({
  cover,
  notice,
  returning,
  seconds,
  reducedMotion,
  onOpen,
  onOpened,
  onEdit,
}: {
  cover: Cover;
  /** Who sees the answers; shown before anything is answered. */
  notice: string | null;
  /** Coming back part-way through. */
  returning: boolean;
  seconds: number;
  reducedMotion: boolean;
  /** The tap itself: sound and sparkle. */
  onOpen: () => void;
  /** The opening has played; the first scene can enter. */
  onOpened: () => void;
  /** Personalize: the cover stays closed and a tap opens its editor. */
  onEdit?: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const idle = !opening && !reducedMotion;

  const open = () => {
    if (onEdit) return onEdit();
    if (opening) return;
    setOpening(true);
    onOpen();
    window.setTimeout(onOpened, seconds * 1000);
  };

  return (
    // Anywhere on the cover opens it; the art is the one focusable control for keyboards.
    <motion.div
      className="flex cursor-pointer flex-col items-center gap-5 text-center"
      onClick={open}
      data-testid="opening-cover"
      data-kind={cover.kind}
      animate={opening ? { opacity: 0 } : { opacity: 1 }}
      transition={{ delay: opening ? seconds * 0.7 : 0, duration: seconds * 0.3 }}
    >
      {returning ? (
        <p className="text-[0.8em] font-semibold tracking-[0.2em] uppercase opacity-75">
          Welcome back
        </p>
      ) : null}
      <h1 className="max-w-xs text-[1.7em] leading-tight font-bold" data-testid="cover-line">
        {cover.line?.trim() || DEFAULT_LINE[cover.kind]}
      </h1>

      <button
        type="button"
        disabled={opening}
        aria-label={
          onEdit
            ? 'Edit the opening cover'
            : returning
              ? 'Continue your surprise'
              : 'Open your surprise'
        }
        data-testid="open-cover"
        className="relative my-2 flex min-h-56 w-full max-w-72 items-center justify-center rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mp-accent)]"
      >
        {/* A soft halo of light behind it, so the eye goes straight to what to tap. */}
        {onEdit ? null : (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 size-[21rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--mp-accent)_0%,transparent_62%)]"
            initial={{ opacity: 0.35, scale: 0.9 }}
            animate={
              opening
                ? { opacity: 0, scale: 1.2 }
                : idle
                  ? { opacity: [0.3, 0.65, 0.3], scale: [0.9, 1.05, 0.9] }
                  : { opacity: 0.35, scale: 1 }
            }
            transition={
              idle && !opening
                ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.3 }
            }
          />
        )}
        <motion.span
          aria-hidden="true"
          className="relative block"
          animate={idle ? { y: [0, -7, 0] } : { y: 0 }}
          transition={
            idle ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }
          }
        >
          {cover.kind === 'ENVELOPE' ? (
            <Envelope
              emoji={cover.emoji}
              opening={opening}
              seconds={seconds}
              reduced={reducedMotion}
            />
          ) : cover.kind === 'GIFT' ? (
            <Gift emoji={cover.emoji} opening={opening} seconds={seconds} reduced={reducedMotion} />
          ) : (
            <Glow emoji={cover.emoji} opening={opening} seconds={seconds} reduced={reducedMotion} />
          )}
        </motion.span>
        {onEdit ? (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 inline-flex size-10 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-2 ring-white"
          >
            <PencilIcon className="size-4" />
          </span>
        ) : null}
      </button>

      <motion.p
        className="flex items-center gap-2 text-[0.9em] font-medium tracking-wide opacity-80"
        data-testid="cover-hint"
        animate={idle ? { opacity: [0.55, 0.9, 0.55] } : { opacity: opening ? 0 : 0.8 }}
        transition={
          idle ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }
        }
      >
        <span aria-hidden="true">👆</span>
        {returning ? 'Tap to pick up where you left off' : HINT[cover.kind]}
      </motion.p>
      {notice ? <p className="max-w-xs text-[0.8em] opacity-70">{notice}</p> : null}
    </motion.div>
  );
}

interface ArtProps {
  emoji: string;
  opening: boolean;
  seconds: number;
  reduced: boolean;
}

const EASE: Transition['ease'] = [0.65, 0, 0.35, 1];

/** A sealed envelope: the seal lifts, the flap opens, the letter rises out. */
function Envelope({ emoji, opening, seconds, reduced }: ArtProps) {
  const t = (from: number, span: number): Transition => ({
    delay: reduced ? 0 : seconds * from,
    duration: reduced ? 0.01 : seconds * span,
    ease: EASE,
  });
  // Envelope paper takes a wash of the accent, so it stands out on dark surprises too;
  // the letter inside is always cream paper.
  const paper = 'var(--mp-envelope, color-mix(in srgb, var(--mp-surface) 72%, var(--mp-accent)))';
  return (
    <span className="relative block h-40 w-60 [perspective:800px]">
      {/* The letter, tucked inside until it rises. */}
      <motion.span
        className="absolute inset-x-4 top-3 bottom-3 rounded-lg bg-[#fffaf3] shadow-md"
        style={{ zIndex: 1 }}
        animate={opening ? { y: -66, scale: 1.08 } : { y: 0, scale: 1 }}
        transition={t(0.35, 0.45)}
      >
        <span className="absolute inset-x-5 top-5 block h-1.5 rounded-full bg-[var(--mp-accent)] opacity-40" />
        <span className="absolute top-9 left-5 block h-1.5 w-2/3 rounded-full bg-[#3a1d27] opacity-15" />
        <span className="absolute top-13 left-5 block h-1.5 w-1/2 rounded-full bg-[#3a1d27] opacity-15" />
      </motion.span>
      {/* The pocket in front of it. */}
      <span
        className="absolute inset-0 rounded-xl shadow-xl"
        style={{
          zIndex: 2,
          background: paper,
          clipPath: 'polygon(0 0, 50% 55%, 100% 0, 100% 100%, 0 100%)',
        }}
      />
      <span
        className="absolute inset-0 rounded-xl bg-black/5"
        style={{ zIndex: 2, clipPath: 'polygon(0 100%, 50% 50%, 100% 100%)' }}
      />
      {/* The flap: closed over the letter, then swung open behind it. */}
      <motion.span
        className="absolute inset-x-0 top-0 h-[58%] origin-top rounded-t-xl brightness-110 [backface-visibility:hidden]"
        style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', zIndex: 3, background: paper }}
        animate={opening ? { rotateX: 180, zIndex: 0 } : { rotateX: 0, zIndex: 3 }}
        transition={t(0.12, 0.35)}
      />
      {/* The wax seal. */}
      <motion.span
        className="absolute top-[58%] left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--mp-accent)] text-2xl shadow-lg ring-4 ring-[var(--mp-surface)]"
        style={{ zIndex: 4 }}
        animate={
          opening ? { scale: 0, rotate: 30, opacity: 0 } : { scale: 1, rotate: 0, opacity: 1 }
        }
        transition={t(0, 0.18)}
      >
        {emoji}
      </motion.span>
    </span>
  );
}

/** A wrapped gift: a little shake, the lid flies off, light spills out. */
function Gift({ emoji, opening, seconds, reduced }: ArtProps) {
  const t = (from: number, span: number): Transition => ({
    delay: reduced ? 0 : seconds * from,
    duration: reduced ? 0.01 : seconds * span,
    ease: EASE,
  });
  return (
    <motion.span
      className="relative block h-44 w-48"
      animate={opening && !reduced ? { rotate: [0, -5, 5, -3, 0] } : { rotate: 0 }}
      transition={t(0, 0.25)}
    >
      {/* Light from inside. */}
      <motion.span
        className="absolute top-10 left-1/2 block size-24 -translate-x-1/2 rounded-full bg-[var(--mp-accent)] blur-xl"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={
          opening ? { opacity: [0, 0.9, 0], scale: [0.4, 3, 4] } : { opacity: 0, scale: 0.4 }
        }
        transition={t(0.3, 0.6)}
      />
      {/* The box. */}
      <span className="absolute inset-x-3 top-14 bottom-0 overflow-hidden rounded-2xl bg-[var(--mp-accent)] shadow-xl">
        <span className="absolute inset-y-0 left-1/2 block w-7 -translate-x-1/2 bg-[var(--mp-surface)] opacity-90" />
        <span className="absolute bottom-4 left-1/2 flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--mp-surface)] text-2xl shadow">
          {emoji}
        </span>
      </span>
      {/* The lid and its bow. */}
      <motion.span
        className="absolute inset-x-0 top-8 block h-9 rounded-xl bg-[var(--mp-accent)] shadow-lg brightness-110"
        animate={
          opening
            ? { y: -110, x: 30, rotate: 28, opacity: 0 }
            : { y: 0, x: 0, rotate: 0, opacity: 1 }
        }
        transition={t(0.25, 0.5)}
      >
        <span className="absolute inset-y-0 left-1/2 block w-7 -translate-x-1/2 bg-[var(--mp-surface)] opacity-90" />
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl">🎀</span>
      </motion.span>
    </motion.span>
  );
}

/** A glowing light: it breathes, then blooms until the scene appears inside it. */
function Glow({ emoji, opening, seconds, reduced }: ArtProps) {
  const t = (from: number, span: number): Transition => ({
    delay: reduced ? 0 : seconds * from,
    duration: reduced ? 0.01 : seconds * span,
    ease: EASE,
  });
  return (
    <span className="relative flex size-48 items-center justify-center">
      <motion.span
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,var(--mp-accent)_0%,transparent_68%)]"
        animate={
          opening
            ? { scale: 9, opacity: [0.9, 0.7, 0] }
            : reduced
              ? { scale: 1, opacity: 0.8 }
              : { scale: [1, 1.12, 1], opacity: [0.7, 0.95, 0.7] }
        }
        transition={opening ? t(0.1, 0.85) : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="relative flex size-24 items-center justify-center rounded-full bg-[var(--mp-surface)] text-5xl shadow-xl ring-4 ring-[var(--mp-accent)]/40"
        animate={opening ? { scale: [1, 1.25, 0], opacity: [1, 1, 0] } : { scale: 1, opacity: 1 }}
        transition={t(0, 0.6)}
      >
        {emoji}
      </motion.span>
    </span>
  );
}
