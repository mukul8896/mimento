import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
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

type Step = { key: string; type: string; config: Record<string, unknown> };

async function completeUntilGift(r: ReturnType<typeof recipient>, steps: Step[]) {
  for (const step of steps) {
    if (step.type === 'GIFT_REVEAL') return step;
    const answer =
      step.type === 'YES_NO_CHOICE'
        ? { kind: 'CHOICE', value: 'YES' }
        : step.type === 'MULTIPLE_CHOICE'
          ? { kind: 'OPTION', optionId: (step.config.options as { id: string }[])[0]!.id }
          : { kind: 'ACK' };
    const res = await r.answer(step.key, answer);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }
  throw new Error('no gift step');
}

describe('publishing', () => {
  it('refuses to publish an invalid draft and lists the issues', async () => {
    const { body: exp } = await alice.post('/experiences', { title: '' });
    const res = await alice.post(`/experiences/${exp.id}/publish`);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PUBLISH_VALIDATION_FAILED');
    expect(res.body.issues.map((i: { field: string }) => i.field)).toContain('steps');
    expect((await alice.post(`/experiences/${exp.id}/publish-check`)).body.ok).toBe(false);
  });

  it('publishes a template draft to a 256-bit private token stored only as a hash', async () => {
    const { id, shareToken } = await publishedFromTemplate(ctx, alice);
    expect(shareToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await ctx.prisma.experience.findUniqueOrThrow({ where: { id } });
    expect(row.accessTokenHash).not.toBe(shareToken);
    expect(row.accessTokenEnc).not.toContain(shareToken);
    const detail = await alice.get(`/experiences/${id}`);
    expect(detail.body).toMatchObject({ status: 'PUBLISHED', publishedVersion: 1 });
  });

  it('keeps published versions immutable in the database', async () => {
    const { id } = await publishedFromTemplate(ctx, alice);
    const version = await ctx.prisma.experienceVersion.findFirstOrThrow({
      where: { experienceId: id, state: 'PUBLISHED' },
    });
    await expect(
      ctx.prisma.experienceVersion.update({
        where: { id: version.id },
        data: { title: 'tampered' },
      }),
    ).rejects.toThrow();
    const step = await ctx.prisma.step.findFirstOrThrow({ where: { versionId: version.id } });
    await expect(
      ctx.prisma.step.update({ where: { id: step.id }, data: { position: 99 } }),
    ).rejects.toThrow();
    await expect(ctx.prisma.step.delete({ where: { id: step.id } })).rejects.toThrow();
  });

  it('replays an idempotent publish instead of creating a second version', async () => {
    const { body: exp } = await alice.post('/experiences', { templateKey: 'birthday-surprise' });
    const first = await alice
      .post(`/experiences/${exp.id}/publish`)
      .set('idempotency-key', 'publish-key-0001');
    const again = await alice
      .post(`/experiences/${exp.id}/publish`)
      .set('idempotency-key', 'publish-key-0001');
    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(again.body).toEqual(first.body);
    expect(
      await ctx.prisma.experienceVersion.count({
        where: { experienceId: exp.id, state: 'PUBLISHED' },
      }),
    ).toBe(1);
  });
});

describe('recipient player API', () => {
  it('serves a noindex, uncached experience without secrets or quiz answers', async () => {
    const { body: exp } = await alice.post('/experiences', { templateKey: 'anniversary' });
    const { body: draft } = await alice.get(`/experiences/${exp.id}/draft`);
    const quiz = draft.steps[1];
    quiz.config.correctOptionId = quiz.config.options[1].id;
    await alice.put(`/experiences/${exp.id}/draft`, {
      revision: draft.revision,
      title: draft.title,
      theme: draft.theme,
      settings: draft.settings,
      steps: draft.steps,
    });
    await alice.post(`/experiences/${exp.id}/publish`);
    const { body: link } = await alice.get(`/experiences/${exp.id}/share-link`);

    const r = recipient(ctx, link.shareToken);
    const meta = await r.meta();
    expect(meta.status).toBe(200);
    expect(meta.headers['cache-control']).toContain('no-store');
    expect(meta.headers['x-robots-tag']).toContain('noindex');
    const start = await r.start();
    expect(start.status).toBe(201);
    const body = JSON.stringify(start.body);
    expect(body).not.toContain('Dinner is booked');
    expect(start.body.experience.steps[1].config.correctOptionId).toBeNull();
  });

  it('enforces order, answer validity, the evasive No rule and closes without answers', async () => {
    const { shareToken, draft } = await publishedFromTemplate(ctx, alice, 'anniversary');
    const r = recipient(ctx, shareToken);
    await r.start();
    const [message, quiz, yesNo] = draft.steps as Step[];

    const early = await r.answer(yesNo!.key, { kind: 'CHOICE', value: 'YES' });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('STEP_OUT_OF_ORDER');

    expect((await r.answer(message!.key, { kind: 'CHOICE', value: 'YES' })).status).toBe(400);
    expect((await r.answer(message!.key, { kind: 'ACK' })).status).toBe(200);
    expect((await r.answer(quiz!.key, { kind: 'OPTION', optionId: 'does-not-exist' })).status).toBe(
      400,
    );
    expect((await r.answer(quiz!.key, { kind: 'OPTION', optionId: 'cafe' })).status).toBe(200);

    // The anniversary template's No button is permanently evasive; Maybe is disabled.
    const no = await r.answer(yesNo!.key, { kind: 'CHOICE', value: 'NO' });
    expect(no.status).toBe(400);
    const maybe = await r.answer(yesNo!.key, { kind: 'CHOICE', value: 'MAYBE' });
    expect(maybe.status).toBe(400);

    const close = await r.close();
    expect(close.status).toBe(204);
    const session = await ctx.prisma.recipientSession.findFirstOrThrow({
      where: { tokenHash: { not: '' }, responses: { some: { stepKey: quiz!.key } } },
      include: { responses: true },
      orderBy: { startedAt: 'desc' },
    });
    expect(session.closedAt).not.toBeNull();
    // Closing recorded nothing for the Yes/No step.
    expect(session.responses.map((x) => x.stepKey)).toEqual(
      expect.not.arrayContaining([yesNo!.key]),
    );
    expect(session.responses).toHaveLength(2);
  });

  it('accepts Maybe and No when the creator allows them', async () => {
    const { shareToken, draft } = await publishedFromTemplate(ctx, alice, 'date-invitation');
    const [message, yesNo] = draft.steps as Step[];
    for (const value of ['MAYBE', 'NO']) {
      const r = recipient(ctx, shareToken);
      await r.start();
      await r.answer(message!.key, { kind: 'ACK' });
      const res = await r.answer(yesNo!.key, { kind: 'CHOICE', value });
      expect(res.status).toBe(200);
    }
  });

  it('never releases the gift before the required steps are complete', async () => {
    const { shareToken, draft } = await publishedFromTemplate(ctx, alice, 'date-invitation');
    const gift = (draft.steps as Step[]).at(-1)!;
    const r = recipient(ctx, shareToken);
    await r.start();

    const direct = await r.reveal(gift.key);
    expect(direct.status).toBe(403);
    expect(direct.body.code).toBe('GIFT_LOCKED');
    expect(JSON.stringify(direct.body)).not.toContain('pick you up');

    // Answering the gift step through the answer endpoint is also refused.
    await completeUntilGift(r, draft.steps);
    expect((await r.answer(gift.key, { kind: 'ACK' })).status).toBe(400);

    // Another session's progress does not unlock this one.
    const other = recipient(ctx, shareToken);
    await other.start();
    expect((await other.reveal(gift.key)).status).toBe(403);

    const revealed = await r.reveal(gift.key);
    expect(revealed.status).toBe(200);
    expect(revealed.body.gift).toEqual({
      kind: 'PHYSICAL_MESSAGE',
      message: 'I will pick you up at 7. Wear something comfy!',
    });
    expect(revealed.body.progress.completed).toBe(true);
    expect(revealed.headers['cache-control']).toContain('no-store');
  });

  it('rejects requests without a valid session and resumes with one', async () => {
    const { shareToken, draft } = await publishedFromTemplate(ctx, alice);
    const r = recipient(ctx, shareToken);
    expect((await r.answer(draft.steps[0].key, { kind: 'ACK' })).status).toBe(400);
    await r.start();
    await r.answer(draft.steps[0].key, { kind: 'ACK' });
    const resumed = await r.resume();
    expect(resumed.status).toBe(200);
    expect(resumed.body.progress.completedStepKeys).toEqual([draft.steps[0].key]);
  });

  it('allows a one-time gift to be revealed by one session only', async () => {
    const { body: exp } = await alice.post('/experiences', { templateKey: 'date-invitation' });
    const { body: draft } = await alice.get(`/experiences/${exp.id}/draft`);
    draft.steps.at(-1).config.oneTimeReveal = true;
    await alice.put(`/experiences/${exp.id}/draft`, {
      revision: draft.revision,
      title: draft.title,
      theme: draft.theme,
      settings: draft.settings,
      steps: draft.steps,
    });
    await alice.post(`/experiences/${exp.id}/publish`);
    const { body: link } = await alice.get(`/experiences/${exp.id}/share-link`);
    const gift = draft.steps.at(-1);

    const first = recipient(ctx, link.shareToken);
    await first.start();
    await completeUntilGift(first, draft.steps);
    expect((await first.reveal(gift.key)).status).toBe(200);
    // Same session may view again (e.g. after a refresh).
    expect((await first.reveal(gift.key)).status).toBe(200);

    const second = recipient(ctx, link.shareToken);
    await second.start();
    await completeUntilGift(second, draft.steps);
    const denied = await second.reveal(gift.key);
    expect(denied.status).toBe(410);
    expect(denied.body.code).toBe('GIFT_ALREADY_REVEALED');
  });

  it('pins a session to the version it started on while new versions are published', async () => {
    const { id, shareToken, draft } = await publishedFromTemplate(ctx, alice);
    const r = recipient(ctx, shareToken);
    await r.start();
    const edited = draft.steps.map((s: Step, i: number) =>
      i === 0 ? { ...s, config: { ...s.config, heading: 'Version two' } } : s,
    );
    await alice.put(`/experiences/${id}/draft`, {
      revision: draft.revision,
      title: draft.title,
      theme: draft.theme,
      settings: draft.settings,
      steps: edited,
    });
    // Unpublished edits are not visible to recipients.
    expect((await r.resume()).body.experience.steps[0].config.heading).toBe('Hey you 👋');
    await alice.post(`/experiences/${id}/publish`);
    expect((await r.resume()).body.experience.steps[0].config.heading).toBe('Hey you 👋');
    const fresh = recipient(ctx, shareToken);
    expect((await fresh.start()).body.experience.steps[0].config.heading).toBe('Version two');
  });

  it('shows the creator aggregate counts and permitted responses only', async () => {
    const { id, shareToken, draft } = await publishedFromTemplate(ctx, alice);
    const r = recipient(ctx, shareToken);
    await r.start();
    const gift = await completeUntilGift(r, draft.steps);
    await r.reveal(gift.key);
    const partial = recipient(ctx, shareToken);
    await partial.start();
    await partial.close();

    const results = await alice.get(`/experiences/${id}/results`);
    expect(results.status).toBe(200);
    expect(results.body).toMatchObject({ started: 2, completed: 1, closedEarly: 1 });
    const yesNo = results.body.steps.find((s: { type: string }) => s.type === 'YES_NO_CHOICE');
    expect(yesNo.tallies).toEqual([{ value: 'YES', label: 'Yes!', count: 1 }]);
    expect(results.body.responses).toHaveLength(2);
    const serialized = JSON.stringify(results.body);
    for (const forbidden of [
      '"ip"',
      'ipAddress',
      'userAgent',
      'location',
      'tokenHash',
      'lastActiveAt',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    const summary = await alice.get(`/experiences`);
    const item = summary.body.items.find((e: { id: string }) => e.id === id);
    expect(item.stats).toEqual({ started: 2, completed: 1 });
  });

  it('hides individual answers when the creator chose aggregate-only results', async () => {
    const { body: exp } = await alice.post('/experiences', { templateKey: 'date-invitation' });
    const { body: draft } = await alice.get(`/experiences/${exp.id}/draft`);
    await alice.put(`/experiences/${exp.id}/draft`, {
      revision: draft.revision,
      title: draft.title,
      theme: draft.theme,
      settings: { responseVisibility: 'AGGREGATE_ONLY' },
      steps: draft.steps,
    });
    await alice.post(`/experiences/${exp.id}/publish`);
    const { body: link } = await alice.get(`/experiences/${exp.id}/share-link`);
    const r = recipient(ctx, link.shareToken);
    const start = await r.start();
    expect(start.body.experience.responsesVisibleToCreator).toBe(false);
    await completeUntilGift(r, draft.steps);
    const results = await alice.get(`/experiences/${exp.id}/results`);
    expect(results.body.responses).toBeNull();
    expect(results.body.started).toBe(1);
  });
});
