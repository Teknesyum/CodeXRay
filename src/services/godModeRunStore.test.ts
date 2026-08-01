import { describe, expect, it } from 'vitest';
import type { ManagerPlanV1 } from '../types/godMode';
import {
  clearGodModePlans,
  loadLatestGodModePlan,
  persistGodModePlan,
  removeGodModePlan,
} from './godModeRunStore';

const plan = (runId: string): ManagerPlanV1 => ({
  version: 1,
  runId,
  request: 'test',
  intent: 'create-algorithm',
  createdAt: 1,
  jobs: [],
});

describe('God Mode run store', () => {
  it('persists and restores the latest bounded run audit record', () => {
    sessionStorage.clear();
    persistGodModePlan(plan('run-1'));
    persistGodModePlan(plan('run-2'));
    expect(loadLatestGodModePlan()?.runId).toBe('run-2');
  });

  it('removes one run or clears the complete persisted run index', () => {
    sessionStorage.clear();
    persistGodModePlan(plan('run-1'));
    persistGodModePlan(plan('run-2'));
    removeGodModePlan('run-2');
    expect(loadLatestGodModePlan()?.runId).toBe('run-1');
    clearGodModePlans();
    expect(loadLatestGodModePlan()).toBeNull();
  });
});
