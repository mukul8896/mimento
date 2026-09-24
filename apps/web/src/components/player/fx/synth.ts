/**
 * Small Web Audio instruments. Every sound in the player (music and effects) is synthesised
 * here, so nothing is downloaded and there is nothing to license. Each voice schedules its own
 * nodes at time `t` and lets them stop themselves.
 */

export type Voice =
  | 'bell'
  | 'chime'
  | 'epiano'
  | 'pad'
  | 'pluck'
  | 'sitar'
  | 'marimba'
  | 'bass'
  | 'pizz'
  | 'brass'
  | 'kick'
  | 'snare'
  | 'clap'
  | 'shaker'
  | 'sleigh'
  | 'tablaLow'
  | 'tablaHigh';

export interface Out {
  ctx: BaseAudioContext;
  /** Dry bus. */
  dry: AudioNode;
  /** Reverb send. */
  wet: AudioNode;
  noise: AudioBuffer;
}

/** Level and reverb amount per voice, so songs only need to say how hard a note is played. */
const MIX: Record<Voice, { gain: number; wet: number }> = {
  bell: { gain: 0.2, wet: 0.45 },
  chime: { gain: 0.16, wet: 0.6 },
  epiano: { gain: 0.22, wet: 0.35 },
  pad: { gain: 0.07, wet: 0.6 },
  pluck: { gain: 0.16, wet: 0.3 },
  sitar: { gain: 0.14, wet: 0.35 },
  marimba: { gain: 0.2, wet: 0.25 },
  bass: { gain: 0.26, wet: 0.05 },
  pizz: { gain: 0.2, wet: 0.3 },
  brass: { gain: 0.13, wet: 0.3 },
  kick: { gain: 0.45, wet: 0.05 },
  snare: { gain: 0.12, wet: 0.2 },
  clap: { gain: 0.16, wet: 0.25 },
  shaker: { gain: 0.05, wet: 0.1 },
  sleigh: { gain: 0.06, wet: 0.25 },
  tablaLow: { gain: 0.4, wet: 0.15 },
  tablaHigh: { gain: 0.16, wet: 0.2 },
};

export const mtof = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

const TINY = 0.0001;

function osc(o: Out, type: OscillatorType, freq: number, t: number, end: number) {
  const node = o.ctx.createOscillator();
  node.type = type;
  node.frequency.setValueAtTime(freq, t);
  node.start(t);
  node.stop(end + 0.05);
  return node;
}

function noise(o: Out, t: number, end: number) {
  const src = o.ctx.createBufferSource();
  src.buffer = o.noise;
  src.loop = true;
  // Random start so repeated hits do not sound identical.
  src.start(t, Math.random() * 0.5);
  src.stop(end + 0.05);
  return src;
}

function gain(o: Out, value = 1) {
  const g = o.ctx.createGain();
  g.gain.value = value;
  return g;
}

function filter(o: Out, type: BiquadFilterType, freq: number, q = 0.7) {
  const f = o.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** Percussive envelope: quick attack, exponential decay. */
function perc(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(TINY, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, TINY * 2), t + attack);
  g.gain.exponentialRampToValueAtTime(TINY, t + attack + decay);
}

/** Sustained envelope: attack, hold until `off`, release. */
function sustain(
  g: GainNode,
  t: number,
  off: number,
  peak: number,
  attack: number,
  release: number,
) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, Math.max(t + attack, off));
  g.gain.exponentialRampToValueAtTime(TINY, Math.max(t + attack, off) + release);
}

/** Additive partials [ratio, level, decay] — bells, chimes and marimba. */
function partials(o: Out, out: AudioNode, t: number, f: number, list: [number, number, number][]) {
  let end = t;
  for (const [ratio, level, decay] of list) {
    const g = gain(o);
    perc(g, t, level, 0.004, decay);
    osc(o, 'sine', f * ratio, t, t + decay)
      .connect(g)
      .connect(out);
    end = Math.max(end, t + decay);
  }
  return end;
}

/**
 * Plays one note. `dur` is in seconds; `vel` 0..1. Drum voices ignore the pitch except the
 * tuned tabla.
 */
