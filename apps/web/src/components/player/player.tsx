'use client';

import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Answer, DraftStep, RevealedGift, Theme } from '@momentpath/contracts';
import { PlayerError, type PlayerBackend, type PlayerState } from './backend';
import { ReportDialog } from './report-dialog';
import { GiftStep } from './steps/gift-step';
import { ImageStep } from './steps/image-step';
import { MessageStep } from './steps/message-step';
import { MultipleChoiceStep } from './steps/multiple-choice-step';
import { ScratchStep } from './steps/scratch-step';
import type { StepProps } from './steps/types';
import { YesNoStep } from './steps/yes-no-step';
import { accentButton, outlineButton, themeClass, themeStyle } from './theme';

const VARIANTS: Record<Theme['animation'], Variants> = {
  NONE: { initial: {}, animate: {}, exit: {} },
  FADE: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  SLIDE: {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  },
  POP: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
  },
};

function StepView(props: StepProps) {
  const { step } = props;
  switch (step.type) {
    case 'MESSAGE':
      return <MessageStep {...(props as StepProps<'MESSAGE'>)} />;
    case 'IMAGE':
      return <ImageStep {...(props as StepProps<'IMAGE'>)} />;
    case 'MULTIPLE_CHOICE':
      return <MultipleChoiceStep {...(props as StepProps<'MULTIPLE_CHOICE'>)} />;
    case 'YES_NO_CHOICE':
      return <YesNoStep {...(props as StepProps<'YES_NO_CHOICE'>)} />;
    case 'SCRATCH_REVEAL':
      return <ScratchStep {...(props as StepProps<'SCRATCH_REVEAL'>)} />;
    case 'GIFT_REVEAL':
      return <GiftStep {...(props as StepProps<'GIFT_REVEAL'>)} />;
  }
}

export interface PlayerProps {
  backend: PlayerBackend;
  initialTheme: Theme;
  /** Preview frames are contained, not full-screen. */
  embedded?: boolean;
}

/**
 * Recipient experience. The Close control is rendered outside the step area on every screen
 * and is never covered, disabled or moved by any step behaviour. Closing records no answer.
 */
