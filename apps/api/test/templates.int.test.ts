import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { suggestedDate } from '@momentpath/contracts';
import { API, createTestContext, creator, type Creator, type TestContext } from './helpers';

let ctx: TestContext;
let alice: Creator;
let operator: Creator;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await creator(ctx);
  operator = await creator(ctx, { admin: true });
});
afterAll(async () => ctx.close());

interface Field {
  key: string;
  placeholder: string;
  kind: 'text' | 'datetime';
  suggest: 'NONE' | 'NEXT_NEW_YEAR' | 'IN_7_DAYS' | 'TOMORROW_MORNING';
}

const exampleValues = (fields: Field[]) =>
  Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.kind === 'datetime'
        ? suggestedDate(f.suggest === 'NONE' ? 'IN_7_DAYS' : f.suggest)
        : f.placeholder,
    ]),
  );

describe('template gallery', () => {
  it('is public, with occasions, themes and personalisation fields', async () => {
    const res = await ctx.http.get(`${API}/templates`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(20);
    const diwali = res.body.items.find((t: { key: string }) => t.key === 'diwali-wishes');
    expect(diwali).toMatchObject({ occasion: 'Festivals', emoji: '🪔', tier: 'FREE' });
    expect(diwali.fields.map((f: Field) => f.key)).toEqual(['name', 'from']);
    expect(diwali.theme.palette.background).toMatch(/^#/);
  });

  it('serves a playable preview filled with example values', async () => {
    const res = await ctx.http.get(`${API}/templates/diwali-wishes/preview`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Happy Diwali, Emma!');
    expect(JSON.stringify(res.body.steps)).not.toContain('{{');
    expect((await ctx.http.get(`${API}/templates/nope/preview`)).status).toBe(404);
  });
});

describe('creating from a template', () => {
  it('fills in the personal details everywhere', async () => {
    const res = await alice.post('/experiences', {
      templateKey: 'birthday-wish',
      fields: { name: 'Jenny', from: 'Mark' },
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Happy birthday, Jenny!');
    const draft = (await alice.get(`/experiences/${res.body.id}/draft`)).body;
    expect(JSON.stringify(draft.steps)).toContain('Happy birthday, Jenny!');
    expect(JSON.stringify(draft.steps)).not.toContain('{{');
    const gift = draft.steps.at(-1);
    const secret = await alice.get(`/experiences/${res.body.id}/draft/gifts/${gift.key}`);
    expect(secret.body.secret.message).toContain('Mark');
  });

  it('asks for required details', async () => {
    const res = await alice.post('/experiences', { templateKey: 'birthday-wish', fields: {} });
    expect(res.status).toBe(422);
    expect(res.body.issues[0].field).toBe('name');
  });

  it('turns date details into countdown and unlock times', async () => {
    const midnight = '2027-01-01T00:00:00.000Z';
    const res = await alice.post('/experiences', {
      templateKey: 'new-year-countdown',
      fields: { name: 'Sam', midnight },
    });
    expect(res.status).toBe(201);
    const steps = (await alice.get(`/experiences/${res.body.id}/draft`)).body.steps;
    expect(steps.find((s: { type: string }) => s.type === 'COUNTDOWN').config.targetAt).toBe(
      midnight,
    );
    expect(steps.at(-1).config.revealAt).toBe(midnight);
  });

  it('every template can be personalised and published as it is', async () => {
    const { items } = (await ctx.http.get(`${API}/templates`)).body as {
      items: { key: string; fields: Field[] }[];
    };
    for (const t of items) {
      const created = await alice.post('/experiences', {
        templateKey: t.key,
        fields: exampleValues(t.fields),
      });
      expect(created.status, `${t.key}: ${JSON.stringify(created.body)}`).toBe(201);
      const check = await alice.post(`/experiences/${created.body.id}/publish-check`);
      expect(check.body, t.key).toMatchObject({ ok: true, issues: [] });
    }
  });
});

describe('operator control of templates', () => {
  it('makes a template paid or hidden, and only the operator can', async () => {
    const list = await operator.get('/admin/templates');
    expect(list.status).toBe(200);
    expect(list.body.items.find((t: { key: string }) => t.key === 'holi-wishes')).toMatchObject({
      tier: 'FREE',
      isActive: true,
    });

    expect((await alice.put('/admin/templates/holi-wishes', { tier: 'PLUS' })).status).toBe(403);
    expect((await operator.put('/admin/templates/holi-wishes', { tier: 'PLUS' })).status).toBe(204);
    const pub = (await ctx.http.get(`${API}/templates`)).body.items;
    expect(pub.find((t: { key: string }) => t.key === 'holi-wishes').tier).toBe('PLUS');

    await operator.put('/admin/templates/holi-wishes', { isActive: false });
    const hidden = (await ctx.http.get(`${API}/templates`)).body.items;
    expect(hidden.some((t: { key: string }) => t.key === 'holi-wishes')).toBe(false);

    // Put it back so other tests see the seeded state.
    await operator.put('/admin/templates/holi-wishes', { tier: 'FREE', isActive: true });
    const audit = await ctx.prisma.auditLog.count({ where: { action: 'template.updated' } });
    expect(audit).toBeGreaterThanOrEqual(3);
  });
});
