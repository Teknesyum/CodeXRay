import { describe, expect, it } from 'vitest';
import type { ArrayVisualData, SimulationInput, StringMatchVisualData } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';
import { translateRuntimeText } from '../i18n/translations';

const run = (name: string, input: SimulationInput) => {
  const definition = algorithmRegistry.find((entry) => entry.name === name);
  if (!definition) throw new Error(`Missing ${name}`);
  return simulateAlgorithm(name, definition.code, input);
};
const assertLocalizedPhases = (steps: ReturnType<typeof run>) => {
  for (const step of steps) {
    const phase = step.visualData.vars.phase;
    if (typeof phase === 'string') expect(translateRuntimeText(phase, 'tr')).not.toBe(phase);
  }
};

describe('batch 05 pedagogical string and segment simulations', () => {
  it('Z Algorithm shows the active Z-box, prefix comparison, mirror reuse, and final Z values', () => {
    const steps = run('Z-Algorithm', { kind: 'string', text: 'aabcaabxaaaz', origin: 'user' });
    assertLocalizedPhases(steps);
    expect(steps.every((step) => step.visualData.type === 'string-match')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Z · extend prefix match')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Z · reuse mirror inside box')).toBe(true);
    const final = steps.at(-1)!.visualData as StringMatchVisualData;
    expect(final.vars.z).toEqual([0, 1, 0, 0, 3, 1, 0, 0, 2, 2, 1, 0]);
  });

  it('KMP builds LPS visibly and falls back without rewinding the text pointer', () => {
    const steps = run('Knuth-Morris-Pratt (KMP)', {
      kind: 'string', text: 'ABABDABACDABABCABAB', parameters: { pattern: 'ABABCABAB' }, origin: 'user',
    });
    assertLocalizedPhases(steps);
    expect(steps.every((step) => step.visualData.type === 'string-match')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'KMP · LPS fallback')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'KMP · search fallback')).toBe(true);
    const final = steps.at(-1)!.visualData as StringMatchVisualData;
    expect(final.vars.lps).toEqual([0, 0, 1, 2, 0, 1, 2, 3, 4]);
    expect(final.vars.matches).toEqual([10]);
    expect(final.matchedText).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it('Rabin-Karp shows aligned windows, rolling hash removal/addition, and exact verification', () => {
    const steps = run('Rabin-Karp Algorithm', {
      kind: 'string', text: 'AABAACAADAABAABA', parameters: { pattern: 'AABA', modulus: '101' }, origin: 'user',
    });
    assertLocalizedPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'Rabin-Karp · roll window hash')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Rabin-Karp · verify exact match')).toBe(true);
    const final = steps.at(-1)!.visualData as StringMatchVisualData;
    expect(final.vars.matches).toEqual([0, 9, 12]);
    expect(final.matchedText).toEqual(expect.arrayContaining([0, 3, 9, 12, 15]));
  });

  it('Boyer-Moore compares right-to-left and records the bad-character jump', () => {
    const steps = run('Boyer-Moore Algorithm', {
      kind: 'string', text: 'HERE IS A SIMPLE EXAMPLE', parameters: { pattern: 'EXAMPLE' }, origin: 'user',
    });
    assertLocalizedPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'Boyer-Moore · compare right-to-left')).toBe(true);
    const shift = steps.find((step) => step.visualData.vars.phase === 'Boyer-Moore · bad-character shift');
    expect(shift?.visualData.vars.jump).toEqual(expect.any(Number));
    expect((steps.at(-1)!.visualData as StringMatchVisualData).vars.matches).toEqual([17]);
  });

  it('Kadane separates current and best ranges and explains restart versus extend', () => {
    const steps = run("Kadane's Algorithm", { kind: 'array', text: '-2,1,-3,4,-1,2,1,-5,4', origin: 'user' });
    assertLocalizedPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'Kadane · choose extend or restart'
      && typeof step.visualData.vars.decision === 'string')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Kadane · update best segment')).toBe(true);
    const final = steps.at(-1)!.visualData as ArrayVisualData;
    expect(final.vars.best).toBe(6);
    expect(final.vars.bestRange).toEqual([3, 6]);
    expect(final.pointers).toMatchObject({ bestStart: 3, bestEnd: 6 });
  });
});
