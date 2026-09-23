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

const UNKNOWN_TOKEN = 'A'.repeat(43);

async function neutral(token: string) {
  const r = recipient(ctx, token);
  const meta = await r.meta();
  const start = await r.start();
  return { meta, start };
}

describe('lifecycle fails closed with a neutral response', () => {
  it('treats unknown, malformed, disabled, expired and deleted links identically', async () => {
    const reference = await neutral(UNKNOWN_TOKEN);
    expect(reference.meta.status).toBe(404);
    expect(reference.meta.body.code).toBe('EXPERIENCE_UNAVAILABLE');

    const malformed = await neutral('not-a-token');
    expect(malformed.meta.status).toBe(404);
    expect(malformed.meta.body.code).toBe(reference.meta.body.code);

    const disabled = await publishedFromTemplate(ctx, alice);
    expect((await alice.post(`/experiences/${disabled.id}/disable`)).status).toBe(204);
    const expired = await publishedFromTemplate(ctx, alice);
    expect((await alice.post(`/experiences/${expired.id}/expire`)).status).toBe(204);
    const deleted = await publishedFromTemplate(ctx, alice);
    expect((await alice.del(`/experiences/${deleted.id}`)).status).toBe(204);

    for (const token of [disabled.shareToken, expired.shareToken, deleted.shareToken]) {
      const res = await neutral(token);
      for (const r of [res.meta, res.start]) {
        expect(r.status).toBe(404);
        expect(r.body.code).toBe('EXPERIENCE_UNAVAILABLE');
        expect(r.body.title).toBe(reference.meta.body.title);
      }
    }
  });

  it('denies an existing session as soon as the experience is disabled', async () => {
    const { id, shareToken, draft } = await publishedFromTemplate(ctx, alice);
    const r = recipient(ctx, shareToken);
    await r.start();
    await alice.post(`/experiences/${id}/disable`);
    expect((await r.answer(draft.steps[0].key, { kind: 'ACK' })).status).toBe(404);
    expect((await r.reveal(draft.steps.at(-1).key)).status).toBe(404);
    expect((await alice.post(`/experiences/${id}/enable`)).status).toBe(204);
    expect((await r.answer(draft.steps[0].key, { kind: 'ACK' })).status).toBe(200);
  });

  it('honours scheduled expiry and lets the creator extend it', async () => {
    const { id, shareToken } = await publishedFromTemplate(ctx, alice);
    expect(
      (
        await alice.put(`/experiences/${id}/expiry`, {
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        })
      ).status,
    ).toBe(409);
    const soon = new Date(Date.now() + 3600_000).toISOString();
    expect((await alice.put(`/experiences/${id}/expiry`, { expiresAt: soon })).status).toBe(204);
    expect((await recipient(ctx, shareToken).meta()).status).toBe(200);

    // Simulate the clock passing the expiry.
    await ctx.prisma.experience.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await recipient(ctx, shareToken).meta()).status).toBe(404);
    expect((await alice.get(`/experiences/${id}`)).body.status).toBe('EXPIRED');
    expect(
      (await alice.get('/experiences?status=INACTIVE')).body.items.map((e: { id: string }) => e.id),
    ).toContain(id);

    expect((await alice.put(`/experiences/${id}/expiry`, { expiresAt: null })).status).toBe(204);
    expect((await recipient(ctx, shareToken).meta()).status).toBe(200);
  });

  it('rejects invalid transitions', async () => {
    const { body: draftOnly } = await alice.post('/experiences', {});
    expect((await alice.post(`/experiences/${draftOnly.id}/disable`)).status).toBe(409);
    expect((await alice.post(`/experiences/${draftOnly.id}/enable`)).status).toBe(409);
    const { id } = await publishedFromTemplate(ctx, alice);
    await alice.post(`/experiences/${id}/disable`);
    const publishWhileDisabled = await alice.post(`/experiences/${id}/publish`);
    expect(publishWhileDisabled.status).toBe(409);
  });

  it('rotating the link invalidates the old link and its sessions', async () => {
    const { id, shareToken, draft } = await publishedFromTemplate(ctx, alice);
    const r = recipient(ctx, shareToken);
    await r.start();
    const rotated = await alice.post(`/experiences/${id}/share-link/rotate`);
    expect(rotated.body.shareToken).not.toBe(shareToken);
    expect((await recipient(ctx, shareToken).meta()).status).toBe(404);
    expect((await r.answer(draft.steps[0].key, { kind: 'ACK' })).status).toBe(404);
    expect((await recipient(ctx, rotated.body.shareToken).meta()).status).toBe(200);
  });
});

