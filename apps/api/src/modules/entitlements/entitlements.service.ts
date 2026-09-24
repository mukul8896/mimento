import { Inject, Injectable } from '@nestjs/common';
import {
  flowSteps,
  hasRouting,
  requiredTier,
  stepTypesOf,
  tierAtLeast,
  type DraftStep,
  type Tier,
} from '@momentpath/contracts';
import { APP_ENV, type AppEnv } from '../../config/env';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { TemplateContentSchema } from '../templates/template-content';

export interface TierState {
  /** What this draft needs before it can be published. */
  required: Tier;
  /** What has been unlocked for it. */
  held: Tier;
  /** False when the creator must upgrade before publishing. */
  satisfied: boolean;
}

@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  /**
   * Works out the tier a draft needs and the tier it holds. With BILLING_ENABLED=false every
   * draft is treated as satisfied, so the product runs end to end before payments exist.
   */
  async tierState(
    experience: { id: string; templateKey: string | null },
    steps: DraftStep[],
    client: PrismaService | Tx = this.prisma,
  ): Promise<TierState> {
    const template = experience.templateKey
      ? await client.template.findFirst({ where: { key: experience.templateKey } })
      : null;
    const templateSteps = template ? TemplateContentSchema.parse(template.content).steps : null;

    const required = requiredTier({
      templateTier: template ? template.tier : null,
      templateStepTypes: templateSteps ? stepTypesOf(templateSteps) : null,
      stepTypes: stepTypesOf(steps),
      hasRouting: hasRouting(flowSteps(steps)),
    });

    const entitlement = await client.entitlement.findUnique({
      where: { experienceId: experience.id },
    });
    const held: Tier = entitlement?.tier ?? 'FREE';
    return {
      required,
      held,
      satisfied: !this.env.BILLING_ENABLED || tierAtLeast(held, required),
    };
  }

  /**
   * Grants or upgrades an entitlement. One row per experience, so a purchase that arrives twice
   * (a replayed webhook in stage 3) is an upsert rather than a second grant.
   */
  async grant(input: {
    experienceId: string;
    tier: Tier;
    source: 'COMPLIMENTARY' | 'PURCHASE';
    note?: string | null;
    providerRef?: string | null;
    grantedById?: string | null;
  }) {
    return this.prisma.entitlement.upsert({
      where: { experienceId: input.experienceId },
      create: {
        experienceId: input.experienceId,
        tier: input.tier,
        source: input.source,
        note: input.note ?? null,
        providerRef: input.providerRef ?? null,
        grantedById: input.grantedById ?? null,
      },
      update: {
        tier: input.tier,
        source: input.source,
        note: input.note ?? null,
        grantedById: input.grantedById ?? null,
      },
    });
  }
}
