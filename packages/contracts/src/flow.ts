import { z } from 'zod';
import type { Answer } from './answers';

/**
 * Branching. Steps stay an ordered list; a step may carry `next` routing that jumps elsewhere.
 * Rules are checked in order after the recipient finishes the step; the first that matches
 * decides where they go. With no match, `otherwise` applies, and `null` there means "the next
 * step in the list". `END` finishes the experience without any further steps.
 *
 * The same `walkPath` runs on the API (authoritative: which step may be answered next, and
 * whether the gift unlocks) and in the editor preview, so they cannot disagree.
 */

export const END = 'END' as const;
const StepKey = z.uuid();
export const RouteTargetSchema = z.union([StepKey, z.literal(END)]);
export type RouteTarget = z.infer<typeof RouteTargetSchema>;

export const MAX_ROUTE_RULES = 8;

export const RouteConditionSchema = z.discriminatedUnion('kind', [
  /** This step's own answer: an option id (multiple choice) or YES / NO / MAYBE. */
  z.strictObject({ kind: z.literal('ANSWER'), equals: z.string().min(1).max(40) }),
  /** Quiz answers answered correctly so far on the recipient's path. */
  z.strictObject({ kind: z.literal('SCORE_AT_LEAST'), value: z.number().int().min(0).max(30) }),
  /** On or after a calendar date (UTC), when the recipient reaches this point. */
  z.strictObject({ kind: z.literal('DATE_ON_OR_AFTER'), date: z.iso.date() }),
  /** The recipient has completed another step on their path. */
  z.strictObject({ kind: z.literal('COMPLETED'), stepKey: StepKey }),
]);
export type RouteCondition = z.infer<typeof RouteConditionSchema>;

export const RouteRuleSchema = z.strictObject({
  when: RouteConditionSchema,
  goto: RouteTargetSchema,
});
export type RouteRule = z.infer<typeof RouteRuleSchema>;

export const StepRoutingSchema = z
  .strictObject({
    rules: z.array(RouteRuleSchema).max(MAX_ROUTE_RULES).default([]),
    otherwise: RouteTargetSchema.nullable().default(null),
  })
  .meta({ id: 'StepRouting' });
export type StepRouting = z.infer<typeof StepRoutingSchema>;

/** The minimum walkPath needs from a step (keeps this module free of the step schemas). */
export interface FlowStep {
  key: string;
  type: string;
  next?: StepRouting | undefined;
  /** Multiple-choice correct option, for scoring; the server has it, recipients do not. */
  correctOptionId?: string | null;
}

export interface PathState {
  /** Steps the recipient has been through or is on, in order. */
  path: string[];
  /** The step to answer now, or null when the experience is over. */
  nextStepKey: string | null;
  /** True once the path has run out (END, or past the last step). */
  finished: boolean;
}

function answerValue(answer: Answer | undefined): string | null {
  if (!answer) return null;
  if (answer.kind === 'OPTION') return answer.optionId;
  if (answer.kind === 'CHOICE') return answer.value;
  return null;
}

function matches(
  when: RouteCondition,
  ctx: { answer: Answer | undefined; score: number; done: ReadonlySet<string>; today: string },
): boolean {
  switch (when.kind) {
    case 'ANSWER':
      return answerValue(ctx.answer) === when.equals;
    case 'SCORE_AT_LEAST':
      return ctx.score >= when.value;
    case 'DATE_ON_OR_AFTER':
      return ctx.today >= when.date;
    case 'COMPLETED':
      return ctx.done.has(when.stepKey);
  }
}

/** Where a finished step leads: a step key, END, or null for "next in the list". */
export function routeFrom(
  step: FlowStep,
  ctx: { answer: Answer | undefined; score: number; done: ReadonlySet<string>; today: string },
): RouteTarget | null {
  for (const rule of step.next?.rules ?? []) if (matches(rule.when, ctx)) return rule.goto;
  return step.next?.otherwise ?? null;
}

/**
 * Follows the recipient's answers from the first step. Stops at the first unanswered step
 * (that is the one they may answer next) or where the path ends. A step revisited would mean a
 * loop; publishing rejects those, and the walk stops rather than spin.
 */
export function walkPath(
  steps: readonly FlowStep[],
  answers: ReadonlyMap<string, Answer>,
  now: Date = new Date(),
): PathState {
  const index = new Map(steps.map((s, i) => [s.key, i]));
  const today = now.toISOString().slice(0, 10);
  const path: string[] = [];
  const done = new Set<string>();
  let score = 0;
  let at: number | undefined = steps.length > 0 ? 0 : undefined;

  while (at !== undefined && at < steps.length) {
    const step = steps[at]!;
    if (done.has(step.key)) break; // loop guard
    path.push(step.key);
    const answer = answers.get(step.key);
    if (!answer) return { path, nextStepKey: step.key, finished: false };
    done.add(step.key);
    if (
      step.type === 'MULTIPLE_CHOICE' &&
      step.correctOptionId &&
      answerValue(answer) === step.correctOptionId
    ) {
      score += 1;
    }
    const target = routeFrom(step, { answer, score, done, today });
    if (target === END) break;
    at = target === null ? at + 1 : index.get(target);
  }
  return { path, nextStepKey: null, finished: true };
}

export function hasRouting(steps: readonly FlowStep[]): boolean {
  return steps.some((s) => (s.next?.rules.length ?? 0) > 0 || (s.next?.otherwise ?? null) !== null);
}

/** Every step a finished step could lead to (all rules plus the fallback). */
export function successors(steps: readonly FlowStep[], i: number): (number | 'END')[] {
  const step = steps[i]!;
  const index = new Map(steps.map((s, n) => [s.key, n]));
  const resolve = (t: RouteTarget | null): number | 'END' | undefined =>
    t === END ? 'END' : t === null ? (i + 1 < steps.length ? i + 1 : 'END') : index.get(t);
  const out = new Set<number | 'END'>();
  for (const rule of step.next?.rules ?? []) {
    const r = resolve(rule.goto);
    if (r !== undefined) out.add(r);
  }
  const fallback = resolve(step.next?.otherwise ?? null);
  if (fallback !== undefined) out.add(fallback);
  return [...out];
}
