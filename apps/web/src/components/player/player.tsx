'use client';

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  NO_MUSIC,
  type Answer,
  type DraftStep,
  type Reaction,
  type Climax,
  type RevealedGift,
  type SceneTransition,
  type Theme,
} from '@momentpath/contracts';
import { PlayerError, type PlayerBackend, type PlayerState } from './backend';
import { AudioEngine } from './fx/engine';
import { ambientGlyphs, burstGlyphs, centerOf, splitEmoji } from './fx/emoji';
import { FxContext, SoundToggle, type Fx } from './fx/fx';
import { ParticleLayer, type Point } from './fx/particles';
import { ReportDialog } from './report-dialog';
import { OpeningSoon, PinGate } from './access-screens';
import { EditContext, type EditTarget } from './editable';
import { ClimaxLayer } from './motion/climax';
import { profileOf } from './motion/profiles';
import { danceFrame, STILL } from './motion/dance';
import {
  entranceStyle,
  layoutClass,
  ReactionMoment,
  SceneContext,
  sceneOf,
  sceneVariants,
  Veil,
} from './motion/scene';
import { FreeEnding } from './free-ending';
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
const noSubscribe = () => () => {};

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
  /** Personalize page: taps on editable text, photos and buttons open their editor instead. */
  onEdit?: (stepKey: string, field: string) => void;
  /** Hides the "your answers will be shared" note, which the creator does not need to see. */
  hideIntro?: boolean;
}

/**
 * Recipient experience. The Close control is rendered outside the step area on every screen
 * and is never covered, disabled or moved by any step behaviour. Closing records no answer.
 */
