import { describe, expect, it } from 'vitest';
import type { WorkspaceSnapshotV1 } from '../types/godMode';
import { compileDpTemplatePackage } from './dpTemplateCompiler';
import { compilePredictWinnerPackage } from './intervalDpCompiler';
import { recompileSimulationInput } from './recompileSimulationInput';

const workspace: WorkspaceSnapshotV1 = {
  version: 1,
  algorithmName: 'Custom Code',
  code: '',
  simulationInput: { kind: 'array', text: '[1,2,3]' },
  steps: [],
  currentIndex: 0,
  analysis: null,
  inputError: null,
  activePackageId: null,
  packageOutOfSync: false,
};

describe('manual God Mode input recompilation', () => {
  it('rebuilds an interval-DP matrix from the exact edited array', () => {
    const activePackage = compilePredictWinnerPackage({
      id: 'predict-original', request: 'Predict the Winner', locale: 'tr', workspace,
    });
    const rebuilt = recompileSimulationInput({
      activePackage,
      input: { kind: 'array', text: '[4,9,2,11,6]', origin: 'user' },
      locale: 'tr',
      workspace,
    });

    expect(rebuilt.input.value.text).toBe('[4,9,2,11,6]');
    expect(rebuilt.input.origin).toBe('user');
    expect(rebuilt.steps).toHaveLength(17);
    expect(rebuilt.steps.at(-1)?.visualData.vars.nums).toEqual([4, 9, 2, 11, 6]);
    expect(rebuilt.steps.at(-1)?.visualData.type).toBe('matrix');
  });

  it('keeps DP parameters and rebuilds every cell for edited LCS input', () => {
    const activePackage = compileDpTemplatePackage({
      template: 'lcs-2d-dp', id: 'lcs-original', request: 'LCS', locale: 'en', workspace,
    });
    const rebuilt = recompileSimulationInput({
      activePackage,
      input: {
        kind: 'string', text: 'algorithm', parameters: { other: 'logarithm' }, origin: 'user',
      },
      locale: 'en',
      workspace,
    });

    expect(rebuilt.input.value).toMatchObject({
      kind: 'string', text: 'algorithm', parameters: { other: 'logarithm' }, origin: 'user',
    });
    expect(rebuilt.steps.at(-1)?.visualData.vars).toMatchObject({ first: 'algorithm', second: 'logarithm' });
    expect(rebuilt.steps.at(-1)?.visualData.type).toBe('matrix');
  });
});
