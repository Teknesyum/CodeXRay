import { describe, expect, it } from 'vitest';
import type { WorkspaceSnapshotV1 } from '../types/godMode';
import { compilePredictWinnerPackage, resolvePredictWinnerNumbers } from './intervalDpCompiler';

const workspace: WorkspaceSnapshotV1 = {
  version: 1,
  algorithmName: 'Custom Code',
  code: '',
  simulationInput: { kind: 'array', text: '[9, 2, 7]' },
  steps: [],
  currentIndex: 0,
  analysis: null,
  inputError: null,
  activePackageId: null,
  packageOutOfSync: false,
};

describe('Predict the Winner interval-DP compiler', () => {
  it('uses canonical teaching input unless the request explicitly supplies or references input', () => {
    expect(resolvePredictWinnerNumbers('Solve LeetCode 486 and simulate it.', workspace).numbers)
      .toEqual([1, 5, 233, 7]);
    expect(resolvePredictWinnerNumbers('Use [1, 5, 2] for LeetCode 486.', workspace).numbers)
      .toEqual([1, 5, 2]);
    expect(resolvePredictWinnerNumbers('Bu mevcut input dizisi ile Predict the Winner çöz.', workspace).numbers)
      .toEqual([9, 2, 7]);
  });

  it('fills every interval exactly once in dependency order and grounds the final result', () => {
    const packageValue = compilePredictWinnerPackage({
      id: 'predict-test',
      request: 'LeetCode 486 Predict the Winner çözümünü yap ve simüle et.',
      locale: 'tr',
      workspace,
    });
    expect(packageValue.source.code).toContain('dp[i][j] = max(takeLeft, takeRight);');
    expect(packageValue.visualization.type).toBe('matrix');
    expect(packageValue.steps).toHaveLength(12);
    const computedCoordinates = packageValue.steps.slice(1, -1).map((step) => {
      const data = step.visualData;
      expect(data.type).toBe('matrix');
      if (data.type !== 'matrix') return '';
      const active = data.highlights.find(({ role }) => role === 'active' || role === 'base');
      return `${active?.row},${active?.column}`;
    });
    expect(computedCoordinates).toEqual([
      '0,0', '1,1', '2,2', '3,3',
      '0,1', '1,2', '2,3',
      '0,2', '1,3',
      '0,3',
    ]);
    const firstTransition = packageValue.steps[5].visualData;
    expect(firstTransition.type).toBe('matrix');
    if (firstTransition.type === 'matrix') {
      expect(firstTransition.highlights.filter(({ role }) => role === 'dependency'))
        .toMatchObject([{ row: 1, column: 1 }, { row: 0, column: 0 }]);
      expect(firstTransition.vars).toMatchObject({ i: 0, j: 1, takeLeft: -4, takeRight: 4, choice: 'right' });
    }
    expect(packageValue.steps.at(-1)?.visualData.vars).toMatchObject({
      scoreDifference: 222,
      winner: true,
    });
    expect(packageValue.teachingPlan.checkpoints.length).toBeGreaterThan(3);
  });
});
