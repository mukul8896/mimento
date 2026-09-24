import type { MusicTrack } from '@momentpath/contracts';
import type { Voice } from './synth';

/**
 * The built-in background tracks as note lists, played by the instruments in synth.ts.
 * Happy Birthday, Jingle Bells, Auld Lang Syne and Pachelbel's Canon are public-domain
 * melodies; the other tunes were written for Wish Revealer.
 */

export interface NoteEvent {
  beat: number;
  voice: Voice;
  midi: number;
  /** In beats. */
  dur: number;
  vel: number;
}

export interface Song {
  bpm: number;
  /** Loop length in beats. */
  beats: number;
  events: NoteEvent[];
  /** Evens out loudness between tracks (1 = as written). */
  gain?: number;
}

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C4" → 60, "F#5" → 78, "Bb3" → 58. */
export function midiOf(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]!]! + accidental;
}

/**
 * A melody line: "G4:.75 G4:.25 A4 r:2 C4+E4+G4:2" — note[:beats] (default 1), `r` rests and
 * `+` joins a chord. Returns the events and where the line ends.
 */
export function line(
  voice: Voice,
  start: number,
  notation: string,
  vel = 0.8,
  transpose = 0,
): NoteEvent[] {
  const events: NoteEvent[] = [];
  let beat = start;
  for (const token of notation.trim().split(/\s+/)) {
    const [notes = '', len] = token.split(':');
    const dur = len ? Number(len) : 1;
    if (notes !== 'r' && notes !== '|') {
      for (const n of notes.split('+'))
        events.push({ beat, voice, midi: midiOf(n) + transpose, dur, vel });
    }
    if (notes !== '|') beat += dur;
  }
  return events;
}

/** Plays `chord` notes (index into chord, then an octave up) on each step of `pattern`. */
function arp(
  voice: Voice,
  start: number,
  chord: string[],
  pattern: number[],
  step: number,
  vel: number,
): NoteEvent[] {
  const notes = chord.map(midiOf);
  const ext = [...notes, ...notes.map((n) => n + 12), ...notes.map((n) => n + 24)];
  return pattern.map((i, n) => ({
    beat: start + n * step,
    voice,
    midi: ext[i]!,
    dur: step * 2,
    vel,
  }));
}

const hit = (voice: Voice, beats: number[], vel: number, offset = 0, midi = 60): NoteEvent[] =>
  beats.map((b) => ({ beat: b + offset, voice, midi, dur: 0.25, vel }));

/** Repeats a one-bar pattern for each bar in [from, to). */
function bars(from: number, to: number, perBar: number, make: (at: number) => NoteEvent[]) {
  const out: NoteEvent[] = [];
  for (let b = from; b < to; b++) out.push(...make(b * perBar));
  return out;
}

const root = (chord: string[], down = 12) => midiOf(chord[0]!) - down;

// ---- Soft piano: Pachelbel's Canon progression -------------------------------------------
function lovePiano(): Song {
  const D = ['D3', 'F#3', 'A3'];
  const A = ['A2', 'C#3', 'E3'];
  const Bm = ['B2', 'D3', 'F#3'];
  const Fm = ['F#2', 'A2', 'C#3'];
  const G = ['G2', 'B2', 'D3'];
  const prog = [D, A, Bm, Fm, G, D, G, A, D, A, Bm, Fm, G, D, G, A];
  const events: NoteEvent[] = [];
  prog.forEach((chord, i) => {
    const at = i * 2;
    events.push(...arp('epiano', at, chord, [0, 2, 3, 4], 0.5, 0.55));
    events.push({ beat: at, voice: 'bass', midi: root(chord), dur: 2, vel: 0.7 });
    events.push(
      ...chord.map((n) => ({
        beat: at,
        voice: 'pad' as const,
        midi: midiOf(n) + 12,
        dur: 2,
        vel: 0.8,
      })),
    );
  });
  events.push(...line('bell', 0, 'F#5:2 E5:2 D5:2 C#5:2 B4:2 A4:2 B4:2 C#5:2', 0.7));
  events.push(...line('bell', 16, 'D5 F#5 E5 A5 F#5 D5 C#5 A4 B4 D5 F#5 A5 G5 B4 C#5 E5', 0.6));
  return { bpm: 68, beats: 32, events };
}

