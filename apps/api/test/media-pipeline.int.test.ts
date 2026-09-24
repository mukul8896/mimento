import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makePng } from '@momentpath/test-utils';
import { MediaPipeline } from '../src/modules/media/media-pipeline';
import { startFakeClamd, type FakeClamd } from './fake-clamd';
import { createTestContext, creator, type Creator, type TestContext } from './helpers';

let ctx: TestContext;
let clamd: FakeClamd;
let alice: Creator;
let pipeline: MediaPipeline;

beforeAll(async () => {
  clamd = await startFakeClamd();
  ctx = await createTestContext({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(clamd.port) });
  alice = await creator(ctx);
  pipeline = ctx.app.get(MediaPipeline);
});
afterAll(async () => {
  await ctx.close();
  await clamd.close();
});
beforeEach(() => {
  clamd.infect(false);
  clamd.setDown(false);
});

function apiPath(signedUrl: string): string {
  const url = new URL(signedUrl);
  return url.pathname.replace(/^\/bff\/api/, '/api') + url.search;
}

/** Creates an experience and a completed (READY, not yet processed) image upload. */
async function uploaded(bytes: Buffer = makePng(40, 30, true), contentType = 'image/png') {
  const { body: exp } = await alice.post('/experiences', {});
  const created = await alice.post(`/experiences/${exp.id}/media/uploads`, {
    contentType,
    sizeBytes: bytes.length,
  });
  await ctx.http.put(apiPath(created.body.upload.url)).set('content-type', contentType).send(bytes);
  const done = await alice.post(`/experiences/${exp.id}/media/${created.body.mediaId}/complete`);
  expect(done.status).toBe(200);
  return { experienceId: exp.id as string, mediaId: created.body.mediaId as string };
}

const asset = (id: string) => ctx.prisma.mediaAsset.findUniqueOrThrow({ where: { id } });
const onDisk = (key: string) => existsSync(path.join(ctx.env.STORAGE_FS_ROOT, key));

describe('media pipeline', () => {
  it('scans, marks clean and serves a re-encoded WebP copy', async () => {
    const { experienceId, mediaId } = await uploaded();
    expect(await asset(mediaId)).toMatchObject({ scanStatus: 'NOT_SCANNED', processedAt: null });

    const before = clamd.scanned;
    const totals = await pipeline.processPending(experienceId);
    expect(totals.clean).toBeGreaterThanOrEqual(1);
    expect(clamd.scanned).toBeGreaterThan(before);

    const done = await asset(mediaId);
    expect(done).toMatchObject({ scanStatus: 'CLEAN', status: 'READY' });
    expect(done.displayKey).toBe(`${done.storageKey}-display`);
    expect(onDisk(done.displayKey!)).toBe(true);
    expect(onDisk(done.thumbKey!)).toBe(true);

    // The editor and recipients now get the display copy, served as WebP.
    const draft = await alice.get(`/experiences/${experienceId}/draft`);
    const url = draft.body.media.find((m: { id: string }) => m.id === mediaId).url as string;
    const image = await ctx.http.get(apiPath(url)).buffer(true);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/webp');
    expect(await sharp(image.body).metadata()).toMatchObject({ format: 'webp', width: 40 });
  });

  it('shrinks large images for recipients', async () => {
    const big = await sharp({
      create: { width: 3000, height: 1500, channels: 3, background: '#0a0' },
    })
      .png()
      .toBuffer();
    const { experienceId, mediaId } = await uploaded(big);
    await pipeline.processPending(experienceId);
    const done = await asset(mediaId);
    const display = await sharp(path.join(ctx.env.STORAGE_FS_ROOT, done.displayKey!)).metadata();
    expect(display).toMatchObject({ width: 1600, height: 800 });
    const thumb = await sharp(path.join(ctx.env.STORAGE_FS_ROOT, done.thumbKey!)).metadata();
    expect(thumb.width).toBe(400);
  });

  it('removes an infected upload, records it and blocks publishing with a clear message', async () => {
    const { experienceId, mediaId } = await uploaded();
    // The creator puts the image in a step before the scan has run.
    const draft = (await alice.get(`/experiences/${experienceId}/draft`)).body;
    const photo = {
      key: crypto.randomUUID(),
      type: 'IMAGE',
      config: { mediaId, alt: 'A picture' },
    };
    const saved = await alice.put(`/experiences/${experienceId}/draft`, {
      revision: draft.revision,
      title: 'With a photo',
      theme: draft.theme,
      settings: draft.settings,
      steps: [photo, ...draft.steps],
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);

    clamd.infect(true);
    await pipeline.processPending(experienceId);

    const done = await asset(mediaId);
    expect(done).toMatchObject({ scanStatus: 'INFECTED', status: 'REJECTED', displayKey: null });
    expect(onDisk(done.storageKey)).toBe(false);
    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'media.infected', targetId: experienceId },
    });
    expect(audit?.metadata).toMatchObject({ mediaId, signature: 'Eicar-Test-Signature' });

    const check = await alice.post(`/experiences/${experienceId}/publish-check`);
    expect(JSON.stringify(check.body.issues)).toContain('virus scan flagged');
  });

  it('leaves uploads unscanned and retries later when clamd is unavailable', async () => {
    const { experienceId, mediaId } = await uploaded();
    clamd.setDown(true);
    const first = await pipeline.processPending(experienceId);
    expect(first.retry).toBeGreaterThanOrEqual(1);
    expect(await asset(mediaId)).toMatchObject({ scanStatus: 'NOT_SCANNED', processedAt: null });

    clamd.setDown(false);
    await pipeline.processPending(experienceId);
    expect(await asset(mediaId)).toMatchObject({ scanStatus: 'CLEAN' });
  });

  it('deletes the processed copies together with the original', async () => {
    const { experienceId, mediaId } = await uploaded();
    await pipeline.processPending(experienceId);
    const done = await asset(mediaId);
    expect((await alice.del(`/experiences/${experienceId}`)).status).toBe(204);
    // Inspect this deletion's own outbox job. Processing the whole outbox here would race other
    // test files that share the database and check their own jobs.
    const jobs = await ctx.prisma.outboxEvent.findMany({ where: { type: 'storage.delete' } });
    const job = jobs.find((j) =>
      ((j.payload as { keys: string[] }).keys ?? []).includes(done.storageKey),
    );
    expect((job?.payload as { keys: string[] }).keys.sort()).toEqual(
      [done.storageKey, done.displayKey!, done.thumbKey!].sort(),
    );
  });
});
