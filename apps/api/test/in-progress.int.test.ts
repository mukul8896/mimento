import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RetentionService } from '../src/modules/experiences/retention.service';
import { createTestContext, creator, publishedFromTemplate, type TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => ctx.close());

const HOUR = 3600 * 1000;

async function save(owner: Awaited<ReturnType<typeof creator>>, id: string, heading: string) {
  const draft = (await owner.get(`/experiences/${id}/draft`)).body;
  draft.steps[0].config.heading = heading;
  const res = await owner.put(`/experiences/${id}/draft`, {
    revision: draft.revision,
    title: draft.title,
    theme: draft.theme,
    settings: draft.settings,
    steps: draft.steps,
  });
  expect(res.status).toBe(200);
}

const ids = async (owner: Awaited<ReturnType<typeof creator>>) =>
  ((await owner.get('/experiences/in-progress')).body.items as { id: string }[]).map((i) => i.id);

describe('work in progress', () => {
  it('only counts once something was changed', async () => {
    const amy = await creator(ctx);
    const looked = await amy.post('/experiences', { templateKey: 'date-invitation' });
    const scratch = await amy.post('/experiences', {});
    // Opening and reading is not a draft.
    await amy.get(`/experiences/${looked.body.id}/draft`);
    expect(await ids(amy)).toEqual([]);

    await save(amy, looked.body.id, 'Hi Sam');
    const items = (await amy.get('/experiences/in-progress')).body.items;
    expect(items).toMatchObject([
      { id: looked.body.id, templateKey: 'date-invitation', mode: 'TEMPLATE' },
    ]);
    expect(await ids(amy)).not.toContain(scratch.body.id);
  });

  it('counts typed personal details, a gift, delivery settings and Customize with PRO', async () => {
    const ben = await creator(ctx);
    const named = await ben.post('/experiences', {
      templateKey: 'birthday-wish',
      fields: { name: 'Asha' },
    });
    const pinned = await ben.post('/experiences', { templateKey: 'date-invitation' });
    await ben.put(`/experiences/${pinned.body.id}/access`, { pin: '2412' });
    const custom = await ben.post('/experiences', { templateKey: 'anniversary' });
    await ben.post(`/experiences/${custom.body.id}/customize`);
    const gifted = await ben.post('/experiences', { templateKey: 'birthday-surprise' });
    const gift = (await ben.get(`/experiences/${gifted.body.id}/draft`)).body.steps.at(-1);
    const put = await ben.put(`/experiences/${gifted.body.id}/draft/gifts/${gift.key}`, {
      secret:
        gift.config.kind === 'INSTRUCTION'
          ? { kind: 'INSTRUCTION', instructions: 'Look under your pillow' }
          : { kind: 'PHYSICAL_MESSAGE', message: 'Dinner at 8' },
    });
    expect(put.status).toBe(200);

    expect(new Set(await ids(ben))).toEqual(
      new Set([named.body.id, pinned.body.id, custom.body.id, gifted.body.id]),
    );
    // The template's own starter gift was not the creator changing anything.
    const untouched = await ben.post('/experiences', { templateKey: 'birthday-surprise' });
    expect(await ids(ben)).not.toContain(untouched.body.id);
  });

  it('is private to this browser and never lists published surprises', async () => {
    const cat = await creator(ctx);
    const dan = await creator(ctx);
    const done = await publishedFromTemplate(ctx, cat);
    const draft = await cat.post('/experiences', { templateKey: 'anniversary' });
    await save(cat, draft.body.id, 'Ours');
    expect(await ids(cat)).toEqual([draft.body.id]);
    expect(await ids(cat)).not.toContain(done.id);
    expect(await ids(dan)).toEqual([]);
  });

  it('forgets untouched surprises a day after they were opened', async () => {
    const eve = await creator(ctx);
    const left = await eve.post('/experiences', { templateKey: 'date-invitation' });
    const kept = await eve.post('/experiences', { templateKey: 'anniversary' });
    await save(eve, kept.body.id, 'Keep me');
    const retention = ctx.app.get(RetentionService);
    await retention.sweep(new Date(Date.now() + 2 * HOUR));
    expect((await eve.get(`/experiences/${left.body.id}`)).status).toBe(200);
    await retention.sweep(new Date(Date.now() + 25 * HOUR));
    expect((await eve.get(`/experiences/${left.body.id}`)).status).toBe(404);
    expect((await eve.get(`/experiences/${kept.body.id}`)).status).toBe(200);
  });
});
