import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOTION_PROFILES, RECORDED_LIBRARY } from '@momentpath/contracts';
import { PROFILES, profileOf } from './profiles';

const PUBLIC = path.resolve(__dirname, '../../../../public');

interface Layer {
  ty: number;
  layers?: Layer[];
}

describe('illustrations', () => {
  const files = readdirSync(path.join(PUBLIC, 'lottie')).filter((f) => f.endsWith('.json'));

  it.each(files)('%s is shapes only, small, and never loads fonts', (file) => {
    const full = path.join(PUBLIC, 'lottie', file);
    const data = JSON.parse(readFileSync(full, 'utf8')) as {
      layers: Layer[];
      fonts?: unknown;
      chars?: unknown;
    };
    // Text layers (ty 5) and fonts make lottie-web inject <style> tags, which the CSP blocks.
    const all = (ls: Layer[]): Layer[] => ls.flatMap((l) => [l, ...all(l.layers ?? [])]);
    expect(all(data.layers).every((l) => l.ty !== 5)).toBe(true);
    expect(data.fonts).toBeUndefined();
    expect(data.chars).toBeUndefined();
    expect(statSync(full).size).toBeLessThan(60_000);
  });
});

describe('recorded music', () => {
  it.each(Object.entries(RECORDED_LIBRARY))(
    '%s exists, is small enough for mobile data, and has its licence recorded',
    (_track, info) => {
      const file = path.join(PUBLIC, info.file);
      expect(statSync(file).size).toBeLessThan(1_000_000);
      const licences = readFileSync(path.join(PUBLIC, 'audio', 'LICENSES.md'), 'utf8');
      expect(licences).toContain(path.basename(info.file));
    },
  );
});

describe('motion profiles', () => {
  it('covers every profile the contracts allow', () => {
    expect(Object.keys(PROFILES).sort()).toEqual([...MOTION_PROFILES].sort());
  });

  it('leaves experiences made before scenes on their original animation', () => {
    expect(profileOf({})).toBeNull();
    expect(profileOf({ motionProfile: 'ROMANTIC' })).toBe(PROFILES.ROMANTIC);
  });

  it('keeps ordinary taps quiet in the serious profiles', () => {
    for (const p of ['ROMANTIC', 'CINEMATIC', 'ELEGANT', 'NOSTALGIC'] as const) {
      expect(PROFILES[p].continueFx).toBe('none');
    }
  });
});
