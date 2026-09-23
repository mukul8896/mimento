import { Injectable } from '@nestjs/common';
import {
  publishIssues,
  referencedMediaIds,
  ThemeSchema,
  type DraftStep,
  type PublishIssue,
} from '@momentpath/contracts';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { MediaService } from '../media/media.service';

export interface DraftSnapshot {
  id: string;
  experienceId: string;
  title: string;
  theme: unknown;
  steps: DraftStep[];
  /** The template this experience started from; null for a blank, fully custom build. */
  templateKey?: string | null;
}

/**
 * Server-side publish gate: the shared content rules plus checks only the server can make
 * (gift secrets present, media owned by this experience, uploaded, validated and — in
 * production — malware-scanned). Phase 1 flows are linear, so graph validation reduces to
 * ordering rules (single final gift step, last position).
 */
@Injectable()
export class PublishValidatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async issues(
    draft: DraftSnapshot,
    client: PrismaService | Tx = this.prisma,
  ): Promise<PublishIssue[]> {
    const theme = ThemeSchema.safeParse(draft.theme);
    if (!theme.success)
      return [{ stepKey: null, field: 'theme', message: 'The theme is invalid.' }];

    const gifts = await client.gift.findMany({ where: { versionId: draft.id } });
    const issues = publishIssues({
      title: draft.title,
      theme: theme.data,
      steps: draft.steps,
      giftStepKeysWithSecret: new Set(gifts.map((g) => g.stepKey)),
    });

    const refs = new Map<string, string>(); // mediaId -> stepKey
    for (const step of draft.steps)
      for (const id of referencedMediaIds(step)) refs.set(id, step.key);
    for (const gift of gifts) if (gift.mediaId) refs.set(gift.mediaId, gift.stepKey);
    if (refs.size > 0) {
      const assets = await client.mediaAsset.findMany({
        where: { id: { in: [...refs.keys()] }, experienceId: draft.experienceId },
      });
      const byId = new Map(assets.map((a) => [a.id, a]));
      for (const [mediaId, stepKey] of refs) {
        const asset = byId.get(mediaId);
        if (!asset || asset.status !== 'READY') {
          issues.push({ stepKey, field: 'media', message: 'An image has not finished uploading.' });
        } else if (!this.media.isPublishable(asset)) {
          issues.push({
            stepKey,
            field: 'media',
            message: 'An image is waiting for its safety scan.',
          });
        }
      }
    }
    const tier = await this.entitlements.tierState(
      { id: draft.experienceId, templateKey: draft.templateKey ?? null },
      draft.steps,
      client,
    );
    if (!tier.satisfied) {
      issues.push({
        stepKey: null,
        field: 'tier',
        message:
          tier.required === 'PRO'
            ? 'Building your own sequence of steps needs the custom plan.'
            : 'This template needs an upgrade before you can share it.',
      });
    }

    return issues;
  }
}
