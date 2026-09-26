import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, creator, recipient, type Creator, type TestContext } from './helpers';

let ctx: TestContext;
let alice: Creator;
let operator: Creator;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await creator(ctx);
  operator = await creator(ctx, { admin: true });
});
afterAll(async () => ctx.close());

async function publishedProposal() {
  const created = await alice.post('/experiences', {
    templateKey: 'proposal',
    fields: { name: 'Priya', from: 'Rahul', firstPlace: 'Goa' },
  });
  expect(created.status).toBe(201);
  const id = created.body.id as string;
  expect((await alice.post(`/experiences/${id}/publish`)).status).toBe(200);
  const token = (await alice.get(`/experiences/${id}/share-link`)).body.shareToken as string;
  return { id, token };
}

describe('scenes', () => {
  it('give every template its own pace', async () => {
    const list = (await alice.get('/templates')).body.items as { key: string }[];
    expect(list.length).toBeGreaterThan(20);
    const paces = new Map<string, string>();
    for (const { key } of list) {
      const preview = (await alice.get(`/templates/${key}/preview`)).body;
      paces.set(key, preview.theme.motionProfile);
    }
    expect([...paces.values()].every(Boolean)).toBe(true);
    expect(paces.get('birthday-wish')).toBe('PLAYFUL');
    expect(paces.get('diwali-wishes')).toBe('FESTIVE');
    expect(paces.get('sorry')).toBe('NOSTALGIC');
    expect(paces.get('proposal')).toBe('CINEMATIC');
  });

  it('carry a template’s direction from the draft to the recipient', async () => {
    const { id, token } = await publishedProposal();
    const draft = (await alice.get(`/experiences/${id}/draft`)).body;
    expect(draft.theme).toMatchObject({
      motionProfile: 'CINEMATIC',
      music: { source: 'RECORDED', track: 'CLAIR_DE_LUNE' },
    });
    const question = draft.steps.find((s: { type: string }) => s.type === 'YES_NO_CHOICE');
    expect(question.scene).toMatchObject({ layout: 'FOCUS', climax: 'PROPOSAL' });

    const r = recipient(ctx, token);
    const started = await r.start();
    expect(started.status).toBe(201);
    const exp = started.body.experience;
    expect(exp.theme.motionProfile).toBe('CINEMATIC');
    expect(exp.steps.map((s: { scene?: { layout: string } }) => s.scene?.layout)).toEqual([
      'FLOAT',
      'FLOAT',
      'FLOAT',
      'FOCUS',
      'FOCUS',
      'FLOAT',
    ]);
    // The puzzle answer still never reaches the browser, scenes or not.
    expect(JSON.stringify(exp)).not.toContain('Goa');
  });

  it('are kept when a PRO creator saves the draft', async () => {
    const created = await alice.post('/experiences', {});
    const id = created.body.id as string;
    const draft = (await alice.get(`/experiences/${id}/draft`)).body;
    const saved = await alice.put(`/experiences/${id}/draft`, {
      revision: draft.revision,
      title: 'Mine',
      theme: { ...draft.theme, motionProfile: 'ROMANTIC' },
      settings: draft.settings,
      steps: [
        {
          key: '00000000-0000-4000-8000-00000000abcd',
          type: 'MESSAGE',
          config: { heading: 'Hello' },
          scene: { layout: 'FOCUS', entrance: 'WORD_REVEAL', music: 0.3 },
        },
      ],
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const again = (await alice.get(`/experiences/${id}/draft`)).body;
    expect(again.steps[0].scene).toMatchObject({
      layout: 'FOCUS',
      entrance: 'WORD_REVEAL',
      music: 0.3,
    });
    expect(again.theme.motionProfile).toBe('ROMANTIC');
  });
});

describe('ending and branding', () => {
  it('free surprises are branded; paid ones carry no Wish Revealer branding', async () => {
    const free = await publishedProposal();
    const freeStart = await recipient(ctx, free.token).start();
    expect(freeStart.body.experience.branded).toBe(true);

    const paid = await publishedProposal();
    const grant = await operator.post(`/admin/experiences/${paid.id}/entitlement`, {
      tier: 'PLUS',
    });
    expect(grant.status).toBe(204);
    const paidStart = await recipient(ctx, paid.token).start();
    expect(paidStart.body.experience.branded).toBe(false);
  });
});
