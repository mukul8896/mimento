import type { DraftStep } from './steps';

export const TIERS = ['FREE', 'PLUS', 'PRO'] as const;
export type Tier = (typeof TIERS)[number];

const RANK: Record<Tier, number> = { FREE: 0, PLUS: 1, PRO: 2 };

export function tierAtLeast(held: Tier, required: Tier): boolean {
  return RANK[held] >= RANK[required];
}

export function highestTier(a: Tier, b: Tier): Tier {
  return RANK[a] >= RANK[b] ? a : b;
}

export interface TierCheckInput {
  /** Tier of the template this draft started from; null when it started blank. */
  templateTier: Tier | null;
  /** Step types the template ships, in order; null when the draft started blank. */
  templateStepTypes: readonly string[] | null;
  /** Step types in the draft as it stands. */
  stepTypes: readonly string[];
  /** Whether any step branches (see flow.ts). Templates are linear, so branching is custom. */
  hasRouting?: boolean;
  /** The creator moved to the full builder ("Customize with PRO"); see structure.ts. */
  customized?: boolean;
}

/**
 * What a draft must be entitled to before it can be published.
 *
 * The boundary is *structure*, not content: rewriting every word, swapping every photo and
 * changing the theme of a free template stays free, because personalising a template is the
 * whole point of one. Changing which steps exist — adding, removing or reordering types — is
 * building your own sequence, which is the PRO capability. A draft started from blank is
 * custom by definition, and so is a template the creator chose to customise with PRO.
 */
export function requiredTier(input: TierCheckInput): Tier {
  if (input.templateTier === null || input.templateStepTypes === null) return 'PRO';
  if (input.customized) return 'PRO';
  if (input.hasRouting) return 'PRO';
  const sameShape =
    input.templateStepTypes.length === input.stepTypes.length &&
    input.templateStepTypes.every((type, i) => type === input.stepTypes[i]);
  return sameShape ? input.templateTier : 'PRO';
}

export function stepTypesOf(steps: readonly DraftStep[]): string[] {
  return steps.map((s) => s.type);
}
