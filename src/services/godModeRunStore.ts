import type { ManagerPlanV1 } from '../types/titan';

const INDEX_KEY = 'codexray.god-mode.runs.v1';
const RUN_PREFIX = 'codexray.god-mode.run.v1.';
const MAX_STORED_RUNS = 8;

const readIndex = (storage: Storage): string[] => {
  try {
    const value = JSON.parse(storage.getItem(INDEX_KEY) ?? '[]') as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').slice(0, MAX_STORED_RUNS)
      : [];
  } catch {
    return [];
  }
};

export const persistGodModePlan = (
  plan: ManagerPlanV1,
  storage: Storage = sessionStorage,
): void => {
  try {
    const existing = readIndex(storage).filter((runId) => runId !== plan.runId);
    const next = [plan.runId, ...existing].slice(0, MAX_STORED_RUNS);
    storage.setItem(`${RUN_PREFIX}${plan.runId}`, JSON.stringify(plan));
    existing.slice(MAX_STORED_RUNS - 1).forEach((runId) =>
      storage.removeItem(`${RUN_PREFIX}${runId}`));
    storage.setItem(INDEX_KEY, JSON.stringify(next));
  } catch {
    // The live run remains available when browser storage is constrained.
  }
};

export const loadLatestGodModePlan = (
  storage: Storage = sessionStorage,
): ManagerPlanV1 | null => {
  const [latest] = readIndex(storage);
  if (!latest) return null;
  try {
    const value = JSON.parse(storage.getItem(`${RUN_PREFIX}${latest}`) ?? 'null') as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = value as Partial<ManagerPlanV1>;
    return candidate.version === 1
      && candidate.runId === latest
      && typeof candidate.request === 'string'
      && Array.isArray(candidate.jobs)
      ? candidate as ManagerPlanV1
      : null;
  } catch {
    return null;
  }
};

export const removeGodModePlan = (
  runId: string,
  storage: Storage = sessionStorage,
): void => {
  try {
    storage.removeItem(`${RUN_PREFIX}${runId}`);
    storage.setItem(INDEX_KEY, JSON.stringify(
      readIndex(storage).filter((storedRunId) => storedRunId !== runId),
    ));
  } catch {
    // The in-memory bar can still be dismissed when storage is unavailable.
  }
};

export const clearGodModePlans = (
  storage: Storage = sessionStorage,
): void => {
  try {
    readIndex(storage).forEach((runId) => storage.removeItem(`${RUN_PREFIX}${runId}`));
    storage.removeItem(INDEX_KEY);
  } catch {
    // Clearing the visible conversation remains available when storage is constrained.
  }
};
