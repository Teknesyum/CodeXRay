import { describe, expect, it } from 'vitest';
import type { ArrayVisualData, GraphVisualData, RowsVisualData, SimulationInput, StringMatchVisualData } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const run = (name: string, input: SimulationInput) => {
  const algorithm = algorithmRegistry.find((entry) => entry.name === name)!;
  return simulateAlgorithm(algorithm.name, algorithm.code, input);
};

describe('batch 06 independent edge-case and rejection oracles', () => {
  it('Sliding Window with width one emits every source value as its own maximum', () => {
    const final = run('Sliding Window Maximum', {
      kind: 'array', text: '[4,-2,7]', parameters: { windowSize: '1' }, origin: 'user',
    }).at(-1)?.visualData as ArrayVisualData;
    expect(final.vars).toMatchObject({ windowSize: 1, maxima: [4, -2, 7] });
  });

  it('Manacher treats astral Unicode symbols as characters rather than split surrogate halves', () => {
    const final = run("Longest Palindromic Substring (Manacher's)", {
      kind: 'string', text: 'x😀a😀x', origin: 'user',
    }).at(-1)?.visualData as StringMatchVisualData;
    expect(final.vars).toMatchObject({ palindrome: 'x😀a😀x', start: 0, length: 5 });
    expect(Array.from(final.text)).toContain('😀');
  });

  it('Trie follows Unicode code points and keeps a literal word "root" distinct from its root sentinel', () => {
    const unicodeFinal = run('Trie Insert & Search', {
      kind: 'string', text: '😀,😀a', parameters: { query: '😀a' }, origin: 'user',
    }).at(-1)?.visualData as GraphVisualData;
    expect(unicodeFinal.vars.found).toBe(true);
    expect(unicodeFinal.vars.activePath).toEqual(['root', '😀', '😀a']);

    const rootWord = run('Trie Insert & Search', {
      kind: 'string', text: 'root,route', parameters: { query: 'root' }, origin: 'user',
    }).at(-1)?.visualData as GraphVisualData;
    expect(rootWord.vars.found).toBe(true);
    expect(rootWord.nodes.filter((node) => node.id === 'root')).toHaveLength(1);
    expect(rootWord.nodes.find((node) => node.id === 'prefix:root')?.semanticRoles).toContain('terminal word');
  });

  it('Two Pointers grounds the no-pair result after the search range converges', () => {
    const final = run('Two Pointers Technique', {
      kind: 'array', text: '[1,2,4,8]', parameters: { target: '20' }, origin: 'user',
    }).at(-1)?.visualData as ArrayVisualData;
    expect(final.vars).toMatchObject({ found: false, pair: [], target: 20 });
    expect(final.pointers).toBeDefined();
    expect(final.pointers!.left).toBe(final.pointers!.right);
  });

  it('Prefix Sum handles a single cell and answers the only valid range without subtraction', () => {
    const final = run('Prefix Sum Array', { kind: 'array', text: '[7]', origin: 'user' })
      .at(-1)?.visualData as RowsVisualData;
    expect(final.rows).toEqual([
      { label: 'source', values: [7] }, { label: 'prefix', values: [7] },
    ]);
    expect(final.vars).toMatchObject({ queryRange: [0, 0], rangeSum: 7 });
  });

  it('rejects out-of-range windows, empty text/arrays, and missing numeric/query parameters', () => {
    expect(() => run('Sliding Window Maximum', {
      kind: 'array', text: '[1,2]', parameters: { windowSize: '3' },
    })).toThrow(/cannot exceed/);
    expect(() => run("Longest Palindromic Substring (Manacher's)", { kind: 'string', text: '' }))
      .toThrow(/non-empty string/);
    expect(() => run('Trie Insert & Search', { kind: 'string', text: 'cat' })).toThrow(/Search query is required/);
    expect(() => run('Two Pointers Technique', { kind: 'array', text: '[1,2]' })).toThrow(/Target is required/);
    expect(() => run('Prefix Sum Array', { kind: 'array', text: '[]' })).toThrow(/at least one number/);
  });
});
