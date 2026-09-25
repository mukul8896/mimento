import { Inject, Injectable } from '@nestjs/common';
import {
  GiftSecretSchema,
  StepConfigSchemas,
  type GiftSecret,
  type RevealedGift,
} from '@momentpath/contracts';
import { KEYRING, type Keyring } from '../../common/crypto';
import { requireOwnedExperience } from '../../common/ownership';
import { Problem } from '../../common/problem';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import type { Gift } from '../../generated/prisma/client';
import type { Principal } from '../identity/principal';
import { MediaService, RECIPIENT_MEDIA_URL_TTL_SECONDS } from '../media/media.service';

const aad = (versionId: string, stepKey: string) => `gift:${versionId}:${stepKey}`;

@Injectable()
export class GiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    @Inject(KEYRING) private readonly keyring: Keyring,
  ) {}

  private encrypt(secret: GiftSecret, versionId: string, stepKey: string): string {
    return this.keyring.encrypt(JSON.stringify(secret), 'gift-secret', aad(versionId, stepKey));
  }

  decrypt(gift: Pick<Gift, 'payloadEnc' | 'versionId' | 'stepKey'>): GiftSecret {
    const plaintext = this.keyring.decrypt(
      gift.payloadEnc,
      'gift-secret',
      aad(gift.versionId, gift.stepKey),
    );
    return GiftSecretSchema.parse(JSON.parse(plaintext));
  }

  private async draftGiftStep(principal: Principal, experienceId: string, stepKey: string) {
    await requireOwnedExperience(this.prisma, principal, experienceId);
    const draft = await this.prisma.experienceVersion.findFirst({
      where: { experienceId, state: 'DRAFT' },
      include: { steps: { where: { key: stepKey } } },
    });
    const step = draft?.steps[0];
    if (!draft || !step || step.type !== 'GIFT_REVEAL') throw Problem.notFound('Gift step');
    return { draft, config: StepConfigSchemas.GIFT_REVEAL.parse(step.config) };
  }

  /** Owner-only read of a draft gift secret for editing. Never used by list endpoints. */
  async getDraftSecret(principal: Principal, experienceId: string, stepKey: string) {
    const { draft } = await this.draftGiftStep(principal, experienceId, stepKey);
    const gift = await this.prisma.gift.findUnique({
      where: { versionId_stepKey: { versionId: draft.id, stepKey } },
    });
    return { secret: gift ? this.decrypt(gift) : null };
  }

  async setDraftSecret(
    principal: Principal,
    experienceId: string,
    stepKey: string,
    secret: GiftSecret,
    /** False for a template's starter gift, which is not the creator changing anything. */
    options: { byCreator?: boolean } = {},
  ) {
    const { draft, config } = await this.draftGiftStep(principal, experienceId, stepKey);
    if (secret.kind !== config.kind) {
      throw Problem.badRequest(
        'GIFT_KIND_MISMATCH',
        'The surprise details do not match the chosen gift type',
      );
    }
    let mediaId: string | null = null;
    if (secret.kind === 'QR_IMAGE') {
      const asset = await this.prisma.mediaAsset.findFirst({
        where: { id: secret.mediaId, experienceId, ownerId: principal.userId, status: 'READY' },
      });
      if (!asset) throw Problem.badRequest('INVALID_MEDIA', 'Upload the QR image first');
      mediaId = asset.id;
    }
    const payloadEnc = this.encrypt(secret, draft.id, stepKey);
    await this.prisma.gift.upsert({
      where: { versionId_stepKey: { versionId: draft.id, stepKey } },
      create: {
        versionId: draft.id,
        stepKey,
        kind: secret.kind,
        payloadEnc,
        mediaId,
        oneTimeReveal: config.oneTimeReveal,
      },
      update: { kind: secret.kind, payloadEnc, mediaId, oneTimeReveal: config.oneTimeReveal },
    });
    if (options.byCreator !== false) {
      await this.prisma.experience.updateMany({
        where: { id: experienceId, editedAt: null },
        data: { editedAt: new Date() },
      });
    }
    return { secret };
  }

  /** Drops draft secrets whose gift step was removed or whose gift type changed. */
  async pruneDraftGifts(
    tx: Tx,
    draftVersionId: string,
    giftKinds: Map<string, string>,
  ): Promise<void> {
    const gifts = await tx.gift.findMany({ where: { versionId: draftVersionId } });
    const stale = gifts.filter((g) => giftKinds.get(g.stepKey) !== g.kind).map((g) => g.id);
    if (stale.length > 0) await tx.gift.deleteMany({ where: { id: { in: stale } } });
  }

  /** Re-encrypts draft gifts for a new immutable published version (AAD is version-bound). */
  async cloneForPublish(
    tx: Tx,
    draftVersionId: string,
    publishedVersionId: string,
    oneTimeByStepKey: Map<string, boolean>,
  ): Promise<void> {
    const gifts = await tx.gift.findMany({ where: { versionId: draftVersionId } });
    for (const gift of gifts) {
      if (!oneTimeByStepKey.has(gift.stepKey)) continue;
      const secret = this.decrypt(gift);
      await tx.gift.create({
        data: {
          versionId: publishedVersionId,
          stepKey: gift.stepKey,
          kind: gift.kind,
          payloadEnc: this.encrypt(secret, publishedVersionId, gift.stepKey),
          mediaId: gift.mediaId,
          oneTimeReveal: oneTimeByStepKey.get(gift.stepKey) ?? false,
        },
      });
    }
  }

  /**
   * Restoring a published version into the draft: the draft's secrets become that version's,
   * re-encrypted for the draft (AAD is version-bound, so ciphertext is never copied as-is).
   */
  async restoreIntoDraft(tx: Tx, fromVersionId: string, draftVersionId: string): Promise<void> {
    await tx.gift.deleteMany({ where: { versionId: draftVersionId } });
    const gifts = await tx.gift.findMany({ where: { versionId: fromVersionId } });
    for (const gift of gifts) {
      const secret = this.decrypt(gift);
      await tx.gift.create({
        data: {
          versionId: draftVersionId,
          stepKey: gift.stepKey,
          kind: gift.kind,
          payloadEnc: this.encrypt(secret, draftVersionId, gift.stepKey),
          mediaId: gift.mediaId,
          oneTimeReveal: gift.oneTimeReveal,
        },
      });
    }
  }

  /** Converts a stored secret into what the recipient sees; QR media becomes a short-lived URL. */
  async toRevealed(secret: GiftSecret, experienceId: string): Promise<RevealedGift> {
    switch (secret.kind) {
      case 'QR_IMAGE': {
        const [media] = await this.media.publicMedia(
          [secret.mediaId],
          experienceId,
          RECIPIENT_MEDIA_URL_TTL_SECONDS,
        );
        if (!media) throw Problem.unavailable();
        return { kind: 'QR_IMAGE', imageUrl: media.url, instructions: secret.instructions };
      }
      case 'VOUCHER_CODE':
        return {
          kind: 'VOUCHER_CODE',
          code: secret.code,
          pin: secret.pin,
          redeemUrl: secret.redeemUrl,
          instructions: secret.instructions,
        };
      case 'URL':
        return { kind: 'URL', url: secret.url, instructions: secret.instructions };
      case 'INSTRUCTION':
        return { kind: 'INSTRUCTION', instructions: secret.instructions };
      case 'PHYSICAL_MESSAGE':
        return { kind: 'PHYSICAL_MESSAGE', message: secret.message };
    }
  }
}
