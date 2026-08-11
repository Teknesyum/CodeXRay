import { describe, expect, it } from 'vitest';
import type { MatrixVisualData, SimulationInput } from '../types/simulation';
import { translateRuntimeText } from '../i18n/translations';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const run = (name: string, input: SimulationInput) => {
  const definition = algorithmRegistry.find((entry) => entry.name === name);
  if (!definition) throw new Error(`Missing ${name}`);
  return simulateAlgorithm(name, definition.code, input);
};
const assertPhases = (steps: ReturnType<typeof run>) => steps.forEach((step) => {
  const phase = step.visualData.vars.phase;
  if (typeof phase === 'string') expect(translateRuntimeText(phase, 'tr')).not.toBe(phase);
});

describe('batch 10 pedagogical dynamic-programming simulations', () => {
  it('0/1 Knapsack renders the complete item/capacity table and both dependencies', () => {
    const steps = run('0/1 Knapsack', { kind: 'array', text: '1,3,4,5', parameters: { values: '1,4,5,7', capacity: '7' }, origin: 'user' });
    assertPhases(steps);
    const choose = steps.find((step) => step.visualData.vars.phase === 'Knapsack · choose include or exclude' && step.visualData.vars.included !== null);
    expect(choose?.visualData.type).toBe('matrix');
    expect((choose!.visualData as MatrixVisualData).highlights.filter((cell) => cell.role === 'dependency')).toHaveLength(2);
    expect(steps.at(-1)!.visualData.vars.maxValue).toBe(9);
  });

  it('LCS fills a character-labeled matrix then traces the subsequence backward', () => {
    const steps = run('Longest Common Subsequence', { kind: 'string', text: 'ABCBDAB', parameters: { other: 'BDCABA' }, origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'LCS · traceback subsequence')).toBe(true);
    const final = steps.at(-1)!;
    expect(final.visualData.type).toBe('matrix');
    expect(final.visualData.vars.length).toBe(4);
  });

  it('LIS exposes per-index predecessor DP and reconstructs a valid subsequence', () => {
    const steps = run('Longest Increasing Subsequence', { kind: 'array', text: '10,9,2,5,3,7,101,18', origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'LIS · compare predecessor candidate')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'LIS · traceback sequence')).toBe(true);
    expect(steps.at(-1)!.visualData.vars).toMatchObject({ length: 4, sequence: [2, 5, 7, 101] });
  });

  it('Matrix Chain evaluates each split with two dependency cells on diagonal fill', () => {
    const steps = run('Matrix Chain Multiplication', { kind: 'array', text: '40,20,30,10,30', origin: 'user' });
    assertPhases(steps);
    const split = steps.find((step) => step.visualData.vars.phase === 'Matrix Chain · evaluate split');
    expect(split?.visualData.type).toBe('matrix');
    expect((split!.visualData as MatrixVisualData).fillDirection).toBe('diagonal');
    expect((split!.visualData as MatrixVisualData).highlights.filter((cell) => cell.role === 'dependency')).toHaveLength(2);
    expect(steps.at(-1)!.visualData.vars.minimumCost).toBe(26000);
    expect(steps.at(-1)!.visualData.vars.parenthesization).toBe('((A1 × (A2 × A3)) × A4)');
  });

  it('Edit Distance labels insert/delete/replace dependencies in the full matrix', () => {
    const steps = run('Edit Distance', { kind: 'string', text: 'kitten', parameters: { other: 'sitting' }, origin: 'user' });
    assertPhases(steps);
    const edit = steps.find((step) => step.visualData.vars.phase === 'Edit Distance · choose edit operation' && step.visualData.vars.operation === 'replace');
    expect(edit?.visualData.type).toBe('matrix');
    expect((edit!.visualData as MatrixVisualData).highlights.filter((cell) => cell.role === 'dependency')).toHaveLength(3);
    expect(steps.at(-1)!.visualData.vars.distance).toBe(3);
    expect(steps.at(-1)!.visualData.vars.editScript).toHaveLength(3);
  });
});
