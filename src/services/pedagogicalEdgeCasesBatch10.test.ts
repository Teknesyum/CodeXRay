import { describe, expect, it } from 'vitest';
import type { MatrixVisualData, SimulationInput } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const run = (name: string, input: SimulationInput) => {
  const algorithm = algorithmRegistry.find((entry) => entry.name === name)!;
  return simulateAlgorithm(algorithm.name, algorithm.code, input);
};

describe('batch 10 independent edge-case and rejection oracles', () => {
  it('0/1 Knapsack handles zero capacity and includes a zero-weight item only once', () => {
    const final = run('0/1 Knapsack', {
      kind: 'array', text: '[0,2]', parameters: { values: '[5,3]', capacity: '0' }, origin: 'user',
    }).at(-1)!;
    expect(final.visualData.vars).toMatchObject({ maxValue: 5, capacity: 0 });
  });

  it('LCS treats a Unicode code point as one labeled table cell', () => {
    const steps = run('Longest Common Subsequence', {
      kind: 'string', text: 'A😀B', parameters: { other: '😀' }, origin: 'user',
    });
    const visual = steps.at(-1)!.visualData as MatrixVisualData;
    expect(visual.rowLabels).toEqual(['∅', 'A', '😀', 'B']);
    expect(visual.columnLabels).toEqual(['∅', '😀']);
    expect(steps.at(-1)!.visualData.vars).toMatchObject({ subsequence: '😀', length: 1 });
  });

  it('LIS reconstructs a valid length-one answer for a strictly decreasing input', () => {
    const final = run('Longest Increasing Subsequence', {
      kind: 'array', text: '[5,4,3]', origin: 'user',
    }).at(-1)!;
    expect(final.visualData.vars).toMatchObject({ length: 1, sequence: [5], sequenceIndices: [0] });
  });

  it('Matrix Chain presents a single matrix as a zero-cost base case', () => {
    const steps = run('Matrix Chain Multiplication', {
      kind: 'array', text: '[7,11]', origin: 'user',
    });
    expect(steps.map((step) => step.visualData.vars.phase)).toEqual([
      'Matrix Chain · initialize diagonal', 'Matrix Chain · complete',
    ]);
    expect(steps.at(-1)!.visualData.vars).toMatchObject({ minimumCost: 0, parenthesization: 'A1' });
  });

  it('Edit Distance treats emoji as one symbol and emits one replacement', () => {
    const steps = run('Edit Distance', {
      kind: 'string', text: '😀', parameters: { other: '😃' }, origin: 'user',
    });
    const visual = steps.at(-1)!.visualData as MatrixVisualData;
    expect(visual.rowLabels).toEqual(['∅', '😀']);
    expect(visual.columnLabels).toEqual(['∅', '😃']);
    expect(steps.at(-1)!.visualData.vars).toMatchObject({ distance: 1, editScript: ['replace 😀→😃'] });
  });

  it('rejects malformed DP contracts before simulation', () => {
    expect(() => run('0/1 Knapsack', {
      kind: 'array', text: '[1,2]', parameters: { values: '[3]', capacity: '2' },
    })).toThrow(/same length/);
    expect(() => run('0/1 Knapsack', {
      kind: 'array', text: '[1,-2]', parameters: { values: '[3,4]', capacity: '2' },
    })).toThrow(/non-negative integers/);
    expect(() => run('Longest Common Subsequence', { kind: 'string', text: 'ABC' })).toThrow(/Second text is required/);
    expect(() => run('Edit Distance', { kind: 'string', text: 'ABC' })).toThrow(/Second text is required/);
    expect(() => run('Matrix Chain Multiplication', { kind: 'array', text: '[7]' })).toThrow(/2–30 positive integer dimensions/);
    expect(() => run('Matrix Chain Multiplication', { kind: 'array', text: '[7,0]' })).toThrow(/2–30 positive integer dimensions/);
  });
});
