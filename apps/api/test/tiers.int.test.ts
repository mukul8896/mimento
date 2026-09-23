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
    expect(JSON.stringify(blocked.body)).toContain('upgrade');

    const granted = await operator.post(`/admin/experiences/${id}/entitlement`, { tier: 'PLUS' });
    expect(granted.status).toBe(204);

    expect(await tierOf(id)).toMatchObject({ required: 'PLUS', held: 'PLUS', satisfied: true });
    expect((await alice.post(`/experiences/${id}/publish`)).status).toBe(200);
  });

  it('charges PRO once the creator changes the structure of a free template', async () => {
    const created = await alice.post('/experiences', { templateKey: 'date-invitation' });
    const id = created.body.id as string;
    const draft = (await alice.get(`/experiences/${id}/draft`)).body;

    // Editing words keeps it free...
    const reworded = structuredClone(draft);
    reworded.steps[0].config.heading = 'A completely different heading';
    const saved = await alice.put(`/experiences/${id}/draft`, {
      revision: draft.revision,
      title: 'Reworded',
      theme: draft.theme,
      settings: draft.settings,
      steps: reworded.steps,
    });
    expect(saved.status).toBe(200);
    expect(await tierOf(id)).toMatchObject({ required: 'FREE', satisfied: true });

    // ...removing a step is building your own sequence.
    const fewer = structuredClone(reworded);
    fewer.steps.splice(1, 1);
    const trimmed = await alice.put(`/experiences/${id}/draft`, {
      revision: saved.body.revision,
      title: 'Reworded',
      theme: draft.theme,
      settings: draft.settings,
      steps: fewer.steps,
    });
    expect(trimmed.status).toBe(200);
    expect(await tierOf(id)).toMatchObject({ required: 'PRO', held: 'FREE', satisfied: false });
    expect((await alice.post(`/experiences/${id}/publish`)).status).toBe(422);
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