// ---- Birthday music box (3/4) -------------------------------------------------------------
function birthdayBox(): Song {
  const melody = [
    'A4 G4 C5', // birth-day to
    'B4:2 G4:.75 G4:.25', // you, hap-py
    'A4 G4 D5',
    'C5:2 G4:.75 G4:.25',
    'G5 E5 C5',
    'B4 A4 F5:.75 F5:.25',
    'E5 C5 D5',
    'C5:3',
    'r:3',
    'r:2 G4:.75 G4:.25',
  ].join(' ');
  const events = line('bell', 0, melody, 0.8, 12);
  const C = ['C3', 'E3', 'G3'];
  const G = ['G2', 'B2', 'D3'];
  const F = ['F2', 'A2', 'C3'];
  const chords = [C, G, G, C, C, F, C, C, C, G];
  chords.forEach((chord, i) => {
    const at = i * 3;
    events.push({ beat: at, voice: 'marimba', midi: root(chord, 0), dur: 1, vel: 0.7 });
    for (const beat of [1, 2]) {
      for (const n of chord.slice(1))
        events.push({ beat: at + beat, voice: 'marimba', midi: midiOf(n) + 12, dur: 1, vel: 0.4 });
    }
  });
  // Bar 7 turns to G on its last beat.
  events.push({ beat: 20, voice: 'marimba', midi: midiOf('B3'), dur: 1, vel: 0.3 });
  events.push(...arp('bell', 24, C, [3, 4, 5, 4, 3, 2], 0.5, 0.35));
  return { bpm: 104, beats: 30, events, gain: 2 };
}

// ---- Party pop ------------------------------------------------------------------------------
function party(): Song {
  const G = ['G3', 'B3', 'D4'];
  const D = ['D3', 'F#3', 'A3'];
  const Em = ['E3', 'G3', 'B3'];
  const C = ['C3', 'E3', 'G3'];
  const prog = [G, D, Em, C, G, D, Em, C];
  const events: NoteEvent[] = [];
  prog.forEach((chord, i) => {
    const at = i * 4;
    const r = root(chord);
    for (const [b, d] of [
      [0, 0.75],
      [1.5, 0.5],
      [2, 0.75],
      [3.5, 0.5],
    ] as const)
      events.push({ beat: at + b, voice: 'bass', midi: r, dur: d, vel: 0.75 });
    for (const b of [0.5, 2.5])
      for (const n of chord)
        events.push({ beat: at + b, voice: 'marimba', midi: midiOf(n) + 12, dur: 0.5, vel: 0.35 });
  });
  events.push(...bars(0, 8, 4, (at) => hit('kick', [0, 2], 0.7, at)));
  events.push(...bars(0, 8, 4, (at) => hit('clap', [1, 3], 0.6, at)));
  events.push(
    ...bars(0, 8, 4, (at) => [
      ...hit('shaker', [0, 1, 2, 3], 0.6, at),
      ...hit('shaker', [0.5, 1.5, 2.5, 3.5], 0.35, at),
    ]),
  );
  events.push(
    ...line(
      'pluck',
      0,
      [
        'B4:.5 D5:.5 E5:.5 D5:.5 B4 G4',
        'A4:.5 B4:.5 D5 A4:1.5 r:.5',
        'G4:.5 B4:.5 E5 D5:.5 B4:.5 G4',
        'E5 D5:.5 C5:.5 B4 A4',
        'B4:.5 D5:.5 E5:.5 D5:.5 G5 E5',
        'F#5:.5 E5:.5 D5 A4:1.5 r:.5',
        'G4:.5 B4:.5 E5 G5:.5 F#5:.5 E5',
        'D5 B4:.5 A4:.5 G4:2',
      ].join(' '),
      0.75,
    ),
  );
  return { bpm: 112, beats: 32, events };
}

// ---- Festive lights: sitar over a drone with a keherwa tabla groove ----------------------
function festive(): Song {
  const events: NoteEvent[] = [];
  const tonic = midiOf('D4');
  events.push(
    ...bars(0, 8, 4, (at) => [
      { beat: at, voice: 'pad', midi: midiOf('D3'), dur: 4, vel: 0.9 },
      { beat: at, voice: 'pad', midi: midiOf('A3'), dur: 4, vel: 0.7 },
      // Tanpura: Pa – Sa – Sa – Sa (low).
      ...line('pluck', at, 'A2 D3 D3 D2', 0.35),
    ]),
  );
  // Keherwa: dha ge na ti | na ka dhi na (one cycle per bar, in eighths).
  const bols: [Voice[], number][] = [
    [['tablaLow', 'tablaHigh'], 0.9],
    [['tablaLow'], 0.5],
    [['tablaHigh'], 0.7],
    [['tablaHigh'], 0.35],
    [['tablaHigh'], 0.7],
    [['tablaLow'], 0.35],
    [['tablaLow', 'tablaHigh'], 0.85],
    [['tablaHigh'], 0.6],
  ];
  events.push(
    ...bars(0, 8, 4, (at) =>
      bols.flatMap(([voices, vel], i) =>
        voices.map((voice) => ({ beat: at + i * 0.5, voice, midi: tonic, dur: 0.5, vel })),
      ),
    ),
  );
  events.push(...bars(0, 8, 4, (at) => hit('sleigh', [0], 0.5, at)));
  events.push(
    ...line(
      'sitar',
      0,
      [
        'D5:.5 E5:.5 F#5 A5 F#5:.5 E5:.5',
        'D5 E5:.5 F#5:.5 E5:2',
        'F#5:.5 A5:.5 B5 A5:.5 F#5:.5 E5',
        'D5:3 r',
        'A4:.5 B4:.5 D5 E5:.5 F#5:.5 E5',
        'D5:.5 E5:.5 F#5:.5 A5:.5 B5 A5',
        'F#5:.5 E5:.5 D5:.5 E5:.5 F#5 E5',
        'D5:4',
      ].join(' '),
      0.8,
    ),
  );
  return { bpm: 92, beats: 32, events, gain: 1.7 };
}

