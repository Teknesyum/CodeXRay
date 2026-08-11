import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, GraphVisualData, SimulationInput } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const run = (name: string, input: SimulationInput) => {
  const algorithm = algorithmRegistry.find((entry) => entry.name === name)!;
  return simulateAlgorithm(algorithm.name, algorithm.code, input);
};

const ancestorTree: GraphDocumentV1 = {
  version: 1, mode: 'tree', directed: true, weighted: false,
  nodes: [
    { id: 'A', label: 'A', x: 50, y: 10 },
    { id: 'B', label: 'B', x: 25, y: 45 },
    { id: 'C', label: 'C', x: 75, y: 45 },
    { id: 'D', label: 'D', x: 25, y: 80 },
  ],
  edges: [
    { id: 'ab', from: 'A', to: 'B' },
    { id: 'ac', from: 'A', to: 'C' },
    { id: 'bd', from: 'B', to: 'D' },
  ],
  rootId: 'A', startId: 'A', targetId: 'D',
};

describe('batch 12 independent edge-case and rejection oracles', () => {
  it('LCA returns the queried ancestor when one query node contains the other', () => {
    const final = run('Lowest Common Ancestor (LCA)', {
      kind: 'tree', text: '', graph: ancestorTree, origin: 'user',
    }).at(-1)!;
    expect(final.visualData.vars).toMatchObject({ first: 'A', second: 'D', lca: 'A' });
  });

  it('Sieve represents the lower limit as one prime node and never crosses a composite twice', () => {
    const lower = run('Sieve of Eratosthenes', { kind: 'array', text: '[2]', origin: 'user' });
    const lowerVisual = lower.at(-1)!.visualData as GraphVisualData;
    expect(lowerVisual.nodes).toHaveLength(1);
    expect(lowerVisual.nodes[0]).toMatchObject({ id: '2', state: 'visited' });
    expect(lower.at(-1)!.visualData.vars.primes).toEqual([2]);

    const fifty = run('Sieve of Eratosthenes', { kind: 'array', text: '[50]', origin: 'user' });
    const crossed = fifty
      .filter((step) => step.visualData.vars.phase === 'Sieve · cross out composite')
      .map((step) => step.visualData.vars.multiple);
    expect(new Set(crossed).size).toBe(crossed.length);
  });

  it('Fast Exponentiation normalizes a negative base into the canonical residue range', () => {
    const negative = run('Fast Exponentiation (Modular)', {
      kind: 'array', text: '[-3,3,5]', origin: 'user',
    }).at(-1)!;
    expect(negative.visualData.vars.result).toBe('3');

    const zeroExponent = run('Fast Exponentiation (Modular)', {
      kind: 'array', text: '[99,0,1]', origin: 'user',
    }).at(-1)!;
    expect(zeroExponent.visualData.vars.result).toBe('0');
  });

  it('Reverse Linked List preserves a singleton node with no fabricated edge', () => {
    const steps = run('Reverse Linked List', { kind: 'array', text: '[42]', origin: 'user' });
    const final = steps.at(-1)!;
    const visual = final.visualData as GraphVisualData;
    expect(visual.nodes).toHaveLength(1);
    expect(visual.edges).toHaveLength(0);
    expect(final.visualData.vars.previous).toBe(0);
  });

  it('cycle detection distinguishes a linear singleton from a self-loop', () => {
    const linear = run('Detect Cycle in Linked List', {
      kind: 'array', text: '[9]', parameters: { cycleEntry: '-1' }, origin: 'user',
    }).at(-1)!;
    expect(linear.visualData.vars).toMatchObject({ hasCycle: false, cycleEntry: -1 });

    const loop = run('Detect Cycle in Linked List', {
      kind: 'array', text: '[9]', parameters: { cycleEntry: '0' }, origin: 'user',
    }).at(-1)!;
    expect(loop.visualData.vars).toMatchObject({ hasCycle: true, cycleEntry: 0 });
  });

  it('rejects invalid number, list, and LCA contracts', () => {
    expect(() => run('Sieve of Eratosthenes', { kind: 'array', text: '[1]' })).toThrow(/2 to 5,000/);
    expect(() => run('Fast Exponentiation (Modular)', { kind: 'array', text: '[2,-1,5]' })).toThrow(/non-negative exponent/);
    expect(() => run('Fast Exponentiation (Modular)', { kind: 'array', text: '[2,3,0]' })).toThrow(/positive modulus/);
    expect(() => run('Detect Cycle in Linked List', {
      kind: 'array', text: '[1,2]', parameters: { cycleEntry: '2' },
    })).toThrow(/valid node index/);
    expect(() => run('Lowest Common Ancestor (LCA)', {
      kind: 'tree', text: '', graph: { ...ancestorTree, targetId: 'A' },
    })).toThrow(/distinct Start and Target/);
  });
});
