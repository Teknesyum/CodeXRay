import { describe, expect, it } from 'vitest';
import type { ArrayVisualData, BarVisualData, IntervalVisualData, SimulationInput, StringMatchVisualData } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const run = (name: string, input: SimulationInput) => {
  const algorithm = algorithmRegistry.find((entry) => entry.name === name)!;
  return simulateAlgorithm(algorithm.name, algorithm.code, input);
};

describe('batch 07 independent edge-case and rejection oracles', () => {
  it('Dutch National Flag leaves an all-one partition stable with an empty unknown region', () => {
    const final = run('Dutch National Flag', { kind: 'array', text: '[1,1,1]', origin: 'user' })
      .at(-1)?.visualData as ArrayVisualData;
    expect(final.values).toEqual([1, 1, 1]);
    expect(final.vars.result).toEqual([1, 1, 1]);
  });

  it('Moore verification explicitly rejects a surviving candidate without a strict majority', () => {
    const final = run("Moore's Voting Algorithm", { kind: 'array', text: '[1,2,3,4]', origin: 'user' }).at(-1)!;
    expect((final.visualData as ArrayVisualData).vars).toMatchObject({ candidate: 3, occurrences: 1, hasMajority: false });
    expect(final.explanation).toBe('No strict majority value exists.');
  });

  it('Minimum Window uses Unicode code-point indices and returns no window when requirements are absent', () => {
    const unicode = run('Minimum Window Substring', {
      kind: 'string', text: 'a😀b😀c', parameters: { target: '😀c' }, origin: 'user',
    }).at(-1)?.visualData as StringMatchVisualData;
    expect(unicode.vars).toMatchObject({ window: '😀c', start: 3 });
    expect(unicode.matchedText).toEqual([3, 4]);

    const missing = run('Minimum Window Substring', {
      kind: 'string', text: 'abc', parameters: { target: 'z' }, origin: 'user',
    }).at(-1)?.visualData as StringMatchVisualData;
    expect(missing.vars).toMatchObject({ window: '', start: -1 });
    expect(missing.matchedText).toEqual([]);
  });

  it('monotone bars trap no water and render an all-zero fill layer', () => {
    const final = run('Trapping Rain Water', { kind: 'array', text: '[1,2,3,4]', origin: 'user' })
      .at(-1)?.visualData as BarVisualData;
    expect(final.vars.water).toBe(0);
    expect(final.water).toEqual([0, 0, 0, 0]);
  });

  it('Merge Intervals normalizes reversed endpoints and merges touching/nested spans', () => {
    const final = run('Merge Intervals', {
      kind: 'array', text: '[5,1,2,3,3,4,8,8]', origin: 'user',
    }).at(-1)?.visualData as IntervalVisualData;
    expect(final.intervals).toEqual([[1, 5], [2, 3], [3, 4], [8, 8]]);
    expect(final.merged).toEqual([[1, 5], [8, 8]]);
  });

  it('rejects invalid flag values, empty arrays, missing targets, negative bars, and odd interval arity', () => {
    expect(() => run('Dutch National Flag', { kind: 'array', text: '[0,3,1]' })).toThrow(/only 0, 1, and 2/);
    expect(() => run("Moore's Voting Algorithm", { kind: 'array', text: '[]' })).toThrow(/at least one number/);
    expect(() => run('Minimum Window Substring', { kind: 'string', text: 'abc' })).toThrow(/Target text is required/);
    expect(() => run('Trapping Rain Water', { kind: 'array', text: '[1,-1,2]' })).toThrow(/non-negative/);
    expect(() => run('Merge Intervals', { kind: 'array', text: '[1,2,3]' })).toThrow(/even number/);
  });
});
