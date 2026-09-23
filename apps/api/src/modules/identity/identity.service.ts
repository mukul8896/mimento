import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { generateToken, isWellFormedToken, safeEqual, sha256 } from '../../common/crypto';
import { APP_ENV, type AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
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

  /** Resolves an owner token. Returns null for unknown tokens and deactivated profiles. */
  async resolveOwner(token: string): Promise<Principal | null> {
    if (!isWellFormedToken(token)) return null;
    const profile = await this.prisma.userProfile.findUnique({
      where: { ownerTokenHash: sha256(token) },
    });
    if (!profile || profile.status !== 'ACTIVE') return null;
    return { userId: profile.id, subject: profile.subject, isAdmin: false };
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
