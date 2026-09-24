import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { generateToken, isWellFormedToken, safeEqual, sha256 } from '../../common/crypto';
import { APP_ENV, type AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { RetentionService } from '../experiences/retention.service';
import type { Principal } from './principal';

/** The single operator identity behind ADMIN_TOKEN. Not a login; there is no password. */
const OPERATOR_SUBJECT = 'operator';

/** A freshly minted owner identity. The raw token is returned once and never stored. */
export interface MintedOwner {
  ownerToken: string;
  principal: Principal;
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly retention: RetentionService,
  ) {}

  /**
   * Creates an anonymous owner. There is no registration: the returned token *is* the identity,
   * held in the creator's cookie. Losing it loses access, which is why every experience also
   * carries its own manage token.
   */
  async mintOwner(): Promise<MintedOwner> {
    const ownerToken = generateToken();
    const profile = await this.prisma.userProfile.create({
      data: { subject: `anon:${randomUUID()}`, ownerTokenHash: sha256(ownerToken) },
    });
    return {
      ownerToken,
      principal: { userId: profile.id, subject: profile.subject, isAdmin: false },
    };
  }

  /**
   * Resolves an owner token: the one minted with the identity, or a further key minted when the
   * creator signed in on another device. Null for unknown tokens and deactivated profiles.
   */
  async resolveOwner(token: string): Promise<Principal | null> {
    if (!isWellFormedToken(token)) return null;
    const hash = sha256(token);
    const profile =
      (await this.prisma.userProfile.findUnique({ where: { ownerTokenHash: hash } })) ??
      (
        await this.prisma.ownerKey.findUnique({
          where: { tokenHash: hash },
          include: { owner: true },
        })
      )?.owner ??
      null;
    if (!profile || profile.status !== 'ACTIVE') return null;
    await this.retention.touchOwner(profile.id, profile.lastSeenAt);
    return { userId: profile.id, subject: profile.subject, isAdmin: false };
  }

  /** A new owner token for an existing creator on another device (after a passkey or email). */
  async mintOwnerKey(ownerId: string): Promise<string> {
    const token = generateToken();
    await this.prisma.ownerKey.create({ data: { ownerId, tokenHash: sha256(token) } });
    return token;
  }

  /**
   * Moves everything a throwaway identity made into the creator who just signed in, then retires
   * it. Only identities without passkeys are merged — one with its own passkey is someone's real
   * key and is left alone.
   */
  async mergeInto(fromId: string, toId: string, requestId: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const from = await tx.userProfile.findUnique({
        where: { id: fromId },
        select: { status: true, subject: true, _count: { select: { passkeys: true } } },
      });
      if (!from || from.status !== 'ACTIVE' || !from.subject.startsWith('anon:')) return;
      if (from._count.passkeys > 0) return;
      const moved = await tx.experience.updateMany({
        where: { ownerId: fromId },
        data: { ownerId: toId },
      });
      await tx.mediaAsset.updateMany({ where: { ownerId: fromId }, data: { ownerId: toId } });
      await tx.idempotencyRecord.deleteMany({ where: { userId: fromId } });
      await tx.userProfile.update({
        where: { id: fromId },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
          ownerTokenHash: null,
          ownerKeys: { deleteMany: {} },
        },
      });
      await tx.auditLog.create({
        data: {
          actorType: 'USER',
          actorId: toId,
          action: 'owner.merged',
          targetType: 'user',
          targetId: fromId,
          requestId,
          metadata: { experienceCount: moved.count },
        },
      });
    });
  }

  /**
   * Resolves a manage token to a principal scoped to that one experience. Deleted experiences
   * and deactivated owners resolve to null.
   */
  async resolveManageToken(token: string): Promise<Principal | null> {
    if (!isWellFormedToken(token)) return null;
    const experience = await this.prisma.experience.findUnique({
      where: { manageTokenHash: sha256(token) },
      select: {
        id: true,
        status: true,
        owner: { select: { id: true, subject: true, status: true } },
      },
    });
    if (!experience || experience.status === 'DELETED') return null;
    if (experience.owner.status !== 'ACTIVE') return null;
    await this.retention.touchExperience(experience.id);
    return {
      userId: experience.owner.id,
      subject: experience.owner.subject,
      isAdmin: false,
      scopeExperienceId: experience.id,
    };
  }

  /**
   * Resolves the operator credential. Compared in constant time; an unset ADMIN_TOKEN disables
   * the moderation endpoints entirely rather than leaving them open.
   *
   * The operator gets a real profile row so that audit entries keep a valid actor reference —
   * takedowns must stay attributable even though there is no account behind the credential.
   */
  async resolveAdmin(token: string): Promise<Principal | null> {
    const expected = this.env.ADMIN_TOKEN;
    if (!expected || !safeEqual(token, expected)) return null;
    await this.prisma.$executeRaw`
      INSERT INTO "UserProfile" ("id", "subject", "displayName", "updatedAt")
      VALUES (gen_random_uuid(), ${OPERATOR_SUBJECT}, 'Operator', now())
      ON CONFLICT ("subject") DO NOTHING`;
    const profile = await this.prisma.userProfile.findUniqueOrThrow({
      where: { subject: OPERATOR_SUBJECT },
    });
    return { userId: profile.id, subject: profile.subject, isAdmin: true };
  }

  me(principal: Principal) {
    return {
      id: principal.userId,
      email: null,
      displayName: null,
      isAdmin: principal.isAdmin,
    };
  }
}
