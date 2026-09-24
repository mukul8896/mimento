import { describe, expect, it } from 'vitest';
import { checkAnswer } from './answers';
import { publishIssues } from './publish-rules';
import { DEFAULT_THEME } from './theme';
import {
  defaultStepConfig,
  DraftStepSchema,
  normalizePuzzleAnswer,
  parseVideoUrl,
  referencedMediaKinds,
  STEP_TYPES,
  videoEmbedUrl,
  type DraftStep,
} from './steps';

const key = '00000000-0000-4000-8000-000000000001';
const media = '00000000-0000-4000-8000-0000000000aa';
const step = (type: string, config: object): DraftStep =>
  DraftStepSchema.parse({ key, type, config });
const issuesOf = (s: DraftStep) =>
  publishIssues({
    title: 't',
    theme: DEFAULT_THEME,
    steps: [s],
    giftStepKeysWithSecret: new Set(),
  }).map((i) => i.field);

describe('every step type', () => {
  it('has a valid default configuration', () => {
    for (const type of STEP_TYPES) {
      expect(
        DraftStepSchema.safeParse({ key, type, config: defaultStepConfig(type) }).success,
      ).toBe(true);
    }
  });
});

describe('parseVideoUrl', () => {
  it('accepts YouTube and Vimeo links in their common shapes', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ]) {
      expect(parseVideoUrl(url)).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' });
    }
    expect(parseVideoUrl('https://vimeo.com/76979871')).toEqual({
      provider: 'vimeo',
      id: '76979871',
    });
    expect(parseVideoUrl('https://player.vimeo.com/video/76979871')).toEqual({
      provider: 'vimeo',
      id: '76979871',
    });
  });
  it('rejects anything else, including http and look-alike hosts', () => {
    for (const url of [
      'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=short',
      'https://example.com/video.mp4',
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(parseVideoUrl(url)).toBeNull();
    }
  });
  it('embeds YouTube through its no-cookie domain', () => {
    expect(videoEmbedUrl({ provider: 'youtube', id: 'dQw4w9WgXcQ' })).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/,
    );
  });
});

describe('puzzle answers', () => {
  const puzzle = step('PUZZLE', { prompt: 'Where did we meet?', answer: 'Café Mocha!' });
  it('ignores case, accents, punctuation and spacing', () => {
    expect(normalizePuzzleAnswer('  CAFE   mocha ')).toBe('cafe mocha');
    expect(checkAnswer(puzzle, { kind: 'TEXT', value: 'cafe mocha' })).toEqual({
      ok: true,
      correct: true,
    });
  });
  it('refuses wrong answers, other answer kinds and puzzles without an answer', () => {
    expect(checkAnswer(puzzle, { kind: 'TEXT', value: 'Paris' })).toEqual({
      ok: false,
      reason: 'INCORRECT',
    });
    expect(checkAnswer(puzzle, { kind: 'ACK' })).toEqual({ ok: false, reason: 'WRONG_KIND' });
    const empty = step('PUZZLE', { prompt: 'x' });
    expect(checkAnswer(empty, { kind: 'TEXT', value: 'anything' }).ok).toBe(false);
  });
});

describe('countdown', () => {
  const at = '2026-12-25T00:00:00.000Z';
  it('holds the recipient until the moment arrives when waitForIt is on', () => {
    const cd = step('COUNTDOWN', { targetAt: at, waitForIt: true });
    expect(checkAnswer(cd, { kind: 'ACK' }, new Date('2026-12-24T23:59:59Z'))).toEqual({
      ok: false,
      reason: 'NOT_ALLOWED',
    });
    expect(checkAnswer(cd, { kind: 'ACK' }, new Date(at)).ok).toBe(true);
  });
  it('lets them continue early when waitForIt is off', () => {
    const cd = step('COUNTDOWN', { targetAt: at, waitForIt: false });
    expect(checkAnswer(cd, { kind: 'ACK' }, new Date('2026-01-01T00:00:00Z')).ok).toBe(true);
  });
});

describe('publish rules for the new steps', () => {
  it('asks for what each step needs', () => {
    expect(issuesOf(step('COUNTDOWN', {}))).toContain('targetAt');
    expect(issuesOf(step('PUZZLE', {}))).toEqual(expect.arrayContaining(['prompt', 'answer']));
    expect(issuesOf(step('PHOTO_GALLERY', {}))).toContain('items');
    expect(issuesOf(step('PHOTO_GALLERY', { items: [{ mediaId: media }] }))).toContain('items');
    expect(issuesOf(step('VOICE_NOTE', {}))).toContain('mediaId');
    expect(issuesOf(step('VIDEO', { url: 'https://example.com/x' }))).toContain('url');
    expect(issuesOf(step('PLACE_REVEAL', { placeName: '' }))).toContain('placeName');
  });
  it('accepts complete steps', () => {
    expect(issuesOf(step('VIDEO', { url: 'https://youtu.be/dQw4w9WgXcQ' }))).toEqual([]);
    expect(issuesOf(step('PLACE_REVEAL', { placeName: 'Marine Drive' }))).toEqual([]);
    expect(issuesOf(step('PHOTO_GALLERY', { items: [{ mediaId: media, alt: 'Us' }] }))).toEqual([]);
  });
  it('knows which media must be images and which audio', () => {
    expect(referencedMediaKinds(step('VOICE_NOTE', { mediaId: media })).get(media)).toBe('audio');
    expect(
      referencedMediaKinds(step('PHOTO_GALLERY', { items: [{ mediaId: media, alt: 'a' }] })).get(
        media,
      ),
    ).toBe('image');
  });
});
