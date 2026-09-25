import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, creator, type Creator, type TestContext } from './helpers';

let ctx: TestContext;
let alice: Creator;
let operator: Creator;

beforeAll(async () => {
  // Billing off is the default; this suite is about what happens once it is switched on.
  ctx = await createTestContext({ BILLING_ENABLED: 'true' });
  alice = await creator(ctx);
  operator = await creator(ctx, { admin: true });
});
afterAll(async () => ctx.close());

async function tierOf(id: string) {
  return (await alice.get(`/experiences/${id}`)).body.tier as {
    required: string;
    held: string;
    satisfied: boolean;
  };
}

describe('tiers', () => {
  it('publishes a free template without any entitlement', async () => {
    const created = await alice.post('/experiences', { templateKey: 'date-invitation' });
    expect(await tierOf(created.body.id)).toMatchObject({ required: 'FREE', satisfied: true });
    expect((await alice.post(`/experiences/${created.body.id}/publish`)).status).toBe(200);
  });

  it('blocks a paid template until it is unlocked, then publishes', async () => {
    const created = await alice.post('/experiences', { templateKey: 'birthday-surprise' });
    const id = created.body.id as string;
    expect(await tierOf(id)).toMatchObject({ required: 'PLUS', held: 'FREE', satisfied: false });

    const blocked = await alice.post(`/experiences/${id}/publish`);
    expect(blocked.status).toBe(422);
    expect(JSON.stringify(blocked.body)).toContain('PLUS');

    const granted = await operator.post(`/admin/experiences/${id}/entitlement`, { tier: 'PLUS' });
    expect(granted.status).toBe(204);

    expect(await tierOf(id)).toMatchObject({ required: 'PLUS', held: 'PLUS', satisfied: true });
    expect((await alice.post(`/experiences/${id}/publish`)).status).toBe(200);
  });

  it("keeps a template's structure until the creator customises it with PRO", async () => {
    const created = await alice.post('/experiences', { templateKey: 'date-invitation' });
    const id = created.body.id as string;
    expect(created.body).toMatchObject({
      mode: 'TEMPLATE',
      template: { key: 'date-invitation', tier: 'FREE' },
    });
    const draft = (await alice.get(`/experiences/${id}/draft`)).body;
    expect(draft.mode).toBe('TEMPLATE');
    const save = (revision: number, steps: unknown[]) =>
      alice.put(`/experiences/${id}/draft`, {
        revision,
        title: 'Reworded',
        theme: draft.theme,
        settings: draft.settings,
        steps,
      });

    // Editing words keeps it free...
    const reworded = structuredClone(draft);
    reworded.steps[0].config.heading = 'A completely different heading';
    const saved = await save(draft.revision, reworded.steps);
    expect(saved.status).toBe(200);
    expect(await tierOf(id)).toMatchObject({ required: 'FREE', satisfied: true });

    // ...but a personalised template cannot lose, gain or reorder steps.
    const fewer = structuredClone(reworded.steps);
    fewer.splice(1, 1);
    const refused = await save(saved.body.revision, fewer);
    expect(refused.status).toBe(422);
    expect(refused.body.code).toBe('STRUCTURE_LOCKED');
    const swapped = structuredClone(reworded.steps);
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect((await save(saved.body.revision, swapped)).body.code).toBe('STRUCTURE_LOCKED');
    const branched = structuredClone(reworded.steps);
    branched[0].next = { rules: [], otherwise: 'END' };
    expect((await save(saved.body.revision, branched)).body.code).toBe('STRUCTURE_LOCKED');

    // Customize with PRO: same content, full builder, PRO to publish.
    const customised = await alice.post(`/experiences/${id}/customize`);
    expect(customised.status).toBe(200);
    expect(customised.body.mode).toBe('CUSTOM');
    expect(customised.body.tier).toMatchObject({ required: 'PRO', satisfied: false });
    const kept = (await alice.get(`/experiences/${id}/draft`)).body;
    expect(kept.steps[0].config.heading).toBe('A completely different heading');
    const trimmed = await save(kept.revision, fewer);
    expect(trimmed.status).toBe(200);
    expect((await alice.post(`/experiences/${id}/publish`)).status).toBe(422);

    // Doing it twice is harmless, and the master template is untouched.
    expect((await alice.post(`/experiences/${id}/customize`)).status).toBe(200);
    const again = await alice.post('/experiences', { templateKey: 'date-invitation' });
    const fresh = (await alice.get(`/experiences/${again.body.id}/draft`)).body;
    expect(fresh.steps.length).toBe(draft.steps.length);
    expect(fresh.steps[0].config.heading).toBe(draft.steps[0].config.heading);
  });

  it('starts a blank experience in the full builder', async () => {
    const created = await alice.post('/experiences', {});
    expect(created.body).toMatchObject({ mode: 'CUSTOM', template: null });
    expect(created.body.tier).toMatchObject({ required: 'PRO' });
  });

  it("does not let someone else customise a creator's surprise", async () => {
    const created = await alice.post('/experiences', { templateKey: 'date-invitation' });
    const mallory = await creator(ctx);
    expect((await mallory.post(`/experiences/${created.body.id}/customize`)).status).toBe(404);
    expect((await alice.get(`/experiences/${created.body.id}`)).body.mode).toBe('TEMPLATE');
  });

  it('refuses to let a creator grant their own entitlement', async () => {
    const created = await alice.post('/experiences', { templateKey: 'birthday-surprise' });
    const res = await alice.post(`/admin/experiences/${created.body.id}/entitlement`, {
      tier: 'PRO',
    });
    expect(res.status).toBe(403);
  });
});

describe('tiers with billing disabled', () => {
  it('lets everything publish, so the product runs before payments exist', async () => {
    const free = await createTestContext();
    try {
      const user = await creator(free);
      const created = await user.post('/experiences', { templateKey: 'birthday-surprise' });
      const detail = await user.get(`/experiences/${created.body.id}`);
      expect(detail.body.tier).toMatchObject({ required: 'PLUS', held: 'FREE', satisfied: true });
      expect((await user.post(`/experiences/${created.body.id}/publish`)).status).toBe(200);
    } finally {
      await free.close();
    }
  });
});
