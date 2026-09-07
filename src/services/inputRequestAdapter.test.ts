import { describe, expect, it } from 'vitest';
import { adaptSimulationInputFromRequest, isUnderstoodInputAdaptation } from './inputRequestAdapter';

describe('natural-language input adaptation', () => {
  it('creates a rectangular 8 by 15 matrix for a matrix simulation', () => {
    const input = adaptSimulationInputFromRequest({
      request: 'gridi 8*15 yap',
      current: { kind: 'array', text: '[[1,2],[3,4]]', origin: 'user' },
      kind: 'array',
      algorithmName: 'Spiral Matrix',
      activeProgramId: 'spiral_matrix',
    });
    const matrix = JSON.parse(input.text) as number[][];
    expect(matrix).toHaveLength(8);
    expect(matrix.every((row) => row.length === 15)).toBe(true);
    expect(matrix.at(-1)?.at(-1)).toBe(120);
  });

  it('expands a flat array instead of reusing the same input', () => {
    const input = adaptSimulationInputFromRequest({
      request: 'inputu genişlet',
      current: { kind: 'array', text: '[2,3,1,1,4]', origin: 'user' },
      kind: 'array',
      algorithmName: 'Jump Game',
      activeProgramId: 'jump_game_dp',
    });
    expect(JSON.parse(input.text)).toHaveLength(8);
    expect((JSON.parse(input.text) as number[]).every((value) => value >= 0)).toBe(true);
  });

  it('chooses a fresh deterministic teaching preset for a vague edit request', () => {
    const input = adaptSimulationInputFromRequest({
      request: 'inputu düzenle',
      current: { kind: 'array', text: '[1,2,3]', origin: 'user' },
      kind: 'array',
      algorithmName: 'Binary Search',
    });
    expect(input.text).not.toBe('[1,2,3]');
  });

  it('does not silently rewrite explicit values that violate a program contract', () => {
    const input = adaptSimulationInputFromRequest({
      request: 'inputu [-1,2,3] yap',
      current: { kind: 'array', text: '[2,3,1]', origin: 'user' },
      kind: 'array', algorithmName: 'Jump Game', activeProgramId: 'jump_game_dp',
    });
    expect(input.text).toBe('[-1,2,3]');
  });

  it('replaces a matrix input when the edit command has no dimensions', () => {
    const input = adaptSimulationInputFromRequest({
      request: 'inputu düzenle',
      current: { kind: 'array', text: '[[1,2],[3,4]]', origin: 'user' },
      kind: 'array', algorithmName: 'Spiral Matrix', activeProgramId: 'spiral_matrix',
    });
    expect(input.text).toBe('[[11,12],[13,14]]');
  });

  it('doubles array complexity while preserving the active program contract', () => {
    const input = adaptSimulationInputFromRequest({
      request: 'inputumuzu 2 kat karmaşıklaştır',
      current: { kind: 'array', text: '[2,3,1,4]', origin: 'user' },
      kind: 'array', algorithmName: 'Jump Game', activeProgramId: 'jump_game_dp',
    });
    const values = JSON.parse(input.text) as number[];
    expect(values).toHaveLength(8);
    expect(values.every((value) => value >= 0)).toBe(true);
  });
});

describe('unrecognised input adaptation', () => {
  const current = { kind: 'array' as const, text: '[9, 4, 7, 1, 3]', origin: 'user' as const };

  it.each([
    'diziyi karıştır',
    'sort the array',
    'diziyi ters çevir',
    'make it interesting',
  ])('reports %s as not understood instead of silently presetting', (request) => {
    const result = adaptSimulationInputFromRequest({
      request,
      current,
      kind: 'array',
      algorithmName: 'Bubble Sort',
    });
    expect(result.origin).toBe('preset');
    expect(isUnderstoodInputAdaptation(result, current)).toBe(false);
  });

  it('still treats a preset as understood when there is no current input', () => {
    const result = adaptSimulationInputFromRequest({
      request: 'make it interesting',
      current: null,
      kind: 'array',
      algorithmName: 'Bubble Sort',
    });
    expect(result.origin).toBe('preset');
    expect(isUnderstoodInputAdaptation(result, null)).toBe(true);
  });

  it('treats every understood branch as understood', () => {
    const explicit = adaptSimulationInputFromRequest({
      request: 'inputu [4,9,2] yap',
      current,
      kind: 'array',
      algorithmName: 'Bubble Sort',
    });
    expect(isUnderstoodInputAdaptation(explicit, current)).toBe(true);
    const expanded = adaptSimulationInputFromRequest({
      request: 'inputu genişlet',
      current,
      kind: 'array',
      algorithmName: 'Bubble Sort',
    });
    expect(isUnderstoodInputAdaptation(expanded, current)).toBe(true);
  });
});
