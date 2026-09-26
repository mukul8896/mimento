import { describe, expect, it } from 'vitest';
import { PublicExperienceSchema } from './api';
import { DEFAULT_SCENE, SceneSchema } from './scene';
import { MusicSchema } from './sound';
import { DraftStepSchema } from './steps';
import { DEFAULT_THEME, isDark, mixHex, PALETTE_PRESETS, ThemeSchema } from './theme';

const key = '00000000-0000-4000-8000-000000000001';

describe('scenes', () => {
  it('fills in defaults, so a scene only says what differs from the classic card', () => {
    expect(SceneSchema.parse({})).toEqual(DEFAULT_SCENE);
    expect(SceneSchema.parse({ layout: 'FOCUS', climax: 'PROPOSAL' })).toMatchObject({
      layout: 'FOCUS',
      climax: 'PROPOSAL',
      reaction: '',
    });
  });

  it('keeps steps without a scene exactly as they were', () => {
    const step = DraftStepSchema.parse({ key, type: 'MESSAGE', config: { heading: 'Hi' } });
    expect('scene' in step).toBe(false);
    const withScene = DraftStepSchema.parse({
      key,
      type: 'MESSAGE',
      config: { heading: 'Hi' },
      scene: { layout: 'FLOAT', music: 0.4 },
    });
    expect(withScene.scene).toMatchObject({ layout: 'FLOAT', music: 0.4, climax: 'NONE' });
  });

  it('refuses directions it does not know, and music levels outside 0–1', () => {
    expect(() => SceneSchema.parse({ layout: 'CAROUSEL' })).toThrow();
    expect(() => SceneSchema.parse({ music: 1.5 })).toThrow();
    expect(() => SceneSchema.parse({ reaction: 'x'.repeat(121) })).toThrow();
  });

  it('adds recorded music and a motion profile without changing older themes', () => {
    const old = ThemeSchema.parse({ ...DEFAULT_THEME });
    expect(old.motionProfile).toBeUndefined();
    expect(MusicSchema.parse({ source: 'RECORDED', track: 'CLAIR_DE_LUNE' })).toEqual({
      source: 'RECORDED',
      track: 'CLAIR_DE_LUNE',
    });
    expect(() => MusicSchema.parse({ source: 'RECORDED', track: 'SOME_POP_SONG' })).toThrow();
    expect(ThemeSchema.parse({ ...DEFAULT_THEME, motionProfile: 'CINEMATIC' }).motionProfile).toBe(
      'CINEMATIC',
    );
  });

  it('treats a recipient payload without the branding flag as branded (free)', () => {
    const payload = PublicExperienceSchema.parse({
      title: 't',
      theme: DEFAULT_THEME,
      versionNumber: 1,
      responsesVisibleToCreator: false,
      steps: [],
      media: [],
    });
    expect(payload.branded).toBe(true);
  });
});

describe('colour helpers', () => {
  it('tell dark palettes from light ones', () => {
    expect(isDark(PALETTE_PRESETS.dusk.background)).toBe(true);
    expect(isDark(PALETTE_PRESETS.midnight.background)).toBe(true);
    expect(isDark(PALETTE_PRESETS.blush.background)).toBe(false);
  });

  it('mix two colours by weight', () => {
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});
