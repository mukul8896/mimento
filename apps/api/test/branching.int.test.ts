import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, creator, recipient, type Creator, type TestContext } from './helpers';

let ctx: TestContext;
let alice: Creator;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await creator(ctx);
});
afterAll(async () => ctx.close());

/**
 * Will you come to dinner?  ── Yes ──▶ "See you at 8"  ──▶ gift
 *                           └─ No ───▶ "Maybe next time" ──▶ END (no gift)
 */
function branchingSteps() {
  const ask = randomUUID();
  const yes = randomUUID();
  const no = randomUUID();
  const gift = randomUUID();
  const steps = [
    {
      key: ask,
      type: 'YES_NO_CHOICE',
      config: { question: 'Will you come to dinner?' },
      next: { rules: [{ when: { kind: 'ANSWER', equals: 'NO' }, goto: no }], otherwise: yes },
    },
    {
      key: yes,
      type: 'MESSAGE',
      config: { heading: 'See you at 8' },
      next: { rules: [], otherwise: gift },
    },
    {
      key: no,
      type: 'MESSAGE',
      config: { heading: 'Maybe next time' },
      next: { rules: [], otherwise: 'END' },
    },
    { key: gift, type: 'GIFT_REVEAL', config: { title: 'Dinner is on me' } },
  ];
  return { steps, keys: { ask, yes, no, gift } };
}

async function saveDraft(id: string, steps: object[]) {
  const draft = (await alice.get(`/experiences/${id}/draft`)).body;
  return alice.put(`/experiences/${id}/draft`, {
    revision: draft.revision,
    title: 'Dinner?',
    theme: draft.theme,
    settings: draft.settings,
    steps,
  });
}

async function publishedBranching() {
  const { body: exp } = await alice.post('/experiences', {});
  const { steps, keys } = branchingSteps();
  const saved = await saveDraft(exp.id, steps);
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  await alice.put(`/experiences/${exp.id}/draft/gifts/${keys.gift}`, {
    secret: { kind: 'PHYSICAL_MESSAGE', message: 'Table for two at 8' },
  });
  const published = await alice.post(`/experiences/${exp.id}/publish`);
  expect(published.status, JSON.stringify(published.body)).toBe(200);
  const link = await alice.get(`/experiences/${exp.id}/share-link`);
  return { id: exp.id as string, token: link.body.shareToken as string, keys };
}

describe('branching', () => {
  it('saves routing and returns it in the draft', async () => {
    const { body: exp } = await alice.post('/experiences', {});
    const { steps, keys } = branchingSteps();
    expect((await saveDraft(exp.id, steps)).status).toBe(200);
    const draft = (await alice.get(`/experiences/${exp.id}/draft`)).body;
    expect(draft.steps[0].next).toEqual(steps[0]!.next);
    expect(draft.steps.find((s: { key: string }) => s.key === keys.gift).next).toBeUndefined();
  });

  it('follows the Yes branch to the gift', async () => {
    const { token, keys } = await publishedBranching();
    const r = recipient(ctx, token);
    const started = await r.start();
    // Routing never reaches the browser: it could give away which answer leads to the gift.
    expect(JSON.stringify(started.body.experience)).not.toContain('"next"');
    expect(started.body.progress.nextStepKey).toBe(keys.ask);

    const answered = await r.answer(keys.ask, { kind: 'CHOICE', value: 'YES' });
    expect(answered.body.progress.nextStepKey).toBe(keys.yes);
    // The other branch cannot be answered.
    expect((await r.answer(keys.no, { kind: 'ACK' })).status).toBe(409);
    await r.answer(keys.yes, { kind: 'ACK' });

    const reveal = await r.reveal(keys.gift);
    expect(reveal.status).toBe(200);
    expect(reveal.body.gift.message).toBe('Table for two at 8');
    expect(reveal.body.progress.completed).toBe(true);
  });

  it('ends the No branch without the gift, and the gift stays locked', async () => {
    const { token, keys } = await publishedBranching();
    const r = recipient(ctx, token);
    await r.start();
    const answered = await r.answer(keys.ask, { kind: 'CHOICE', value: 'NO' });
    expect(answered.body.progress.nextStepKey).toBe(keys.no);
    const done = await r.answer(keys.no, { kind: 'ACK' });
    expect(done.body.progress).toMatchObject({ nextStepKey: null, completed: true });

    const reveal = await r.reveal(keys.gift);
    expect(reveal.status).toBe(403);
    expect(JSON.stringify(reveal.body)).not.toContain('Table for two');
  });

  it('resumes on the branch the recipient took', async () => {
    const { token, keys } = await publishedBranching();
    const r = recipient(ctx, token);
    await r.start();
    await r.answer(keys.ask, { kind: 'CHOICE', value: 'NO' });
    const resumed = await r.resume();
    expect(resumed.body.progress).toMatchObject({
      completedStepKeys: [keys.ask],
      nextStepKey: keys.no,
    });
  });

  it('refuses to publish a flow with a loop or an unreachable surprise', async () => {
    const { body: exp } = await alice.post('/experiences', {});
    const { steps, keys } = branchingSteps();
    // "Maybe next time" goes back to the question: a loop.
    const looped = steps.map((s) =>
      s.key === keys.no ? { ...s, next: { rules: [], otherwise: keys.ask } } : s,
    );
    expect((await saveDraft(exp.id, looped)).status).toBe(200);
    await alice.put(`/experiences/${exp.id}/draft/gifts/${keys.gift}`, {
      secret: { kind: 'PHYSICAL_MESSAGE', message: 'x' },
    });
    const blocked = await alice.post(`/experiences/${exp.id}/publish`);
    expect(blocked.status).toBe(422);
    expect(JSON.stringify(blocked.body)).toContain('earlier step');

    // Both branches end early: nobody can reach the gift.
    const orphaned = steps.map((s) =>
      s.key === keys.yes ? { ...s, next: { rules: [], otherwise: 'END' } } : s,
    );
    expect((await saveDraft(exp.id, orphaned)).status).toBe(200);
    const check = await alice.post(`/experiences/${exp.id}/publish-check`);
    expect(JSON.stringify(check.body.issues)).toContain('final surprise');
  });
});

