'use client';

import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import {
  answerChoices,
  END,
  flowIssues,
  type DraftStep,
  type RouteCondition,
  type RouteTarget,
} from '@momentpath/contracts';
import { END_NODE, layout } from './flow-layout';
import { STEP_TYPE_LABEL, stepSummary } from './reducer';

function conditionLabel(step: DraftStep, when: RouteCondition): string {
  switch (when.kind) {
    case 'ANSWER':
      return answerChoices(step)?.find((c) => c.value === when.equals)?.label ?? when.equals;
    case 'SCORE_AT_LEAST':
      return `score ≥ ${when.value}`;
    case 'DATE_ON_OR_AFTER':
      return `from ${when.date}`;
    case 'COMPLETED':
      return 'if completed…';
  }
}

export function FlowView({
  steps,
  selectedKey,
  onSelect,
  onConnect,
}: {
  steps: readonly DraftStep[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Dragging from one step to another sets where the first step goes "otherwise". */
  onConnect: (source: string, target: RouteTarget) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const positions = layout(steps);
    const problems = new Set(flowIssues(steps).map((i) => i.stepKey));
    const nodes: Node[] = steps.map((step, i) => ({
      id: step.key,
      position: positions.get(step.key)!,
      data: { label: `${i + 1}. ${STEP_TYPE_LABEL[step.type]}\n${stepSummary(step)}` },
      className: [
        'flow-node',
        step.key === selectedKey ? 'flow-node-selected' : '',
        problems.has(step.key) ? 'flow-node-problem' : '',
        step.type === 'GIFT_REVEAL' ? 'flow-node-gift' : '',
      ].join(' '),
      connectable: step.type !== 'GIFT_REVEAL',
      ariaLabel: `Step ${i + 1}, ${STEP_TYPE_LABEL[step.type]}: ${stepSummary(step)}`,
    }));
    nodes.push({
      id: END_NODE,
      position: positions.get(END_NODE)!,
      data: { label: 'End' },
      className: 'flow-node flow-node-end',
      type: 'output',
      ariaLabel: 'End of the experience',
    });

    const index = new Map(steps.map((s, i) => [s.key, i]));
    const nodeFor = (target: RouteTarget | null, i: number): string | null => {
      if (target === END) return END_NODE;
      if (target === null) return steps[i + 1]?.key ?? END_NODE;
      return index.has(target) ? target : null;
    };
    const edges: Edge[] = [];
    steps.forEach((step, i) => {
      if (step.type === 'GIFT_REVEAL') {
        edges.push({ id: `${step.key}-end`, source: step.key, target: END_NODE });
        return;
      }
      (step.next?.rules ?? []).forEach((rule, n) => {
        const target = nodeFor(rule.goto, i);
        if (!target) return;
        edges.push({
          id: `${step.key}-r${n}`,
          source: step.key,
          target,
          label: conditionLabel(step, rule.when),
          className: 'flow-edge-branch',
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      });
      const fallback = nodeFor(step.next?.otherwise ?? null, i);
      if (fallback) {
        edges.push({
          id: `${step.key}-next`,
          source: step.key,
          target: fallback,
          label: (step.next?.rules.length ?? 0) > 0 ? 'otherwise' : undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }
    });
    return { nodes, edges };
  }, [steps, selectedKey]);

  const connect = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    onConnect(c.source, c.target === END_NODE ? END : c.target);
  };

  return (
    <div
      className="h-[65dvh] min-h-96 overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100"
      data-testid="flow-view"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={(_, node) => node.id !== END_NODE && onSelect(node.id)}
        onConnect={connect}
        nodesDraggable={false}
        fitView
        minZoom={0.3}
        proOptions={{ hideAttribution: false }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
