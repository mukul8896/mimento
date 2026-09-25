import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { generateToken, KEYRING, sha256, type Keyring } from '../../common/crypto';
import { requireOwnedExperience } from '../../common/ownership';
import { Problem } from '../../common/problem';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { transition } from '../experiences/lifecycle';
import { stepRow, toDraftSteps } from '../experiences/step-mapping';
import { GiftsService } from '../gifts/gifts.service';
import type { Principal } from '../identity/principal';
import { OutboxService } from '../outbox/outbox.service';
import { PublishValidatorService } from '../workflow/publish-validator.service';

@Injectable()
export class PublishingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: PublishValidatorService,
    private readonly gifts: GiftsService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    @Inject(KEYRING) private readonly keyring: Keyring,
  ) {}

  private async loadDraft(client: PrismaService | Tx, experienceId: string) {
    const draft = await client.experienceVersion.findFirst({
      where: { experienceId, state: 'DRAFT' },
      include: { steps: true },
    });
    if (!draft) throw Problem.notFound('Draft');
    return { ...draft, parsedSteps: toDraftSteps(draft.steps) };
  }

  async check(principal: Principal, experienceId: string) {
    const exp = await requireOwnedExperience(this.prisma, principal, experienceId);
    const draft = await this.loadDraft(this.prisma, experienceId);
    const issues = await this.validator.issues({
      ...draft,
      steps: draft.parsedSteps,
      templateKey: exp.templateKey,
      mode: exp.mode,
    });
    return { ok: issues.length === 0, issues };
  }

  /**
   * Validates the draft on the server, clones it into a new immutable version and atomically
   * switches the active version. The experience row is locked so concurrent publishes serialise.
   */
  async publish(principal: Principal, experienceId: string, requestId: string | null) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "Experience" WHERE "id" = ${experienceId}::uuid FOR UPDATE`;
        const exp = await requireOwnedExperience(tx, principal, experienceId);
        const now = new Date();
        const allowed = transition(exp, 'publish', now);
        if (!allowed.ok) throw Problem.conflict(allowed.code, allowed.message);

        const draft = await this.loadDraft(tx, exp.id);
        const issues = await this.validator.issues(
          { ...draft, steps: draft.parsedSteps, templateKey: exp.templateKey, mode: exp.mode },
          tx,
        );
        if (issues.length > 0) {
          throw Problem.unprocessable(
            'PUBLISH_VALIDATION_FAILED',
            'Fix these problems before publishing',
            issues,
          );
        }

        const latest = await tx.experienceVersion.aggregate({
          where: { experienceId: exp.id, state: 'PUBLISHED' },
          _max: { number: true },
        });
        const number = (latest._max.number ?? 0) + 1;
        const version = await tx.experienceVersion.create({
          data: {
            experienceId: exp.id,
            number,
            state: 'PUBLISHED',
            title: draft.title,
            theme: draft.theme as Prisma.InputJsonValue,
            responseVisibility: draft.responseVisibility,
            publishedAt: now,
          },
        });
        await tx.step.createMany({
          data: draft.parsedSteps.map((s, position) => ({
            versionId: version.id,
            ...stepRow(s, position),
          })),
        });
        const oneTime = new Map(
          draft.parsedSteps.flatMap((s) =>
            s.type === 'GIFT_REVEAL' ? [[s.key, s.config.oneTimeReveal] as const] : [],
          ),
        );
        await this.gifts.cloneForPublish(tx, draft.id, version.id, oneTime);

        const token = exp.accessTokenHash ? null : generateToken();
        await tx.experience.update({
          where: { id: exp.id },
          data: {
            status: 'PUBLISHED',
            activeVersionId: version.id,
            publishedAt: now,
            title: draft.title,
            ...(token
              ? {
                  accessTokenHash: sha256(token),
                  accessTokenEnc: this.keyring.encrypt(token, 'share-token', `share:${exp.id}`),
                }
              : {}),
          },
        });
        await this.outbox.enqueue(tx, 'experience.published', {
          experienceId: exp.id,
          versionNumber: number,
        });
        await this.audit.record(
          {
            actorType: 'USER',
            actorId: principal.userId,
            action: 'experience.published',
            targetType: 'experience',
            targetId: exp.id,
            requestId,
            metadata: { versionNumber: number, stepCount: draft.parsedSteps.length },
          },
          tx,
        );
        return { versionNumber: number, publishedAt: now.toISOString() };
      },
      { timeout: 20_000 },
    );
  }

  /** Owner-only: the raw share token, decrypted on demand; never stored in plain text. */
  async shareLink(principal: Principal, experienceId: string) {
    const exp = await requireOwnedExperience(this.prisma, principal, experienceId);
    if (!exp.accessTokenEnc)
      throw Problem.conflict('NOT_PUBLISHED', 'Publish the experience to get a link');
    return {
      shareToken: this.keyring.decrypt(exp.accessTokenEnc, 'share-token', `share:${exp.id}`),
    };
  }

  /** Issues a new private link; the previous link and its recipient sessions stop working. */
  async rotateShareLink(principal: Principal, experienceId: string, requestId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const exp = await requireOwnedExperience(tx, principal, experienceId);
      if (!exp.accessTokenEnc)
        throw Problem.conflict('NOT_PUBLISHED', 'Publish the experience to get a link');
      const token = generateToken();
      await tx.experience.update({
        where: { id: exp.id },
        data: {
          accessTokenHash: sha256(token),
          accessTokenEnc: this.keyring.encrypt(token, 'share-token', `share:${exp.id}`),
        },
      });
      await tx.recipientSession.updateMany({
        where: { experienceId: exp.id },
        data: { expiresAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: principal.userId,
          action: 'experience.share_link_rotated',
          targetType: 'experience',
          targetId: exp.id,
          requestId,
        },
        tx,
      );
      return { shareToken: token };
    });
  }
}
