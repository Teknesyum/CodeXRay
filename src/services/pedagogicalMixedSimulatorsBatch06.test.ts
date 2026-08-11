import { describe, expect, it } from 'vitest';
import type { ArrayVisualData, GraphVisualData, RowsVisualData, SimulationInput, StringMatchVisualData } from '../types/simulation';
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

describe('batch 06 pedagogical simulations', () => {
  it('Sliding Window Maximum shows expiry, domination, window bounds, deque, and maxima', () => {
    const steps = run('Sliding Window Maximum', { kind: 'array', text: '1,3,-1,-3,5,3,6,7', parameters: { windowSize: '3' }, origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'Sliding Window · expire front')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Sliding Window · remove dominated back')).toBe(true);
    const final = steps.at(-1)!.visualData as ArrayVisualData;
    expect(final.vars.maxima).toEqual([3, 3, 5, 5, 6, 7]);
  });

  it('Manacher shows the transformed string, mirror reuse, radius expansion, and best palindrome', () => {
    const steps = run("Longest Palindromic Substring (Manacher's)", { kind: 'string', text: 'forgeeksskeegfor', origin: 'user' });
    assertPhases(steps);
    expect(steps.every((step) => step.visualData.type === 'string-match')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Manacher · reuse mirror radius')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Manacher · expand radius')).toBe(true);
    const final = steps.at(-1)!.visualData as StringMatchVisualData;
    expect(final.vars.palindrome).toBe('geeksskeeg');
    expect(final.matchedText?.length).toBeGreaterThan(0);
  });

  it('Trie creates real prefix nodes character-by-character and follows the exact query path', () => {
    const steps = run('Trie Insert & Search', { kind: 'string', text: 'car,card,cat', parameters: { query: 'card' }, origin: 'user' });
    assertPhases(steps);
    expect(steps.every((step) => step.visualData.type === 'graph')).toBe(true);
    const final = steps.at(-1)!.visualData as GraphVisualData;
    expect(final.nodes.map((node) => node.id)).toEqual(expect.arrayContaining(['root', 'c', 'ca', 'car', 'card', 'cat']));
    expect(final.nodes.find((node) => node.id === 'card')?.semanticRoles).toContain('terminal word');
    expect(final.nodes.filter((node) => node.state === 'path').map((node) => node.id))
      .toEqual(expect.arrayContaining(['root', 'c', 'ca', 'car']));
    expect(final.vars.found).toBe(true);
  });

  it('Two Pointers keeps original indices and states why left or right moves', () => {
    const steps = run('Two Pointers Technique', { kind: 'array', text: '11,2,7,15', parameters: { target: '9' }, origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => typeof step.visualData.vars.decision === 'string')).toBe(true);
    const final = steps.at(-1)!.visualData as ArrayVisualData;
    expect(final.vars.pair).toEqual([1, 2]);
    expect(final.vars.originalIndices).toEqual([1, 2, 0, 3]);
  });

  it('Prefix Sum shows the source dependency and accumulated prefix row at every index', () => {
    const steps = run('Prefix Sum Array', { kind: 'array', text: '3,1,4,1,5', origin: 'user' });
    assertPhases(steps);
    const dependency = steps.find((step) => step.visualData.vars.phase === 'Prefix Sum · accumulate dependency');
    expect(dependency?.visualData.vars.dependency).toEqual([0, 1]);
    expect(dependency?.visualData.type).toBe('rows');
    const range = steps.find((step) => step.visualData.vars.phase === 'Prefix Sum · answer range query');
    expect(range?.visualData.vars).toMatchObject({ queryRange: [1, 4], rangeSum: 11 });
    const final = steps.at(-1)!.visualData as RowsVisualData;
    expect(final.rows[1].values).toEqual([3, 4, 8, 9, 14]);
    expect(final.vars.source).toEqual([3, 1, 4, 1, 5]);
  });
});
