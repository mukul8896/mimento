import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_THEME,
  referencedMediaIds,
  ThemeSchema,
  themeMediaIds,
  type DraftStep,
  type ExperienceSummary,
  fieldIssues,
  materializeTemplate,
  type TemplateFieldValues,
  type UpdateAccessRequest,
  type UpdateDraftRequest,
} from '@momentpath/contracts';
import { RetentionService } from './retention.service';
import { generateToken, KEYRING, sha256, type Keyring } from '../../common/crypto';
import { hashPin } from '../../common/pin';
import { requireOwnedExperience } from '../../common/ownership';
import { decodeCursor, page } from '../../common/pagination';
import { Problem } from '../../common/problem';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { Prisma, type Experience } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { GiftsService } from '../gifts/gifts.service';
import type { Principal } from '../identity/principal';
import { MediaService } from '../media/media.service';
import { TemplatesService } from '../templates/templates.service';
import { effectiveStatus } from './lifecycle';
import { stepRow, toDraftSteps } from './step-mapping';

type ListFilter = 'DRAFT' | 'PUBLISHED' | 'INACTIVE' | undefined;

export function accessOf(exp: Pick<Experience, 'opensAt' | 'pinHash' | 'slug'>) {
  return {
    opensAt: exp.opensAt?.toISOString() ?? null,
    hasPin: exp.pinHash !== null,
    slug: exp.slug,
  };
}

