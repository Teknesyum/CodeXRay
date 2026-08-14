import { describe, expect, it } from 'vitest';
import type { WorkspaceSnapshotV1 } from '../types/titan';
import { compileMatrixTemplatePackage } from './matrixCompiler';

const workspace: WorkspaceSnapshotV1 = {
  version: 1, algorithmName: '', code: '',
  simulationInput: { kind: 'array', text: '[]', origin: 'user' },
  steps: [], currentIndex: 0, analysis: null, inputError: null,
  activePackageId: null, packageOutOfSync: false,
};

describe('matrix compiler dimensions', () => {
  it('compiles every cell of an 8 by 15 grid', () => {
    const value = compileMatrixTemplatePackage({
      template: 'spiral-matrix', id: 'matrix-test', request: 'gridi 8*15 yap', locale: 'tr', workspace,
    });
    expect(value.steps).toHaveLength(122);
    expect(value.steps.at(-1)?.visualData.vars.visitedCells).toBe(120);
    expect(value.tests.passed).toBe(true);
  });
});
