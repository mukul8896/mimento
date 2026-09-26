import type { SoundEffect } from '@momentpath/contracts';
import { midiOf } from './songs';
import { mtof, playNote, type Out } from './synth';

const TINY = 0.0001;

function tone(
  o: Out,
  type: OscillatorType,
  t: number,
  from: number,
  to: number,
  dur: number,
  level: number,
) {
  const s = o.ctx.createOscillator();
  s.type = type;
  s.frequency.setValueAtTime(from, t);
  s.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6);
  const g = o.ctx.createGain();
  g.gain.setValueAtTime(TINY, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.005);
  g.gain.exponentialRampToValueAtTime(TINY, t + dur);
  s.connect(g).connect(o.dry);
  s.start(t);
  s.stop(t + dur + 0.05);
  return s;
}

function burstNoise(
  o: Out,
  t: number,
  dur: number,
  level: number,
  type: BiquadFilterType,
  freq: number,
  q = 1,
) {
  const src = o.ctx.createBufferSource();
  src.buffer = o.noise;
  src.loop = true;
  const f = o.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = o.ctx.createGain();
  g.gain.setValueAtTime(TINY, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.004);
  g.gain.exponentialRampToValueAtTime(TINY, t + dur);
  src.connect(f).connect(g).connect(o.dry);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
  return { src, f, g };
}

const n = midiOf;

function sparkle(o: Out, t: number, count = 10) {
  for (let i = 0; i < count; i++) {
    const midi = 84 + Math.floor(Math.random() * 16);
    playNote(o, 'chime', t + i * 0.045, midi, 0.3, 0.35 + Math.random() * 0.25);
  }
}

