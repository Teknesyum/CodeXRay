import { describe, expect, it } from 'vitest';
import type { ArrayVisualData, RowsVisualData, SimulationInput } from '../types/simulation';
import { translateRuntimeText } from '../i18n/translations';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

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

describe('batch 09 pedagogical sort/search simulations', () => {
  it('Counting Sort exposes frequency, cumulative positions, and stable output placement', () => {
    const steps = run('Counting Sort', { kind: 'array', text: '4,2,2,8,3,3,1', origin: 'user' });
    assertPhases(steps);
    const stable = steps.find((step) => step.visualData.vars.phase === 'Counting Sort · stable output placement');
    expect(stable?.visualData.type).toBe('rows');
    expect((stable!.visualData as RowsVisualData).rows.map((row) => row.label)).toEqual(['input', 'domain', 'next position', 'output']);
    expect(steps.some((step) => step.visualData.vars.phase === 'Counting Sort · accumulate positions')).toBe(true);
    expect((steps.at(-1)!.visualData as ArrayVisualData).values).toEqual([1, 2, 2, 3, 3, 4, 8]);
  });

  it('Bubble Sort distinguishes comparisons, inversions, and the settled suffix', () => {
    const steps = run('Bubble Sort', { kind: 'array', text: '5,1,4,2,8', origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'Bubble Sort · compare adjacent pair')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Bubble Sort · swap inversion')).toBe(true);
    expect(steps.some((step) => typeof step.visualData.vars.settledSuffixStart === 'number')).toBe(true);
  });

  it('Insertion Sort keeps the lifted key, shifting gap, and sorted prefix visible', () => {
    const steps = run('Insertion Sort', { kind: 'array', text: '5,2,4,6,1,3', origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'Insertion Sort · lift key')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Insertion Sort · shift right')).toBe(true);
    expect(steps.some((step) => typeof step.visualData.vars.insertionGap === 'number')).toBe(true);
  });

  it('Selection Sort shows the current minimum scan before placing it', () => {
    const steps = run('Selection Sort', { kind: 'array', text: '64,25,12,22,11', origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'Selection Sort · start unsorted scan')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Selection Sort · compare current minimum')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Selection Sort · place minimum')).toBe(true);
  });

  it('Ternary Search exposes both pivots and the discarded-region decision', () => {
    const steps = run('Ternary Search', { kind: 'array', text: '1,3,5,7,9,11,13,15', parameters: { target: '13' }, origin: 'user' });
    assertPhases(steps);
    const inspect = steps.find((step) => step.visualData.vars.phase === 'Ternary Search · inspect two pivots');
    expect(inspect?.visualData.vars.decision).toEqual(expect.any(String));
    if (!inspect || inspect.visualData.type !== 'array') throw new Error('Missing ternary inspection array step');
    expect(inspect.visualData.pointers).toMatchObject({ left: 0, middle1: 2, middle2: 5, right: 7 });
    expect(steps.at(-1)!.visualData.vars).toMatchObject({ found: true, foundIndex: 6 });
  });
});
