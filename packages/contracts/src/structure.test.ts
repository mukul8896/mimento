import { describe, expect, it } from 'vitest';
import { END } from './flow';
import { DraftStepSchema, type DraftStep } from './steps';
import { structureChange } from './structure';

const k = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function msg(n: number, heading = `Step ${n}`): DraftStep {
  return DraftStepSchema.parse({ key: k(n), type: 'MESSAGE', config: { heading } });
}
function quiz(n: number, labels: string[]): DraftStep {
  return DraftStepSchema.parse({
    key: k(n),
    type: 'MULTIPLE_CHOICE',
    config: {
      question: 'Where did we meet?',
      options: labels.map((label, i) => ({ id: `o${i}`, label })),
    },
  });
}

const base = [msg(1), quiz(2, ['Paris', 'Delhi']), msg(3)];

describe('structureChange', () => {
  it('allows every content change: words, answer labels, button text', () => {
    const personalised = [
      msg(1, 'Happy birthday, Pratikshya!'),
      quiz(2, ['Goa', 'Pune']),
      DraftStepSchema.parse({
        key: k(3),
        type: 'MESSAGE',
        config: { heading: 'Open it', buttonLabel: 'Show me' },
      }),
    ];
    expect(structureChange(base, personalised)).toBeNull();
  });

  it.each([
    ['a step added', [...base, msg(4)]],
    ['a step removed', base.slice(0, 2)],
    ['steps reordered', [base[1]!, base[0]!, base[2]!]],
    ['an answer choice added', [base[0]!, quiz(2, ['Paris', 'Delhi', 'Goa']), base[2]!]],
  ])('refuses %s', (_label, after) => {
    expect(structureChange(base, after)).not.toBeNull();
  });

  it('refuses branching, because templates are linear', () => {
    const routed = DraftStepSchema.parse({
      key: k(1),
      type: 'MESSAGE',
      config: { heading: 'Step 1' },
      next: { rules: [], otherwise: END },
    });
    expect(structureChange(base, [routed, base[1]!, base[2]!])).toMatch(/flow/);
  });
});