// ---- Jingle Bells (chorus) -------------------------------------------------------------------
function jingle(): Song {
  const melody = [
    'E5 E5 E5:2',
    'E5 E5 E5:2',
    'E5 G5 C5:1.5 D5:.5',
    'E5:4',
    'F5 F5 F5:1.5 F5:.5',
    'F5 E5 E5 E5:.5 E5:.5',
    'E5 D5 D5 E5',
    'D5:2 G5:2',
    'E5 E5 E5:2',
    'E5 E5 E5:2',
    'E5 G5 C5:1.5 D5:.5',
    'E5:4',
    'F5 F5 F5:1.5 F5:.5',
    'F5 E5 E5 E5:.5 E5:.5',
    'G5 G5 F5 D5',
    'C5:4',
  ].join(' ');
  const events = line('bell', 0, melody, 0.8);
  const C = ['C3', 'E3', 'G3'];
  const F = ['F2', 'A2', 'C3'];
  const D7 = ['D3', 'F#3', 'C4'];
  const G = ['G2', 'B2', 'D3'];
  const prog = [C, C, C, C, F, C, D7, G, C, C, C, C, F, C, G, C];
  prog.forEach((chord, i) => {
    const at = i * 4;
    const r = root(chord, 12);
    events.push({ beat: at, voice: 'bass', midi: r, dur: 1, vel: 0.7 });
    events.push({ beat: at + 2, voice: 'bass', midi: r + 7, dur: 1, vel: 0.6 });
    for (const b of [1, 3])
      for (const n of chord)
        events.push({ beat: at + b, voice: 'pizz', midi: midiOf(n) + 12, dur: 0.5, vel: 0.4 });
  });
  events.push(
    ...bars(0, 16, 4, (at) => [
      ...hit('sleigh', [0, 1, 2, 3], 0.7, at),
      ...hit('sleigh', [0.5, 1.5, 2.5, 3.5], 0.35, at),
    ]),
  );
  return { bpm: 124, beats: 64, events };
}

// ---- Auld Lang Syne ---------------------------------------------------------------------------
function auldLangSyne(): Song {
  const melody = [
    'F4:1.5 F4:.5 F4 A4',
    'G4:1.5 F4:.5 G4 A4:.5 G4:.5',
    'F4:1.5 F4:.5 A4 C5',
    'D5:3 D5',
    'C5:1.5 A4:.5 A4 F4',
    'G4:1.5 F4:.5 G4 A4:.5 G4:.5',
    'F4:1.5 D4:.5 D4 C4',
    'F4:4',
    'r:3 C4',
  ].join(' ');
  const events = line('chime', 0, melody, 0.8, 12);
  const F = ['F3', 'A3', 'C4'];
  const C = ['C3', 'E3', 'G3'];
  const Bb = ['Bb2', 'D3', 'F3'];
  const prog: [string[], number][] = [
    [F, 4],
    [C, 4],
    [F, 4],
    [Bb, 4],
    [F, 4],
    [C, 4],
    [Bb, 2],
    [C, 2],
    [F, 4],
    [F, 2],
    [C, 2],
  ];
  let at = 0;
  for (const [chord, len] of prog) {
    for (const n of chord)
      events.push({ beat: at, voice: 'epiano', midi: midiOf(n), dur: len, vel: 0.45 });
    for (const n of chord)
      events.push({ beat: at, voice: 'pad', midi: midiOf(n) + 12, dur: len, vel: 0.7 });
    events.push({ beat: at, voice: 'bass', midi: root(chord), dur: len, vel: 0.6 });
    at += len;
  }
  return { bpm: 80, beats: 36, events };
}