export function Player({
  backend,
  initialTheme,
  embedded = false,
  onEdit,
  hideIntro = false,
}: PlayerProps) {
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
  const root = useRef<HTMLDivElement>(null);
  /** Until when buttons hold still: a finger is on the screen, so nothing moves under it. */
  const stillUntil = useRef(0);

  // Scenes (templates with a motion profile): how the last scene left, the veil between
  // scenes, the short reaction after an answer, the climax, and a guard against taps while
  // one scene hands over to the next.
  const [leaving, setLeaving] = useState<SceneTransition | undefined>(undefined);
  const [veil, setVeil] = useState<{ kind: SceneTransition; run: number } | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const [climax, setClimax] = useState<{
    kind: Exclude<Climax, 'NONE'>;
    text: string;
    done: () => void;
  } | null>(null);
  const [settling, setSettling] = useState(false);
  const [promo, setPromo] = useState<'waiting' | 'shown' | 'dismissed'>('waiting');

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
  const profile = profileOf(theme);
  const scene = sceneOf(current);
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
  // Scenes set how present the music is: it can soften before the question that matters.
  useEffect(() => {
    if (!climax) engine.setLevel(profile ? (scene.music ?? 1) : 1);
  }, [engine, profile, scene.music, climax]);

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

  // Buttons move with the music. Not with reduced motion, and not in automated browsers, which
  // wait for elements to stop moving before they tap them; real phones always dance.
  const dance = profile?.dance ?? null;
  // Read on the client only (the server renders still buttons), so hydration always matches.
  const automated = useSyncExternalStore(
    noSubscribe,
    () => navigator.webdriver === true,
    () => true,
  );
  const dancing = dance !== null && !reducedMotion && !closed && !automated;
  useEffect(() => {
    const el = root.current;
    if (!dancing || !dance || !el) return;
    let raf = 0;
    let last = 0;
    let smooth = 0;
    let shown = STILL;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 33 || document.hidden) return; // about 30 frames a second is plenty
      last = now;
      const energy = engine.energy();
      smooth += (energy - smooth) * 0.12;
      const target =
        now < stillUntil.current ? STILL : danceFrame(now / 1000, energy, smooth, dance);
      // Ease towards the target, so pausing for a tap (and resuming) is never a jump.
      shown = {
        bobA: shown.bobA + (target.bobA - shown.bobA) * 0.35,
        bobB: shown.bobB + (target.bobB - shown.bobB) * 0.35,
        sway: shown.sway + (target.sway - shown.sway) * 0.35,
      };
      el.style.setProperty('--mp-bob-a', `${shown.bobA.toFixed(2)}px`);
      el.style.setProperty('--mp-bob-b', `${shown.bobB.toFixed(2)}px`);
      el.style.setProperty('--mp-sway', `${shown.sway.toFixed(2)}deg`);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.removeProperty('--mp-bob-a');
      el.style.removeProperty('--mp-bob-b');
      el.style.removeProperty('--mp-sway');
    };
  }, [dancing, dance, engine]);

  const celebration = theme.celebration ?? 'CONFETTI';
  const loaded = state !== null;
  const ambientMode = profile?.ambient ?? 'full';
  useEffect(() => {
    const on = loaded && !closed && ambientMode !== 'none';
    ambient.current?.setAmbient(
      on ? ambientGlyphs(celebration) : [],
      ambientMode === 'faint' ? 4 : undefined,
    );
  }, [celebration, loaded, closed, reducedMotion, ambientMode]);

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
    // The climax is the feedback for its own answer; nothing should compete with it.
    if (
      profile &&
      answer.kind === 'CHOICE' &&
      answer.value === 'YES' &&
      sceneOf(step).climax !== 'NONE'
    )
      return;
    if (profile && answer.kind === 'ACK') {
      if (profile.continueFx === 'none') return;
      fx.effect('POP');
      if (profile.continueFx === 'burst') fx.burst();
      return;
    }
    if (answer.kind === 'CHOICE' && step.type === 'YES_NO_CHOICE') {
      const reaction =
        answer.value === 'YES'
          ? step.config.yesReaction
          : answer.value === 'NO'
            ? step.config.noReaction
            : step.config.maybeReaction;
      fx.react(reaction);
      if (answer.value === 'YES' && !reducedMotion && (profile?.yesFx ?? 'shower') === 'shower')
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
    // In quieter profiles the scene's own reaction line is the celebration of a right answer.
    if (profile && profile.continueFx === 'none') {
      if (correct === true) engine.cue('REVEAL');
      else if (correct === false) shake();
      return;
    }
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

  /** Moves to the next scene, letting the one being left choose how it hands over. */
  const advance = useCallback(
    (from: DraftStep, next: string | null) => {
      const hand = from.scene?.transition ?? profile?.transition;
      setLeaving(hand);
      if (
        profile &&
        !reducedMotion &&
        (hand === 'FADE_THROUGH_DARK' || hand === 'FADE_THROUGH_LIGHT')
      )
        setVeil((v) => ({ kind: hand, run: (v?.run ?? 0) + 1 }));
      setViewing(next);
      if (profile) {
        setSettling(true);
        window.setTimeout(
          () => setSettling(false),
          (reducedMotion ? 0.3 : profile.duration * 1.5) * 1000,
        );
      }
    },
    [profile, reducedMotion],
  );

  /** The climax plays over everything; resolves when it has finished. */
  const playClimax = useCallback(
    (kind: Exclude<Climax, 'NONE'>, text: string) =>
      new Promise<void>((resolve) =>
        setClimax({
          kind,
          text,
          done: () => {
            setClimax(null);
            resolve();
          },
        }),
      ),
    [],
  );

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
        const sc = sceneOf(current);
        if (profile) {
          if (answer.kind === 'CHOICE' && answer.value === 'YES' && sc.climax !== 'NONE') {
            await playClimax(sc.climax, sc.reaction);
          } else if (sc.reaction && res.correct !== false) {
            // A moment of acknowledgement before the story moves on.
            setReaction(sc.reaction);
            await new Promise((r) =>
              window.setTimeout(r, reducedMotion ? 900 : (profile?.reactionHold ?? 1.8) * 1000),
            );
            setReaction(null);
          }
        }
        advance(current, res.progress.nextStepKey);
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
    [backend, current, fx, profile, advance, playClimax, reducedMotion],
  );

  const reveal = useCallback(async (): Promise<RevealedGift | null> => {
    if (!current) return null;
    setBusy(true);
    setNotice(null);
    try {
      const res = await backend.reveal(current.key);
      setState((s) => (s ? { ...s, progress: res.progress } : s));
      const sc = sceneOf(current);
      if (profile && sc.climax !== 'NONE') {
        await playClimax(sc.climax, sc.reaction);
      } else if (profile) {
        // The final reveal lands softly when the climax already happened earlier.
        engine.cue('REVEAL');
        if (profile.ambient === 'full') fx.celebrate();
      } else {
        fx.effect('FANFARE');
        fx.celebrate();
      }
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
  }, [backend, current, fx, profile, playClimax, engine]);

  // Free surprises: once the ending has had room to breathe, a gentle invitation follows.
  const branded = state?.experience.branded !== false;
  const ended =
    finished || (current?.type === 'GIFT_REVEAL' && state?.progress.giftRevealed === true);
  useEffect(() => {
    if (!branded || !ended || promo !== 'waiting' || onEdit) return;
    const timer = window.setTimeout(() => setPromo('shown'), finished ? 4500 : 9000);
    return () => window.clearTimeout(timer);
  }, [branded, ended, finished, promo, onEdit]);

  function close() {
    // Fire-and-forget: closing must work even offline and never submits an answer.
    void backend.close();
    setClosed(true);
  }

  const currentKey = current?.key ?? null;
  const editTarget: EditTarget | null = useMemo(
    () => (onEdit && currentKey ? { onEdit: (field: string) => onEdit(currentKey, field) } : null),
    [onEdit, currentKey],
  );

  const variants = profile
    ? sceneVariants(profile, reducedMotion)
    : reducedMotion
      ? VARIANTS.NONE
      : VARIANTS[theme.animation];
  const transition = profile
    ? undefined
    : reducedMotion
      ? TRANSITIONS.NONE
      : TRANSITIONS[theme.animation];
  const entrance = profile ? (scene.entrance ?? profile.entrance) : null;
  const enter = profile && entrance ? entranceStyle(profile, entrance) : null;
  const sceneState = useMemo(
    () => (profile && entrance ? { scene, entrance, reducedMotion } : null),
    [profile, entrance, scene, reducedMotion],
  );
  const holding = settling || reaction !== null || climax !== null;
  const shell = embedded ? 'relative h-full min-h-full' : 'relative min-h-dvh';
  const layer = `pointer-events-none ${embedded ? 'absolute' : 'fixed'} inset-0 size-full`;

  // Browsers allow sound only after a tap or key press, so the first one switches it on.
  const unlock = () => {
    engine.unlock();
    if (!unlocked) setUnlocked(true);
  };

  return (
    <div
      ref={root}
      className={`${themeClass(theme)} ${shell} flex flex-col overflow-x-hidden ${
        profile && profile.continueFx === 'none' ? 'mp-calm' : ''
      } ${dancing ? 'mp-dance' : ''}`}
      style={themeStyle(theme)}
      data-testid="player"
      onPointerDownCapture={(e) => {
        lastPointer.current = { x: e.clientX, y: e.clientY };
        stillUntil.current = performance.now() + 700;
      }}
      onPointerUpCapture={unlock}
      onKeyDownCapture={(e) => {
        lastPointer.current = null;
        if (e.key === 'Enter' || e.key === ' ') unlock();
      }}
    >
      <canvas ref={ambientCanvas} aria-hidden="true" className={`${layer} z-0`} />
      <canvas ref={burstCanvas} aria-hidden="true" className={`${layer} z-30`} />
      {veil && profile ? (
        <Veil kind={veil.kind} run={veil.run} duration={profile.duration} palette={theme.palette} />
      ) : null}
      <AnimatePresence>
        {climax ? (
          <ClimaxLayer
            key="climax"
            kind={climax.kind}
            text={climax.text}
            reducedMotion={reducedMotion}
            controls={{
              cue: (c, d) => engine.cue(c, d),
              setLevel: (l) => engine.setLevel(l),
              celebrate: () => fx.celebrate(),
            }}
            onDone={climax.done}
          />
        ) : null}
      </AnimatePresence>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div className="min-w-0 flex-1">
          {state && !closed && steps.length > 0 && profile ? (
            // Quiet scene markers: where they are in the story, not a questionnaire's bar.
            <div
              aria-label={`Step ${position} of ${steps.length}`}
              role="img"
              className="flex items-center gap-1.5"
              data-testid="scene-markers"
            >
              {steps.map((s, i) => (
                <span
                  key={s.key}
                  className={`h-1.5 rounded-full bg-[var(--mp-accent)] transition-all duration-700 ${
                    i === position - 1 && !finished
                      ? 'w-5 opacity-100'
                      : i < position || finished
                        ? 'w-1.5 opacity-70'
                        : 'w-1.5 opacity-20'
                  }`}
                />
              ))}
            </div>
          ) : state && !closed && steps.length > 0 ? (
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
        ) : promo === 'shown' && (finished || !current) ? (
          <FreeEnding
            onBack={() => setPromo('dismissed')}
            reducedMotion={reducedMotion}
            preview={backend.mode === 'preview'}
          />
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
            {/* The final scene stays mounted under the invitation, so "See it again" returns
                to it exactly as it was — the letter still open. */}
            {promo === 'shown' ? (
              <FreeEnding
                onBack={() => setPromo('dismissed')}
                reducedMotion={reducedMotion}
                preview={backend.mode === 'preview'}
              />
            ) : null}
            <div className={promo === 'shown' ? 'hidden' : 'contents'}>
              {position === 1 && !hideIntro ? (
                <p className="mb-4 rounded-2xl bg-black/5 px-3 py-2 text-center text-sm">
                  {state.experience.responsesVisibleToCreator
                    ? 'Your answers will be shared with the person who sent this.'
                    : 'Only overall totals are shared with the person who sent this.'}{' '}
                  You can close this at any time.
                </p>
              ) : null}
              <AnimatePresence mode="wait" initial={false} custom={leaving}>
                <motion.section
                  ref={card}
                  key={current.key}
                  aria-label={`Step ${position} of ${steps.length}`}
                  aria-busy={holding || undefined}
                  variants={variants}
                  custom={leaving}
                  initial="initial"
                  animate={
                    climax
                      ? { opacity: 0, transition: { duration: 0.6 } }
                      : reaction
                        ? { opacity: 0.12, transition: { duration: 0.35 } }
                        : 'animate'
                  }
                  exit="exit"
                  transition={transition}
                  className={
                    enter
                      ? `${layoutClass(scene)} ${enter.className} ${holding ? 'pointer-events-none' : ''}`
                      : `rounded-3xl bg-[var(--mp-surface)] p-5 shadow-lg sm:p-7 ${theme.animation === 'NONE' ? '' : 'mp-stagger'}`
                  }
                  style={enter?.style}
                  data-layout={profile ? scene.layout : undefined}
                >
                  <FxContext.Provider value={fx}>
                    <SceneContext.Provider value={sceneState}>
                      <EditContext.Provider value={editTarget}>
                        <StepView
                          step={current}
                          media={state.experience.media}
                          busy={busy}
                          reducedMotion={reducedMotion}
                          submit={submit}
                          reveal={reveal}
                          preview={backend.mode === 'preview'}
                        />
                      </EditContext.Provider>
                    </SceneContext.Provider>
                  </FxContext.Provider>
                </motion.section>
              </AnimatePresence>
              <AnimatePresence>
                {reaction ? (
                  <ReactionMoment key="reaction" text={reaction} reducedMotion={reducedMotion} />
                ) : null}
              </AnimatePresence>
              {notice ? (
                <p role="alert" className="mt-4 text-center text-sm font-medium">
                  {notice}
                </p>
              ) : null}
            </div>
          </>
        )}
      </main>

      <footer className="relative z-10 flex items-center justify-between gap-2 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs opacity-70">
        {/* Paid surprises carry no Wish Revealer branding. */}
        <span>{branded ? 'Made with Wish Revealer' : ''}</span>
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
