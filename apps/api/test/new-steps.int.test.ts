import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makePng } from '@momentpath/test-utils';
import { MediaPipeline } from '../src/modules/media/media-pipeline';
import { createTestContext, creator, recipient, type Creator, type TestContext } from './helpers';

let ctx: TestContext;
let alice: Creator;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await creator(ctx);
});
afterAll(async () => ctx.close());

function apiPath(signedUrl: string): string {
  const url = new URL(signedUrl);
  return url.pathname.replace(/^\/bff\/api/, '/api') + url.search;
}

async function upload(experienceId: string, bytes: Buffer, contentType: string) {
  const created = await alice.post(`/experiences/${experienceId}/media/uploads`, {
    contentType,
    sizeBytes: bytes.length,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  await ctx.http.put(apiPath(created.body.upload.url)).set('content-type', contentType).send(bytes);
  return alice.post(`/experiences/${experienceId}/media/${created.body.mediaId}/complete`);
}

async function draftWith(steps: object[]) {
  const { body: exp } = await alice.post('/experiences', {});
  const draft = (await alice.get(`/experiences/${exp.id}/draft`)).body;
  const gift = { key: randomUUID(), type: 'GIFT_REVEAL', config: {} };
  const saved = await alice.put(`/experiences/${exp.id}/draft`, {
    revision: draft.revision,
    title: 'New steps',
    theme: draft.theme,
    settings: draft.settings,
    steps: [...steps, gift],
  });
  await alice.put(`/experiences/${exp.id}/draft/gifts/${gift.key}`, {
    secret: { kind: 'PHYSICAL_MESSAGE', message: 'x' },
  });
  return { id: exp.id as string, saved, giftKey: gift.key };
}

async function publish(id: string) {
  const res = await alice.post(`/experiences/${id}/publish`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return (await alice.get(`/experiences/${id}/share-link`)).body.shareToken as string;
}

// A tiny MP3: an ID3 header is enough for the byte check.
const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(200, 1)]);

describe('puzzle', () => {
  it('checks the answer on the server without ever sending it to the recipient', async () => {
    const key = randomUUID();
    const { id } = await draftWith([
      { key, type: 'PUZZLE', config: { prompt: 'Our first city?', answer: 'Jaipur' } },
    ]);
    const r = recipient(ctx, await publish(id));
    const started = await r.start();
    expect(JSON.stringify(started.body)).not.toContain('Jaipur');

    const wrong = await r.answer(key, { kind: 'TEXT', value: 'Delhi' });
    expect(wrong.status).toBe(200);
    expect(wrong.body).toMatchObject({ correct: false, progress: { nextStepKey: key } });
    const right = await r.answer(key, { kind: 'TEXT', value: '  JAIPUR ' });
    expect(right.body.correct).toBe(true);
    expect(right.body.progress.nextStepKey).not.toBe(key);
  });
});

describe('countdown', () => {
  it('will not let the recipient past a locked countdown before its time', async () => {
    const key = randomUUID();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const { id } = await draftWith([
      { key, type: 'COUNTDOWN', config: { targetAt: future, waitForIt: true } },
    ]);
    const r = recipient(ctx, await publish(id));
    await r.start();
    const early = await r.answer(key, { kind: 'ACK' });
    expect(early.status).toBe(400);
  });
});

describe('voice note', () => {
  it('accepts an audio upload, scans it without re-encoding and serves it as audio', async () => {
    const { body: exp } = await alice.post('/experiences', {});
    const done = await upload(exp.id, mp3, 'audio/mpeg');
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ status: 'READY', width: null, height: null });

    await ctx.app.get(MediaPipeline).processPending(exp.id);
    const row = await ctx.prisma.mediaAsset.findUniqueOrThrow({ where: { id: done.body.id } });
    expect(row).toMatchObject({ displayKey: null, thumbKey: null });
    expect(row.processedAt).not.toBeNull();

    const file = await ctx.http.get(apiPath(done.body.url)).buffer(true);
    expect(file.headers['content-type']).toBe('audio/mpeg');
  });

  it('rejects a file that is not the audio it claims to be, and oversized audio', async () => {
    const { body: exp } = await alice.post('/experiences', {});
    const fake = await upload(exp.id, makePng(4, 4), 'audio/mpeg');
    expect(fake.status).toBe(422);
    const big = await alice.post(`/experiences/${exp.id}/media/uploads`, {
      contentType: 'audio/mpeg',
      sizeBytes: 11 * 1024 * 1024,
    });
    expect(big.status).toBe(400);
  });

  it('refuses to publish an image where a voice note should be', async () => {
    const { body: exp } = await alice.post('/experiences', {});
    const image = await upload(exp.id, makePng(8, 8), 'image/png');
    const draft = (await alice.get(`/experiences/${exp.id}/draft`)).body;
    const saved = await alice.put(`/experiences/${exp.id}/draft`, {
      revision: draft.revision,
      title: 'Wrong media',
      theme: draft.theme,
      settings: draft.settings,
      steps: [{ key: randomUUID(), type: 'VOICE_NOTE', config: { mediaId: image.body.id } }],
    });
    expect(saved.status).toBe(200);
    const check = await alice.post(`/experiences/${exp.id}/publish-check`);
    expect(JSON.stringify(check.body.issues)).toContain('must be an audio file');
  });
});

