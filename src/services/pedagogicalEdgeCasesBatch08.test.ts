import { describe, expect, it } from 'vitest';
import type { ArrayVisualData, RowsVisualData, SimulationInput } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const run = (name: string, input: SimulationInput) => {
  const algorithm = algorithmRegistry.find((entry) => entry.name === name)!;
  return simulateAlgorithm(algorithm.name, algorithm.code, input);
};

describe('batch 08 independent edge-case and rejection oracles', () => {
  it('Quick Sort terminates duplicate-only partitions and marks its one-value base case', () => {
    const steps = run('Quick Sort', { kind: 'array', text: '[2,2,2]', origin: 'user' });
    expect((steps.at(-1)!.visualData as ArrayVisualData).values).toEqual([2, 2, 2]);
    expect(steps.some((step) => step.visualData.vars.phase === 'Quick Sort · base case range')).toBe(true);
    expect(steps.length).toBeLessThan(20);
  });

  it('Merge Sort represents a singleton as a split-tree leaf before completion', () => {
    const steps = run('Merge Sort', { kind: 'array', text: '[9]', origin: 'user' });
    const leaf = steps.find((step) => step.visualData.vars.phase === 'Merge Sort · reach split-tree leaf');
    expect((leaf!.visualData as RowsVisualData).rows).toEqual([{ label: 'split depth 0', values: ['0–0: [9]'] }]);
    expect((steps.at(-1)!.visualData as ArrayVisualData).values).toEqual([9]);
  });

  it('Binary Search grounds both deterministic duplicate discovery and an exhausted no-result range', () => {
    const duplicate = run('Binary Search', {
      kind: 'array', text: '[1,2,2,2,3]', parameters: { target: '2' }, origin: 'user',
    }).at(-1)!;
    expect(duplicate.visualData.vars).toMatchObject({ found: true, foundIndex: 2 });

    const missing = run('Binary Search', {
      kind: 'array', text: '[1,3,5]', parameters: { target: '4' }, origin: 'user',
    }).at(-1)!;
    expect(missing.visualData.vars).toMatchObject({ found: false, foundIndex: -1, activeRange: [2, 1] });
  });

  it('Heap Sort emits an initial heap view even for one element', () => {
    const steps = run('Heap Sort', { kind: 'array', text: '[5]', origin: 'user' });
    const initial = steps[0].visualData as RowsVisualData;
    expect(initial).toMatchObject({ type: 'rows', mode: 'heap', vars: { phase: 'Heap Sort · initialize heap view', heapSize: 1 } });
    expect(initial.rows).toEqual([{ label: 'array', values: [5] }, { label: 'L0', values: [5] }]);
    expect((steps.at(-1)!.visualData as ArrayVisualData).values).toEqual([5]);
  });

  it('Radix Sort explains the zero-digit boundary without inventing a distribution pass', () => {
    const steps = run('Radix Sort', { kind: 'array', text: '[0,0]', origin: 'user' });
    expect(steps[0].visualData).toMatchObject({
      type: 'rows', mode: 'buckets', vars: { phase: 'Radix Sort · initialize digit buckets' },
    });
    expect(steps.some((step) => step.visualData.vars.phase === 'Radix Sort · distribute by digit')).toBe(false);
    expect((steps.at(-1)!.visualData as ArrayVisualData).values).toEqual([0, 0]);
  });

  it('rejects empty sort inputs, unsorted binary-search input, and invalid radix domains', () => {
    for (const name of ['Quick Sort', 'Merge Sort', 'Heap Sort']) {
      expect(() => run(name, { kind: 'array', text: '[]' }), name).toThrow(/at least one number/);
    }
    expect(() => run('Binary Search', {
      kind: 'array', text: '[2,1]', parameters: { target: '1' },
    })).toThrow(/sorted in non-decreasing order/);
    expect(() => run('Radix Sort', { kind: 'array', text: '[1,-1]' })).toThrow(/non-negative safe integers/);
    expect(() => run('Radix Sort', { kind: 'array', text: '[1,1.5]' })).toThrow(/non-negative safe integers/);
  });
});