// ---- Dreamy stars -----------------------------------------------------------------------------
function dreamy(): Song {
  const chords = [
    ['C3', 'E3', 'G3', 'B3'],
    ['A2', 'C3', 'E3', 'G3'],
    ['F2', 'A2', 'C3', 'E3'],
    ['G2', 'B2', 'D3', 'E3'],
    ['C3', 'E3', 'G3', 'B3'],
    ['E2', 'G2', 'B2', 'D3'],
    ['F2', 'A2', 'C3', 'E3'],
    ['G2', 'B2', 'D3', 'F3'],
  ];
  // A fixed "random" sprinkle of chord tones so the loop is identical every time.
  const sprinkle: [number, number][][] = [
    [
      [0, 6],
      [1, 5],
      [1.5, 7],
      [3, 4],
    ],
    [
      [0, 7],
      [1.5, 6],
      [2.5, 5],
      [3.5, 8],
    ],
    [
      [0.5, 5],
      [1, 7],
      [2, 6],
      [3, 4],
    ],
    [
      [0, 6],
      [1, 7],
      [2.5, 8],
      [3, 5],
    ],
  ];
  const events: NoteEvent[] = [];
  chords.forEach((chord, i) => {
    const at = i * 4;
    for (const n of chord)
      events.push({ beat: at, voice: 'pad', midi: midiOf(n) + 12, dur: 4, vel: 0.8 });
    events.push({ beat: at, voice: 'bass', midi: root(chord, 0), dur: 4, vel: 0.5 });
    const notes = chord.map(midiOf);
    const ext = [...notes, ...notes.map((n) => n + 12), ...notes.map((n) => n + 24)];
    for (const [b, idx] of sprinkle[i % 4]!)
      events.push({ beat: at + b, voice: 'chime', midi: ext[idx]! + 12, dur: 1, vel: 0.55 });
  });
  return { bpm: 64, beats: 32, events };
}

// ---- Playful plucks -----------------------------------------------------------------------------
function playful(): Song {
  const F = ['F2', 'A3', 'C4'];
  const C = ['C3', 'E3', 'G3'];
  const Bb = ['Bb2', 'D3', 'F3'];
  const Dm = ['D3', 'F3', 'A3'];
  const prog = [F, C, Bb, C, F, Dm, Bb, C];
  const events: NoteEvent[] = [];
  prog.forEach((chord, i) => {
    const at = i * 4;
    const r = midiOf(chord[0]!) - (chord[0]!.endsWith('2') ? 0 : 12);
    for (const b of [0, 2])
      events.push({ beat: at + b, voice: 'bass', midi: r, dur: 0.5, vel: 0.7 });
    for (const b of [1, 3])
      for (const n of chord.slice(1))
        events.push({ beat: at + b, voice: 'pizz', midi: midiOf(n), dur: 0.4, vel: 0.45 });
  });
  events.push(...bars(0, 8, 4, (at) => hit('kick', [0], 0.45, at)));
  events.push(...bars(0, 8, 4, (at) => hit('shaker', [1.5, 3.5], 0.7, at)));
  events.push(...bars(0, 8, 4, (at) => hit('tablaHigh', [0.5, 2.5], 0.25, at, midiOf('C6'))));
  events.push(
    ...line(
      'pizz',
      0,
      [
        'C5:.5 r:.5 A4:.5 r:.5 F4:.5 A4:.5 C5',
        'D5:.5 C5:.5 Bb4:.5 A4:.5 G4 r',
        'D5:.5 r:.5 Bb4:.5 r:.5 G4:.5 Bb4:.5 D5',
        'C5:.5 D5:.5 E5:.5 G5:.5 E5 C5',
        'F5:.5 r:.5 C5:.5 r:.5 A4:.5 C5:.5 F5',
        'E5:.5 F5:.5 E5:.5 D5:.5 A4 r',
        'D5:.5 C5:.5 Bb4:.5 A4:.5 G4:.5 A4:.5 Bb4',
        'A4:.5 G4:.5 A4:.5 C5:.5 F4:2',
      ].join(' '),
      0.85,
      12,
    ),
  );
  return { bpm: 124, beats: 32, events, gain: 1.4 };
}

const BUILDERS: Record<MusicTrack, () => Song> = {
  LOVE_PIANO: lovePiano,
  BIRTHDAY_BOX: birthdayBox,
  PARTY: party,
  FESTIVE: festive,
  JINGLE: jingle,
  AULD_LANG_SYNE: auldLangSyne,
  DREAMY: dreamy,
  PLAYFUL: playful,
};

const cache = new Map<MusicTrack, Song>();

export function song(track: MusicTrack): Song {
  let s = cache.get(track);
  if (!s) {
    s = BUILDERS[track]();
    s.events.sort((a, b) => a.beat - b.beat);
    cache.set(track, s);
  }
  return s;
}
