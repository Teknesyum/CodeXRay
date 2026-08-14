import { describe, expect, it } from 'vitest';
import type { WorkspaceSnapshotV1 } from '../types/titan';
import { compileArrayTemplatePackage, type ArrayTemplateId } from './arrayCompiler';

const workspace: WorkspaceSnapshotV1 = {
  version: 1,
  algorithmName: 'Custom Code',
  code: '',
  simulationInput: { kind: 'array', text: '[]', origin: 'user' },
  steps: [],
  currentIndex: 0,
  analysis: null,
  inputError: null,
  activePackageId: null,
  packageOutOfSync: false,
};

const compile = (template: ArrayTemplateId, request: string) => compileArrayTemplatePackage({
  template, request, locale: 'tr', id: 'test', workspace,
});

describe('optimization-path array packages', () => {
  it.each([
    ['jump-game-dp', 'O(n^2)', true],
    ['jump-game-greedy', 'O(n)', true],
    ['lis-quadratic-dp', 'O(n^2)', 4],
    ['lis-binary-search', 'O(n log n)', 4],
  ] as const)('compiles %s with a grounded result', (template, complexity, expected) => {
    const value = compile(template, template.startsWith('jump') ? '[2,3,1,1,4]' : '[10,9,2,5,3,7,101,18]');
    expect(value.analysis).toContain(complexity);
    expect(value.steps.at(-1)?.visualData.vars.result).toBe(expected);
    expect(value.tests.passed).toBe(true);
  });
});
