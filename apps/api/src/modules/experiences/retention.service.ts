import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { APP_ENV, type AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExperienceLifecycleService } from './experience-lifecycle.service';

const DAY_MS = 24 * 3600 * 1000;
/** Activity is recorded at most this often per owner or surprise, so reads stay cheap. */
const TOUCH_EVERY_MS = 12 * 3600 * 1000;
const BATCH = 50;
/** A surprise opened but never changed, left behind by a closed tab, is removed after a day. */
const UNTOUCHED_MS = 24 * 3600 * 1000;

/**
 * Retention for an app without accounts. Nobody can tell us they have stopped using it, so
 * activity decides: every surprise remembers when its creator or a recipient last used it, and
 * the worker deletes surprises nobody has used for RETENTION_DAYS (and owners who have nothing
 * left and have not been back for as long). An active creator keeps all their surprises alive.
 */
@Injectable()
export class RetentionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Retention');
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: ExperienceLifecycleService,
    private readonly audit: AuditService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  onApplicationBootstrap(): void {
    if (
      this.env.RETENTION_SWEEP_MS > 0 &&
      this.env.RETENTION_DAYS > 0 &&
      this.env.PROCESS_ROLE !== 'api'
    ) {
      this.timer = setInterval(() => void this.tick(), this.env.RETENTION_SWEEP_MS);
      this.timer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Days a surprise is kept without use: shorter for unfinished (never published) ones. */
  private retentionDays(status: string): number {
    const draft = this.env.DRAFT_RETENTION_DAYS;
    return status === 'DRAFT' && draft > 0 ? draft : this.env.RETENTION_DAYS;
  }

  /** The date a surprise will be deleted if nobody uses it before then; null when off. */
  keptUntil(lastActivityAt: Date, status = 'PUBLISHED'): Date | null {
    if (this.env.RETENTION_DAYS <= 0) return null;
    return new Date(lastActivityAt.getTime() + this.retentionDays(status) * DAY_MS);
  }

  /**
   * The creator is back: they, and what they have published, count as active. Unfinished
   * surprises are not kept alive by visits alone — only by being opened or saved themselves
   * (touchExperience), so abandoned ones expire after DRAFT_RETENTION_DAYS.
   */
  async touchOwner(ownerId: string, lastSeenAt: Date, now = new Date()): Promise<void> {
    if (now.getTime() - lastSeenAt.getTime() < TOUCH_EVERY_MS) return;
    const stale = new Date(now.getTime() - TOUCH_EVERY_MS);
    await this.prisma.userProfile.updateMany({
      where: { id: ownerId, lastSeenAt: { lt: stale } },
      data: { lastSeenAt: now },
    });
    await this.prisma.experience.updateMany({
      where: { ownerId, status: { notIn: ['DELETED', 'DRAFT'] }, lastActivityAt: { lt: stale } },
      data: { lastActivityAt: now, retentionWarnedAt: null },
    });
  }

  /** One surprise was used (its manage link, a recipient opening it, or its draft). */
  async touchExperience(experienceId: string, now = new Date()): Promise<void> {
    await this.prisma.experience.updateMany({
      where: {
        id: experienceId,
        status: { not: 'DELETED' },
        lastActivityAt: { lt: new Date(now.getTime() - TOUCH_EVERY_MS) },
      },
      data: { lastActivityAt: now, retentionWarnedAt: null },
    });
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.sweep();
      if (result.experiences || result.owners) this.logger.log(result, 'Retention sweep');
    } catch (err) {
      this.logger.error({ err: { message: (err as Error).message } }, 'Retention sweep failed');
    } finally {
      this.running = false;
    }
  }

  /** Deletes what is past retention. Exposed for tests and operational scripts. */
  async sweep(now = new Date()): Promise<{ experiences: number; owners: number }> {
    if (this.env.RETENTION_DAYS <= 0) return { experiences: 0, owners: 0 };
    const cutoff = new Date(now.getTime() - this.env.RETENTION_DAYS * DAY_MS);
    const draftCutoff = new Date(now.getTime() - this.retentionDays('DRAFT') * DAY_MS);
    const untouchedCutoff = new Date(now.getTime() - UNTOUCHED_MS);
    let experiences = 0;
    for (;;) {
      const stale = await this.prisma.experience.findMany({
        where: {
          owner: { subject: { startsWith: 'anon:' } },
          OR: [
            { status: 'DRAFT', editedAt: null, createdAt: { lt: untouchedCutoff } },
            { status: 'DRAFT', lastActivityAt: { lt: draftCutoff } },
            { status: { notIn: ['DELETED', 'DRAFT'] }, lastActivityAt: { lt: cutoff } },
          ],
        },
        select: { id: true, status: true },
        take: BATCH,
      });
      for (const { id, status } of stale) {
        await this.prisma.$transaction(async (tx) => {
          // Re-check inside the transaction, by the same rules: someone may have just used it.
          const locked =
            status === 'DRAFT'
              ? await tx.$queryRaw<{ id: string }[]>`
                  SELECT "id" FROM "Experience"
                  WHERE "id" = ${id}::uuid AND "status" = 'DRAFT'
                    AND ("lastActivityAt" < ${draftCutoff}
                      OR ("editedAt" IS NULL AND "createdAt" < ${untouchedCutoff}))
                  FOR UPDATE`
              : await tx.$queryRaw<{ id: string }[]>`
                  SELECT "id" FROM "Experience"
                  WHERE "id" = ${id}::uuid AND "status" NOT IN ('DELETED', 'DRAFT')
                    AND "lastActivityAt" < ${cutoff}
                  FOR UPDATE`;
          if (locked.length === 0) return;
          await this.lifecycle.purge(tx, id, {
            actorType: 'SYSTEM',
            actorId: null,
            requestId: null,
          });
          experiences++;
        });
      }
      if (stale.length < BATCH) break;
    }

    // Owners with nothing left who have not been back: the token stops working, the
    // anonymous profile stays as a content-free tombstone for audit references.
    const owners = await this.prisma.userProfile.findMany({
      where: {
        status: 'ACTIVE',
        subject: { startsWith: 'anon:' },
        lastSeenAt: { lt: cutoff },
        experiences: { none: { status: { not: 'DELETED' } } },
      },
      select: { id: true },
      take: 500,
    });
    for (const { id } of owners) {
      await this.prisma.$transaction(async (tx) => {
        await tx.userProfile.update({
          where: { id },
          data: {
            status: 'DELETED',
            deletedAt: now,
            ownerTokenHash: null,
            email: null,
            displayName: null,
            ownerKeys: { deleteMany: {} },
            passkeys: { deleteMany: {} },
          },
        });
        await this.audit.record(
          {
            actorType: 'SYSTEM',
            actorId: null,
            action: 'account.expired',
            targetType: 'user',
            targetId: id,
            requestId: null,
          },
          tx,
        );
      });
    }
    return { experiences, owners: owners.length };
  }
}
