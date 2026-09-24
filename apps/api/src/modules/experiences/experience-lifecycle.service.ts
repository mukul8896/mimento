import { Injectable } from '@nestjs/common';
import { requireOwnedExperience } from '../../common/ownership';
import { Problem } from '../../common/problem';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import type { ActorType } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import type { Principal } from '../identity/principal';
import { OutboxService } from '../outbox/outbox.service';
import { transition, type LifecycleAction } from './lifecycle';

@Injectable()
export class ExperienceLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  private async apply(
    principal: Principal,
    experienceId: string,
    action: Exclude<LifecycleAction, 'publish' | 'delete'>,
    requestId: string | null,
    newExpiry?: Date | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "Experience" WHERE "id" = ${experienceId}::uuid FOR UPDATE`;
      const exp = await requireOwnedExperience(tx, principal, experienceId);
      const now = new Date();
      const result = transition(exp, action, now, newExpiry);
      if (!result.ok) throw Problem.conflict(result.code, result.message);
      await tx.experience.update({
        where: { id: exp.id },
        data: {
          status: result.status,
          ...(action === 'disable' ? { disabledAt: now } : {}),
          ...(action === 'enable' ? { disabledAt: null } : {}),
          ...(action === 'expire' ? { expiresAt: now } : {}),
          ...(action === 'setExpiry' ? { expiresAt: newExpiry ?? null } : {}),
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: principal.userId,
          action: `experience.${action}`,
          targetType: 'experience',
          targetId: exp.id,
          requestId,
          metadata: action === 'setExpiry' ? { expiresAt: newExpiry?.toISOString() ?? null } : {},
        },
        tx,
      );
    });
  }

  disable(p: Principal, id: string, requestId: string | null) {
    return this.apply(p, id, 'disable', requestId);
  }
  enable(p: Principal, id: string, requestId: string | null) {
    return this.apply(p, id, 'enable', requestId);
  }
  expire(p: Principal, id: string, requestId: string | null) {
    return this.apply(p, id, 'expire', requestId);
  }
  setExpiry(p: Principal, id: string, expiresAt: Date | null, requestId: string | null) {
    return this.apply(p, id, 'setExpiry', requestId, expiresAt);
  }

  async delete(
    principal: Principal,
    experienceId: string,
    requestId: string | null,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const exp = await tx.experience.findFirst({
        where: { id: experienceId, ownerId: principal.userId },
      });
      // Deleting twice is a no-op success (idempotent destructive operation).
      if (!exp || exp.status === 'DELETED') {
        if (!exp) throw Problem.notFound('Experience');
        return;
      }
      await this.purge(tx, exp.id, { actorType: 'USER', actorId: principal.userId, requestId });
    });
  }

  /**
   * Permanent deletion. Public access is denied immediately (token hash removed, status
   * DELETED) and every version, step, gift, session, response and media row is deleted in the
   * same transaction. Stored objects are removed by the outbox worker. A content-free
   * tombstone row remains so audit entries and abuse reports keep a valid reference.
   */
  async purge(
    tx: Tx,
    experienceId: string,
    actor: { actorType: ActorType; actorId: string | null; requestId: string | null },
  ): Promise<void> {
    const media = await tx.mediaAsset.findMany({
      where: { experienceId },
      select: { storageKey: true, displayKey: true, thumbKey: true },
    });
    await tx.experience.update({
      where: { id: experienceId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        title: '',
        accessTokenHash: null,
        accessTokenEnc: null,
        activeVersionId: null,
        templateKey: null,
        takedownReason: null,
      },
    });
    await tx.recipientSession.deleteMany({ where: { experienceId } });
    await tx.experienceVersion.deleteMany({ where: { experienceId } });
    await tx.mediaAsset.deleteMany({ where: { experienceId } });
    if (media.length > 0) {
      const keys = media.flatMap((m) =>
        [m.storageKey, m.displayKey, m.thumbKey].filter((k): k is string => !!k),
      );
      await this.outbox.enqueue(tx, 'storage.delete', { keys });
    }
    await this.outbox.enqueue(tx, 'experience.deleted', { experienceId });
    await this.audit.record(
      {
        ...actor,
        action: 'experience.deleted',
        targetType: 'experience',
        targetId: experienceId,
        metadata: { mediaCount: media.length },
      },
      tx,
    );
  }
}
