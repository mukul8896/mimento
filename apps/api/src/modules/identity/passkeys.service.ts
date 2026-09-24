import { Inject, Injectable } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { createHash } from 'node:crypto';
import { Problem } from '../../common/problem';
import { APP_ENV, type AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IdentityService } from './identity.service';
import type { Principal } from './principal';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_PASSKEYS = 10;

/**
 * Passkeys as an optional way back in. There is still no account: a passkey is bound to the
 * anonymous owner, and signing in with it mints a new owner key for that device. The private key
 * never leaves the creator's device (or their password manager, which is how it syncs).
 */
@Injectable()
export class PasskeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly audit: AuditService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  private get rp() {
    const origin = new URL(this.env.WEB_ORIGIN);
    return { id: origin.hostname, origin: origin.origin, name: 'Wish Revealer' };
  }

  /** Adding a passkey needs the creator's own key, not a single surprise's manage link. */
  private requireOwner(principal: Principal): void {
    if (principal.isAdmin || principal.scopeExperienceId)
      throw Problem.forbidden('Open this from the browser you made your surprises in.');
  }

  private async issue(challenge: string, ownerId: string | null): Promise<string> {
    const row = await this.prisma.webAuthnChallenge.create({
      data: { challenge, ownerId, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
    });
    return row.id;
  }

  /**
   * One-time: whoever deletes the row gets to use it, so a replayed response fails even when two
   * arrive at once. Expired challenges are refused.
   */
  private async takeChallenge(id: string, ownerId: string | null): Promise<string> {
    const row = await this.prisma.webAuthnChallenge.findUnique({ where: { id } });
    const taken = row
      ? await this.prisma.webAuthnChallenge.deleteMany({
          where: { id, ownerId, expiresAt: { gt: new Date() } },
        })
      : { count: 0 };
    if (!row || taken.count !== 1) throw Problem.badRequest('PASSKEY_EXPIRED', 'Please try again.');
    return row.challenge;
  }

  async list(principal: Principal) {
    this.requireOwner(principal);
    const rows = await this.prisma.passkey.findMany({
      where: { ownerId: principal.userId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      items: rows.map((p) => ({
        id: p.id,
        name: p.name,
        backedUp: p.backedUp,
        createdAt: p.createdAt.toISOString(),
        lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
      })),
    };
  }

  async registrationOptions(principal: Principal) {
    this.requireOwner(principal);
    const existing = await this.prisma.passkey.findMany({
      where: { ownerId: principal.userId },
      select: { credentialId: true, transports: true },
    });
    if (existing.length >= MAX_PASSKEYS)
      throw Problem.conflict('TOO_MANY_PASSKEYS', 'Remove a passkey before adding another.');
    const options = await generateRegistrationOptions({
      rpName: this.rp.name,
      rpID: this.rp.id,
      // Stable per creator, so all their passkeys belong to the same "account" in a password
      // manager. Derived, not the raw id, and says nothing about the person.
      userID: new Uint8Array(createHash('sha256').update(`wr-owner:${principal.userId}`).digest()),
      userName: 'My Wish Revealer surprises',
      userDisplayName: 'Wish Revealer',
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({
        id: p.credentialId,
        transports: p.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
    const challengeId = await this.issue(options.challenge, principal.userId);
    return { challengeId, options: { ...options } };
  }

  async register(
    principal: Principal,
    body: { challengeId: string; response: Record<string, unknown>; name?: string },
    requestId: string | null,
  ) {
    this.requireOwner(principal);
    const expectedChallenge = await this.takeChallenge(body.challengeId, principal.userId);
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.response as unknown as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: this.rp.origin,
        expectedRPID: this.rp.id,
        requireUserVerification: false,
      });
    } catch {
      throw Problem.badRequest('PASSKEY_INVALID', 'That passkey could not be saved.');
    }
    if (!verification.verified)
      throw Problem.badRequest('PASSKEY_INVALID', 'That passkey could not be saved.');
    const info = verification.registrationInfo;
    const clash = await this.prisma.passkey.findUnique({
      where: { credentialId: info.credential.id },
    });
    if (clash) throw Problem.conflict('PASSKEY_EXISTS', 'This passkey is already saved.');
    const created = await this.prisma.passkey.create({
      data: {
        ownerId: principal.userId,
        credentialId: info.credential.id,
        publicKey: Buffer.from(info.credential.publicKey),
        counter: BigInt(info.credential.counter),
        transports: info.credential.transports ?? [],
        backedUp: info.credentialBackedUp,
        name:
          body.name?.trim() ||
          `Passkey added ${new Date().toISOString().slice(0, 10)}`.slice(0, 60),
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: principal.userId,
      action: 'passkey.added',
      targetType: 'user',
      targetId: principal.userId,
      requestId,
    });
    return {
      id: created.id,
      name: created.name,
      backedUp: created.backedUp,
      createdAt: created.createdAt.toISOString(),
      lastUsedAt: null,
    };
  }

  async remove(principal: Principal, id: string, requestId: string | null): Promise<void> {
    this.requireOwner(principal);
    const deleted = await this.prisma.passkey.deleteMany({
      where: { id, ownerId: principal.userId },
    });
    if (deleted.count === 0) throw Problem.notFound('Passkey');
    await this.audit.record({
      actorType: 'USER',
      actorId: principal.userId,
      action: 'passkey.removed',
      targetType: 'user',
      targetId: principal.userId,
      requestId,
    });
  }

  /** Sign-in: discoverable credentials, so the browser offers whichever passkey it has. */
  async loginOptions() {
    const options = await generateAuthenticationOptions({
      rpID: this.rp.id,
      userVerification: 'preferred',
    });
    const challengeId = await this.issue(options.challenge, null);
    return { challengeId, options: { ...options } };
  }

  /**
   * Verifies the passkey and returns a new owner key for this device. When the browser already
   * holds a different, throwaway identity (the proxy mints one on the first visit), whatever it
   * made moves over, so nothing started before signing in is lost.
   */
  async login(
    body: { challengeId: string; response: Record<string, unknown> },
    currentOwnerToken: string | undefined,
    requestId: string | null,
  ): Promise<{ ownerToken: string }> {
    const expectedChallenge = await this.takeChallenge(body.challengeId, null);
    const response = body.response as unknown as AuthenticationResponseJSON;
    const passkey = await this.prisma.passkey.findUnique({
      where: { credentialId: String(response.id) },
      include: { owner: { select: { status: true } } },
    });
    const refused = () => new Problem(401, 'PASSKEY_UNKNOWN', 'That passkey is not recognised.');
    if (!passkey || passkey.owner.status !== 'ACTIVE') throw refused();
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.rp.origin,
        expectedRPID: this.rp.id,
        requireUserVerification: false,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: Number(passkey.counter),
          transports: passkey.transports as AuthenticatorTransport[],
        },
      });
    } catch {
      throw refused();
    }
    if (!verification.verified) throw refused();
    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        backedUp: verification.authenticationInfo.credentialBackedUp,
        lastUsedAt: new Date(),
      },
    });

    if (currentOwnerToken) {
      const current = await this.identity.resolveOwner(currentOwnerToken);
      if (current && current.userId !== passkey.ownerId)
        await this.identity.mergeInto(current.userId, passkey.ownerId, requestId);
    }
    const ownerToken = await this.identity.mintOwnerKey(passkey.ownerId);
    await this.audit.record({
      actorType: 'USER',
      actorId: passkey.ownerId,
      action: 'owner.signed_in',
      targetType: 'user',
      targetId: passkey.ownerId,
      requestId,
      metadata: { method: 'passkey' },
    });
    return { ownerToken };
  }
}
