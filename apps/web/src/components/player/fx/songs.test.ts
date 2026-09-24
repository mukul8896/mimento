import { describe, expect, it } from 'vitest';
import { MUSIC_TRACKS } from '@momentpath/contracts';
import { line, midiOf, song } from './songs';
import { splitEmoji } from './emoji';

describe('built-in music', () => {
  it('reads note names', () => {
    expect(midiOf('C4')).toBe(60);
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('F#5')).toBe(78);
    expect(midiOf('Bb3')).toBe(58);
    expect(() => midiOf('H2')).toThrow();
  });

  it('parses melody lines with rests, lengths and chords', () => {
    const events = line('bell', 2, 'C4 r:.5 E4+G4:2 D4:.5');
    expect(events.map((e) => [e.beat, e.midi, e.dur])).toEqual([
      [2, 60, 1],
      [3.5, 64, 2],
      [3.5, 67, 2],
      [5.5, 62, 0.5],
    ]);
  });

  it.each(MUSIC_TRACKS)('%s loops cleanly inside its length, in a pleasant range', (track) => {
    const s = song(track);
    expect(s.events.length).toBeGreaterThan(20);
    expect(s.bpm).toBeGreaterThanOrEqual(60);
    for (const e of s.events) {
      expect(e.beat).toBeGreaterThanOrEqual(0);
      expect(e.beat).toBeLessThan(s.beats);
      expect(e.dur).toBeGreaterThan(0);
      expect(e.vel).toBeGreaterThan(0);
      expect(e.vel).toBeLessThanOrEqual(1);
      expect(e.midi).toBeGreaterThanOrEqual(24);
      expect(e.midi).toBeLessThanOrEqual(100);
    }
    // Sorted, so the scheduler can walk it in order.
    const beats = s.events.map((e) => e.beat);
    expect([...beats].sort((a, b) => a - b)).toEqual(beats);
  });

  it('keeps the public-domain melodies on the beat (bars add up)', () => {
    // Happy Birthday is in 3/4: its 10 bars fill exactly 30 beats.
    const melody = song('BIRTHDAY_BOX').events.filter((e) => e.voice === 'bell' && e.beat < 24);
    expect(melody[0]).toMatchObject({ beat: 0, midi: midiOf('A5') });
    expect(song('BIRTHDAY_BOX').beats).toBe(30);
    // Jingle Bells ends on C after 16 bars of 4/4.
    const jingle = song('JINGLE').events.filter((e) => e.voice === 'bell');
    expect(jingle.at(-1)).toMatchObject({ beat: 60, midi: midiOf('C5'), dur: 4 });
  });
});

describe('splitEmoji', () => {
  it('splits into whole emoji, keeping joined and flag sequences together', () => {
    expect(splitEmoji('😍🔥')).toEqual(['😍', '🔥']);
    expect(splitEmoji(' ❤️ 👩‍❤️‍👨 ')).toEqual(['❤️', '👩‍❤️‍👨']);
    expect(splitEmoji('')).toEqual([]);
  });
});
