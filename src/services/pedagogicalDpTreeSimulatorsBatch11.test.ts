import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, MatrixVisualData, SimulationInput } from '../types/simulation';
import { translateRuntimeText } from '../i18n/translations';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const tree: GraphDocumentV1 = {
  version: 1, mode: 'tree', directed: true, weighted: false,
  nodes: [
    { id: 'A', label: 'A', x: 50, y: 10 }, { id: 'B', label: 'B', x: 25, y: 45 },
    { id: 'C', label: 'C', x: 75, y: 45 }, { id: 'D', label: 'D', x: 12, y: 80 },
    { id: 'E', label: 'E', x: 38, y: 80 },
  ],
  edges: [
    { id: 'ab', from: 'A', to: 'B' }, { id: 'ac', from: 'A', to: 'C' },
    { id: 'bd', from: 'B', to: 'D' }, { id: 'be', from: 'B', to: 'E' },
  ], rootId: 'A', startId: 'A',
};
const run = (name: string, input: SimulationInput) => {
  const definition = algorithmRegistry.find((entry) => entry.name === name);
  if (!definition) throw new Error(`Missing ${name}`);
  return simulateAlgorithm(name, definition.code, input);
};
const assertPhases = (steps: ReturnType<typeof run>) => steps.forEach((step) => {
  const phase = step.visualData.vars.phase;
  if (typeof phase === 'string') expect(translateRuntimeText(phase, 'tr')).not.toBe(phase);
});

describe('batch 11 pedagogical DP/tree simulations', () => {
  it('Coin Change shows each denomination relaxation and predecessor amount', () => {
    const steps = run('Coin Change', { kind: 'array', text: '1,2,5', parameters: { amount: '11' }, origin: 'user' });
    assertPhases(steps);
    const relax = steps.find((step) => step.visualData.vars.phase === 'Coin Change · relax amount with coin');
    expect(relax?.visualData.type).toBe('matrix');
    expect((relax!.visualData as MatrixVisualData).highlights.some((cell) => cell.role === 'dependency')).toBe(true);
    expect(steps.at(-1)!.visualData.vars.minCoins).toBe(3);
  });

  it('Unique Paths renders the full grid with top and left dependencies', () => {
    const steps = run('Unique Paths', { kind: 'array', text: '3,7', origin: 'user' });
    assertPhases(steps);
    const fill = steps.find((step) => step.visualData.vars.phase === 'Unique Paths · add top and left');
    expect(fill?.visualData.type).toBe('matrix');
    expect((fill!.visualData as MatrixVisualData).values).toHaveLength(3);
    expect((fill!.visualData as MatrixVisualData).highlights.filter((cell) => cell.role === 'dependency')).toHaveLength(2);
    expect(steps.at(-1)!.visualData.vars.uniquePaths).toBe('28');
  });

  for (const [name, order, expected] of [
    ['Binary Tree Inorder Traversal', 'inorder', ['D', 'B', 'E', 'A', 'C']],
    ['Binary Tree Preorder Traversal', 'preorder', ['A', 'B', 'D', 'E', 'C']],
    ['Binary Tree Postorder Traversal', 'postorder', ['D', 'E', 'B', 'C', 'A']],
  ] as const) {
    it(`${order} animates enter, descent, visit, and return frames`, () => {
      const steps = run(name, { kind: 'tree', text: '', graph: tree, origin: 'user' });
      assertPhases(steps);
      expect(steps.some((step) => step.visualData.vars.phase === `Tree ${order} · enter frame`)).toBe(true);
      expect(steps.some((step) => step.visualData.vars.phase === `Tree ${order} · descend left`)).toBe(true);
      expect(steps.some((step) => step.visualData.vars.phase === `Tree ${order} · return from frame`)).toBe(true);
      expect(steps.at(-1)!.visualData.vars.traversal).toEqual(expected);
    });
  }
});
