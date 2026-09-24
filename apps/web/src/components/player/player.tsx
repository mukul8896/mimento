'use client';

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NO_MUSIC,
  type Answer,
  type DraftStep,
  type Reaction,
  type RevealedGift,
  type Theme,
} from '@momentpath/contracts';
import { PlayerError, type PlayerBackend, type PlayerState } from './backend';
import { AudioEngine } from './fx/engine';
import { ambientGlyphs, burstGlyphs, centerOf, splitEmoji } from './fx/emoji';
import { FxContext, SoundToggle, type Fx } from './fx/fx';
import { ParticleLayer, type Point } from './fx/particles';
import { ReportDialog } from './report-dialog';
import { OpeningSoon, PinGate } from './access-screens';
import { CountdownStep } from './steps/countdown-step';
import { GalleryStep } from './steps/gallery-step';
import { GiftStep } from './steps/gift-step';
import { ImageStep } from './steps/image-step';
import { MessageStep } from './steps/message-step';
import { MultipleChoiceStep } from './steps/multiple-choice-step';
import { PlaceStep } from './steps/place-step';
import { PuzzleStep } from './steps/puzzle-step';
import { ScratchStep } from './steps/scratch-step';
import type { StepProps } from './steps/types';
import { VideoStep } from './steps/video-step';
import { VoiceNoteStep } from './steps/voice-note-step';
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
    initial: { opacity: 0, scale: 0.85 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.94 },
  },
  FLIP: {
    initial: { opacity: 0, rotateY: -75, scale: 0.92 },
    animate: { opacity: 1, rotateY: 0, scale: 1 },
    exit: { opacity: 0, rotateY: 75, scale: 0.92 },
  },
  RISE: {
    initial: { opacity: 0, y: 70, scale: 0.94 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -50, scale: 0.97 },
  },
};

const SPRING: Transition = { type: 'spring', stiffness: 260, damping: 22 };
const TRANSITIONS: Record<Theme['animation'], Transition> = {
  NONE: { duration: 0 },
  FADE: { duration: 0.3 },
  SLIDE: { duration: 0.3, ease: 'easeOut' },
  POP: SPRING,
  FLIP: { type: 'spring', stiffness: 180, damping: 20 },
  RISE: SPRING,
};

const SOUND_PREF = 'wr-sound';

function readMutedPref(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SOUND_PREF) === 'off';
  } catch {
    return false;
  }
}

