import { describe, expect, it } from 'vitest';
import type { ArrayVisualData, RowsVisualData, SimulationInput } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';
import { translateRuntimeText } from '../i18n/translations';

const run = (name: string, input: SimulationInput) => {
  const definition = algorithmRegistry.find((entry) => entry.name === name);
  if (!definition) throw new Error(`Missing ${name}`);
  return simulateAlgorithm(name, definition.code, input);
};
const assertPhases = (steps: ReturnType<typeof run>) => {
  for (const step of steps) {
    const phase = step.visualData.vars.phase;
    if (typeof phase === 'string') expect(translateRuntimeText(phase, 'tr')).not.toBe(phase);
  }
};

describe('batch 08 pedagogical sort/search simulations', () => {
  it('Quick Sort keeps the recursive range, pivot, scan, partitions, and settled pivots explicit', () => {
    const steps = run('Quick Sort', { kind: 'array', text: '10,7,8,9,1,5', origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'Quick Sort · choose pivot range')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Quick Sort · scan partition')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Quick Sort · settle pivot')).toBe(true);
    expect((steps.at(-1)!.visualData as ArrayVisualData).values).toEqual([1, 5, 7, 8, 9, 10]);
  });

  it('Merge Sort shows output plus separate left/right buffers and dependency cells', () => {
    const steps = run('Merge Sort', { kind: 'array', text: '38,27,43,3,9,82,10', origin: 'user' });
    assertPhases(steps);
    const splitTree = steps.find((step) => step.visualData.vars.phase === 'Merge Sort · grow split tree');
    expect(splitTree?.visualData.type).toBe('rows');
    expect((splitTree!.visualData as RowsVisualData).rows[0].label).toBe('split depth 0');
    const compare = steps.find((step) => step.visualData.vars.phase === 'Merge Sort · compare buffer fronts');
    expect(compare?.visualData.type).toBe('rows');
    const rows = compare!.visualData as RowsVisualData;
    expect(rows.rows.map((row) => row.label)).toEqual(['output', 'left', 'right']);
    expect(rows.active?.some((cell) => cell.role === 'dependency')).toBe(true);
    expect((steps.at(-1)!.visualData as ArrayVisualData).values).toEqual([3, 9, 10, 27, 38, 43, 82]);
  });

  it('Binary Search exposes the active range, midpoint, and discarded-half decision', () => {
    const steps = run('Binary Search', { kind: 'array', text: '1,3,5,7,9,11', parameters: { target: '9' }, origin: 'user' });
    assertPhases(steps);
    const inspect = steps.filter((step) => step.visualData.vars.phase === 'Binary Search · inspect midpoint');
    expect(inspect.length).toBeGreaterThan(1);
    expect(inspect.every((step) => Array.isArray(step.visualData.vars.activeRange))).toBe(true);
    expect(steps.at(-1)!.visualData.vars).toMatchObject({ found: true, foundIndex: 4 });
  });

  it('Heap Sort synchronizes array values with heap levels during heapify and extraction', () => {
    const steps = run('Heap Sort', { kind: 'array', text: '4,10,3,5,1', origin: 'user' });
    assertPhases(steps);
    const heapify = steps.find((step) => step.visualData.vars.phase === 'Heap Sort · compare parent and children');
    expect(heapify?.visualData.type).toBe('rows');
    const rows = heapify!.visualData as RowsVisualData;
    expect(rows.mode).toBe('heap');
    expect(rows.rows.map((row) => row.label)).toEqual(expect.arrayContaining(['array', 'L0', 'L1']));
    expect(steps.some((step) => step.visualData.vars.phase === 'Heap Sort · extract maximum')).toBe(true);
    expect((steps.at(-1)!.visualData as ArrayVisualData).values).toEqual([1, 3, 4, 5, 10]);
  });

  it('Radix Sort shows all ten buckets and stable collection for each digit pass', () => {
    const steps = run('Radix Sort', { kind: 'array', text: '170,45,75,90,802,24,2,66', origin: 'user' });
    assertPhases(steps);
    const distribute = steps.find((step) => step.visualData.vars.phase === 'Radix Sort · distribute by digit');
    expect(distribute?.visualData.type).toBe('rows');
    expect((distribute!.visualData as RowsVisualData).rows).toHaveLength(11);
    expect(steps.filter((step) => step.visualData.vars.phase === 'Radix Sort · stable bucket collection')).toHaveLength(3);
    expect((steps.at(-1)!.visualData as ArrayVisualData).values).toEqual([2, 24, 45, 66, 75, 90, 170, 802]);
  });
});