export function playNote(o: Out, voice: Voice, t: number, midi: number, dur: number, vel = 0.8) {
  const mix = MIX[voice];
  const amp = gain(o, mix.gain * vel);
  amp.connect(o.dry);
  const send = gain(o, mix.wet);
  amp.connect(send).connect(o.wet);
  const f = mtof(midi);

  switch (voice) {
    case 'bell':
      partials(o, amp, t, f, [
        [1, 1, 1.4],
        [2.005, 0.32, 0.6],
        [4.02, 0.12, 0.22],
      ]);
      return;
    case 'chime':
      partials(o, amp, t, f, [
        [1, 1, 2.6],
        [2.76, 0.3, 1.1],
        [5.4, 0.12, 0.45],
      ]);
      return;
    case 'marimba':
      partials(o, amp, t, f, [
        [1, 1, 0.5],
        [3.99, 0.22, 0.07],
      ]);
      return;
    case 'epiano': {
      const end = t + Math.max(1.2, dur * 1.3);
      const carrier = osc(o, 'sine', f, t, end);
      const mod = osc(o, 'sine', f, t, end);
      const index = gain(o);
      index.gain.setValueAtTime(f * 1.4, t);
      index.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.7);
      mod.connect(index).connect(carrier.frequency);
      const g = gain(o);
      perc(g, t, 1, 0.006, end - t);
      carrier.connect(g).connect(amp);
      partials(o, amp, t, f, [[4, 0.08, 0.12]]);
      return;
    }
    case 'pad': {
      const off = t + dur;
      const end = off + 1.2;
      const lp = filter(o, 'lowpass', 1000, 0.5);
      const g = gain(o);
      sustain(g, t, off, 1, Math.min(0.6, dur / 2), 1.2);
      lp.connect(g).connect(amp);
      for (const [type, ratio, level] of [
        ['sawtooth', 1.0035, 0.5],
        ['sawtooth', 0.9965, 0.5],
        ['triangle', 0.5, 0.6],
      ] as const) {
        const lvl = gain(o, level);
        osc(o, type, f * ratio, t, end)
          .connect(lvl)
          .connect(lp);
      }
      return;
    }
    case 'pluck': {
      const end = t + 0.7;
      const lp = filter(o, 'lowpass', 3200, 1);
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.3);
      const g = gain(o);
      perc(g, t, 1, 0.003, 0.65);
      lp.connect(g).connect(amp);
      osc(o, 'triangle', f, t, end).connect(lp);
      const saw = gain(o, 0.35);
      osc(o, 'sawtooth', f, t, end).connect(saw).connect(lp);
      return;
    }
    case 'sitar': {
      const end = t + Math.max(1.1, dur);
      const lp = filter(o, 'lowpass', 5000, 2);
      lp.frequency.setValueAtTime(5000, t);
      lp.frequency.exponentialRampToValueAtTime(1100, t + 0.45);
      const hp = filter(o, 'highpass', 180);
      const g = gain(o);
      perc(g, t, 1, 0.003, end - t);
      lp.connect(hp).connect(g).connect(amp);
      // A small upward bend at the start of each note gives the plucked-string "meend".
      const main = osc(o, 'sawtooth', f * 0.985, t, end);
      main.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      main.connect(lp);
      const buzz = gain(o, 0.22);
      osc(o, 'sawtooth', f * 2.003, t, end)
        .connect(buzz)
        .connect(lp);
      return;
    }
    case 'bass': {
      const end = t + dur + 0.15;
      const lp = filter(o, 'lowpass', 480, 0.8);
      const g = gain(o);
      sustain(g, t, t + dur * 0.85, 1, 0.01, 0.15);
      lp.connect(g).connect(amp);
      osc(o, 'triangle', f, t, end).connect(lp);
      const sub = gain(o, 0.6);
      osc(o, 'sine', f, t, end).connect(sub).connect(lp);
      return;
    }
    case 'pizz': {
      const lp = filter(o, 'lowpass', 2400, 1);
      const g = gain(o);
      perc(g, t, 1, 0.003, 0.24);
      lp.connect(g).connect(amp);
      osc(o, 'triangle', f, t, t + 0.3).connect(lp);
      partials(o, amp, t, f, [[2, 0.25, 0.1]]);
      return;
    }
    case 'brass': {
      const off = t + dur;
      const end = off + 0.2;
      const lp = filter(o, 'lowpass', 700, 1.5);
      lp.frequency.setValueAtTime(700, t);
      lp.frequency.exponentialRampToValueAtTime(3200, t + 0.06);
      lp.frequency.exponentialRampToValueAtTime(1600, t + 0.3);
      const g = gain(o);
      sustain(g, t, off, 1, 0.03, 0.18);
      lp.connect(g).connect(amp);
      osc(o, 'sawtooth', f, t, end).connect(lp);
      osc(o, 'sawtooth', f * 1.004, t, end).connect(lp);
      return;
    }
    case 'kick': {
      const s = osc(o, 'sine', 140, t, t + 0.4);
      s.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      const g = gain(o);
      perc(g, t, 1, 0.002, 0.34);
      s.connect(g).connect(amp);
      return;
    }
    case 'snare': {
      const bp = filter(o, 'bandpass', 2200, 0.7);
      const g = gain(o);
      perc(g, t, 1, 0.001, 0.12);
      noise(o, t, t + 0.15)
        .connect(bp)
        .connect(g)
        .connect(amp);
      return;
    }
    case 'clap': {
      const bp = filter(o, 'bandpass', 1300, 0.9);
      const g = gain(o);
      g.gain.setValueAtTime(TINY, t);
      for (const d of [0, 0.011, 0.022]) {
        g.gain.setValueAtTime(1, t + d);
        g.gain.exponentialRampToValueAtTime(0.1, t + d + 0.01);
      }
      g.gain.setValueAtTime(0.9, t + 0.03);
      g.gain.exponentialRampToValueAtTime(TINY, t + 0.2);
      noise(o, t, t + 0.22)
        .connect(bp)
        .connect(g)
        .connect(amp);
      return;
    }
    case 'shaker': {
      const hp = filter(o, 'highpass', 6500);
      const g = gain(o);
      perc(g, t, 1, 0.006, 0.05);
      noise(o, t, t + 0.08)
        .connect(hp)
        .connect(g)
        .connect(amp);
      return;
    }
    case 'sleigh': {
      const bp = filter(o, 'bandpass', 7800, 1.6);
      const g = gain(o);
      g.gain.setValueAtTime(TINY, t);
      for (const d of [0, 0.028, 0.056]) {
        g.gain.setValueAtTime(1, t + d);
        g.gain.exponentialRampToValueAtTime(0.15, t + d + 0.025);
      }
      g.gain.exponentialRampToValueAtTime(TINY, t + 0.22);
      noise(o, t, t + 0.25)
        .connect(bp)
        .connect(g)
        .connect(amp);
      partials(o, amp, t, 5200, [[1, 0.08, 0.1]]);
      return;
    }
    case 'tablaLow': {
      // Bayan: a deep boom whose pitch rises a little (the palm pressing the skin).
      const s = osc(o, 'sine', 82, t, t + 0.5);
      s.frequency.exponentialRampToValueAtTime(118, t + 0.22);
      const g = gain(o);
      perc(g, t, 1, 0.003, 0.42);
      s.connect(g).connect(amp);
      return;
    }
    case 'tablaHigh': {
      // Dayan: a tuned ring plus the slap of the finger.
      partials(o, amp, t, f, [
        [1, 1, 0.28],
        [2.01, 0.35, 0.12],
        [3.02, 0.15, 0.06],
      ]);
      const hp = filter(o, 'highpass', 3000);
      const g = gain(o);
      perc(g, t, 0.35, 0.001, 0.02);
      noise(o, t, t + 0.04)
        .connect(hp)
        .connect(g)
        .connect(amp);
      return;
    }
  }
}

/** One second of white noise, shared by every noisy voice. */
export function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** A soft hall: decaying stereo noise used as the reverb impulse. */
export function makeImpulse(ctx: BaseAudioContext, seconds = 2.4): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3.2;
  }
  return buffer;
}
