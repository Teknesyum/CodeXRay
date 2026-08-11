import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, SimulationInput } from '../types/simulation';
import { translateRuntimeText } from '../i18n/translations';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const run = (name: string, input: SimulationInput) => {
  const algorithm = algorithmRegistry.find((entry) => entry.name === name)!;
  return simulateAlgorithm(algorithm.name, algorithm.code, input);
};

const singletonTree: GraphDocumentV1 = {
  version: 1, mode: 'tree', directed: true, weighted: false,
  nodes: [{ id: 'root', label: '42', x: 50, y: 20 }],
  edges: [], rootId: 'root', startId: 'root',
};

const threeChildTree: GraphDocumentV1 = {
  version: 1, mode: 'tree', directed: true, weighted: false,
  nodes: [
    { id: 'R', label: 'R', x: 50, y: 10 },
    { id: 'A', label: 'A', x: 20, y: 70 },
    { id: 'B', label: 'B', x: 50, y: 70 },
    { id: 'C', label: 'C', x: 80, y: 70 },
  ],
  edges: [
    { id: 'ra', from: 'R', to: 'A' },
    { id: 'rb', from: 'R', to: 'B' },
    { id: 'rc', from: 'R', to: 'C' },
  ],
  rootId: 'R', startId: 'R',
};

describe('batch 11 independent edge-case and rejection oracles', () => {
  it('Coin Change distinguishes amount zero from an unreachable amount', () => {
    const zero = run('Coin Change', {
      kind: 'array', text: '[2,5]', parameters: { amount: '0' }, origin: 'user',
    }).at(-1)!;
    expect(zero.visualData.vars).toMatchObject({ minCoins: 0, possible: true });

    const impossible = run('Coin Change', {
      kind: 'array', text: '[2,4]', parameters: { amount: '3' }, origin: 'user',
    }).at(-1)!;
    expect(impossible.visualData.vars).toMatchObject({ minCoins: -1, possible: false });
  });

  it('Unique Paths shows the one-cell grid as one complete path', () => {
    const steps = run('Unique Paths', { kind: 'array', text: '[1,1]', origin: 'user' });
    expect(steps.map((step) => step.visualData.vars.phase)).toEqual([
      'Unique Paths · initialize grid borders', 'Unique Paths · complete',
    ]);
    expect(steps.at(-1)!.visualData.vars.uniquePaths).toBe('1');
  });

  for (const [name, order] of [
    ['Binary Tree Inorder Traversal', 'inorder'],
    ['Binary Tree Preorder Traversal', 'preorder'],
    ['Binary Tree Postorder Traversal', 'postorder'],
  ] as const) {
    it(`${order} traverses and returns from a singleton binary tree`, () => {
      const steps = run(name, { kind: 'tree', text: '', graph: singletonTree, origin: 'user' });
      expect(steps.map((step) => step.visualData.vars.phase)).toEqual([
        `Tree ${order} · initialize`,
        `Tree ${order} · enter frame`,
        `Tree ${order} · visit node`,
        `Tree ${order} · return from frame`,
        `Tree ${order} · complete`,
      ]);
      expect(steps.at(-1)!.visualData.vars.traversal).toEqual(['root']);
    });

    it(`${order} rejects a non-binary tree instead of silently dropping its third child`, () => {
      let message = '';
      try {
        run(name, { kind: 'tree', text: '', graph: threeChildTree, origin: 'user' });
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).toBe('Binary node R has more than two children.');
      expect(translateRuntimeText(message, 'tr')).toBe('R ikili düğümünde ikiden fazla çocuk var.');
    });
  }

  it('rejects invalid coin and grid contracts', () => {
    expect(() => run('Coin Change', {
      kind: 'array', text: '[1,0]', parameters: { amount: '3' },
    })).toThrow(/positive integers/);
    expect(() => run('Coin Change', { kind: 'array', text: '[1]' })).toThrow(/Amount is required/);
    expect(() => run('Unique Paths', { kind: 'array', text: '[0,2]' })).toThrow(/between 1 and 100/);
    expect(() => run('Unique Paths', { kind: 'array', text: '[2,101]' })).toThrow(/between 1 and 100/);
  });
});
