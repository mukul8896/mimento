import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { Principal } from '../identity/principal';
import { OutboxService } from '../outbox/outbox.service';
import { ExperienceLifecycleService } from './experience-lifecycle.service';

@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: ExperienceLifecycleService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Deletes all creator data, anonymises the profile (the opaque subject is kept so tokens
   * that are still valid are refused rather than re-provisioning an account), and
   * queues deletion of the identity at the provider (retried by the outbox until it succeeds).
   */
  async deleteAccount(principal: Principal, requestId: string | null): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const experiences = await tx.experience.findMany({
          where: { ownerId: principal.userId, status: { not: 'DELETED' } },
          select: { id: true },
        });
        for (const exp of experiences) {
          await this.lifecycle.purge(tx, exp.id, {
            actorType: 'USER',
            actorId: principal.userId,
            requestId,
          });
        }
        await tx.idempotencyRecord.deleteMany({ where: { userId: principal.userId } });
        await tx.userProfile.update({
          where: { id: principal.userId },
          data: {
            status: 'DELETED',
            deletedAt: new Date(),
            email: null,
            displayName: null,
            ownerKeys: { deleteMany: {} },
            passkeys: { deleteMany: {} },
          },
        });
        await this.audit.record(
          {
            actorType: 'USER',
            actorId: principal.userId,
            action: 'account.deleted',
            targetType: 'user',
            targetId: principal.userId,
            requestId,
            metadata: { experienceCount: experiences.length },
          },
          tx,
        );
      },
      { timeout: 30_000 },
    );
  }
}