function writeMutedPref(muted: boolean) {
  try {
    window.localStorage.setItem(SOUND_PREF, muted ? 'off' : 'on');
  } catch {
    /* private mode */
  }
}

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
    case 'COUNTDOWN':
      return <CountdownStep {...(props as StepProps<'COUNTDOWN'>)} />;
    case 'PUZZLE':
      return <PuzzleStep {...(props as StepProps<'PUZZLE'>)} />;
    case 'PHOTO_GALLERY':
      return <GalleryStep {...(props as StepProps<'PHOTO_GALLERY'>)} />;
    case 'VOICE_NOTE':
      return <VoiceNoteStep {...(props as StepProps<'VOICE_NOTE'>)} />;
    case 'VIDEO':
      return <VideoStep {...(props as StepProps<'VIDEO'>)} />;
    case 'PLACE_REVEAL':
      return <PlaceStep {...(props as StepProps<'PLACE_REVEAL'>)} />;
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
  const [engine] = useState(() => new AudioEngine());
  // Read on first render: the toggle only appears after the client has loaded the experience.
  const [muted, setMuted] = useState(readMutedPref);
  const [unlocked, setUnlocked] = useState(false);
  const burstCanvas = useRef<HTMLCanvasElement>(null);
  const ambientCanvas = useRef<HTMLCanvasElement>(null);
  const bursts = useRef<ParticleLayer | null>(null);
  const ambient = useRef<ParticleLayer | null>(null);
  const lastPointer = useRef<Point | null>(null);
  const card = useRef<HTMLElement>(null);

  const [attempt, setAttempt] = useState(0);
  const [pin, setPin] = useState<string | undefined>(undefined);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    let cancelled = false;
    backend.load(pin ? { pin } : undefined).then(
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
  }, [backend, attempt, pin]);

  const theme = state?.experience.theme ?? initialTheme;
  const steps: DraftStep[] = useMemo(() => state?.experience.steps ?? [], [state]);
  const current = steps.find((s) => s.key === viewing) ?? null;
  // With branching the list order is not the recipient's order, so count steps they have done.
  const position = Math.min((state?.progress.completedStepKeys.length ?? 0) + 1, steps.length);
  const finished = state?.progress.completed === true && current?.type !== 'GIFT_REVEAL';
  const music = theme.music ?? NO_MUSIC;
  const musicUrl =
    music.source === 'UPLOAD'
      ? (state?.experience.media.find((m) => m.id === music.mediaId)?.url ?? null)
      : null;
  const hasSound = music.source !== 'NONE' || theme.sounds !== false;

  useEffect(() => () => engine.dispose(), [engine]);
  useEffect(() => engine.setMuted(muted), [engine, muted]);
  useEffect(() => {
    engine.setMusic(closed ? NO_MUSIC : music, musicUrl);
  }, [engine, music, musicUrl, closed]);
  // Embedded videos have their own sound; the music steps back while one is on screen.
  useEffect(() => engine.setDucked(current?.type === 'VIDEO'), [engine, current?.type]);

  useEffect(() => {
    if (reducedMotion || !burstCanvas.current || !ambientCanvas.current) return;
    bursts.current = new ParticleLayer(burstCanvas.current);
    ambient.current = new ParticleLayer(ambientCanvas.current);
    return () => {
      bursts.current?.dispose();
      ambient.current?.dispose();
      bursts.current = ambient.current = null;
    };
  }, [reducedMotion]);

  const celebration = theme.celebration ?? 'CONFETTI';
  const loaded = state !== null;
  useEffect(() => {
    ambient.current?.setAmbient(loaded && !closed ? ambientGlyphs(celebration) : []);
  }, [celebration, loaded, closed, reducedMotion]);

  const fx: Fx = useMemo(() => {
    const effect: Fx['effect'] = (e) => {
      if (theme.sounds !== false) engine.effect(e);
    };
    const origin = (at?: Point | Element | null): Point => {
      const point = centerOf(at) ?? lastPointer.current;
      if (point) return point;
      const r = card.current?.getBoundingClientRect();
      return r
        ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    };
    const burst: Fx['burst'] = ({ emoji, at, size = 'small' } = {}) => {
      const glyphs = emoji ? splitEmoji(emoji) : burstGlyphs(celebration);
      if (!emoji && celebration === 'NONE') return;
      const big = size === 'big';
      bursts.current?.burst(origin(at), glyphs, big ? 28 : 10, big ? 1.1 : 0.7);
    };
    return {
      effect,
      burst,
      react: (reaction: Reaction, at?: Point | Element | null) => {
        effect(reaction.sound);
        burst({ emoji: reaction.emoji, at, size: 'big' });
      },
      celebrate: () => {
        if (celebration !== 'NONE') bursts.current?.shower(burstGlyphs(celebration));
      },
      duck: (ducked: boolean) => engine.setDucked(ducked),
    };
  }, [engine, theme.sounds, celebration]);

  const shake = useCallback(() => {
    if (reducedMotion) return;
    card.current?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-10px)' },
        { transform: 'translateX(9px)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 420, easing: 'ease-out' },
    );
  }, [reducedMotion]);

  const wasFinished = useRef(false);
  useEffect(() => {
    if (finished && !wasFinished.current) {
      fx.effect('CHIME');
      fx.celebrate();
    }
    wasFinished.current = finished;
  }, [finished, fx]);

  /** Immediate feedback for the tap itself, before the server has answered. */
  function answerFx(step: DraftStep, answer: Answer) {
    if (answer.kind === 'CHOICE' && step.type === 'YES_NO_CHOICE') {
      const reaction =
        answer.value === 'YES'
          ? step.config.yesReaction
          : answer.value === 'NO'
            ? step.config.noReaction
            : step.config.maybeReaction;
      fx.react(reaction);
      if (answer.value === 'YES' && !reducedMotion)
        bursts.current?.shower(
          reaction.emoji ? splitEmoji(reaction.emoji) : burstGlyphs(celebration),
        );
    } else if (answer.kind === 'ACK') {
      fx.effect('POP');
      fx.burst();
    }
  }

  function resultFx(step: DraftStep, answer: Answer, correct: boolean | null) {
    if (answer.kind !== 'OPTION' && answer.kind !== 'TEXT') return;
    if (correct === true) {
      fx.effect('DING');
      fx.burst({ size: 'big' });
    } else if (correct === false) {
      fx.effect('BUZZ');
      shake();
    } else if (step.type === 'MULTIPLE_CHOICE') {
      fx.effect('POP');
      fx.burst();
    }
  }

  const submit = useCallback(
    async (answer: Answer): Promise<boolean | null> => {
      if (!current) return null;
      setBusy(true);
      setNotice(null);
      answerFx(current, answer);
      try {
        const res = await backend.answer(current.key, answer);
        resultFx(current, answer, res.correct);
        // A wrong required answer (quiz or puzzle) keeps the recipient on the same step.
        if (
          res.correct === false &&
          (current.type === 'PUZZLE' ||
            (current.type === 'MULTIPLE_CHOICE' && current.config.requireCorrect))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the fx helpers only read refs and fx
    [backend, current, fx],
  );

  const reveal = useCallback(async (): Promise<RevealedGift | null> => {
    if (!current) return null;
    setBusy(true);
    setNotice(null);
    try {
      const res = await backend.reveal(current.key);
      setState((s) => (s ? { ...s, progress: res.progress } : s));
      fx.effect('FANFARE');
      fx.celebrate();
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
  }, [backend, current, fx]);

  function close() {
    // Fire-and-forget: closing must work even offline and never submits an answer.
    void backend.close();
    setClosed(true);
  }

  const variants = reducedMotion ? VARIANTS.NONE : VARIANTS[theme.animation];
  const transition = reducedMotion ? TRANSITIONS.NONE : TRANSITIONS[theme.animation];
  const shell = embedded ? 'relative h-full min-h-full' : 'relative min-h-dvh';
  const layer = `pointer-events-none ${embedded ? 'absolute' : 'fixed'} inset-0 size-full`;

  // Browsers allow sound only after a tap or key press, so the first one switches it on.
  const unlock = () => {
    engine.unlock();
    if (!unlocked) setUnlocked(true);
  };

  return (
    <div
      className={`${themeClass(theme)} ${shell} flex flex-col overflow-x-hidden`}
      style={themeStyle(theme)}
      data-testid="player"
      onPointerDownCapture={(e) => {
        lastPointer.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUpCapture={unlock}
      onKeyDownCapture={(e) => {
        lastPointer.current = null;
        if (e.key === 'Enter' || e.key === ' ') unlock();
      }}
    >
      <canvas ref={ambientCanvas} aria-hidden="true" className={`${layer} z-0`} />
      <canvas ref={burstCanvas} aria-hidden="true" className={`${layer} z-30`} />
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div className="min-w-0 flex-1">
          {state && !closed && steps.length > 0 ? (
            <div
              aria-label={`Step ${position} of ${steps.length}`}
              role="img"
              className="flex max-w-60 gap-1"
            >
              {steps.map((s, i) => (
                <span
                  key={s.key}
                  className={`h-1.5 flex-1 rounded-full ${i < position || finished ? 'bg-[var(--mp-accent)]' : 'bg-current opacity-15'}`}
                />
              ))}
            </div>
          ) : null}
        </div>
        {!closed && hasSound && state ? (
          <SoundToggle
            muted={muted}
            playing={unlocked && music.source !== 'NONE'}
            onToggle={() => {
              const next = !muted;
              setMuted(next);
              writeMutedPref(next);
            }}
          />
        ) : null}
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

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-6 [perspective:1200px]">
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
        ) : error &&
          (error.code === 'PIN_REQUIRED' ||
            error.code === 'PIN_INCORRECT' ||
            error.code === 'PIN_LOCKED') ? (
          <PinGate
            code={error.code}
            lockedUntil={error.detail}
            onSubmit={(value) => {
              setPin(value);
              retry();
            }}
          />
        ) : error?.code === 'NOT_YET_OPEN' && error.detail ? (
          <OpeningSoon opensAt={error.detail} onOpen={retry} />
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
            {position === 1 ? (
              <p className="mb-4 rounded-2xl bg-black/5 px-3 py-2 text-center text-sm">
                {state.experience.responsesVisibleToCreator
                  ? 'Your answers will be shared with the person who sent this.'
                  : 'Only overall totals are shared with the person who sent this.'}{' '}
                You can close this at any time.
              </p>
            ) : null}
            <AnimatePresence mode="wait" initial={false}>
              <motion.section
                ref={card}
                key={current.key}
                aria-label={`Step ${position} of ${steps.length}`}
                variants={variants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
                className={`rounded-3xl bg-[var(--mp-surface)] p-5 shadow-lg sm:p-7 ${theme.animation === 'NONE' ? '' : 'mp-stagger'}`}
              >
                <FxContext.Provider value={fx}>
                  <StepView
                    step={current}
                    media={state.experience.media}
                    busy={busy}
                    reducedMotion={reducedMotion}
                    submit={submit}
                    reveal={reveal}
                    preview={backend.mode === 'preview'}
                  />
                </FxContext.Provider>
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

      <footer className="relative z-10 flex items-center justify-between gap-2 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs opacity-70">
        <span>Made with Wish Revealer</span>
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
