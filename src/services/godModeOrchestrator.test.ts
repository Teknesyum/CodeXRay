import { describe, expect, it, vi } from 'vitest';
import type { LocalAgentHandle, LocalAgentRequest } from './localAiService';
import type { ManagerPlanV1, WorkspaceSnapshotV1 } from '../types/godMode';
import { startGodModeRun } from './godModeOrchestrator';

const modelAuthoredProgram = {
  version: 1 as const,
  id: 'scan_array',
  title: 'Array Scan',
  locale: 'en' as const,
  inputKind: 'array' as const,
  functions: [],
  budgets: { instructions: 200, traceSteps: 20, recursionDepth: 4, collectionSize: 100 },
  entry: [
    { id: 'load_array', type: 'declare' as const, name: 'array', value: { type: 'input-field' as const, field: 'array' as const } },
    { id: 'trace_array', type: 'trace' as const, at: 'load_array', explanation: 'Loaded {{array}}.', category: 'result' as const, importance: 1 },
  ],
};

const workspace: WorkspaceSnapshotV1 = {
  version: 1,
  algorithmName: 'Custom Code',
  code: '',
  simulationInput: { kind: 'array', text: '[3, 1, 2]' },
  steps: [],
  currentIndex: 0,
  analysis: null,
  inputError: null,
  activePackageId: null,
  packageOutOfSync: false,
};

const successfulAgent = (request: LocalAgentRequest): LocalAgentHandle => {
  const architect = {
    version: 1,
    title: 'Bidirectional BFS',
    purpose: 'Find a shortest path from two endpoints.',
    inputKind: 'graph',
    dataStructures: ['two queues', 'two sets', 'two parent maps'],
    invariants: ['Each side visits a node once.'],
    termination: 'The frontiers meet or one becomes empty.',
    complexity: { time: 'O(V + E)', space: 'O(V)' },
  };
  const text = request.role === 'architect'
    ? JSON.stringify(architect)
    : request.role === 'critic'
      ? JSON.stringify({ passed: true, issues: [], summary: 'Validated.' })
      : `${request.role} completed.`;
  return { requestId: 1, promise: Promise.resolve(text), cancel: vi.fn() };
};

describe('God Mode orchestrator', () => {
  it('runs specialist jobs, compiles bidirectional BFS, and applies one package transaction', async () => {
    const applyPackage = vi.fn();
    let latestPlan: ManagerPlanV1 | null = null;
    const run = startGodModeRun({
      request: 'bana iki yönlü BFS yaz',
      intent: { type: 'create-algorithm', template: 'bidirectional-bfs' },
      locale: 'tr',
      workspace,
      activePackage: null,
      onPlan: (plan) => { latestPlan = plan; },
      applyPackage,
      applyInput: vi.fn(),
      agentRunner: successfulAgent,
    });
    const result = await run.promise;

    expect(result.package?.title).toBe('Bidirectional BFS');
    expect(result.package?.steps.length).toBeGreaterThan(3);
    expect(applyPackage).toHaveBeenCalledTimes(1);
    expect(latestPlan).not.toBeNull();
    expect((latestPlan as ManagerPlanV1 | null)?.jobs.every((job) => job.status === 'completed')).toBe(true);
  });

  it('uses deterministic specialist fallbacks when advisory local-model calls fail', async () => {
    const failingAgent = (): LocalAgentHandle => ({
      requestId: 3,
      promise: Promise.reject(new Error('Small local model returned invalid output.')),
      cancel: vi.fn(),
    });
    const applyPackage = vi.fn();
    const run = startGodModeRun({
      request: 'bana iki yönlü BFS yaz',
      intent: { type: 'create-algorithm', template: 'bidirectional-bfs' },
      locale: 'tr',
      workspace,
      activePackage: null,
      onPlan: vi.fn(),
      applyPackage,
      applyInput: vi.fn(),
      agentRunner: failingAgent,
    });

    const result = await run.promise;
    expect(result.package?.tests.passed).toBe(true);
    expect(result.tutorAnswer).toContain('Kod:');
    expect(applyPackage).toHaveBeenCalledOnce();
  });

  it('retries a model-authored program in plain JSON mode when schema generation is unavailable', async () => {
    const calls: LocalAgentRequest[] = [];
    const runner = (request: LocalAgentRequest): LocalAgentHandle => {
      calls.push(request);
      if (request.role === 'architect') {
        return {
          requestId: calls.length,
          promise: Promise.resolve(JSON.stringify({
            version: 1,
            title: 'Array Scan',
            purpose: 'Visit the supplied array.',
            inputKind: 'array',
            dataStructures: ['array'],
            invariants: ['The input is not mutated.'],
            termination: 'The array is loaded once.',
            complexity: { time: 'O(n)', space: 'O(n)' },
          })),
          cancel: vi.fn(),
        };
      }
      if (request.role === 'code-author' && request.responseSchema) {
        return {
          requestId: calls.length,
          promise: Promise.reject(new Error('Recursive schema grammar is unavailable.')),
          cancel: vi.fn(),
        };
      }
      const text = request.role === 'code-author'
        ? JSON.stringify(modelAuthoredProgram)
        : request.role === 'critic'
          ? JSON.stringify({ passed: true, issues: [], summary: 'Validated.' })
          : `${request.role} completed.`;
      return { requestId: calls.length, promise: Promise.resolve(text), cancel: vi.fn() };
    };
    const applyPackage = vi.fn();
    const run = startGodModeRun({
      request: 'diziyi tarayan özel bir algoritma yaz',
      intent: { type: 'create-algorithm', template: 'model-authored' },
      locale: 'tr',
      workspace,
      activePackage: null,
      onPlan: vi.fn(),
      applyPackage,
      applyInput: vi.fn(),
      agentRunner: runner,
    });

    const result = await run.promise;
    const codeAuthorCalls = calls.filter((request) => request.role === 'code-author');
    expect(codeAuthorCalls).toHaveLength(2);
    expect(codeAuthorCalls[0]?.responseSchema).toBeDefined();
    expect(codeAuthorCalls[1]?.responseSchema).toBeUndefined();
    expect(codeAuthorCalls[1]?.jsonMode).toBe(true);
    expect(result.package?.program.id).toBe('scan_array');
    expect(result.package?.tests.passed).toBe(true);
    expect(applyPackage).toHaveBeenCalledOnce();
  });

  it('cancels the active handoff and cleans every remaining queued job', async () => {
    let rejectActive: ((reason: Error) => void) | null = null;
    const blockingAgent = (): LocalAgentHandle => ({
      requestId: 2,
      promise: new Promise((_resolve, reject) => { rejectActive = reject; }),
      cancel: () => rejectActive?.(new Error('God Mode agent was cancelled.')),
    });
    let latestPlan: ManagerPlanV1 | null = null;
    const run = startGodModeRun({
      request: 'bana iki yönlü BFS yaz',
      intent: { type: 'create-algorithm', template: 'bidirectional-bfs' },
      locale: 'tr',
      workspace,
      activePackage: null,
      onPlan: (plan) => { latestPlan = plan; },
      applyPackage: vi.fn(),
      applyInput: vi.fn(),
      agentRunner: blockingAgent,
    });
    await Promise.resolve();
    run.cancel();
    await expect(run.promise).rejects.toThrow(/cancelled/);
    expect((latestPlan as ManagerPlanV1 | null)?.jobs.every((job) =>
      job.status === 'cancelled' || job.status === 'completed')).toBe(true);
  });
});
