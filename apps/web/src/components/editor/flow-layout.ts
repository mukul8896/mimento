import { flowSteps, successors, type DraftStep } from '@momentpath/contracts';

export const END_NODE = 'end';
const COL = 250;
const ROW = 130;

/**
 * Lays the flow out top to bottom: each step sits one row below the deepest step that can lead
 * to it, so branches spread sideways and rejoin below. Loops (which publishing rejects) fall back
 * to list order so the graph still renders while the creator fixes them.
 */
export function layout(steps: readonly DraftStep[]): Map<string, { x: number; y: number }> {
  const flow = flowSteps(steps);
  const depth = new Array<number>(steps.length).fill(-1);
  if (steps.length > 0) depth[0] = 0;
  for (let pass = 0; pass < steps.length; pass++) {
    let changed = false;
    steps.forEach((_, i) => {
      if (depth[i]! < 0) return;
      for (const n of successors(flow, i)) {
        if (n === 'END' || n <= i) continue; // ignore back edges for layout
        if (depth[n]! < depth[i]! + 1) {
          depth[n] = depth[i]! + 1;
          changed = true;
        }
      }
    });
    if (!changed) break;
  }
  steps.forEach((_, i) => {
    if (depth[i]! < 0) depth[i] = i; // unreachable: keep list order
  });
  const rows = new Map<number, number[]>();
  depth.forEach((d, i) => rows.set(d, [...(rows.get(d) ?? []), i]));
  const positions = new Map<string, { x: number; y: number }>();
  for (const [d, members] of rows) {
    members.forEach((i, n) => {
      positions.set(steps[i]!.key, { x: (n - (members.length - 1) / 2) * COL, y: d * ROW });
    });
  }
  const maxDepth = Math.max(0, ...depth);
  positions.set(END_NODE, { x: 0, y: (maxDepth + 1) * ROW });
  return positions;
}
