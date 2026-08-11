import { describe, expect, it } from 'vitest';
import type { ArrayVisualData, RowsVisualData, SimulationInput } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const run = (name: string, input: SimulationInput) => {
  const algorithm = algorithmRegistry.find((entry) => entry.name === name)!;
  return simulateAlgorithm(algorithm.name, algorithm.code, input);
};

describe('batch 09 independent edge-case and rejection oracles', () => {
  it('Counting Sort handles a singleton negative domain and still shows frequency/output rows', () => {
    const steps = run('Counting Sort', { kind: 'array', text: '[-2]', origin: 'user' });
    const count = steps.find((step) => step.visualData.vars.phase === 'Counting Sort · count frequency')
      ?.visualData as RowsVisualData;
    expect(count.rows).toEqual([
      { label: 'input', values: [-2] }, { label: 'domain', values: [-2] }, { label: 'frequency', values: [1] },
    ]);
    expect((steps.at(-1)!.visualData as ArrayVisualData).values).toEqual([-2]);
  });

  it.each([
    ['Bubble Sort', 'Bubble Sort · initialize unsettled array'],
    ['Insertion Sort', 'Insertion Sort · initialize sorted prefix'],
    ['Selection Sort', 'Selection Sort · initialize unsorted range'],
  ] as const)('%s explicitly initializes and completes a singleton boundary input', (name, phase) => {
    const steps = run(name, { kind: 'array', text: '[7]', origin: 'user' });
    expect(steps[0].visualData.vars.phase).toBe(phase);
    expect((steps.at(-1)!.visualData as ArrayVisualData).values).toEqual([7]);
    expect(steps.at(-1)!.visualData.vars).toMatchObject({ phase: 'Sorting · complete', comparisons: 0 });
  });

  it('Ternary Search grounds present and absent results on a one-value range', () => {
    const found = run('Ternary Search', {
      kind: 'array', text: '[5]', parameters: { target: '5' }, origin: 'user',
    }).at(-1)!;
    expect(found.visualData.vars).toMatchObject({ found: true, foundIndex: 0 });

    const missing = run('Ternary Search', {
      kind: 'array', text: '[5]', parameters: { target: '4' }, origin: 'user',
    }).at(-1)!;
    expect(missing.visualData.vars).toMatchObject({ found: false, foundIndex: -1, activeRange: [0, -1] });
  });

  it('rejects invalid counting domains, empty elementary sorts, and unsorted/missing ternary input', () => {
    expect(() => run('Counting Sort', { kind: 'array', text: '[0,10001]' })).toThrow(/range must not exceed 10,000/);
    expect(() => run('Counting Sort', { kind: 'array', text: '[1,1.5]' })).toThrow(/integer values/);
    for (const name of ['Bubble Sort', 'Insertion Sort', 'Selection Sort']) {
      expect(() => run(name, { kind: 'array', text: '[]' }), name).toThrow(/at least one number/);
    }
    expect(() => run('Ternary Search', {
      kind: 'array', text: '[2,1]', parameters: { target: '1' },
    })).toThrow(/sorted in non-decreasing order/);
    expect(() => run('Ternary Search', { kind: 'array', text: '[1,2]' })).toThrow(/Target is required/);
  });
});
