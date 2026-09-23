import { Injectable } from '@nestjs/common';
import { AnswerSchema, type Answer, type DraftStep } from '@momentpath/contracts';
import { requireOwnedExperience } from '../../common/ownership';
import { PrismaService } from '../../prisma/prisma.service';
import { toDraftSteps } from '../experiences/step-mapping';
import type { Principal } from '../identity/principal';

function stepLabel(step: DraftStep): string {
  switch (step.type) {
    case 'MESSAGE':
      return step.config.heading || 'Message';
    case 'IMAGE':
      return step.config.caption || 'Image';
    case 'MULTIPLE_CHOICE':
    case 'YES_NO_CHOICE':
      return step.config.question || 'Question';
    case 'SCRATCH_REVEAL':
      return 'Scratch card';
    case 'GIFT_REVEAL':
      return step.config.title || 'Surprise';
  }
}

function answerValue(step: DraftStep, answer: Answer): { value: string; label: string } | null {
  if (step.type === 'MULTIPLE_CHOICE' && answer.kind === 'OPTION') {
    return {
      value: answer.optionId,
      label: step.config.options.find((o) => o.id === answer.optionId)?.label ?? answer.optionId,
    };
  }
  if (step.type === 'YES_NO_CHOICE' && answer.kind === 'CHOICE') {
    const labels = {
      YES: step.config.yesLabel,
      NO: step.config.noLabel,
      MAYBE: step.config.maybeLabel,
    };
    return { value: answer.value, label: labels[answer.value] };
  }
  return null;
}

/**
 * Creator-facing results. Aggregates are always available. Individual answers are only shown
 * for sessions whose recipient was told answers are shared, and never include IP addresses,
 * devices, locations or precise timestamps (only the start date).
 */
@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async results(principal: Principal, experienceId: string) {
    const exp = await requireOwnedExperience(this.prisma, principal, experienceId);
    const draft = await this.prisma.experienceVersion.findFirst({
      where: { experienceId: exp.id, state: 'DRAFT' },
    });
    const versions = await this.prisma.experienceVersion.findMany({
      where: { experienceId: exp.id, state: 'PUBLISHED' },
      include: { steps: true },
      orderBy: { number: 'asc' },
    });
    // Steps by key across versions; the latest definition wins for labels.
    const stepByKey = new Map<string, DraftStep>();
    for (const v of versions) for (const s of toDraftSteps(v.steps)) stepByKey.set(s.key, s);

    const sessions = await this.prisma.recipientSession.findMany({
      where: { experienceId: exp.id },
      include: { responses: true },
      orderBy: { startedAt: 'asc' },
      take: 1000,
    });

    const tallies = new Map<string, Map<string, { label: string; count: number }>>();
    for (const session of sessions) {
      for (const r of session.responses) {
        const step = stepByKey.get(r.stepKey);
        const parsed = AnswerSchema.safeParse(r.answer);
        if (!step || !parsed.success) continue;
        const v = answerValue(step, parsed.data);
        if (!v) continue;
        const t = tallies.get(step.key) ?? new Map();
        const entry = t.get(v.value) ?? { label: v.label, count: 0 };
        entry.count += 1;
        t.set(v.value, entry);
        tallies.set(step.key, t);
      }
    }

    const questionSteps = [...stepByKey.values()].filter(
      (s) => s.type === 'MULTIPLE_CHOICE' || s.type === 'YES_NO_CHOICE',
    );
    const shared = sessions.filter((s) => s.answersShared);
    return {
      responseVisibility: draft?.responseVisibility ?? 'FULL',
      started: sessions.length,
      completed: sessions.filter((s) => s.completedAt).length,
      closedEarly: sessions.filter((s) => s.closedAt && !s.completedAt).length,
      steps: questionSteps.map((s) => ({
        stepKey: s.key,
        type: s.type,
        label: stepLabel(s),
        tallies: [...(tallies.get(s.key) ?? new Map()).entries()].map(([value, e]) => ({
          value,
          label: e.label,
          count: e.count,
        })),
      })),
      responses:
        draft?.responseVisibility === 'AGGREGATE_ONLY'
          ? null
          : shared.map((s, index) => ({
              label: `Recipient ${index + 1}`,
              startedOn: s.startedAt.toISOString().slice(0, 10),
              completed: s.completedAt !== null,
              answers: s.responses
                .filter((r) => stepByKey.get(r.stepKey)?.type !== 'GIFT_REVEAL')
                .flatMap((r) => {
                  const parsed = AnswerSchema.safeParse(r.answer);
                  return parsed.success && parsed.data.kind !== 'ACK'
                    ? [{ stepKey: r.stepKey, answer: parsed.data }]
                    : [];
                }),
            })),
    };
  }
}
