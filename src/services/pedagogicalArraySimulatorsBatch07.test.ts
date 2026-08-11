import { describe, expect, it } from 'vitest';
import type { ArrayVisualData, BarVisualData, IntervalVisualData, SimulationInput, StringMatchVisualData } from '../types/simulation';
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
    if (typeof phase === 'string') {
      expect(translateRuntimeText(phase, 'tr')).not.toBe(phase);
      expect(step.lineNumber).not.toBeNull();
    }
  }
};

describe('batch 07 pedagogical array/window simulations', () => {
  it('Dutch National Flag exposes low/mid/high regions and the action for each value', () => {
    const steps = run('Dutch National Flag', { kind: 'array', text: '2,0,2,1,1,0', origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'Dutch Flag · classify current value'
      && typeof step.visualData.vars.action === 'string')).toBe(true);
    const final = steps.at(-1)!.visualData as ArrayVisualData;
    expect(final.values).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('Moore Voting shows candidate resets, cancellation, and a real verification pass', () => {
    const steps = run("Moore's Voting Algorithm", { kind: 'array', text: '2,2,1,1,1,2,2', origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'Moore · cancel pair')).toBe(true);
    expect(steps.filter((step) => step.visualData.vars.phase === 'Moore · verify candidate')).toHaveLength(7);
    const final = steps.at(-1)!.visualData as ArrayVisualData;
    expect(final.vars).toMatchObject({ candidate: 2, occurrences: 4, hasMajority: true });
  });

  it('Minimum Window expands, contracts, updates best, and highlights the final substring', () => {
    const steps = run('Minimum Window Substring', { kind: 'string', text: 'ADOBECODEBANC', parameters: { target: 'ABC' }, origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'Minimum Window · expand right')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Minimum Window · contract left')).toBe(true);
    const final = steps.at(-1)!.visualData as StringMatchVisualData;
    expect(final.vars).toMatchObject({ window: 'BANC', start: 9 });
    expect(final.matchedText).toEqual([9, 10, 11, 12]);
  });

  it('Trapping Rain Water uses bar heights plus visible per-column water fill', () => {
    const steps = run('Trapping Rain Water', { kind: 'array', text: '0,1,0,2,1,0,1,3,2,1,2,1', origin: 'user' });
    assertPhases(steps);
    expect(steps.every((step) => step.visualData.type === 'bars')).toBe(true);
    const final = steps.at(-1)!.visualData as BarVisualData;
    expect(final.vars.water).toBe(6);
    expect(final.water.reduce((sum, value) => sum + value, 0)).toBe(6);
    expect(final.water).toEqual([0, 0, 1, 0, 1, 2, 1, 0, 0, 1, 0, 0]);
  });

  it('Merge Intervals renders original and merged spans on a number line', () => {
    const steps = run('Merge Intervals', { kind: 'array', text: '1,3,2,6,8,10,15,18', origin: 'user' });
    assertPhases(steps);
    expect(steps.every((step) => step.visualData.type === 'intervals')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Merge Intervals · merge overlap')).toBe(true);
    const final = steps.at(-1)!.visualData as IntervalVisualData;
    expect(final.merged).toEqual([[1, 6], [8, 10], [15, 18]]);
  });
});
