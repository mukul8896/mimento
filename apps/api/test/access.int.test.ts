import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  API,
  createTestContext,
  creator,
  publishedFromTemplate,
  recipient,
  type Creator,
  type TestContext,
} from './helpers';

let ctx: TestContext;
let alice: Creator;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await creator(ctx);
});
afterAll(async () => ctx.close());

const access = (id: string, body: object) => alice.put(`/experiences/${id}/access`, body);
const startWith = (token: string, pin?: string) =>
  ctx.http.post(`${API}/public/experiences/${token}/sessions`).send(pin ? { pin } : undefined);
const shortLink = (slug: string, pin: string) =>
  ctx.http.post(`${API}/public/links/${slug}/sessions`).send({ pin });
const unique = () => `for-${crypto.randomUUID().slice(0, 8)}`;

describe('scheduled opening', () => {
  it('shows when the link opens and refuses to start before then', async () => {
    const { id, shareToken } = await publishedFromTemplate(ctx, alice);
    const opensAt = new Date(Date.now() + 3_600_000).toISOString();
    expect((await access(id, { opensAt })).body).toMatchObject({ opensAt, hasPin: false });

    const meta = await ctx.http.get(`${API}/public/experiences/${shareToken}/meta`);
    expect(meta.body.opensAt).toBe(opensAt);
    const early = await startWith(shareToken);
    expect(early.status).toBe(403);
    expect(early.body).toMatchObject({ code: 'NOT_YET_OPEN', detail: opensAt });

    await access(id, { opensAt: null });
    expect((await startWith(shareToken)).status).toBe(201);
  });
});

describe('PIN', () => {
  it('hides the title, requires the PIN and never stores or logs it in the clear', async () => {
    const { id, shareToken } = await publishedFromTemplate(ctx, alice);
    expect((await access(id, { pin: '482913' })).body).toMatchObject({ hasPin: true });

    const meta = await ctx.http.get(`${API}/public/experiences/${shareToken}/meta`);
    expect(meta.body).toMatchObject({ title: 'A private surprise', pinRequired: true });
    expect((await startWith(shareToken)).body.code).toBe('PIN_REQUIRED');
    expect((await startWith(shareToken, '000000')).body.code).toBe('PIN_INCORRECT');
    expect((await startWith(shareToken, '482913')).status).toBe(201);

    const row = await ctx.prisma.experience.findUniqueOrThrow({ where: { id } });
    expect(row.pinHash).not.toContain('482913');
    const audit = await ctx.prisma.auditLog.findMany({ where: { targetId: id } });
    expect(JSON.stringify(audit)).not.toContain('482913');
  });

  it('locks after ten wrong PINs, even for the right one', async () => {
    const { id, shareToken } = await publishedFromTemplate(ctx, alice);
    await access(id, { pin: '1357' });
    for (let i = 0; i < 10; i++) await startWith(shareToken, '9999');
    const locked = await startWith(shareToken, '1357');
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('PIN_LOCKED');

    // Setting the PIN again clears the lock.
    await access(id, { pin: '1357' });
    expect((await startWith(shareToken, '1357')).status).toBe(201);
  });

  it('rejects malformed PINs', async () => {
    const { id, shareToken } = await publishedFromTemplate(ctx, alice);
    expect((await access(id, { pin: '12' })).status).toBe(400);
    expect((await startWith(shareToken, 'abcd')).status).toBe(400);
  });
});

describe('short links', () => {
  it('need a PIN, are unique, and open the surprise with the right PIN', async () => {
    const { id, shareToken } = await publishedFromTemplate(ctx, alice);
    const slug = unique();
    expect((await access(id, { slug })).status).toBe(422); // no PIN yet
    expect((await access(id, { pin: '2468', slug: slug.toUpperCase() })).body).toMatchObject({
      hasPin: true,
      slug,
    });

    const other = await publishedFromTemplate(ctx, alice);
    await access(other.id, { pin: '1111' });
    expect((await access(other.id, { slug })).status).toBe(409);
    expect((await access(other.id, { slug: 'pricing' })).status).toBe(400);

    const opened = await shortLink(slug, '2468');
    expect(opened.status).toBe(201);
    expect(opened.body.shareToken).toBe(shareToken);
    expect(opened.body.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // A wrong PIN and a made-up name look exactly the same.
    const wrongPin = await shortLink(slug, '0000');
    const wrongName = await shortLink(unique(), '2468');
    expect([wrongPin.status, wrongName.status]).toEqual([403, 403]);
    expect(wrongPin.body.title).toBe(wrongName.body.title);

    // The PIN cannot be removed while the short link would be left unprotected.
    expect((await access(id, { pin: null })).status).toBe(422);
    expect((await access(id, { pin: null, slug: null })).body).toMatchObject({
      hasPin: false,
      slug: null,
    });
  });
});

describe('scheduled gift reveal', () => {
  it('keeps the gift locked until its time', async () => {
    const { id, shareToken, draft } = await publishedFromTemplate(ctx, alice, 'anniversary');
    const gift = draft.steps.at(-1);
    gift.config.revealAt = new Date(Date.now() + 3_600_000).toISOString();
    const saved = await alice.put(`/experiences/${id}/draft`, {
      revision: draft.revision,
      title: draft.title,
      theme: draft.theme,
      settings: draft.settings,
      steps: draft.steps,
    });
    expect(saved.status).toBe(200);
    expect((await alice.post(`/experiences/${id}/publish`)).status).toBe(200);

    const r = recipient(ctx, shareToken);
    const started = await r.start();
    for (const step of started.body.experience.steps) {
      if (step.type === 'GIFT_REVEAL') break;
      const answer =
        step.type === 'MULTIPLE_CHOICE'
          ? { kind: 'OPTION', optionId: step.config.options[0].id }
          : step.type === 'YES_NO_CHOICE'
            ? { kind: 'CHOICE', value: 'YES' }
            : { kind: 'ACK' };
      await r.answer(step.key, answer);
    }
    const reveal = await r.reveal(gift.key);
    expect(reveal.status).toBe(403);
    expect(reveal.body).toMatchObject({ code: 'GIFT_NOT_YET', detail: gift.config.revealAt });
  });
});

describe('analytics', () => {
  it('counts opens per day and how far recipients got', async () => {
    const { id, shareToken, draft } = await publishedFromTemplate(ctx, alice);
    await ctx.http.get(`${API}/public/experiences/${shareToken}/meta`);
    await ctx.http.get(`${API}/public/experiences/${shareToken}/meta`);
    const r = recipient(ctx, shareToken);
    await r.start();
    await r.answer(draft.steps[0].key, { kind: 'ACK' });

    const results = (await alice.get(`/experiences/${id}/results`)).body;
    expect(results.opens).toBe(2);
    expect(results.opensByDay).toEqual([{ day: new Date().toISOString().slice(0, 10), opens: 2 }]);
    expect(results.reach[0]).toMatchObject({ stepKey: draft.steps[0].key, reached: 1 });
    expect(results.reach[1].reached).toBe(0);
    expect(results.started).toBe(1);
  });
});
