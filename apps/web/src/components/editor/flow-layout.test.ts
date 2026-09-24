import { describe, expect, it } from 'vitest';
import { DraftStepSchema, type DraftStep } from '@momentpath/contracts';
import { layout } from './flow-layout';

const k = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const step = (n: number, next?: object): DraftStep =>
  DraftStepSchema.parse({ key: k(n), type: 'MESSAGE', config: { heading: `S${n}` }, next });

describe('flow layout', () => {
  it('stacks a linear flow in one column', () => {
    const pos = layout([step(1), step(2), step(3)]);
    expect([1, 2, 3].map((n) => pos.get(k(n))!.x)).toEqual([0, 0, 0]);
    expect(pos.get(k(2))!.y).toBeGreaterThan(pos.get(k(1))!.y);
    expect(pos.get('end')!.y).toBeGreaterThan(pos.get(k(3))!.y);
  });

  it('puts two branches side by side and the join below both', () => {
    const pos = layout([
      step(1, {
        rules: [{ when: { kind: 'SCORE_AT_LEAST', value: 1 }, goto: k(3) }],
        otherwise: k(2),
      }),
      step(2, { rules: [], otherwise: k(4) }),
      step(3),
      step(4),
    ]);
    expect(pos.get(k(2))!.y).toBe(pos.get(k(3))!.y);
    expect(pos.get(k(2))!.x).not.toBe(pos.get(k(3))!.x);
    expect(pos.get(k(4))!.y).toBeGreaterThan(pos.get(k(3))!.y);
  });
});
