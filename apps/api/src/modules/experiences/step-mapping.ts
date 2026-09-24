import { DraftStepSchema, type DraftStep } from '@momentpath/contracts';
import { Prisma, type Step } from '../../generated/prisma/client';

/** Re-validates stored JSONB on the way out; corrupt rows fail loudly instead of rendering. */
export function toDraftSteps(
  rows: Pick<Step, 'key' | 'type' | 'config' | 'position' | 'routing'>[],
): DraftStep[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((row) =>
      DraftStepSchema.parse({
        key: row.key,
        type: row.type,
        config: row.config,
        ...(row.routing ? { next: row.routing } : {}),
      }),
    );
}

/** Step columns for a DraftStep at a position (drafts and published versions alike). */
export function stepRow(step: DraftStep, position: number) {
  return {
    key: step.key,
    position,
    type: step.type,
    config: step.config as Prisma.InputJsonValue,
    routing: step.next ? (step.next as Prisma.InputJsonValue) : Prisma.DbNull,
  };
}
