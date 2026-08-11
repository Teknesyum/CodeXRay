import { describe, expect, it } from 'vitest';
import type { ArrayVisualData, SimulationInput, StringMatchVisualData } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const run = (name: string, input: SimulationInput) => {
  const algorithm = algorithmRegistry.find((entry) => entry.name === name)!;
  return simulateAlgorithm(algorithm.name, algorithm.code, input);
};

describe('batch 05 independent edge-case and rejection oracles', () => {
  it('Z Algorithm handles the smallest valid string without inventing a nonzero box', () => {
    const steps = run('Z-Algorithm', { kind: 'string', text: 'x', origin: 'user' });
    const final = steps.at(-1)?.visualData as StringMatchVisualData;
    expect(final.vars).toMatchObject({ phase: 'Z · complete', source: 'x', z: [0] });
    expect(final.window).toEqual([0, 0]);
  });

  it('KMP reports every overlapping match and preserves the fallback-ready LPS table', () => {
    const final = run('Knuth-Morris-Pratt (KMP)', {
      kind: 'string', text: 'aaaaa', parameters: { pattern: 'aaa' }, origin: 'user',
    }).at(-1)?.visualData as StringMatchVisualData;
    expect(final.vars).toMatchObject({ lps: [0, 1, 2], matches: [0, 1, 2] });
    expect(final.matchedText).toEqual([0, 1, 2, 1, 2, 3, 2, 3, 4]);
  });

  it('Rabin-Karp exposes a real hash collision but records only the exact match', () => {
    const steps = run('Rabin-Karp Algorithm', {
      kind: 'string', text: 'cbab', parameters: { pattern: 'ab', modulus: '2' }, origin: 'user',
    });
    const collision = steps.find((step) => step.visualData.vars.phase === 'Rabin-Karp · hash collision');
    expect(collision?.visualData.vars).toMatchObject({ index: 0, hashMatches: true, exactMatch: false });
    const final = steps.at(-1)!.visualData as StringMatchVisualData;
    expect(final.vars.matches).toEqual([2]);
  });

  it('Boyer-Moore safely finishes with no comparisons when the pattern is longer than the text', () => {
    const steps = run('Boyer-Moore Algorithm', {
      kind: 'string', text: 'abc', parameters: { pattern: 'abcdef' }, origin: 'user',
    });
    expect(steps.map((step) => step.visualData.vars.phase)).toEqual([
      'Boyer-Moore · build bad-character table', 'Boyer-Moore · complete',
    ]);
    const final = steps.at(-1)!.visualData as StringMatchVisualData;
    expect(final.vars.matches).toEqual([]);
  });

  it('Kadane keeps the only negative value as the best non-empty subarray', () => {
    const final = run("Kadane's Algorithm", { kind: 'array', text: '[-5]', origin: 'user' })
      .at(-1)?.visualData as ArrayVisualData;
    expect(final.vars).toMatchObject({ best: -5, bestRange: [0, 0] });
    expect(final.pointers).toMatchObject({ bestStart: 0, bestEnd: 0 });
  });

  it('rejects empty primary input and missing/invalid search parameters', () => {
    expect(() => run('Z-Algorithm', { kind: 'string', text: '' })).toThrow(/non-empty string/);
    expect(() => run('Knuth-Morris-Pratt (KMP)', { kind: 'string', text: 'abc' })).toThrow(/Pattern is required/);
    expect(() => run('Rabin-Karp Algorithm', {
      kind: 'string', text: 'abc', parameters: { pattern: 'a', modulus: '1' },
    })).toThrow(/at least 2/);
    expect(() => run('Boyer-Moore Algorithm', { kind: 'string', text: 'abc' })).toThrow(/Pattern is required/);
    expect(() => run("Kadane's Algorithm", { kind: 'array', text: '[]' })).toThrow(/at least one number/);
  });
});
