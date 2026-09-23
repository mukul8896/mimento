import { DraftStepSchema, type DraftStep } from '@momentpath/contracts';
import type { Step } from '../../generated/prisma/client';

/** Re-validates stored JSONB on the way out; corrupt rows fail loudly instead of rendering. */
export function toDraftSteps(
  rows: Pick<Step, 'key' | 'type' | 'config' | 'position'>[],
): DraftStep[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((row) => DraftStepSchema.parse({ key: row.key, type: row.type, config: row.config }));
}