describe('version history', () => {
  it('lists published versions and restores one into the draft, gift included', async () => {
    const { id, keys } = await publishedBranching();
    // Change the draft and publish a second version with another gift.
    const draft = (await alice.get(`/experiences/${id}/draft`)).body;
    const edited = draft.steps.map((s: { key: string; config: object }) =>
      s.key === keys.yes ? { ...s, config: { ...s.config, heading: 'Changed my mind' } } : s,
    );
    expect((await saveDraft(id, edited)).status).toBe(200);
    await alice.put(`/experiences/${id}/draft/gifts/${keys.gift}`, {
      secret: { kind: 'PHYSICAL_MESSAGE', message: 'Second gift' },
    });
    expect((await alice.post(`/experiences/${id}/publish`)).status).toBe(200);

    const list = await alice.get(`/experiences/${id}/versions`);
    expect(
      list.body.items.map((v: { number: number; isActive: boolean }) => [v.number, v.isActive]),
    ).toEqual([
      [2, true],
      [1, false],
    ]);

    const before = (await alice.get(`/experiences/${id}/draft`)).body.revision;
    const restored = await alice.post(`/experiences/${id}/versions/1/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body).toEqual({ revision: before + 1, restoredFrom: 1 });

    const after = (await alice.get(`/experiences/${id}/draft`)).body;
    expect(after.steps.find((s: { key: string }) => s.key === keys.yes).config.heading).toBe(
      'See you at 8',
    );
    expect(after.steps[0].next).toBeDefined(); // routing comes back too
    const gift = await alice.get(`/experiences/${id}/draft/gifts/${keys.gift}`);
    expect(gift.body.secret.message).toBe('Table for two at 8');

    // Recipients still get version 2 until the creator publishes again.
    const detail = (await alice.get(`/experiences/${id}`)).body;
    expect(detail.publishedVersion).toBe(2);

    // A stale editor tab cannot overwrite the restore.
    expect(
      (
        await alice.put(`/experiences/${id}/draft`, {
          revision: before,
          title: 'Old tab',
          theme: after.theme,
          settings: after.settings,
          steps: after.steps,
        })
      ).status,
    ).toBe(409);
  });

  it("hides another creator's history and unknown versions", async () => {
    const { id } = await publishedBranching();
    const bob = await creator(ctx);
    expect((await bob.get(`/experiences/${id}/versions`)).status).toBe(404);
    expect((await bob.post(`/experiences/${id}/versions/1/restore`)).status).toBe(404);
    expect((await alice.post(`/experiences/${id}/versions/99/restore`)).status).toBe(404);
  });
});
