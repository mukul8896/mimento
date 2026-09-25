import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sha256 } from '../src/common/crypto';
import { RetentionService } from '../src/modules/experiences/retention.service';
import {
  createTestContext,
  creator,
  publishedFromTemplate,
  recipient,
  type TestContext,
} from './helpers';

let ctx: TestContext;
let retention: RetentionService;

beforeAll(async () => {
  ctx = await createTestContext();
  retention = ctx.app.get(RetentionService);
});
afterAll(async () => ctx.close());

const DAY = 24 * 3600 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

async function ownerOf(token: string) {
  return ctx.prisma.userProfile.findUniqueOrThrow({ where: { ownerTokenHash: sha256(token) } });
}

describe('activity', () => {
  it('a returning creator keeps themselves and their published surprises active', async () => {
    const alice = await creator(ctx);
    const exp = await publishedFromTemplate(ctx, alice);
    const owner = await ownerOf(alice.token);
    await ctx.prisma.userProfile.update({
      where: { id: owner.id },
      data: { lastSeenAt: daysAgo(200) },
    });
    await ctx.prisma.experience.update({
      where: { id: exp.id },
      data: { lastActivityAt: daysAgo(200), retentionWarnedAt: daysAgo(1) },
    });

    const list = await alice.get('/experiences');
    expect(list.status).toBe(200);
    const after = await ctx.prisma.experience.findUniqueOrThrow({ where: { id: exp.id } });
    expect(after.lastActivityAt.getTime()).toBeGreaterThan(daysAgo(1).getTime());
    expect(after.retentionWarnedAt).toBeNull();
    expect((await ownerOf(alice.token)).lastSeenAt.getTime()).toBeGreaterThan(daysAgo(1).getTime());
    // The manage page says how long it is kept: a year from the last use.
    const keptUntil = new Date(
      list.body.items.find((i: { id: string }) => i.id === exp.id).keptUntil,
    ).getTime();
    expect(Math.abs(keptUntil - (Date.now() + 365 * DAY))).toBeLessThan(DAY);
  });

  it('a recipient opening the surprise keeps it active', async () => {
    const bob = await creator(ctx);
    const { id, shareToken } = await publishedFromTemplate(ctx, bob);
    await ctx.prisma.experience.update({
      where: { id },
      data: { lastActivityAt: daysAgo(300) },
    });
    const r = recipient(ctx, shareToken);
    expect((await r.meta()).status).toBe(200);
    const after = await ctx.prisma.experience.findUniqueOrThrow({ where: { id } });
    expect(after.lastActivityAt.getTime()).toBeGreaterThan(daysAgo(1).getTime());
  });
});

describe('retention sweep', () => {
  it('deletes surprises nobody used for a year, then owners with nothing left', async () => {
    const carol = await creator(ctx);
    const stale = await publishedFromTemplate(ctx, carol);
    const { body: fresh } = await carol.post('/experiences', { templateKey: 'anniversary' });
    const owner = await ownerOf(carol.token);
    await ctx.prisma.experience.update({
      where: { id: stale.id },
      data: { lastActivityAt: daysAgo(366) },
    });

    const first = await retention.sweep();
    expect(first.experiences).toBeGreaterThanOrEqual(1);
    const gone = await ctx.prisma.experience.findUniqueOrThrow({ where: { id: stale.id } });
    expect(gone).toMatchObject({ status: 'DELETED', title: '', accessTokenHash: null });
    // The link stops working at once.
    expect((await recipient(ctx, stale.shareToken).meta()).status).toBe(404);
    const kept = await ctx.prisma.experience.findUniqueOrThrow({ where: { id: fresh.id } });
    expect(kept.status).not.toBe('DELETED');
    expect(
      await ctx.prisma.auditLog.count({
        where: { action: 'experience.deleted', targetId: stale.id, actorType: 'SYSTEM' },
      }),
    ).toBe(1);

    // The owner still has a live surprise, so they stay even though they have not been back.
    await ctx.prisma.userProfile.update({
      where: { id: owner.id },
      data: { lastSeenAt: daysAgo(400) },
    });
    await retention.sweep();
    expect(
      (await ctx.prisma.userProfile.findUniqueOrThrow({ where: { id: owner.id } })).status,
    ).toBe('ACTIVE');

    // Once that one lapses too, the owner goes and their token no longer works.
    await ctx.prisma.experience.update({
      where: { id: fresh.id },
      data: { lastActivityAt: daysAgo(366) },
    });
    const second = await retention.sweep();
    expect(second.owners).toBeGreaterThanOrEqual(1);
    const removed = await ctx.prisma.userProfile.findUniqueOrThrow({ where: { id: owner.id } });
    expect(removed).toMatchObject({ status: 'DELETED', ownerTokenHash: null });
    expect((await carol.get('/experiences')).status).toBe(401);
  });

  it('never touches the operator or surprises used within the year', async () => {
    const dave = await creator(ctx);
    const exp = await publishedFromTemplate(ctx, dave);
    await ctx.prisma.experience.update({
      where: { id: exp.id },
      data: { lastActivityAt: daysAgo(364) },
    });
    await retention.sweep();
    const still = await ctx.prisma.experience.findUniqueOrThrow({ where: { id: exp.id } });
    expect(still.status).not.toBe('DELETED');
    const operator = await ctx.prisma.userProfile.findUnique({ where: { subject: 'operator' } });
    if (operator) expect(operator.status).toBe('ACTIVE');
  });
});

