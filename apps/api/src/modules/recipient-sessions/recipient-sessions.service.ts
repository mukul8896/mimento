import { Injectable } from '@nestjs/common';
import {
  AnswerSchema,
  checkAnswer,
  flowSteps,
  referencedMediaIds,
  walkPath,
  ThemeSchema,
  type Answer,
  type DraftStep,
} from '@momentpath/contracts';
import { generateToken, isWellFormedToken, sha256 } from '../../common/crypto';
import { Problem } from '../../common/problem';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import type { Experience, RecipientSession, ReportCategory } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { isPubliclyAvailable } from '../experiences/lifecycle';
import { toDraftSteps } from '../experiences/step-mapping';
import { giftEligibility } from '../gifts/gift-eligibility';
import { GiftsService } from '../gifts/gifts.service';
import { MediaService, RECIPIENT_MEDIA_URL_TTL_SECONDS } from '../media/media.service';
import { computeProgress, publicStep } from './progress';

const SESSION_RETENTION_DAYS = 180;

@Injectable()
export class RecipientSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly gifts: GiftsService,
    private readonly audit: AuditService,
  ) {}

  /** Resolves a share token to a publicly available experience, failing closed and neutrally. */
  async resolve(token: string, client: PrismaService | Tx = this.prisma): Promise<Experience> {
    if (!isWellFormedToken(token)) throw Problem.unavailable();
    const exp = await client.experience.findUnique({ where: { accessTokenHash: sha256(token) } });
    if (!exp || !isPubliclyAvailable(exp, new Date())) throw Problem.unavailable();
    return exp;
  }

  private async version(versionId: string) {
    const version = await this.prisma.experienceVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { steps: true },
    });
    if (version.state !== 'PUBLISHED') throw Problem.unavailable();
    return { ...version, parsedSteps: toDraftSteps(version.steps) };
  }

  /** What the recipient's browser gets, plus the full steps (with routing) for progress. */
  private async publicExperience(exp: Experience, versionId: string) {
    const version = await this.version(versionId);
    const mediaIds = version.parsedSteps.flatMap(referencedMediaIds);
    const experience = {
      title: version.title,
      theme: ThemeSchema.parse(version.theme),
      versionNumber: version.number,
      responsesVisibleToCreator: version.responseVisibility === 'FULL',
      steps: version.parsedSteps.map(publicStep),
      media: await this.media.publicMedia(mediaIds, exp.id, RECIPIENT_MEDIA_URL_TTL_SECONDS),
    };
    return { experience, steps: version.parsedSteps };
  }

  /** This session's answers by step key; they decide the path through any branching. */
  private async answersOf(
    sessionId: string,
    client: PrismaService | Tx = this.prisma,
  ): Promise<Map<string, Answer>> {
    const responses = await client.response.findMany({
      where: { sessionId },
      select: { stepKey: true, answer: true },
    });
    return new Map(responses.map((r) => [r.stepKey, AnswerSchema.parse(r.answer)]));
  }

  async meta(token: string) {
    const exp = await this.resolve(token);
    const version = await this.prisma.experienceVersion.findUniqueOrThrow({
      where: { id: exp.activeVersionId! },
    });
    return { title: version.title, theme: ThemeSchema.parse(version.theme) };
  }

  /** Starts an anonymous session pinned to the currently active version. */
  async start(token: string) {
    const exp = await this.resolve(token);
    const versionId = exp.activeVersionId!;
    const version = await this.prisma.experienceVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    const sessionToken = generateToken();
    await this.prisma.recipientSession.create({
      data: {
        experienceId: exp.id,
        versionId,
        tokenHash: sha256(sessionToken),
        answersShared: version.responseVisibility === 'FULL',
        expiresAt: new Date(Date.now() + SESSION_RETENTION_DAYS * 24 * 3600 * 1000),
      },
    });
    const { experience, steps } = await this.publicExperience(exp, versionId);
    return { sessionToken, experience, progress: computeProgress(steps, new Map()) };
  }

  private async session(
    exp: Experience,
    sessionToken: string | undefined,
  ): Promise<RecipientSession> {
    if (!sessionToken || !isWellFormedToken(sessionToken)) {
      throw Problem.badRequest('SESSION_REQUIRED', 'Start the experience first');
    }
    const session = await this.prisma.recipientSession.findUnique({
      where: { tokenHash: sha256(sessionToken) },
    });
    if (!session || session.experienceId !== exp.id || session.expiresAt <= new Date()) {
      throw new Problem(404, 'SESSION_NOT_FOUND', 'Your progress has expired. Start again.');
    }
    return session;
  }

  async resume(token: string, sessionToken: string | undefined) {
    const exp = await this.resolve(token);
    const session = await this.session(exp, sessionToken);
    const { experience, steps } = await this.publicExperience(exp, session.versionId);
    const answers = await this.answersOf(session.id);
    return {
      sessionToken: sessionToken!,
      experience,
      progress: computeProgress(steps, answers),
    };
  }

  async answer(token: string, sessionToken: string | undefined, stepKey: string, answer: Answer) {
    const exp = await this.resolve(token);
    const session = await this.session(exp, sessionToken);
    const version = await this.version(session.versionId);
    const steps = version.parsedSteps;
    const answers = await this.answersOf(session.id);

    const step = steps.find((s) => s.key === stepKey);
    if (!step) throw Problem.badRequest('UNKNOWN_STEP', 'Unknown step');
    if (answers.has(stepKey)) return { progress: computeProgress(steps, answers), correct: null };

    // Only the step the recipient's own path has reached may be answered.
    const progress = computeProgress(steps, answers);
    if (progress.nextStepKey !== stepKey) {
      throw Problem.conflict('STEP_OUT_OF_ORDER', 'Complete the earlier steps first');
    }
    const result = checkAnswer(step, answer);
    if (!result.ok) {
      if (result.reason === 'INCORRECT') return { progress, correct: false };
      throw Problem.badRequest('INVALID_ANSWER', 'That answer is not valid for this step');
    }
    const stepRow = version.steps.find((s) => s.key === stepKey)!;
    await this.prisma.$transaction(async (tx) => {
      await tx.response.createMany({
        data: [{ sessionId: session.id, stepId: stepRow.id, stepKey, answer }],
        skipDuplicates: true,
      });
      answers.set(stepKey, answer);
      if (computeProgress(steps, answers).completed) {
        await tx.recipientSession.update({
          where: { id: session.id },
          data: { completedAt: new Date() },
        });
      }
    });
    return { progress: computeProgress(steps, answers), correct: result.correct };
  }

  /** Closing records no answer of any kind; it only marks that the recipient left. */
  async close(token: string, sessionToken: string | undefined): Promise<void> {
    const exp = await this.resolve(token);
    const session = await this.session(exp, sessionToken);
    if (!session.completedAt && !session.closedAt) {
      await this.prisma.recipientSession.update({
        where: { id: session.id },
        data: { closedAt: new Date() },
      });
    }
  }

  /**
   * The only path that ever returns a gift secret. Eligibility is decided server-side from this
   * session's stored responses; a one-time gift is claimed atomically under a row lock.
   */
  async revealGift(token: string, sessionToken: string | undefined, stepKey: string) {
    const exp = await this.resolve(token);
    const session = await this.session(exp, sessionToken);
    const version = await this.version(session.versionId);
    const steps: DraftStep[] = version.parsedSteps;
    const step = steps.find((s) => s.key === stepKey);

    const secret = await this.prisma.$transaction(async (tx) => {
      const [gift] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Gift" WHERE "versionId" = ${version.id}::uuid AND "stepKey" = ${stepKey}::uuid FOR UPDATE`;
      const giftRow = gift ? await tx.gift.findUniqueOrThrow({ where: { id: gift.id } }) : null;
      const answers = await this.answersOf(session.id, tx);
      const eligibility = giftEligibility({
        giftStepKey: stepKey,
        path: walkPath(flowSteps(steps), answers).path,
        isGiftStep: step?.type === 'GIFT_REVEAL',
        gift: giftRow,
        sessionId: session.id,
      });
      if (!eligibility.ok) {
        if (eligibility.reason === 'ALREADY_REVEALED') {
          throw new Problem(
            410,
            'GIFT_ALREADY_REVEALED',
            'This surprise has already been revealed',
          );
        }
        if (eligibility.reason === 'STEPS_INCOMPLETE') {
          throw Problem.forbidden(
            'GIFT_LOCKED',
            'Complete the earlier steps to unlock the surprise',
          );
        }
        throw Problem.badRequest('NOT_A_GIFT_STEP', 'Unknown surprise');
      }
      await tx.gift.update({
        where: { id: giftRow!.id },
        data: {
          revealCount: { increment: 1 },
          ...(giftRow!.revealedAt
            ? {}
            : { revealedAt: new Date(), revealedBySessionId: session.id }),
        },
      });
      const stepRow = version.steps.find((s) => s.key === stepKey)!;
      await tx.response.createMany({
        data: [{ sessionId: session.id, stepId: stepRow.id, stepKey, answer: { kind: 'ACK' } }],
        skipDuplicates: true,
      });
      answers.set(stepKey, { kind: 'ACK' });
      if (computeProgress(steps, answers).completed && !session.completedAt) {
        await tx.recipientSession.update({
          where: { id: session.id },
          data: { completedAt: new Date() },
        });
      }
      return { secret: this.gifts.decrypt(giftRow!), answers };
    });

    return {
      gift: await this.gifts.toRevealed(secret.secret, exp.id),
      progress: computeProgress(steps, secret.answers),
    };
  }

  /**
   * Abuse reports are accepted for any token that maps to an experience (even a disabled one)
   * and always answer "accepted", so reporting cannot be used to probe tokens.
   */
  async report(token: string, category: ReportCategory, details: string): Promise<void> {
    if (!isWellFormedToken(token)) return;
    const exp = await this.prisma.experience.findUnique({
      where: { accessTokenHash: sha256(token) },
    });
    if (!exp || exp.status === 'DELETED') return;
    const report = await this.prisma.abuseReport.create({
      data: { experienceId: exp.id, category, details },
    });
    await this.audit.record({
      actorType: 'RECIPIENT',
      actorId: null,
      action: 'report.created',
      targetType: 'experience',
      targetId: exp.id,
      requestId: null,
      metadata: { reportId: report.id, category },
    });
  }
}
