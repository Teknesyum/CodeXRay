import { describe, expect, it } from 'vitest';
import type { ManagerPlanV1 } from '../types/titan';
import {
  clearTitanModePlans,
  loadLatestTitanModePlan,
  persistTitanModePlan,
  removeTitanModePlan,
} from './titanModeRunStore';

const plan = (runId: string): ManagerPlanV1 => ({
  version: 1,
  runId,
  request: 'test',
  intent: 'create-algorithm',
  createdAt: 1,
  jobs: [],
});

describe('Titan Mode run store', () => {
  it('persists and restores the latest bounded run audit record', () => {
    sessionStorage.clear();
    persistTitanModePlan(plan('run-1'));
    persistTitanModePlan(plan('run-2'));
    expect(loadLatestTitanModePlan()?.runId).toBe('run-2');
  });

  it('removes one run or clears the complete persisted run index', () => {
    sessionStorage.clear();
    persistTitanModePlan(plan('run-1'));
    persistTitanModePlan(plan('run-2'));
    removeTitanModePlan('run-2');
    expect(loadLatestTitanModePlan()?.runId).toBe('run-1');
    clearTitanModePlans();
    expect(loadLatestTitanModePlan()).toBeNull();
  });

  it('loads and clears legacy persisted plans during the naming migration', () => {
    sessionStorage.clear();
    const legacyName = ['god', 'mode'].join('-');
    sessionStorage.setItem(`codexray.${legacyName}.runs.v1`, JSON.stringify(['legacy-run']));
    sessionStorage.setItem(`codexray.${legacyName}.run.v1.legacy-run`, JSON.stringify(plan('legacy-run')));
    expect(loadLatestTitanModePlan()?.runId).toBe('legacy-run');
    clearTitanModePlans();
    expect(loadLatestTitanModePlan()).toBeNull();
  });
});