describe('gallery, video and place reveal', () => {
  it('publish with complete content, and a bad video link is caught', async () => {
    const { body: exp } = await alice.post('/experiences', {});
    const photo = await upload(exp.id, makePng(10, 10), 'image/png');
    const draft = (await alice.get(`/experiences/${exp.id}/draft`)).body;
    const video = {
      key: randomUUID(),
      type: 'VIDEO',
      config: { url: 'https://example.com/v.mp4' },
    };
    const steps = [
      {
        key: randomUUID(),
        type: 'PHOTO_GALLERY',
        config: { items: [{ mediaId: photo.body.id, alt: 'Us at the beach' }] },
      },
      video,
      { key: randomUUID(), type: 'PLACE_REVEAL', config: { placeName: 'Marine Drive' } },
    ];
    const saved = await alice.put(`/experiences/${exp.id}/draft`, {
      revision: draft.revision,
      title: 'Mixed',
      theme: draft.theme,
      settings: draft.settings,
      steps,
    });
    expect(saved.status).toBe(200);
    const check = await alice.post(`/experiences/${exp.id}/publish-check`);
    expect(check.body.issues.map((i: { field: string }) => i.field)).toEqual(['url']);

    video.config.url = 'https://youtu.be/dQw4w9WgXcQ';
    const fixed = await alice.put(`/experiences/${exp.id}/draft`, {
      revision: saved.body.revision,
      title: 'Mixed',
      theme: draft.theme,
      settings: draft.settings,
      steps,
    });
    expect(fixed.status).toBe(200);
    expect((await alice.post(`/experiences/${exp.id}/publish-check`)).body.ok).toBe(true);
  });
});

describe('background music', () => {
  async function setMusic(id: string, music: object) {
    const draft = (await alice.get(`/experiences/${id}/draft`)).body;
    return alice.put(`/experiences/${id}/draft`, {
      revision: draft.revision,
      title: draft.title,
      theme: { ...draft.theme, music },
      settings: draft.settings,
      steps: draft.steps,
    });
  }

  it('plays a built-in track, and new experiences start silent', async () => {
    const { id } = await draftWith([
      { key: randomUUID(), type: 'PLACE_REVEAL', config: { placeName: 'Marine Drive' } },
    ]);
    expect((await alice.get(`/experiences/${id}/draft`)).body.theme).toMatchObject({
      music: { source: 'NONE' },
      sounds: true,
      celebration: 'CONFETTI',
    });
    expect((await setMusic(id, { source: 'LIBRARY', track: 'JINGLE' })).status).toBe(200);
    expect((await setMusic(id, { source: 'LIBRARY', track: 'NOPE' })).status).toBe(400);
    const r = recipient(ctx, await publish(id));
    expect((await r.start()).body.experience.theme.music).toEqual({
      source: 'LIBRARY',
      track: 'JINGLE',
    });
  });

  it('plays the creator’s own upload: it must be theirs and audio, and reaches the recipient', async () => {
    const { id } = await draftWith([
      { key: randomUUID(), type: 'PLACE_REVEAL', config: { placeName: 'Marine Drive' } },
    ]);
    // A file from another experience cannot be borrowed.
    const { body: other } = await alice.post('/experiences', {});
    const foreign = await upload(other.id, mp3, 'audio/mpeg');
    const borrowed = await setMusic(id, { source: 'UPLOAD', mediaId: foreign.body.id });
    expect(borrowed.status).toBe(400);
    expect(borrowed.body.code).toBe('INVALID_MEDIA');

    // An image is not music.
    const image = await upload(id, makePng(8, 8), 'image/png');
    expect((await setMusic(id, { source: 'UPLOAD', mediaId: image.body.id })).status).toBe(200);
    const check = await alice.post(`/experiences/${id}/publish-check`);
    expect(check.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'music' })]),
    );

    const song = await upload(id, mp3, 'audio/mpeg');
    await ctx.app.get(MediaPipeline).processPending(id);
    expect((await setMusic(id, { source: 'UPLOAD', mediaId: song.body.id })).status).toBe(200);
    const r = recipient(ctx, await publish(id));
    const started = (await r.start()).body;
    expect(started.experience.theme.music).toEqual({ source: 'UPLOAD', mediaId: song.body.id });
    expect(started.experience.media.map((m: { id: string }) => m.id)).toContain(song.body.id);
  });
});