@Injectable()
export class ExperiencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
    private readonly gifts: GiftsService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    @Inject(KEYRING) private readonly keyring: Keyring,
    private readonly retention: RetentionService,
  ) {}

  /**
   * The experience's recovery credential, decrypted for the creator. Minted at creation, so a
   * missing ciphertext means a row from before manage links existed.
   */
  async manageLink(principal: Principal, id: string) {
    const exp = await requireOwnedExperience(this.prisma, principal, id);
    if (!exp.manageTokenEnc) throw Problem.notFound('Manage link');
    return {
      manageToken: this.keyring.decrypt(exp.manageTokenEnc, 'manage-token', `manage:${exp.id}`),
    };
  }

  private async stats(ids: string[]) {
    if (ids.length === 0) return new Map<string, { started: number; completed: number }>();
    const [started, completed] = await Promise.all([
      this.prisma.recipientSession.groupBy({
        by: ['experienceId'],
        where: { experienceId: { in: ids } },
        _count: true,
      }),
      this.prisma.recipientSession.groupBy({
        by: ['experienceId'],
        where: { experienceId: { in: ids }, completedAt: { not: null } },
        _count: true,
      }),
    ]);
    const map = new Map(ids.map((id) => [id, { started: 0, completed: 0 }]));
    for (const row of started) map.get(row.experienceId)!.started = row._count;
    for (const row of completed) map.get(row.experienceId)!.completed = row._count;
    return map;
  }

  toSummary(
    exp: Experience,
    stats: { started: number; completed: number },
    now = new Date(),
  ): ExperienceSummary {
    return {
      id: exp.id,
      title: exp.title,
      status: effectiveStatus(exp, now),
      moderationState: exp.moderationState,
      createdAt: exp.createdAt.toISOString(),
      updatedAt: exp.updatedAt.toISOString(),
      publishedAt: exp.publishedAt?.toISOString() ?? null,
      expiresAt: exp.expiresAt?.toISOString() ?? null,
      keptUntil: this.retention.keptUntil(exp.lastActivityAt)?.toISOString() ?? null,
      stats,
    };
  }

  async list(principal: Principal, query: { cursor?: string; limit: number; status?: ListFilter }) {
    const cursor = decodeCursor(query.cursor);
    const now = new Date();
    const filters: Prisma.ExperienceWhereInput[] = [
      {
        status: { not: 'DELETED' },
        OR: [
          { ownerId: principal.userId },
          ...(principal.alsoManagedExperienceId ? [{ id: principal.alsoManagedExperienceId }] : []),
        ],
      },
    ];
    // A manage link sees only the experience it was issued for.
    if (principal.scopeExperienceId) filters.push({ id: principal.scopeExperienceId });
    if (query.status === 'DRAFT') filters.push({ status: 'DRAFT' });
    if (query.status === 'PUBLISHED') {
      filters.push({ status: 'PUBLISHED', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
    }
    if (query.status === 'INACTIVE') {
      filters.push({
        OR: [
          { status: { in: ['DISABLED', 'EXPIRED'] } },
          { status: 'PUBLISHED', expiresAt: { lte: now } },
        ],
      });
    }
    if (cursor) {
      filters.push({
        OR: [{ updatedAt: { lt: cursor.at } }, { updatedAt: cursor.at, id: { lt: cursor.id } }],
      });
    }
    const rows = await this.prisma.experience.findMany({
      where: { AND: filters },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const { items, nextCursor } = page(rows, query.limit, (r) => ({ at: r.updatedAt, id: r.id }));
    const stats = await this.stats(items.map((i) => i.id));
    return { items: items.map((i) => this.toSummary(i, stats.get(i.id)!, now)), nextCursor };
  }

  async create(
    principal: Principal,
    input: { title?: string; templateKey?: string | null; fields?: TemplateFieldValues },
    requestId: string | null,
  ) {
    // A manage link opens one experience; new ones need this browser's own owner token.
    if (principal.scopeExperienceId) {
      throw Problem.forbidden(
        'MANAGE_LINK_ONLY',
        'This browser was opened with a link to one surprise. Start fresh on this device to create new ones.',
      );
    }
    const content = input.templateKey ? await this.templates.find(input.templateKey) : null;
    if (input.templateKey && !content)
      throw Problem.badRequest('UNKNOWN_TEMPLATE', 'Template not found');
    const fieldProblems = content ? fieldIssues(content.fields, input.fields ?? {}) : [];
    if (fieldProblems.length > 0) {
      throw Problem.unprocessable(
        'INVALID_TEMPLATE_FIELDS',
        'Check the personal details',
        fieldProblems.map((i) => ({ stepKey: null, field: i.key, message: i.message })),
      );
    }
    const template = content ? materializeTemplate(content, input.fields ?? {}) : null;

    // Templates carry placeholder keys; every experience gets fresh stable step keys.
    const keyMap = new Map<string, string>();
    const steps: DraftStep[] = (template?.steps ?? []).map((s) => {
      const key = randomUUID();
      keyMap.set(s.key, key);
      return { ...s, key } as DraftStep;
    });
    const title = (input.title?.trim() || template?.title || 'Untitled surprise').slice(0, 120);
    const theme = template?.theme ?? DEFAULT_THEME;

    const experience = await this.prisma.$transaction(async (tx) => {
      // Every experience carries its own recovery credential, so losing the owner cookie
      // (new device, cleared browser) does not mean losing the surprise.
      const manageToken = generateToken();
      const exp = await tx.experience.create({
        data: {
          ownerId: principal.userId,
          title,
          templateKey: input.templateKey ?? null,
          manageTokenHash: sha256(manageToken),
        },
      });
      await tx.experience.update({
        where: { id: exp.id },
        data: {
          manageTokenEnc: this.keyring.encrypt(manageToken, 'manage-token', `manage:${exp.id}`),
        },
      });
      const draft = await tx.experienceVersion.create({
        data: { experienceId: exp.id, number: 0, state: 'DRAFT', title, theme },
      });
      await this.writeSteps(tx, draft.id, steps);
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: principal.userId,
          action: 'experience.created',
          targetType: 'experience',
          targetId: exp.id,
          requestId,
          metadata: { template: input.templateKey ?? null },
        },
        tx,
      );
      return exp;
    });

    // Starter surprise details from the template (never real vouchers), encrypted like any secret.
    for (const [templateKey, secret] of Object.entries(template?.giftDefaults ?? {})) {
      const stepKey = keyMap.get(templateKey);
      if (stepKey) await this.gifts.setDraftSecret(principal, experience.id, stepKey, secret);
    }
    return this.detail(principal, experience.id);
  }

  private async writeSteps(tx: Tx, versionId: string, steps: DraftStep[]): Promise<void> {
    if (steps.length === 0) return;
    await tx.step.createMany({
      data: steps.map((s, position) => ({ versionId, ...stepRow(s, position) })),
    });
  }

  private async draftVersion(experienceId: string, client: PrismaService | Tx = this.prisma) {
    const draft = await client.experienceVersion.findFirst({
      where: { experienceId, state: 'DRAFT' },
      include: { steps: true },
    });
    if (!draft) throw Problem.notFound('Draft');
    return draft;
  }

  async detail(principal: Principal, experienceId: string) {
    const exp = await requireOwnedExperience(this.prisma, principal, experienceId);
    const [draft, active, stats] = await Promise.all([
      this.draftVersion(exp.id),
      exp.activeVersionId
        ? this.prisma.experienceVersion.findUnique({ where: { id: exp.activeVersionId } })
        : Promise.resolve(null),
      this.stats([exp.id]),
    ]);
    const tier = await this.entitlements.tierState(exp, toDraftSteps(draft.steps));
    return {
      ...this.toSummary(exp, stats.get(exp.id)!),
      settings: { responseVisibility: draft.responseVisibility },
      publishedVersion: active?.number ?? null,
      hasUnpublishedChanges:
        active === null || draft.updatedAt > (active.publishedAt ?? active.createdAt),
      takedownReason: exp.moderationState === 'TAKEN_DOWN' ? exp.takedownReason : null,
      tier,
      access: accessOf(exp),
    };
  }

  async getDraft(principal: Principal, experienceId: string) {
    const exp = await requireOwnedExperience(this.prisma, principal, experienceId);
    const draft = await this.draftVersion(exp.id);
    const gifts = await this.prisma.gift.findMany({
      where: { versionId: draft.id },
      select: { stepKey: true },
    });
    const withSecret = new Set(gifts.map((g) => g.stepKey));
    const steps = toDraftSteps(draft.steps);
    return {
      experienceId: exp.id,
      revision: draft.revision,
      title: draft.title,
      theme: ThemeSchema.parse(draft.theme),
      settings: { responseVisibility: draft.responseVisibility },
      steps,
      // Only whether a secret exists; the secret itself has its own owner-only endpoint.
      gifts: steps
        .filter((s) => s.type === 'GIFT_REVEAL')
        .map((s) => ({ stepKey: s.key, hasSecret: withSecret.has(s.key) })),
      media: await this.media.ownerMedia(exp.id),
      updatedAt: draft.updatedAt.toISOString(),
    };
  }

  /**
   * Scheduled opening, PIN and short link. A short link is guessable by design, so it only
   * exists while a PIN protects the experience; removing the PIN while a link is set is refused
   * rather than silently exposing the surprise.
   */
  async updateAccess(
    principal: Principal,
    experienceId: string,
    body: UpdateAccessRequest,
    requestId: string | null,
  ) {
    const exp = await requireOwnedExperience(this.prisma, principal, experienceId);
    const pinHash =
      body.pin === undefined ? exp.pinHash : body.pin === null ? null : await hashPin(body.pin);
    const slug = body.slug === undefined ? exp.slug : body.slug;
    if (slug && !pinHash) {
      throw Problem.unprocessable('SHORT_LINK_NEEDS_PIN', 'Set a PIN before using a short link', [
        { stepKey: null, field: 'pin', message: 'A short link can be guessed, so it needs a PIN.' },
      ]);
    }
    let updated;
    try {
      updated = await this.prisma.experience.update({
        where: { id: exp.id },
        data: {
          ...(body.opensAt === undefined
            ? {}
            : { opensAt: body.opensAt ? new Date(body.opensAt) : null }),
          ...(body.pin === undefined ? {} : { pinHash, pinFailures: 0, pinLockedUntil: null }),
          ...(body.slug === undefined ? {} : { slug }),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw Problem.conflict('SHORT_LINK_TAKEN', 'That short link is taken. Try another.');
      }
      throw err;
    }
    await this.audit.record({
      actorType: 'USER',
      actorId: principal.userId,
      action: 'access.updated',
      targetType: 'experience',
      targetId: exp.id,
      requestId,
      // Which settings changed, never the PIN itself.
      metadata: {
        opensAt: body.opensAt !== undefined,
        pin: body.pin === undefined ? 'unchanged' : body.pin === null ? 'removed' : 'set',
        slug: body.slug !== undefined,
      },
    });
    return accessOf(updated);
  }

  /** Published versions, newest first, for the editor's history. */
  async versions(principal: Principal, experienceId: string) {
    const exp = await requireOwnedExperience(this.prisma, principal, experienceId);
    const versions = await this.prisma.experienceVersion.findMany({
      where: { experienceId: exp.id, state: 'PUBLISHED' },
      orderBy: { number: 'desc' },
      include: { _count: { select: { steps: true } } },
    });
    return {
      items: versions.map((v) => ({
        number: v.number,
        title: v.title,
        publishedAt: (v.publishedAt ?? v.createdAt).toISOString(),
        stepCount: v._count.steps,
        isActive: v.id === exp.activeVersionId,
      })),
    };
  }

  /**
   * Replaces the draft with a published version: title, theme, settings, steps (with routing)
   * and gift secrets. Published versions are untouched; recipients see nothing until the
   * creator publishes again. The draft revision moves on, so an open editor gets a conflict
   * instead of overwriting the restore.
   */
  async restoreVersion(
    principal: Principal,
    experienceId: string,
    number: number,
    requestId: string | null,
  ) {
    const exp = await requireOwnedExperience(this.prisma, principal, experienceId);
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.experienceVersion.findFirst({
        where: { experienceId: exp.id, state: 'PUBLISHED', number },
        include: { steps: true },
      });
      if (!source) throw Problem.notFound('Version');
      const draft = await this.draftVersion(exp.id, tx);
      const saved = await tx.experienceVersion.update({
        where: { id: draft.id },
        data: {
          revision: { increment: 1 },
          title: source.title,
          theme: source.theme as Prisma.InputJsonValue,
          responseVisibility: source.responseVisibility,
        },
      });
      await tx.step.deleteMany({ where: { versionId: draft.id } });
      await this.writeSteps(tx, draft.id, toDraftSteps(source.steps));
      await this.gifts.restoreIntoDraft(tx, source.id, draft.id);
      await tx.experience.update({
        where: { id: exp.id },
        data: { title: source.title.trim() || exp.title },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: principal.userId,
          action: 'draft.restored',
          targetType: 'experience',
          targetId: exp.id,
          requestId,
          metadata: { fromVersion: number },
        },
        tx,
      );
      return { revision: saved.revision, restoredFrom: number };
    });
  }

  /**
   * Autosave. Optimistic concurrency: the client sends the revision it edited; a stale revision
   * gets 409 so two tabs cannot silently overwrite each other.
   */
  async updateDraft(principal: Principal, experienceId: string, body: UpdateDraftRequest) {
    const exp = await requireOwnedExperience(this.prisma, principal, experienceId);
    const keys = new Set<string>();
    for (const step of body.steps) {
      if (keys.has(step.key))
        throw Problem.badRequest('DUPLICATE_STEP_KEY', 'Step keys must be unique');
      keys.add(step.key);
    }
    const mediaIds = [
      ...new Set([...body.steps.flatMap(referencedMediaIds), ...themeMediaIds(body.theme)]),
    ];
    if (mediaIds.length > 0) {
      const owned = await this.prisma.mediaAsset.count({
        where: {
          id: { in: mediaIds },
          experienceId: exp.id,
          ownerId: principal.userId,
          status: { in: ['READY', 'PENDING_UPLOAD'] },
        },
      });
      if (owned !== mediaIds.length)
        throw Problem.badRequest('INVALID_MEDIA', 'A referenced image does not exist');
    }

    return this.prisma.$transaction(async (tx) => {
      const draft = await this.draftVersion(exp.id, tx);
      const updated = await tx.experienceVersion.updateMany({
        where: { id: draft.id, state: 'DRAFT', revision: body.revision },
        data: {
          revision: { increment: 1 },
          title: body.title,
          theme: body.theme,
          responseVisibility: body.settings.responseVisibility,
        },
      });
      if (updated.count === 0) {
        throw Problem.conflict(
          'REVISION_CONFLICT',
          'This draft was changed elsewhere. Reload to get the latest version.',
        );
      }
      await tx.step.deleteMany({ where: { versionId: draft.id } });
      await this.writeSteps(tx, draft.id, body.steps);
      const giftKinds = new Map(
        body.steps.flatMap((s) =>
          s.type === 'GIFT_REVEAL' ? [[s.key, s.config.kind] as const] : [],
        ),
      );
      await this.gifts.pruneDraftGifts(tx, draft.id, giftKinds);
      await tx.experience.update({
        where: { id: exp.id },
        data: { title: body.title.trim() || exp.title },
      });
      const saved = await tx.experienceVersion.findUniqueOrThrow({ where: { id: draft.id } });
      return { revision: saved.revision, updatedAt: saved.updatedAt.toISOString() };
    });
  }
}
