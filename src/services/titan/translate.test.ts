import { describe, expect, it } from 'vitest';
import type { InputContractV1, ProgramSpecV1, VisualizationContractV1 } from '../../types/titan';
import { renderLite } from '../simLangLite';
import { translateToVerifiedPackage, type TranslatableLanguage } from './translate';

const program: ProgramSpecV1 = {
  version: 1,
  id: 'translated_scan',
  title: 'Translated scan',
  locale: 'en',
  inputKind: 'array',
  entry: [
    { id: 's1', type: 'declare', name: 'values', value: { type: 'input-field', field: 'array' } },
    { id: 's2', type: 'trace', at: 's1', explanation: 'Read the verified input.', importance: 0.5 },
    { id: 's3', type: 'return', value: { type: 'length', value: { type: 'variable', name: 'values' } } },
  ],
  functions: [],
  budgets: { instructions: 200, traceSteps: 20, recursionDepth: 4, collectionSize: 50 },
};

const input: InputContractV1 = {
  version: 1,
  kind: 'array',
  description: 'Finite translated input',
  constraints: ['At most 50 values'],
  value: { kind: 'array', text: '[3,1,2]' },
  origin: 'user',
};

const visualization: VisualizationContractV1 = {
  version: 1,
  type: 'variables',
  activeVariables: [],
  queuedVariables: [],
  visitedVariables: [],
};

const translate = (language: TranslatableLanguage, attempts: string[][]) => translateToVerifiedPackage({
  id: `translate-${language}`,
  title: `${language} translation`,
  locale: 'en',
  originalLanguage: language,
  originalSource: `${language} source that is never executed`,
  attempts,
  input,
  visualization,
  analysis: 'Verified deterministic translation.',
  verifiedAt: 1_700_000_000_000,
});

describe('verified SimLang-Lite translation', () => {
  it.each(['cpp', 'java', 'python'] as const)('gates %s through deterministic compile and execution', (language) => {
    const result = translate(language, [[renderLite(program)]]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.package.translation).toMatchObject({
      originalLanguage: language,
      generatedFormat: 'simlang-lite',
      deterministicTrace: true,
      verifiedAt: 1_700_000_000_000,
    });
    expect(result.package.steps.length).toBeGreaterThan(0);
    expect(result.package.tests.passed).toBe(true);
  });

  it('merges function fragments in deterministic order', () => {
    const first = { ...program, functions: [{ name: 'first', parameters: [], body: [{ id: 'f1', type: 'return' as const, value: { type: 'literal' as const, value: 1 } }] }] };
    const second = { ...program, functions: [{ name: 'second', parameters: [], body: [{ id: 'f2', type: 'return' as const, value: { type: 'literal' as const, value: 2 } }] }] };
    const result = translate('python', [[renderLite(first), renderLite(second)]]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.package.program.functions.map((fn) => fn.name)).toEqual(['first', 'second']);
  });

  it('returns line feedback and accepts at most the second repair', () => {
    const result = translate('java', [
      ['program "x" "X" en array\nbudgets 20 1 1 1\nentry\n  nope s1\nend'],
      ['still invalid'],
      [renderLite(program)],
      [renderLite(program)],
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(3);
    expect(result.failures).toHaveLength(2);
    expect(result.failures[0].reason).toMatch(/Line 4/);
  });

  it('returns every failure without a package after three attempts', () => {
    const result = translate('cpp', [['bad'], ['bad'], ['bad'], [renderLite(program)]]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures).toHaveLength(3);
    expect('reason' in result && result.reason).toBeTruthy();
    expect(result).not.toHaveProperty('package');
  });
});
