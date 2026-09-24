import { describe, expect, it } from 'vitest';
import type { Answer } from './answers';
import { END, hasRouting, walkPath, type StepRouting } from './flow';
import { flowIssues, flowSteps } from './publish-rules';
import { DraftStepSchema, type DraftStep } from './steps';
import { requiredTier } from './tiers';

const k = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function msg(n: number, next?: StepRouting): DraftStep {
  return DraftStepSchema.parse({
    key: k(n),
    type: 'MESSAGE',
    config: { heading: `Step ${n}` },
    next,
  });
}
function yesNo(n: number, next?: StepRouting, extra: object = {}): DraftStep {
  return DraftStepSchema.parse({
    key: k(n),
    type: 'YES_NO_CHOICE',
    config: { question: 'Will you?', ...extra },
    next,
  });
}
function quiz(n: number, correct: string, next?: StepRouting): DraftStep {
  return DraftStepSchema.parse({
    key: k(n),
    type: 'MULTIPLE_CHOICE',
    config: {
      question: 'Where did we meet?',
      options: [
        { id: 'a', label: 'Paris' },
        { id: 'b', label: 'Delhi' },
      ],
      correctOptionId: correct,
    },
    next,
  });
}
function gift(n: number): DraftStep {
  return DraftStepSchema.parse({ key: k(n), type: 'GIFT_REVEAL', config: {} });
}
const ack: Answer = { kind: 'ACK' };
const choice = (value: 'YES' | 'NO' | 'MAYBE'): Answer => ({ kind: 'CHOICE', value });
const option = (optionId: string): Answer => ({ kind: 'OPTION', optionId });
const answers = (entries: [number, Answer][]) => new Map(entries.map(([n, a]) => [k(n), a]));

describe('walkPath', () => {
  it('is linear without routing', () => {
    const steps = flowSteps([msg(1), msg(2), gift(3)]);
    expect(walkPath(steps, answers([]))).toEqual({
      path: [k(1)],
      nextStepKey: k(1),
      finished: false,
    });
    expect(walkPath(steps, answers([[1, ack]])).nextStepKey).toBe(k(2));
    expect(
      walkPath(
        steps,
        answers([
          [1, ack],
          [2, ack],
          [3, ack],
        ]),
      ).finished,
    ).toBe(true);
  });

  it('branches on the answer and skips the other branch', () => {
    const steps = flowSteps([
      yesNo(1, {
        rules: [{ when: { kind: 'ANSWER', equals: 'NO' }, goto: k(3) }],
        otherwise: null,
      }),
      msg(2, { rules: [], otherwise: k(4) }), // yes branch
      msg(3, { rules: [], otherwise: END }), // no branch ends politely
      gift(4),
    ]);
    const yes = walkPath(
      steps,
      answers([
        [1, choice('YES')],
        [2, ack],
      ]),
    );
    expect(yes).toMatchObject({ path: [k(1), k(2), k(4)], nextStepKey: k(4) });
    const no = walkPath(
      steps,
      answers([
        [1, choice('NO')],
        [3, ack],
      ]),
    );
    expect(no).toEqual({ path: [k(1), k(3)], nextStepKey: null, finished: true });
  });

  it('routes on quiz score, dates and completed steps', () => {
    const steps = flowSteps([
      quiz(1, 'a'),
      quiz(2, 'b', {
        rules: [{ when: { kind: 'SCORE_AT_LEAST', value: 2 }, goto: k(4) }],
        otherwise: k(3),
      }),
      msg(3),
      msg(4, {
        rules: [{ when: { kind: 'DATE_ON_OR_AFTER', date: '2026-12-25' }, goto: k(5) }],
        otherwise: END,
      }),
      gift(5),
    ]);
    const perfect = answers([
      [1, option('a')],
      [2, option('b')],
      [4, ack],
    ]);
    expect(walkPath(steps, perfect, new Date('2026-12-25T08:00:00Z')).nextStepKey).toBe(k(5));
    expect(walkPath(steps, perfect, new Date('2026-12-24T23:00:00Z')).finished).toBe(true);
    const oneRight = answers([
      [1, option('a')],
      [2, option('a')],
    ]);
    expect(walkPath(steps, oneRight).nextStepKey).toBe(k(3));
  });

  it('stops instead of looping on a malformed flow', () => {
    const steps = flowSteps([
      msg(1, { rules: [], otherwise: k(2) }),
      msg(2, { rules: [], otherwise: k(1) }),
    ]);
    expect(
      walkPath(
        steps,
        answers([
          [1, ack],
          [2, ack],
        ]),
      ).finished,
    ).toBe(true);
  });
});

describe('flowIssues', () => {
  const messages = (steps: DraftStep[]) => flowIssues(steps).map((i) => i.message);

  it('accepts linear and well-formed branching flows', () => {
    expect(flowIssues([msg(1), msg(2), gift(3)])).toEqual([]);
    expect(
      flowIssues([
        yesNo(1, {
          rules: [{ when: { kind: 'ANSWER', equals: 'NO' }, goto: END }],
          otherwise: null,
        }),
        gift(2),
      ]),
    ).toEqual([]);
  });

  it('rejects loops, dangling and self routes', () => {
    expect(messages([msg(1), msg(2, { rules: [], otherwise: k(1) }), gift(3)]).join()).toMatch(
      /goes back to an earlier step/,
    );
    expect(messages([msg(1, { rules: [], otherwise: k(9) }), gift(2)]).join()).toMatch(
      /no longer exists/,
    );
    expect(messages([msg(1, { rules: [], otherwise: k(1) }), gift(2)]).join()).toMatch(
      /back to itself/,
    );
  });

  it('rejects answer conditions a step cannot produce', () => {
    const route = {
      rules: [{ when: { kind: 'ANSWER' as const, equals: 'MAYBE' }, goto: END }],
      otherwise: null,
    };
    expect(messages([yesNo(1, route), gift(2)]).join()).toMatch(/no longer offers/);
    expect(messages([yesNo(1, route, { maybeEnabled: true }), gift(2)])).toEqual([]);
    expect(messages([msg(1, route), gift(2)]).join()).toMatch(/Only question steps/);
  });

  it('reports unreachable steps and an unreachable final surprise', () => {
    const skip = [msg(1, { rules: [], otherwise: k(3) }), msg(2), gift(3)];
    expect(messages(skip)).toEqual(['No path leads to this step. Connect it or remove it.']);
    const neverGift = [msg(1, { rules: [], otherwise: END }), gift(2)];
    expect(messages(neverGift).join()).toMatch(/final surprise/);
  });
});

describe('branching and tiers', () => {
  it('counts routing as a custom build', () => {
    const steps = flowSteps([msg(1, { rules: [], otherwise: END }), gift(2)]);
    expect(hasRouting(steps)).toBe(true);
    expect(hasRouting(flowSteps([msg(1), gift(2)]))).toBe(false);
    expect(
      requiredTier({
        templateTier: 'FREE',
        templateStepTypes: ['MESSAGE', 'GIFT_REVEAL'],
        stepTypes: ['MESSAGE', 'GIFT_REVEAL'],
        hasRouting: true,
      }),
    ).toBe('PRO');
  });
});