export function Player({ backend, initialTheme, embedded = false }: PlayerProps) {
  const [state, setState] = useState<PlayerState | null>(null);
  const [error, setError] = useState<PlayerError | null>(null);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    backend.load().then(
      (loaded) => {
        if (cancelled) return;
        setError(null);
        setState(loaded);
        setViewing(loaded.progress.nextStepKey ?? loaded.experience.steps.at(-1)?.key ?? null);
      },
      (err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof PlayerError ? err : new PlayerError('NETWORK', 'Something went wrong'),
          );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [backend, attempt]);

  const theme = state?.experience.theme ?? initialTheme;
  const steps: DraftStep[] = useMemo(() => state?.experience.steps ?? [], [state]);
  const current = steps.find((s) => s.key === viewing) ?? null;
  const index = current ? steps.indexOf(current) : -1;
  const finished = state?.progress.completed === true && current?.type !== 'GIFT_REVEAL';

  const submit = useCallback(
    async (answer: Answer): Promise<boolean | null> => {
      if (!current) return null;
      setBusy(true);
      setNotice(null);
      try {
        const res = await backend.answer(current.key, answer);
        if (
          res.correct === false &&
          current.type === 'MULTIPLE_CHOICE' &&
          current.config.requireCorrect
        )
          return false;
        setState((s) => (s ? { ...s, progress: res.progress } : s));
        setViewing(res.progress.nextStepKey);
        return res.correct;
      } catch (err) {
        setNotice(
          err instanceof PlayerError ? err.message : 'Something went wrong. Please try again.',
        );
        if (err instanceof PlayerError && err.code === 'EXPERIENCE_UNAVAILABLE') setError(err);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [backend, current],
  );

  const reveal = useCallback(async (): Promise<RevealedGift | null> => {
    if (!current) return null;
    setBusy(true);
    setNotice(null);
    try {
      const res = await backend.reveal(current.key);
      setState((s) => (s ? { ...s, progress: res.progress } : s));
      return res.gift;
    } catch (err) {
      const code = err instanceof PlayerError ? err.code : '';
      setNotice(
        code === 'GIFT_ALREADY_REVEALED'
          ? 'This surprise has already been opened on another device.'
          : code === 'GIFT_LOCKED'
            ? 'Finish the earlier steps to unlock your surprise.'
            : 'The surprise could not be opened. Please try again.',
      );
      if (code === 'EXPERIENCE_UNAVAILABLE' && err instanceof PlayerError) setError(err);
      return null;
    } finally {
      setBusy(false);
    }
  }, [backend, current]);

  function close() {
    // Fire-and-forget: closing must work even offline and never submits an answer.
    void backend.close();
    setClosed(true);
  }

  const variants = reducedMotion ? VARIANTS.NONE : VARIANTS[theme.animation];
  const shell = embedded ? 'relative h-full min-h-full' : 'relative min-h-dvh';

  return (
    <div
      className={`${themeClass(theme)} ${shell} flex flex-col overflow-x-hidden`}
      style={themeStyle(theme)}
      data-testid="player"
    >
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div className="min-w-0 flex-1">
          {state && !closed && steps.length > 0 ? (
            <div
              aria-label={`Step ${Math.min(index + 1, steps.length)} of ${steps.length}`}
              role="img"
              className="flex max-w-60 gap-1"
            >
              {steps.map((s, i) => (
                <span
                  key={s.key}
                  className={`h-1.5 flex-1 rounded-full ${i <= index || finished ? 'bg-[var(--mp-accent)]' : 'bg-current opacity-15'}`}
                />
              ))}
            </div>
          ) : null}
        </div>
        {!closed ? (
          <button
            type="button"
            onClick={close}
            aria-label="Close experience"
            data-testid="close-experience"
            className="relative z-50 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--mp-surface)] text-[var(--mp-text)] shadow-md ring-1 ring-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mp-accent)]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : null}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-6">
        {error?.code === 'EXPERIENCE_UNAVAILABLE' ? (
          <Unavailable />
        ) : closed ? (
          <div className="space-y-4 text-center" data-testid="closed-screen">
            <h1 className="text-[1.5em] font-bold">You closed this experience</h1>
            <p>Nothing was answered on your behalf. You can come back to it whenever you like.</p>
            <button type="button" className={outlineButton} onClick={() => setClosed(false)}>
              Reopen
            </button>
          </div>
        ) : error ? (
          <div className="space-y-4 text-center">
            <p>{error.message}</p>
            <button
              type="button"
              className={accentButton}
              onClick={() => {
                setError(null);
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : !state ? (
          <p className="text-center opacity-70" role="status">
            Loading…
          </p>
        ) : finished || !current ? (
          <div className="space-y-3 text-center" data-testid="finished-screen">
            <p className="text-[2em]" aria-hidden="true">
              💝
            </p>
            <h1 className="text-[1.5em] font-bold">That’s everything</h1>
            <p>Thank you for taking part.</p>
          </div>
        ) : (
          <>
            {index === 0 ? (
              <p className="mb-4 rounded-2xl bg-black/5 px-3 py-2 text-center text-sm">
                {state.experience.responsesVisibleToCreator
                  ? 'Your answers will be shared with the person who sent this.'
                  : 'Only overall totals are shared with the person who sent this.'}{' '}
                You can close this at any time.
              </p>
            ) : null}
            <AnimatePresence mode="wait" initial={false}>
              <motion.section
                key={current.key}
                aria-label={`Step ${index + 1} of ${steps.length}`}
                variants={variants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="rounded-3xl bg-[var(--mp-surface)] p-5 shadow-lg sm:p-7"
              >
                <StepView
                  step={current}
                  media={state.experience.media}
                  busy={busy}
                  reducedMotion={reducedMotion}
                  submit={submit}
                  reveal={reveal}
                  preview={backend.mode === 'preview'}
                />
              </motion.section>
            </AnimatePresence>
            {notice ? (
              <p role="alert" className="mt-4 text-center text-sm font-medium">
                {notice}
              </p>
            ) : null}
          </>
        )}
      </main>

      <footer className="flex items-center justify-between gap-2 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs opacity-70">
        <span>Made with MomentPath</span>
        {backend.mode === 'live' && error?.code !== 'EXPERIENCE_UNAVAILABLE' ? (
          <button type="button" className="min-h-9 underline" onClick={() => setReporting(true)}>
            Report
          </button>
        ) : null}
      </footer>
      <ReportDialog
        open={reporting}
        onOpenChange={setReporting}
        onSubmit={(c, d) => backend.report(c, d)}
      />
    </div>
  );
}

export function Unavailable() {
  return (
    <div className="space-y-3 text-center" data-testid="unavailable">
      <h1 className="text-[1.5em] font-bold">This experience isn’t available</h1>
      <p>The link may be mistyped, or the experience is no longer shared.</p>
    </div>
  );
}
