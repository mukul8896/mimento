import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makePng } from '@momentpath/test-utils';
import { createTestContext, creator, recipient, type Creator, type TestContext } from './helpers';

let ctx: TestContext;
let alice: Creator;
let bob: Creator;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await creator(ctx);
  bob = await creator(ctx);
});
afterAll(async () => ctx.close());

/** Signed filesystem URLs point at the web BFF; map them to the API under test. */
function apiPath(signedUrl: string): string {
  const url = new URL(signedUrl);
  return url.pathname.replace(/^\/bff\/api/, '/api') + url.search;
}

async function upload(
  owner: Creator,
  experienceId: string,
  bytes: Buffer,
  contentType = 'image/png',
) {
  const created = await owner.post(`/experiences/${experienceId}/media/uploads`, {
    contentType,
    sizeBytes: bytes.length,
  });
  expect(created.status).toBe(201);
  const put = await ctx.http
    .put(apiPath(created.body.upload.url))
    .set('content-type', contentType)
    .send(bytes);
  return {
    mediaId: created.body.mediaId as string,
    uploadUrl: created.body.upload.url as string,
    put,
  };
}

describe('media uploads', () => {
  it('validates, strips metadata and serves images through time-limited signed URLs', async () => {
    const { body: exp } = await alice.post('/experiences', {});
    const png = makePng(40, 30, true);
    const { mediaId, uploadUrl, put } = await upload(alice, exp.id, png);
    expect(put.status).toBe(200);

    const done = await alice.post(`/experiences/${exp.id}/media/${mediaId}/complete`);
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ status: 'READY', width: 40, height: 30 });
    expect(done.body.sizeBytes).toBeLessThan(png.length); // tEXt chunk removed

    const image = await ctx.http.get(apiPath(done.body.url)).buffer(true);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.body.includes(Buffer.from('GPS'))).toBe(false);

    // Upload URLs cannot be replayed once the asset is complete.
    const replay = await ctx.http
      .put(apiPath(uploadUrl))
      .set('content-type', 'image/png')
      .send(png);
    expect(replay.status).toBe(403);

    // Tampered signatures are refused.
    const tampered = apiPath(done.body.url).replace(/sig=[^&]+/, 'sig=AAAA');
    expect((await ctx.http.get(tampered)).status).toBe(404);
  });

  it('rejects content that does not match the declared type or size', async () => {
    const { body: exp } = await alice.post('/experiences', {});
    const fake = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    const { mediaId, put } = await upload(alice, exp.id, fake, 'image/png');
    expect(put.status).toBe(200);
    const done = await alice.post(`/experiences/${exp.id}/media/${mediaId}/complete`);
    expect(done.status).toBe(422);
    expect(done.body.code).toBe('MEDIA_REJECTED');

    const tooBig = await alice.post(`/experiences/${exp.id}/media/uploads`, {
      contentType: 'image/png',
      sizeBytes: 6 * 1024 * 1024,
    });
    expect(tooBig.status).toBe(400);
    const svg = await alice.post(`/experiences/${exp.id}/media/uploads`, {
      contentType: 'image/svg+xml',
      sizeBytes: 100,
    });
    expect(svg.status).toBe(400);

    const png = makePng(10, 10);
    const created = await alice.post(`/experiences/${exp.id}/media/uploads`, {
      contentType: 'image/png',
      sizeBytes: png.length + 5,
    });
    const mismatch = await ctx.http
      .put(apiPath(created.body.upload.url))
      .set('content-type', 'image/png')
      .send(png);
    expect(mismatch.status).toBe(400);
  });

  it("prevents other users from completing or referencing someone else's media", async () => {
    const { body: exp } = await alice.post('/experiences', {});
    const { mediaId } = await upload(alice, exp.id, makePng(5, 5));
    expect((await bob.post(`/experiences/${exp.id}/media/${mediaId}/complete`)).status).toBe(404);

    const { body: bobExp } = await bob.post('/experiences', {});
    const { body: bobDraft } = await bob.get(`/experiences/${bobExp.id}/draft`);
    const steal = await bob.put(`/experiences/${bobExp.id}/draft`, {
      revision: bobDraft.revision,
      title: 't',
      theme: bobDraft.theme,
      settings: bobDraft.settings,
      steps: [{ key: crypto.randomUUID(), type: 'IMAGE', config: { mediaId, alt: 'stolen' } }],
    });
    expect(steal.status).toBe(400);
    expect(steal.body.code).toBe('INVALID_MEDIA');
  });

  it('blocks publishing until images are uploaded and shows them to recipients with signed URLs', async () => {
    const { body: exp } = await alice.post('/experiences', { title: 'Photo' });
    const { body: draft } = await alice.get(`/experiences/${exp.id}/draft`);
    const created = await alice.post(`/experiences/${exp.id}/media/uploads`, {
      contentType: 'image/png',
      sizeBytes: 100,
    });
    const step = {
      key: crypto.randomUUID(),
      type: 'IMAGE',
      config: { mediaId: created.body.mediaId, alt: 'Us at the beach' },
    };
    await alice.put(`/experiences/${exp.id}/draft`, {
      revision: draft.revision,
      title: 'Photo',
      theme: draft.theme,
      settings: draft.settings,
      steps: [step],
    });
    const blocked = await alice.post(`/experiences/${exp.id}/publish`);
    expect(blocked.status).toBe(422);
    expect(blocked.body.issues.map((i: { field: string }) => i.field)).toContain('media');

    const { mediaId } = await upload(alice, exp.id, makePng(20, 20));
    await alice.post(`/experiences/${exp.id}/media/${mediaId}/complete`);
    const again = await alice.get(`/experiences/${exp.id}/draft`);
    await alice.put(`/experiences/${exp.id}/draft`, {
      revision: again.body.revision,
      title: 'Photo',
      theme: again.body.theme,
      settings: again.body.settings,
      steps: [{ ...step, config: { ...step.config, mediaId } }],
    });
    expect((await alice.post(`/experiences/${exp.id}/publish`)).status).toBe(200);
    const { body: link } = await alice.get(`/experiences/${exp.id}/share-link`);
    const start = await recipient(ctx, link.shareToken).start();
    expect(start.body.experience.media).toHaveLength(1);
    expect(start.body.experience.media[0].url).toContain('sig=');
  });
});
