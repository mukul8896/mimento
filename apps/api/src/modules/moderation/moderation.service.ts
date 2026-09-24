import { Injectable } from '@nestjs/common';
import { referencedMediaIds, ThemeSchema, themeMediaIds, type Tier } from '@momentpath/contracts';
import { decodeCursor, page } from '../../common/pagination';
import { Problem } from '../../common/problem';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { effectiveStatus } from '../experiences/lifecycle';
import { toDraftSteps } from '../experiences/step-mapping';
import type { Principal } from '../identity/principal';
import { MediaService } from '../media/media.service';
import { publicStep } from '../recipient-sessions/progress';

type ListQuery = { cursor?: string; limit: number };

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** Operator-granted upgrade. Audited, because it is giving away something that has a price. */
  async grantEntitlement(
    principal: Principal,
    experienceId: string,
    input: { tier: Tier; note?: string },
    requestId: string | null,
  ): Promise<void> {
    const experience = await this.prisma.experience.findFirst({
      where: { id: experienceId, status: { not: 'DELETED' } },
    });
    if (!experience) throw Problem.notFound('Experience');

    await this.entitlements.grant({
      experienceId,
      tier: input.tier,
      source: 'COMPLIMENTARY',
      note: input.note ?? null,
      grantedById: principal.userId,
    });
    await this.audit.record({
      actorType: 'ADMIN',
      actorId: principal.userId,
      action: 'entitlement.granted',
      targetType: 'experience',
      targetId: experienceId,
      requestId,
      metadata: { tier: input.tier },
    });
  }

  async reports(query: ListQuery) {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.abuseReport.findMany({
      where: cursor
        ? {
            OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }],
          }
        : undefined,
      include: { experience: { select: { title: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const { items, nextCursor } = page(rows, query.limit, (r) => ({ at: r.createdAt, id: r.id }));
    return {
      items: items.map((r) => ({
        id: r.id,
        experienceId: r.experienceId,
        experienceTitle: r.experience?.title || null,
        category: r.category,
        details: r.details,
        status: r.status,
        resolutionNote: r.resolutionNote,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      })),
      nextCursor,
    };
  }

  async resolveReport(
    admin: Principal,
    id: string,
    resolution: 'ACTIONED' | 'DISMISSED',
    note: string,
    requestId: string | null,
  ) {
    const report = await this.prisma.abuseReport.findUnique({ where: { id } });
    if (!report) throw Problem.notFound('Report');
    await this.prisma.$transaction(async (tx) => {
      await tx.abuseReport.update({
        where: { id },
        data: {
          status: resolution,
          resolutionNote: note || null,
          resolvedAt: new Date(),
          resolvedById: admin.userId,
        },
      });
      await this.audit.record(
        {
          actorType: 'ADMIN',
          actorId: admin.userId,
          action: 'report.resolved',
          targetType: 'report',
          targetId: id,
          requestId,
          metadata: { resolution },
        },
        tx,
      );
    });
  }

  async experiences(query: ListQuery) {
    const cursor = decodeCursor(query.cursor);
    const filters: Prisma.ExperienceWhereInput[] = [{ status: { not: 'DELETED' } }];
    if (cursor)
      filters.push({
        OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }],
      });
    const rows = await this.prisma.experience.findMany({
      where: { AND: filters },
      include: { _count: { select: { reports: { where: { status: 'OPEN' } } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const { items, nextCursor } = page(rows, query.limit, (r) => ({ at: r.createdAt, id: r.id }));
    const now = new Date();
    return {
      items: items.map((e) => ({
        id: e.id,
        title: e.title,
        ownerId: e.ownerId,
        status: effectiveStatus(e, now),
        moderationState: e.moderationState,
        openReports: e._count.reports,
        createdAt: e.createdAt.toISOString(),
        publishedAt: e.publishedAt?.toISOString() ?? null,
      })),
      nextCursor,
    };
  }

  /** Published content for review. Gift secrets are never included. Access is audited. */
  async content(admin: Principal, id: string, requestId: string | null) {
    const exp = await this.prisma.experience.findUnique({ where: { id } });
    if (!exp || exp.status === 'DELETED' || !exp.activeVersionId)
      throw Problem.notFound('Published experience');
    const version = await this.prisma.experienceVersion.findUniqueOrThrow({
      where: { id: exp.activeVersionId },
      include: { steps: true },
    });
    const steps = toDraftSteps(version.steps);
    await this.audit.record({
      actorType: 'ADMIN',
      actorId: admin.userId,
      action: 'experience.content_reviewed',
      targetType: 'experience',
      targetId: id,
      requestId,
    });
    const theme = ThemeSchema.parse(version.theme);
    return {
      title: version.title,
      theme,
      versionNumber: version.number,
      responsesVisibleToCreator: version.responseVisibility === 'FULL',
      steps: steps.map(publicStep),
      media: await this.media.publicMedia(
        [...steps.flatMap(referencedMediaIds), ...themeMediaIds(theme)],
        exp.id,
        15 * 60,
      ),
    };
  }

  async setModeration(
    admin: Principal,
    id: string,
    takenDown: boolean,
    reason: string | null,
    requestId: string | null,
  ) {
    const exp = await this.prisma.experience.findUnique({ where: { id } });
    if (!exp || exp.status === 'DELETED') throw Problem.notFound('Experience');
    await this.prisma.$transaction(async (tx) => {
      await tx.experience.update({
        where: { id },
        data: {
          moderationState: takenDown ? 'TAKEN_DOWN' : 'ACTIVE',
          takedownReason: takenDown ? reason : null,
        },
      });
      if (takenDown) {
        await tx.abuseReport.updateMany({
          where: { experienceId: id, status: 'OPEN' },
          data: {
            status: 'ACTIONED',
            resolvedAt: new Date(),
            resolvedById: admin.userId,
            resolutionNote: 'Experience taken down',
          },
        });
      }
      await this.audit.record(
        {
          actorType: 'ADMIN',
          actorId: admin.userId,
          action: takenDown ? 'experience.taken_down' : 'experience.restored',
          targetType: 'experience',
          targetId: id,
          requestId,
        },
        tx,
      );
    });
  }

  async auditLogs(query: ListQuery) {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.auditLog.findMany({
      where: cursor
        ? {
            OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }],
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const { items, nextCursor } = page(rows, query.limit, (r) => ({ at: r.createdAt, id: r.id }));
    return {
      items: items.map((r) => ({
        id: r.id,
        actorType: r.actorType,
        actorId: r.actorId,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        metadata: (r.metadata ?? {}) as Record<string, string | number | boolean | null>,
        requestId: r.requestId,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }
}
