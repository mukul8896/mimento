import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestContext,
  creator,
  publishedFromTemplate,
  type Creator,
  type TestContext,
} from './helpers';

let ctx: TestContext;
let alice: Creator;
let bob: Creator;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await creator(ctx);
  bob = await creator(ctx);
});
afterAll(async () => ctx.close());

describe('templates and drafts', () => {
  it('lists the seeded templates, classics first', async () => {
    const res = await alice.get('/templates');
    expect(res.status).toBe(200);
    expect(res.body.items.map((t: { key: string }) => t.key).slice(0, 3)).toEqual([
      'date-invitation',
      'birthday-surprise',
      'anniversary',
    ]);
  });

  it('creates from a template with fresh step keys and a starter surprise secret', async () => {
    const res = await alice.post('/experiences', { templateKey: 'date-invitation' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    const draft = await alice.get(`/experiences/${res.body.id}/draft`);
    expect(draft.body.steps).toHaveLength(5);
    expect(draft.body.steps[0].key).not.toMatch(/^00000000-/);
    expect(draft.body.gifts).toEqual([{ stepKey: draft.body.steps[4].key, hasSecret: true }]);
    // The draft payload never carries the secret itself.
    expect(JSON.stringify(draft.body)).not.toContain('pick you up at 7');
  });

  it('creates a blank experience', async () => {
    const res = await alice.post('/experiences', { title: 'Blank one' });
    expect(res.status).toBe(201);
    const draft = await alice.get(`/experiences/${res.body.id}/draft`);
    expect(draft.body.steps).toEqual([]);
    expect(draft.body.title).toBe('Blank one');
  });

  it('rejects unknown templates', async () => {
    expect((await alice.post('/experiences', { templateKey: 'nope' })).status).toBe(400);
  });

  it('saves drafts with optimistic concurrency', async () => {
    const { body: exp } = await alice.post('/experiences', { templateKey: 'birthday-surprise' });
    const { body: draft } = await alice.get(`/experiences/${exp.id}/draft`);
    const edited = {
      ...draft.steps[0],
      config: { ...draft.steps[0].config, heading: 'Edited heading' },
    };
    const save = await alice.put(`/experiences/${exp.id}/draft`, {
      revision: draft.revision,
      title: 'Renamed',
      theme: draft.theme,
      settings: draft.settings,
      steps: [edited, ...draft.steps.slice(1)],
    });
    expect(save.status).toBe(200);
    expect(save.body.revision).toBe(draft.revision + 1);

    const stale = await alice.put(`/experiences/${exp.id}/draft`, {
      revision: draft.revision,
      title: 'Stale write',
      theme: draft.theme,
      settings: draft.settings,
      steps: draft.steps,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('REVISION_CONFLICT');

    const reloaded = await alice.get(`/experiences/${exp.id}/draft`);
    expect(reloaded.body.title).toBe('Renamed');
    expect(reloaded.body.steps[0].config.heading).toBe('Edited heading');
  });

  it('rejects invalid step configuration, arbitrary CSS and duplicate keys', async () => {
    const { body: exp } = await alice.post('/experiences', {});
    const { body: draft } = await alice.get(`/experiences/${exp.id}/draft`);
    const base = {
      revision: draft.revision,
      title: 'x',
      theme: draft.theme,
      settings: draft.settings,
    };
    const key = randomUUID();

    const badType = await alice.put(`/experiences/${exp.id}/draft`, {
      ...base,
      steps: [{ key, type: 'SCRIPT', config: {} }],
    });
    expect(badType.status).toBe(400);
    expect(badType.body.code).toBe('VALIDATION_FAILED');

    const css = await alice.put(`/experiences/${exp.id}/draft`, {
      ...base,
      theme: {
        ...draft.theme,
        palette: { ...draft.theme.palette, background: 'red;} body{display:none' },
      },
      steps: [],
    });
    expect(css.status).toBe(400);

    const badNo = await alice.put(`/experiences/${exp.id}/draft`, {
      ...base,
      steps: [
        {
          key,
          type: 'YES_NO_CHOICE',
          config: { question: 'q', noButton: { mode: 'AFTER_ATTEMPTS', attempts: 99 } },
        },
      ],
    });
    expect(badNo.status).toBe(400);

    const msg = { key, type: 'MESSAGE', config: { heading: 'a' } };
    const dup = await alice.put(`/experiences/${exp.id}/draft`, { ...base, steps: [msg, msg] });
    expect(dup.status).toBe(400);
    expect(dup.body.code).toBe('DUPLICATE_STEP_KEY');
  });

  it('lists only the owner experiences with cursor pagination', async () => {
    const owner = await creator(ctx);
    for (let i = 0; i < 3; i++) await owner.post('/experiences', { title: `E${i}` });
    const first = await owner.get('/experiences?limit=2');
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const second = await owner.get(`/experiences?limit=2&cursor=${first.body.nextCursor}`);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
    const titles = [...first.body.items, ...second.body.items]
      .map((e: { title: string }) => e.title)
      .sort();
    expect(titles).toEqual(['E0', 'E1', 'E2']);
    expect((await owner.get('/experiences?cursor=garbage')).status).toBe(400);
  });
});

describe('object-level authorization', () => {
  it("denies every creator operation on another user's experience", async () => {
    const { id, draft } = await publishedFromTemplate(ctx, alice);
    const giftKey = draft.steps.at(-1).key;
    const attempts = [
      bob.get(`/experiences/${id}`),
      bob.get(`/experiences/${id}/draft`),
      bob.put(`/experiences/${id}/draft`, {
        revision: draft.revision,
        title: 'hijack',
        theme: draft.theme,
        settings: draft.settings,
        steps: [],
      }),
      bob.get(`/experiences/${id}/draft/gifts/${giftKey}`),
      bob.put(`/experiences/${id}/draft/gifts/${giftKey}`, {
        secret: { kind: 'PHYSICAL_MESSAGE', message: 'x' },
      }),
      bob.get(`/experiences/${id}/results`),
      bob.get(`/experiences/${id}/share-link`),
      bob.post(`/experiences/${id}/share-link/rotate`),
      bob.post(`/experiences/${id}/publish`),
      bob.post(`/experiences/${id}/publish-check`),
      bob.post(`/experiences/${id}/disable`),
      bob.post(`/experiences/${id}/expire`),
      bob.put(`/experiences/${id}/expiry`, { expiresAt: null }),
      bob.post(`/experiences/${id}/media/uploads`, { contentType: 'image/png', sizeBytes: 100 }),
      bob.del(`/experiences/${id}`),
    ];
    const results = await Promise.all(attempts);
    results.forEach((res, index) =>
      expect(res.status, `attempt #${index} ${JSON.stringify(res.body)}`).toBe(404),
    );
    const bobList = await bob.get('/experiences');
    expect(bobList.body.items.find((e: { id: string }) => e.id === id)).toBeUndefined();
    // Alice's data is untouched.
    expect((await alice.get(`/experiences/${id}`)).body.status).toBe('PUBLISHED');
  });
});

describe('gift secrets', () => {
  it('stores secrets encrypted and only returns them to the owner', async () => {
    const { body: exp } = await alice.post('/experiences', { templateKey: 'anniversary' });
    const { body: draft } = await alice.get(`/experiences/${exp.id}/draft`);
    const giftKey = draft.steps.at(-1).key;
    const put = await alice.put(`/experiences/${exp.id}/draft/gifts/${giftKey}`, {
      secret: { kind: 'PHYSICAL_MESSAGE', message: 'SECRET-VOUCHER-XYZ' },
    });
    expect(put.status).toBe(200);
    const row = await ctx.prisma.gift.findFirstOrThrow({ where: { stepKey: giftKey } });
    expect(row.payloadEnc).not.toContain('SECRET-VOUCHER-XYZ');
    expect(Buffer.from(row.payloadEnc).toString()).not.toContain('SECRET');
    const get = await alice.get(`/experiences/${exp.id}/draft/gifts/${giftKey}`);
    expect(get.body.secret.message).toBe('SECRET-VOUCHER-XYZ');
    expect(get.headers['cache-control']).toBe('no-store');

    const list = await alice.get('/experiences');
    expect(JSON.stringify(list.body)).not.toContain('SECRET-VOUCHER-XYZ');
  });

  it('rejects secrets that do not match the gift kind or use non-https links', async () => {
    const { body: exp } = await alice.post('/experiences', { templateKey: 'anniversary' });
    const { body: draft } = await alice.get(`/experiences/${exp.id}/draft`);
    const giftKey = draft.steps.at(-1).key;
    const wrongKind = await alice.put(`/experiences/${exp.id}/draft/gifts/${giftKey}`, {
      secret: { kind: 'VOUCHER_CODE', code: 'ABC' },
    });
    expect(wrongKind.status).toBe(400);
    expect(wrongKind.body.code).toBe('GIFT_KIND_MISMATCH');
    const js = await alice.put(`/experiences/${exp.id}/draft/gifts/${giftKey}`, {
      secret: { kind: 'URL', url: 'javascript:alert(1)' },
    });
    expect(js.status).toBe(400);
  });
});