describe('unfinished surprises', () => {
  it('are temporary: deleted after 30 days nobody opened them, and say so', async () => {
    const erin = await creator(ctx);
    const { body: old } = await erin.post('/experiences', { templateKey: 'date-invitation' });
    const { body: recent } = await erin.post('/experiences', { templateKey: 'anniversary' });
    const keptUntil = new Date(old.keptUntil).getTime();
    expect(Math.abs(keptUntil - (Date.now() + 30 * DAY))).toBeLessThan(DAY);

    await ctx.prisma.experience.update({
      where: { id: old.id },
      data: { lastActivityAt: daysAgo(31) },
    });
    await ctx.prisma.experience.update({
      where: { id: recent.id },
      data: { lastActivityAt: daysAgo(29) },
    });
    await retention.sweep();
    expect((await ctx.prisma.experience.findUniqueOrThrow({ where: { id: old.id } })).status).toBe(
      'DELETED',
    );
    expect(
      (await ctx.prisma.experience.findUniqueOrThrow({ where: { id: recent.id } })).status,
    ).toBe('DRAFT');
  });

  it('are kept alive by being opened or saved, not by visiting the site', async () => {
    const fay = await creator(ctx);
    const { body: exp } = await fay.post('/experiences', { templateKey: 'date-invitation' });
    const owner = await ownerOf(fay.token);
    const age = async (days: number) => {
      await ctx.prisma.experience.update({
        where: { id: exp.id },
        data: { lastActivityAt: daysAgo(days) },
      });
      await ctx.prisma.userProfile.update({
        where: { id: owner.id },
        data: { lastSeenAt: daysAgo(days) },
      });
    };

    await age(20);
    await fay.get('/me');
    const visited = await ctx.prisma.experience.findUniqueOrThrow({ where: { id: exp.id } });
    expect(visited.lastActivityAt.getTime()).toBeLessThan(daysAgo(19).getTime());

    await fay.get(`/experiences/${exp.id}/draft`);
    const opened = await ctx.prisma.experience.findUniqueOrThrow({ where: { id: exp.id } });
    expect(opened.lastActivityAt.getTime()).toBeGreaterThan(daysAgo(1).getTime());
  });

  it('a published surprise keeps the year even if its draft was old', async () => {
    const gus = await creator(ctx);
    const { id } = await publishedFromTemplate(ctx, gus);
    await ctx.prisma.experience.update({ where: { id }, data: { lastActivityAt: daysAgo(40) } });
    await retention.sweep();
    expect((await ctx.prisma.experience.findUniqueOrThrow({ where: { id } })).status).toBe(
      'PUBLISHED',
    );
  });
});