/** Plays one effect at `t`. */
export function playEffect(o: Out, effect: SoundEffect, t: number): void {
  switch (effect) {
    case 'NONE':
      return;
    case 'POP':
      tone(o, 'sine', t, 420, 1100, 0.09, 0.35);
      burstNoise(o, t, 0.03, 0.08, 'highpass', 4000);
      return;
    case 'YAY':
      ['C5', 'E5', 'G5', 'C6'].forEach((m, i) =>
        playNote(o, 'marimba', t + i * 0.07, n(m), 0.3, 0.9),
      );
      ['C5', 'E5', 'G5', 'C6'].forEach((m, i) =>
        playNote(o, 'bell', t + i * 0.07, n(m) + 12, 0.3, 0.5),
      );
      sparkle(o, t + 0.3, 8);
      return;
    case 'APPLAUSE': {
      for (let i = 0; i < 70; i++) {
        const at = t + Math.random() ** 1.6 * 1.8;
        burstNoise(
          o,
          at,
          0.03 + Math.random() * 0.04,
          0.3 + Math.random() * 0.25,
          'bandpass',
          900 + Math.random() * 1800,
          1.2,
        );
      }
      return;
    }
    case 'FANFARE': {
      const notes: [string, number, number][] = [
        ['G4', 0, 0.12],
        ['C5', 0.13, 0.12],
        ['E5', 0.26, 0.12],
        ['G5', 0.39, 0.7],
      ];
      for (const [m, at, d] of notes) {
        playNote(o, 'brass', t + at, n(m), d, 0.9);
        playNote(o, 'brass', t + at, n(m) - 12, d, 0.5);
      }
      for (const m of ['C5', 'E5', 'G5']) playNote(o, 'brass', t + 0.39, n(m), 0.7, 0.45);
      playNote(o, 'kick', t + 0.39, 36, 0.3, 0.8);
      burstNoise(o, t + 0.39, 1.3, 0.12, 'highpass', 5000);
      sparkle(o, t + 0.45, 12);
      return;
    }
    case 'DING':
      playNote(o, 'bell', t, n('B5'), 0.4, 1);
      playNote(o, 'bell', t + 0.11, n('E6'), 0.6, 1);
      return;
    case 'CHIME':
      ['C6', 'E6', 'G6', 'B6', 'D7'].forEach((m, i) =>
        playNote(o, 'chime', t + i * 0.08, n(m), 1, 0.8),
      );
      return;
    case 'SPARKLE':
      sparkle(o, t, 12);
      return;
    case 'BOING': {
      const s = o.ctx.createOscillator();
      s.type = 'triangle';
      s.frequency.setValueAtTime(160, t);
      s.frequency.exponentialRampToValueAtTime(620, t + 0.07);
      s.frequency.exponentialRampToValueAtTime(260, t + 0.45);
      const lfo = o.ctx.createOscillator();
      lfo.frequency.value = 17;
      const depth = o.ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(70, t + 0.08);
      depth.gain.linearRampToValueAtTime(10, t + 0.45);
      lfo.connect(depth).connect(s.frequency);
      const g = o.ctx.createGain();
      g.gain.setValueAtTime(TINY, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      g.gain.exponentialRampToValueAtTime(TINY, t + 0.5);
      s.connect(g).connect(o.dry);
      s.start(t);
      lfo.start(t);
      s.stop(t + 0.55);
      lfo.stop(t + 0.55);
      return;
    }
    case 'WOMP': {
      // Sad trombone: four falling notes, the last one wobbling.
      const steps: [number, number, number][] = [
        [n('G3'), 0, 0.34],
        [n('F#3'), 0.36, 0.34],
        [n('F3'), 0.72, 0.34],
        [n('E3'), 1.08, 1],
      ];
      for (const [midi, at, d] of steps) {
        const s = o.ctx.createOscillator();
        s.type = 'sawtooth';
        s.frequency.value = mtof(midi);
        const lp = o.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(500, t + at);
        lp.frequency.linearRampToValueAtTime(1400, t + at + 0.12);
        lp.frequency.linearRampToValueAtTime(700, t + at + d);
        const g = o.ctx.createGain();
        g.gain.setValueAtTime(TINY, t + at);
        g.gain.exponentialRampToValueAtTime(0.16, t + at + 0.04);
        g.gain.setValueAtTime(0.16, t + at + d - 0.08);
        g.gain.exponentialRampToValueAtTime(TINY, t + at + d);
        if (d > 0.5) {
          const lfo = o.ctx.createOscillator();
          lfo.frequency.value = 6;
          const depth = o.ctx.createGain();
          depth.gain.value = 6;
          lfo.connect(depth).connect(s.frequency);
          lfo.start(t + at + 0.15);
          lfo.stop(t + at + d);
        }
        s.connect(lp).connect(g).connect(o.dry);
        s.start(t + at);
        s.stop(t + at + d + 0.05);
      }
      return;
    }
    case 'BUZZ':
      for (const f of [138, 146]) {
        const s = o.ctx.createOscillator();
        s.type = 'square';
        s.frequency.value = f;
        const lp = o.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400;
        const g = o.ctx.createGain();
        g.gain.setValueAtTime(TINY, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
        g.gain.setValueAtTime(0.09, t + 0.3);
        g.gain.exponentialRampToValueAtTime(TINY, t + 0.38);
        s.connect(lp).connect(g).connect(o.dry);
        s.start(t);
        s.stop(t + 0.4);
      }
      return;
    case 'WHOOSH': {
      const { f, g } = burstNoise(o, t, 0.6, 0.6, 'bandpass', 300, 1.4);
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(2600, t + 0.25);
      f.frequency.exponentialRampToValueAtTime(500, t + 0.6);
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(TINY, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.22);
      g.gain.exponentialRampToValueAtTime(TINY, t + 0.6);
      return;
    }
    case 'DRUMROLL': {
      const hits = 26;
      for (let i = 0; i < hits; i++) {
        const at = t + i * 0.042;
        burstNoise(o, at, 0.06, 0.05 + (i / hits) * 0.2, 'bandpass', 2000, 0.8);
      }
      const end = t + hits * 0.042;
      playNote(o, 'kick', end, 36, 0.3, 0.9);
      burstNoise(o, end, 1.4, 0.18, 'highpass', 4500);
      return;
    }
    case 'HEARTBEAT':
      for (const [at, vel] of [
        [0, 1],
        [0.22, 0.7],
        [0.9, 1],
        [1.12, 0.7],
      ] as const) {
        tone(o, 'sine', t + at, 90, 45, 0.22, 0.5 * vel);
      }
      return;
  }
}

/**
 * Climax cues: not creator-selectable effects, but the sound of an experience's peak.
 * SWELL rises from nothing into a warm chord; REVEAL is a soft, bright shimmer.
 */
export type Cue = 'HEARTBEAT' | 'SWELL' | 'REVEAL';

export function playCue(o: Out, cue: Cue, t: number): void {
  if (cue === 'HEARTBEAT') return playEffect(o, 'HEARTBEAT', t);
  if (cue === 'REVEAL') {
    sparkle(o, t, 8);
    ['E6', 'G#6', 'B6'].forEach((m, i) =>
      playNote(o, 'chime', t + 0.05 + i * 0.1, n(m), 1.4, 0.55),
    );
    return;
  }
  // A major-ninth pad that blooms over two seconds, with a bell on top as it arrives.
  const chord = ['E3', 'B3', 'E4', 'G#4', 'B4', 'F#5'];
  const g = o.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 1.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
  g.connect(o.dry);
  const swell: Out = { ...o, dry: g };
  chord.forEach((m, i) => playNote(swell, 'pad', t + i * 0.04, n(m), 4.8, 0.7));
  playNote(o, 'bell', t + 1.5, n('B5'), 2.5, 0.5);
  playNote(o, 'bell', t + 1.65, n('E6'), 2.5, 0.45);
}