describe('permanent deletion', () => {
  it('deletes all recipient data, is idempotent and queues storage cleanup', async () => {
    const { id, shareToken, draft } = await publishedFromTemplate(ctx, alice);
    const r = recipient(ctx, shareToken);
    await r.start();
    await r.answer(draft.steps[0].key, { kind: 'ACK' });

    const first = await alice.del(`/experiences/${id}`).set('idempotency-key', 'delete-key-000001');
    expect(first.status).toBe(204);
    expect((await alice.del(`/experiences/${id}`)).status).toBe(204);
    expect((await alice.get(`/experiences/${id}`)).status).toBe(404);

    expect(await ctx.prisma.experienceVersion.count({ where: { experienceId: id } })).toBe(0);
    expect(await ctx.prisma.recipientSession.count({ where: { experienceId: id } })).toBe(0);
    const tombstone = await ctx.prisma.experience.findUniqueOrThrow({ where: { id } });
    expect(tombstone).toMatchObject({
      status: 'DELETED',
      title: '',
      accessTokenHash: null,
      accessTokenEnc: null,
    });
    expect(await ctx.outbox.processDue()).toBeGreaterThan(0);
  });

  it('rejects reusing an idempotency key for a different request', async () => {
    const a = await publishedFromTemplate(ctx, alice);
    const b = await publishedFromTemplate(ctx, alice);
    expect(
      (await alice.post(`/experiences/${a.id}/disable`).set('idempotency-key', 'reused-key-00001'))
        .status,
    ).toBe(204);
    const reused = await alice
      .post(`/experiences/${b.id}/disable`)
      .set('idempotency-key', 'reused-key-00001');
    expect(reused.status).toBe(422);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });
});

describe('account deletion', () => {
  it('removes creator data, refuses the old token and deletes the identity via the outbox', async () => {
    const leaving = await creator(ctx);
    const { id, shareToken } = await publishedFromTemplate(ctx, leaving);
    const me = await leaving.get('/me');
    expect((await leaving.del('/me')).status).toBe(204);

    expect((await leaving.get('/me')).status).toBe(401);
    expect((await recipient(ctx, shareToken).meta()).status).toBe(404);
    expect((await ctx.prisma.experience.findUniqueOrThrow({ where: { id } })).status).toBe(
      'DELETED',
    );
    const profile = await ctx.prisma.userProfile.findUniqueOrThrow({ where: { id: me.body.id } });
    expect(profile).toMatchObject({ status: 'DELETED', email: null, displayName: null });

    await ctx.outbox.processDue();
  });
});

describe('moderation', () => {
  it('accepts reports neutrally and lets admins take content down', async () => {
    const admin = await creator(ctx, { admin: true });
    const { id, shareToken } = await publishedFromTemplate(ctx, alice);

    expect((await recipient(ctx, UNKNOWN_TOKEN).report('SCAM_OR_FRAUD')).status).toBe(202);
    const report = await recipient(ctx, shareToken).report('HARASSMENT', 'unwanted messages');
    expect(report.status).toBe(202);

    const reports = await admin.get('/admin/reports');
    const mine = reports.body.items.find((x: { experienceId: string }) => x.experienceId === id);
    expect(mine).toMatchObject({ category: 'HARASSMENT', status: 'OPEN' });

    const content = await admin.get(`/admin/experiences/${id}/content`);
    expect(content.status).toBe(200);
    expect(JSON.stringify(content.body)).not.toContain('pick you up');

    expect(
      (await admin.post(`/admin/experiences/${id}/takedown`, { reason: 'Harassment' })).status,
    ).toBe(204);
    expect((await recipient(ctx, shareToken).meta()).status).toBe(404);
    const detail = await alice.get(`/experiences/${id}`);
    expect(detail.body).toMatchObject({
      moderationState: 'TAKEN_DOWN',
      takedownReason: 'Harassment',
    });
    await alice.post(`/experiences/${id}/disable`);
    const enable = await alice.post(`/experiences/${id}/enable`);
    expect(enable.status).toBe(409);
    expect(enable.body.code).toBe('TAKEN_DOWN');

    const resolved = await admin.get('/admin/reports');
    expect(resolved.body.items.find((x: { id: string }) => x.id === mine.id).status).toBe(
      'ACTIONED',
    );

    expect((await admin.post(`/admin/experiences/${id}/restore`)).status).toBe(204);
    expect((await alice.post(`/experiences/${id}/enable`)).status).toBe(204);
    expect((await recipient(ctx, shareToken).meta()).status).toBe(200);

    const audit = await admin.get('/admin/audit-logs?limit=100');
    const actions = audit.body.items.map((a: { action: string }) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(['experience.taken_down', 'experience.restored', 'report.created']),
    );
    const serialized = JSON.stringify(audit.body);
    expect(serialized).not.toContain(shareToken);
    expect(serialized).not.toContain('pick you up');
    expect(serialized).not.toContain('unwanted messages');
  });
});
