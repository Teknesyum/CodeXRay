import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, SimulationStep } from '../types/simulation';
import { classifyGraphChange, patchGraphLayoutInSteps } from './graphTransactions';

const original: GraphDocumentV1 = {
  version: 1,
  mode: 'graph',
  directed: false,
  weighted: false,
  nodes: [
    { id: 'A', label: 'A', x: 10, y: 20 },
    { id: 'B', label: 'B', x: 80, y: 70 },
  ],
  edges: [{ id: 'ab', from: 'A', to: 'B' }],
  startId: 'A',
  targetId: 'B',
};

describe('graph transactions', () => {
  it('distinguishes coordinate and label edits from topology changes', () => {
    expect(classifyGraphChange(original, {
      ...original,
      nodes: original.nodes.map((node) => ({ ...node, x: node.x + 5, label: `Node ${node.id}` })),
    })).toBe('layout');
    expect(classifyGraphChange(original, {
      ...original,
      edges: [...original.edges, { id: 'ba', from: 'B', to: 'A' }],
    })).toBe('structural');
    expect(classifyGraphChange(original, { ...original, targetId: 'A' })).toBe('structural');
  });

  it('patches graph snapshots while preserving semantic trace state', () => {
    const steps: SimulationStep[] = [
      {
        lineNumber: 3,
        explanation: 'Visit A.',
        visualData: {
          type: 'graph', directed: false, vars: { current: 'A' },
          nodes: original.nodes.map((node) => ({ ...node, state: node.id === 'A' ? 'active' : 'idle' })),
          edges: original.edges.map((edge) => ({ ...edge, state: 'visited' })),
        },
      },
      { lineNumber: 4, explanation: 'Count.', visualData: { type: 'variables', vars: { count: 1 } } },
    ];
    const moved: GraphDocumentV1 = {
      ...original,
      nodes: original.nodes.map((node) => ({ ...node, x: 99 - node.x, label: `Moved ${node.id}` })),
    };
    const patched = patchGraphLayoutInSteps(steps, moved);
    expect(patched).not.toBe(steps);
    expect(patched[0].visualData).toMatchObject({
      type: 'graph',
      vars: { current: 'A' },
      edges: [{ id: 'ab', state: 'visited' }],
    });
    expect(patched[0].visualData.type === 'graph'
      ? patched[0].visualData.nodes[0]
      : null).toMatchObject({ id: 'A', label: 'Moved A', x: 89, state: 'active' });
    expect(patched[1]).toBe(steps[1]);
    expect(steps[0].visualData.type === 'graph'
      ? steps[0].visualData.nodes[0]
      : null).toMatchObject({ id: 'A', label: 'A', x: 10 });
  });
});
