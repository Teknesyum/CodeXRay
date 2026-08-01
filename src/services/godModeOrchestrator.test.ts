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
    const sourcePhases: string[] = [];
    const previewSource = vi.fn((code: string) => {
      expect(code).toContain('frontierStart');
      sourcePhases.push('preview');
    });
    let latestPlan: ManagerPlanV1 | null = null;
    const run = startGodModeRun({
      request: 'bana iki yönlü BFS yaz',
      intent: { type: 'create-algorithm', template: 'bidirectional-bfs' },
      locale: 'tr',
      workspace,
      activePackage: null,
      onPlan: (plan) => { latestPlan = plan; },
      previewSource,
      applyPackage: (...args) => {
        sourcePhases.push('apply');
        applyPackage(...args);
      },
      applyInput: vi.fn(),
      agentRunner: successfulAgent,
    });
    const result = await run.promise;

    expect(result.package?.title).toBe('İki Yönlü BFS — Özel');
    expect(result.package?.visualization.version).toBe(2);
    expect(result.package?.teachingPlan.checkpoints.length).toBeGreaterThan(2);
    expect(result.package?.steps.length).toBeGreaterThan(3);
    expect(applyPackage).toHaveBeenCalledTimes(1);
    expect(previewSource).toHaveBeenCalledTimes(1);
    expect(sourcePhases).toEqual(['preview', 'apply']);
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

  it('blocks the workspace commit when the mandatory critic rejects the package', async () => {
    const runner = (request: LocalAgentRequest): LocalAgentHandle => {
      const text = request.role === 'architect'
        ? JSON.stringify({
          version: 1,
          title: 'Array Scan',
          purpose: 'Visit the supplied array.',
          inputKind: 'array',
          dataStructures: ['array'],
          invariants: ['The input is not mutated.'],
          termination: 'The array is loaded once.',
          complexity: { time: 'O(n)', space: 'O(n)' },
        })
        : request.role === 'code-author'
          ? JSON.stringify(modelAuthoredProgram)
          : request.role === 'critic'
            ? JSON.stringify({ passed: false, issues: ['Sample output is not grounded.'], summary: 'Rejected.' })
            : `${request.role} completed.`;
      return { requestId: 20, promise: Promise.resolve(text), cancel: vi.fn() };
    };
    const applyPackage = vi.fn();
    const run = startGodModeRun({
      request: 'diziyi tarayan özel bir algoritma yaz',
      intent: { type: 'create-algorithm', template: 'model-authored' },
      locale: 'en',
      workspace,
      activePackage: null,
      onPlan: vi.fn(),
      applyPackage,
      applyInput: vi.fn(),
      agentRunner: runner,
    });
    await expect(run.promise).rejects.toThrow('Critic rejected the package');
    expect(applyPackage).not.toHaveBeenCalled();
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

  it('rejects a late specialist response after cancellation without applying partial state', async () => {
    let resolveLate!: (value: string) => void;
    const cancelAgent = vi.fn();
    const delayedAgent = (): LocalAgentHandle => ({
      requestId: 9,
      promise: new Promise((resolve) => { resolveLate = resolve; }),
      cancel: cancelAgent,
    });
    const applyPackage = vi.fn();
    const applyInput = vi.fn();
    let latestPlan: ManagerPlanV1 | null = null;
    const run = startGodModeRun({
      request: 'bana iki yönlü BFS yaz',
      intent: { type: 'create-algorithm', template: 'bidirectional-bfs' },
      locale: 'tr',
      workspace,
      activePackage: null,
      onPlan: (plan) => { latestPlan = plan; },
      applyPackage,
      applyInput,
      agentRunner: delayedAgent,
    });

    await Promise.resolve();
    run.cancel();
    resolveLate(JSON.stringify({
      version: 1,
      title: 'Late response',
      purpose: 'Must not apply.',
      inputKind: 'graph',
      dataStructures: [],
      invariants: [],
      termination: 'Never',
      complexity: { time: 'O(1)', space: 'O(1)' },
    }));

    await expect(run.promise).rejects.toThrow(/cancelled/);
    expect(cancelAgent).toHaveBeenCalledOnce();
    expect(applyPackage).not.toHaveBeenCalled();
    expect(applyInput).not.toHaveBeenCalled();
    expect((latestPlan as ManagerPlanV1 | null)?.jobs.every((job) =>
      job.status === 'cancelled' || job.status === 'completed')).toBe(true);
  });

  it('builds the complete original ten-node bidirectional BFS artifact and grounded final report', async () => {
    const run = startGodModeRun({
      request: 'Bana iki yönlü BFS yaz. 10 node ve iki alternatif yol oluştur, simüle et ve öğretmen gibi anlat.',
      intent: { type: 'create-algorithm', template: 'bidirectional-bfs' },
      locale: 'tr',
      workspace,
      activePackage: null,
      onPlan: vi.fn(),
      applyPackage: vi.fn(),
      applyInput: vi.fn(),
      agentRunner: successfulAgent,
    });
    const packageValue = (await run.promise).package;
    expect(packageValue).toBeDefined();
    const graph = packageValue?.input.value.graph;
    expect(graph?.nodes).toHaveLength(10);
    expect(graph?.edges.length).toBeGreaterThanOrEqual(12);
    expect(packageValue?.input.origin).toBe('agent');
    expect(packageValue?.source.code).toMatch(/frontierStart|frontierTarget|parentFromStart|parentFromTarget|reconstructPath/);
    expect(packageValue?.visualization.version).toBe(2);
    if (packageValue?.visualization.version === 2) {
      expect(packageValue.visualization.frontierLayers).toHaveLength(2);
      expect(packageValue.visualization.nodeRoles.find((role) => role.id === 'frontier-start')?.style.shape)
        .not.toBe(packageValue.visualization.nodeRoles.find((role) => role.id === 'frontier-target')?.style.shape);
      expect(packageValue.visualization.edgeRoles.map((role) => role.id)).toEqual(expect.arrayContaining([
        'inspect-start', 'inspect-target', 'tree-start', 'tree-target', 'path',
      ]));
    }
    const final = packageValue?.steps.at(-1)?.visualData;
    expect(final?.type).toBe('graph');
    if (final?.type === 'graph') {
      const path = final.vars.path;
      expect(Array.isArray(path)).toBe(true);
      const ids = path as string[];
      for (let index = 1; index < ids.length; index += 1) {
        expect(graph?.edges.some((edge) =>
          (edge.from === ids[index - 1] && edge.to === ids[index])
          || (!graph.directed && edge.from === ids[index] && edge.to === ids[index - 1])),
        ).toBe(true);
      }
      expect(final.vars.meeting).not.toBeNull();
    }
    expect(packageValue?.teachingPlan.checkpoints.length).toBeGreaterThanOrEqual(3);
    expect(packageValue?.teachingPlan.checkpoints.every(({ narration }) =>
      ['code', 'data', 'visual', 'reasoning', 'time'].every((lens) =>
        Boolean(narration.lenses[lens as keyof typeof narration.lenses])))).toBe(true);
    expect(packageValue?.teachingPlan.finalResult.summary).toBeTruthy();
    expect(packageValue?.tests.passed).toBe(true);
  });

  it('preserves a user graph when creating bidirectional BFS on the current workspace', async () => {
    const graph = {
      version: 1 as const,
      mode: 'graph' as const,
      directed: false,
      weighted: false,
      nodes: ['left', 'fork-a', 'fork-b', 'meet', 'right'].map((id, index) => ({
        id, label: id, x: 10 + index * 20, y: index % 2 ? 30 : 70,
      })),
      edges: [
        { id: 'e1', from: 'left', to: 'fork-a' },
        { id: 'e2', from: 'left', to: 'fork-b' },
        { id: 'e3', from: 'fork-a', to: 'meet' },
        { id: 'e4', from: 'fork-b', to: 'meet' },
        { id: 'e5', from: 'meet', to: 'right' },
      ],
      startId: 'left',
      targetId: 'right',
    };
    const userWorkspace: WorkspaceSnapshotV1 = {
      ...workspace,
      algorithmName: 'Breadth First Search (BFS)',
      simulationInput: { kind: 'graph', text: '', graph, origin: 'user' },
    };
    const result = await startGodModeRun({
      request: 'Benim graphım üzerinde iki yönlü BFS yaz',
      intent: { type: 'create-algorithm', template: 'bidirectional-bfs' },
      locale: 'tr',
      workspace: userWorkspace,
      activePackage: null,
      onPlan: vi.fn(),
      applyPackage: vi.fn(),
      applyInput: vi.fn(),
      agentRunner: successfulAgent,
    }).promise;
    expect(result.package?.input.origin).toBe('user');
    expect(result.package?.input.value.graph?.nodes.map(({ id, label }) => ({ id, label })))
      .toEqual(graph.nodes.map(({ id, label }) => ({ id, label })));
    expect(result.package?.input.value.graph?.edges).toEqual(graph.edges);
    expect(result.package?.input.value.graph?.startId).toBe(graph.startId);
    expect(result.package?.input.value.graph?.targetId).toBe(graph.targetId);
    const traceText = JSON.stringify(result.package?.steps);
    for (const node of graph.nodes) expect(traceText).toContain(node.id);
  });

  it('keeps visual-only edits trace-stable and recompiles named structural graph edits', async () => {
    const created = await startGodModeRun({
      request: 'bana iki yönlü BFS yaz',
      intent: { type: 'create-algorithm', template: 'bidirectional-bfs' },
      locale: 'tr',
      workspace,
      activePackage: null,
      onPlan: vi.fn(),
      applyPackage: vi.fn(),
      applyInput: vi.fn(),
      agentRunner: successfulAgent,
    }).promise;
    const activePackage = created.package!;
    const packageWorkspace: WorkspaceSnapshotV1 = {
      ...workspace,
      algorithmName: activePackage.title,
      code: activePackage.source.code,
      simulationInput: activePackage.input.value,
      steps: activePackage.steps,
      activePackageId: activePackage.id,
    };
    const applyVisualPackage = vi.fn();
    await startGodModeRun({
      request: 'Nodeları daha geniş yay. Başlangıç ve hedef tarafını farklı şekillerle göster.',
      intent: { type: 'adapt-input' },
      locale: 'tr',
      workspace: packageWorkspace,
      activePackage,
      onPlan: vi.fn(),
      applyPackage: vi.fn(),
      applyVisualPackage,
      applyInput: vi.fn(),
      agentRunner: successfulAgent,
    }).promise;
    expect(applyVisualPackage).toHaveBeenCalledOnce();
    const visualPackage = applyVisualPackage.mock.calls[0]?.[0];
    expect(visualPackage.program).toEqual(activePackage.program);
    expect(visualPackage.source).toEqual(activePackage.source);
    expect(visualPackage.steps).toHaveLength(activePackage.steps.length);
    expect(visualPackage.input.value.graph?.edges).toEqual(activePackage.input.value.graph?.edges);
    expect(visualPackage.input.value.graph?.nodes.map((node: { id: string; x: number; y: number }) => ({
      id: node.id,
      x: node.x,
      y: node.y,
    }))).not.toEqual(activePackage.input.value.graph?.nodes.map(({ id, x, y }) => ({ id, x, y })));

    const applyPackage = vi.fn();
    const connectorId = activePackage.input.value.graph?.nodes[1]?.id ?? 'S';
    await startGodModeRun({
      request: `X node'unu ekle, ${connectorId} ile X ve X ile hedef arasında bağlantı kur ve tekrar çalıştır`,
      intent: { type: 'adapt-input' },
      locale: 'tr',
      workspace: packageWorkspace,
      activePackage,
      onPlan: vi.fn(),
      applyPackage,
      applyInput: vi.fn(),
      agentRunner: successfulAgent,
    }).promise;
    expect(applyPackage).toHaveBeenCalledOnce();
    const structuralPackage = applyPackage.mock.calls[0]?.[0];
    const structuralGraph = structuralPackage.input.value.graph;
    expect(structuralGraph.nodes.some((node: { id: string }) => node.id === 'X')).toBe(true);
    expect(structuralGraph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: connectorId, to: 'X' }),
      expect.objectContaining({ from: 'X', to: structuralGraph.targetId }),
    ]));
    expect(structuralPackage.steps.length).toBeGreaterThan(0);
    expect(JSON.stringify(structuralPackage.steps)).toContain('X');
  });
});
