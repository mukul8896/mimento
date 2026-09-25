import { hasRouting } from './flow';
import { flowSteps } from './publish-rules';
import type { DraftStep } from './steps';

/**
 * How a creator is working on an experience.
 *
 * TEMPLATE: a ready-made template being personalised (PLUS). Its structure — which steps exist,
 * their order, their answer options and the flow — is fixed; every word, photo, button label,
 * the music and the gift inside the template's own gift step can change.
 *
 * CUSTOM: the full builder (PRO), either from scratch or from a template the creator chose to
 * customise. Customising copies nothing new: the draft already belongs to the creator, and the
 * master template is never written to.
 */
export const EXPERIENCE_MODES = ['TEMPLATE', 'CUSTOM'] as const;
export type ExperienceMode = (typeof EXPERIENCE_MODES)[number];

/** What a personalised template may not change: one line per step, in order. */
export function structureOf(steps: readonly DraftStep[]): string[] {
  return steps.map((s) => {
    const options = s.type === 'MULTIPLE_CHOICE' ? s.config.options.map((o) => o.id).join(',') : '';
    const maybe = s.type === 'YES_NO_CHOICE' ? String(s.config.maybeEnabled) : '';
    return `${s.key}:${s.type}:${options}:${maybe}`;
  });
}

/**
 * Where a personalised draft departs from the structure it must keep, or null when it does not.
 * Routing is always structural: templates are linear.
 */
export function structureChange(
  before: readonly DraftStep[],
  after: readonly DraftStep[],
): string | null {
  if (hasRouting(flowSteps(after))) return 'Branching changes the flow of the experience.';
  const a = structureOf(before);
  const b = structureOf(after);
  if (a.length !== b.length) return 'Adding or removing steps changes the experience itself.';
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      const [keyA, typeA] = a[i]!.split(':');
      const [keyB, typeB] = b[i]!.split(':');
      return keyA === keyB && typeA === typeB
        ? 'Adding or removing answer choices changes the experience itself.'
        : 'Reordering or replacing steps changes the experience itself.';
    }
  }
  return null;
}
