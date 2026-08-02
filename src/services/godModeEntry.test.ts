import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ManagerPlanV1, WorkspaceSnapshotV1 } from '../types/godMode';
import { startGodModeRun } from './godModeEntry';

const workspace: WorkspaceSnapshotV1 = {
  version: 1,
  algorithmName: 'Custom Code',
  code: '',
  simulationInput: { kind: 'array', text: '[3,1,2]' },
  steps: [],
  currentIndex: 0,
  analysis: null,
  inputError: null,
  activePackageId: null,
  packageOutOfSync: false,
};

afterEach(() => vi.unstubAllGlobals());

describe('God Mode catalog entry', () => {
  it('compiles and atomically applies verified LeetCode 54 without entering the legacy unknown-job path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        id: '54', source: 'leetcode', title: 'Spiral Matrix', slug: 'spiral-matrix',
        difficulty: 'Medium', category: 'matrix', derivedCategories: ['matrix'],
        tags: ['Array', 'Matrix', 'Simulation'],
      }],
    }));
    const applyPackage = vi.fn();
    const previewSource = vi.fn();
    let latestPlan: ManagerPlanV1 | null = null;

    const result = await startGodModeRun({
      request: 'Create catalog problem: leetcode/54',
      intent: { type: 'create-catalog-problem', source: 'leetcode', problemId: '54' },
      locale: 'tr',
      workspace,
      activePackage: null,
      onPlan: (plan) => { latestPlan = plan; },
      previewSource,
      applyPackage,
      applyInput: vi.fn(),
    }).promise;

    expect((result as any).package?.title).toContain('LeetCode 54');
    expect((result as any).package?.visualization.type).toBe('matrix');
    expect((result as any).package?.steps.length).toBeGreaterThan(3);
    expect(previewSource).toHaveBeenCalledOnce();
    expect(applyPackage).toHaveBeenCalledOnce();
    expect((latestPlan as ManagerPlanV1 | null)?.jobs.every((job) => job.status === 'completed')).toBe(true);
  });
});
