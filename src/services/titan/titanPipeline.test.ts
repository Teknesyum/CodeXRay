import { describe, expect, it, vi } from 'vitest';
import {
  executeTitanPipeline,
  startArrayTemplatePipeline,
  startAdaptInputPipeline,
  startDiscussCurrentStepPipeline,
  startModelAuthoredPipeline,
  verifyAdaptInputArtifact,
  verifyCurrentStepArtifact,
  type TitanStageState,
} from './titanPipeline';
import { generateSimulationSteps } from '../aiService';
import { compileCustomSimulationPackage } from '../customSimulationCompiler';
import { deterministicFiveLens } from '../titanEngine';
import { algorithmRegistry } from '../codeRegistry';
import { createInputPreset, getInputKindForAlgorithm } from '../inputPresets';
import type { GraphDocumentV1, SimulationInput } from '../../types/simulation';

const MAX_INPUT_ITEMS = 200;

const createMaximumInput = (algorithmName: string): SimulationInput => {
  const kind = getInputKindForAlgorithm(algorithmName);
  const preset = createInputPreset(kind, 0, algorithmName);
  if (kind === 'array') {
    const arrayLength = /Matrix Chain Multiplication/iu.test(algorithmName) ? 30 : MAX_INPUT_ITEMS;
    const values = /Dutch National Flag/iu.test(algorithmName)
      ? Array.from({ length: arrayLength }, (_, index) => index % 3)
      : /Binary Search|Ternary Search/iu.test(algorithmName)
        ? Array.from({ length: arrayLength }, (_, index) => index)
        : /Unique Paths/iu.test(algorithmName)
          ? Array.from({ length: arrayLength }, () => 1)
          : Array.from({ length: arrayLength }, (_, index) => arrayLength - index);
    const parameters = /Knapsack/iu.test(algorithmName)
      ? { ...preset.parameters, values: JSON.stringify(values.map((value) => value + 1)) }
      : preset.parameters;
    return { ...preset, text: JSON.stringify(values), parameters, origin: 'user' };
  }
  if (kind === 'string') {
    return { ...preset, text: 'AB'.repeat(MAX_INPUT_ITEMS / 2), origin: 'user' };
  }
  const graphLimit = /Bellman-Ford/iu.test(algorithmName)
    ? 60
    : /Floyd-Warshall|Johnson/iu.test(algorithmName)
      ? 40
      : /Graph Coloring|Hamiltonian Cycle/iu.test(algorithmName)
        ? 12
        : MAX_INPUT_ITEMS;
  const nodes = Array.from({ length: graphLimit }, (_, index) => ({
    id: `n${index}`,
    label: String(index),
    x: index % 100,
    y: Math.floor(index / 100) * 50,
  }));
  const graph: GraphDocumentV1 = {
    version: 1,
    mode: kind,
    directed: preset.graph?.directed ?? false,
    weighted: preset.graph?.weighted ?? kind === 'graph',
    nodes,
    edges: nodes.slice(1).map((node, index) => ({
      id: `e${index}`,
      from: nodes[index].id,
      to: node.id,
      weight: (preset.graph?.weighted ?? kind === 'graph') ? 1 : undefined,
    })),
    rootId: kind === 'tree' ? nodes[0].id : undefined,
    startId: nodes[0].id,
    targetId: nodes.at(-1)?.id,
  };
  return { ...preset, graph, origin: 'user' };
};

const createModelAuthoredPackage = () => compileCustomSimulationPackage({
  id: 'model-authored-package',
  title: 'Array Scan — Custom',
  locale: 'en',
  program: {
    version: 1,
    id: 'scan_array',
    title: 'Array Scan',
    locale: 'en',
    inputKind: 'array',
    functions: [],
    budgets: { instructions: 200, traceSteps: 20, recursionDepth: 4, collectionSize: 100 },
    entry: [
      { id: 'load_array', type: 'declare', name: 'array', value: { type: 'input-field', field: 'array' } },
      { id: 'trace_array', type: 'trace', at: 'load_array', explanation: 'Loaded {{array}}.', category: 'result', importance: 1 },
    ],
  },
  input: {
    version: 1,
    kind: 'array',
    description: 'Array input',
    constraints: [],
    value: { kind: 'array', text: '[3, 1, 2]', origin: 'user' },
  },
  visualization: {
    version: 1,
    type: 'array',
    activeVariables: [],
    queuedVariables: [],
    visitedVariables: [],
  },
  analysis: 'A deterministic array scan.',
});

describe('five-stage Titan pipeline', () => {
  it('emits five ordered stages, skips sufficient semantics, and applies once', async () => {
    const events: TitanStageState[] = [];
    const apply = vi.fn();
    const result = await executeTitanPipeline({
      route: () => ({ intent: 'trace-code' }),
      produce: () => ({ trace: [1, 2, 3] }),
      verify: () => ({ ok: true }),
      apply,
      onStage: (stage) => events.push(stage),
    });
    expect(result.stages.map((stage) => [stage.id, stage.status])).toEqual([
      ['route', 'completed'],
      ['produce', 'completed'],
      ['semantics', 'skipped'],
      ['verify', 'completed'],
      ['apply', 'completed'],
    ]);
    expect(events.some((stage) => stage.id === 'semantics' && stage.status === 'skipped')).toBe(true);
    expect(apply).toHaveBeenCalledOnce();
  });

  it('preserves committed state when verification fails', async () => {
    const committed = { id: 'working-package' };
    const apply = vi.fn((artifact: { id: string }) => { committed.id = artifact.id; });
    const stages: TitanStageState[] = [];
    await expect(executeTitanPipeline({
      route: () => 'trace-code',
      produce: () => ({ id: 'candidate' }),
      verify: () => ({ ok: false, reason: 'Trace gate failed.' }),
      apply,
      onStage: (stage) => stages.push(stage),
    })).rejects.toThrow('Trace gate failed.');
    expect(committed.id).toBe('working-package');
    expect(apply).not.toHaveBeenCalled();
    expect(stages.at(-1)).toMatchObject({ id: 'apply', status: 'cancelled' });
  });

  it('fails loudly when a pipeline caller omits the required apply task', async () => {
    await expect(executeTitanPipeline({
      route: () => 'create-algorithm',
      produce: () => ({ package: 'deferred' }),
      verify: () => ({ ok: true }),
    } as any)).rejects.toThrow(/apply/);
  });

  it.each(['route', 'produce', 'apply'] as const)('stops visibly when %s fails', async (failure) => {
    const applied = vi.fn();
    await expect(executeTitanPipeline({
      route: () => {
        if (failure === 'route') throw new Error('route failed');
        return 'trace-code';
      },
      produce: () => {
        if (failure === 'produce') throw new Error('produce failed');
        return { trace: [1] };
      },
      verify: () => ({ ok: true }),
      apply: () => {
        if (failure === 'apply') throw new Error('apply failed');
        applied();
      },
    })).rejects.toThrow(`${failure} failed`);
    if (failure !== 'apply') expect(applied).not.toHaveBeenCalled();
  });

  it('exposes cancellation before apply', async () => {
    const controller = new AbortController();
    const applied = vi.fn();
    await expect(executeTitanPipeline({
      route: () => 'trace-code',
      produce: () => {
        controller.abort();
        return { trace: [1] };
      },
      verify: () => ({ ok: true }),
      apply: applied,
      signal: controller.signal,
    })).rejects.toThrow('cancelled');
    expect(applied).not.toHaveBeenCalled();
  });

  it('runs the current-step explanation through five visible ordered stages', async () => {
    const plans: string[][] = [];
    const applyResult = vi.fn();
    const result = {
      status: 'success' as const,
      runId: 'engine-run',
      plan: { version: 1 as const, runId: 'engine-run', request: 'explain this step', intent: 'discuss-current-step' as const, jobs: [], createdAt: 1 },
      summary: 'Grounded explanation.',
      tutorAnswer: 'Code: Active source line 9.\nData: Live variables {"i":2}.\nVisual: array.\nReasoning: Selected step.\nTime: Step 1/1.',
    };
    const run = startDiscussCurrentStepPipeline({
      request: 'explain this step',
      intent: { type: 'discuss-current-step' },
      locale: 'en',
      workspace: { steps: [{ lineNumber: 9, explanation: 'Selected step', visualData: { type: 'array', vars: { i: 2 } } }], currentIndex: 0 } as any,
      activePackage: null,
      onPlan: (plan) => plans.push(plan.jobs.map((job) => `${job.id}:${job.summary ?? job.status}`)),
      applyPackage: vi.fn(),
      applyInput: vi.fn(),
      verificationFailureMessage: 'Verification failed.',
      applyResult,
      startRun: () => ({ runId: 'engine-run', promise: Promise.resolve(result), cancel: vi.fn() }),
    });
    await expect(run.promise).resolves.toBe(result);
    expect(applyResult).toHaveBeenCalledOnce();
    expect(plans.at(-1)).toEqual([
      'titan-route:completed',
      'titan-produce:completed',
      'titan-semantics:Skipped because deterministic semantics were already sufficient.',
      'titan-verify:completed',
      'titan-apply:completed',
    ]);
  });

  it.each([
    ['wrong source line', 'Code: Active source line 14.\nData: Live variables {"i":2}.\nVisual: array.\nReasoning: prose is not checked.\nTime: Step 2/3.'],
    ['wrong step index', 'Code: Active source line 9.\nData: Live variables {"i":2}.\nVisual: array.\nReasoning: prose is not checked.\nTime: Step 1/3.'],
    ['unparseable', 'A confident explanation without the required labels.'],
  ])('rejects a %s in a current-step answer', (_case, tutorAnswer) => {
    const workspace = {
      currentIndex: 1,
      steps: [
        { lineNumber: 4, visualData: { vars: {} } },
        { lineNumber: 9, visualData: { vars: { i: 2 } } },
        { lineNumber: 12, visualData: { vars: {} } },
      ],
    } as any;
    expect(verifyCurrentStepArtifact({ status: 'success', tutorAnswer } as any, {
      workspace,
      verificationFailureMessage: 'Verification failed.',
    })).toEqual({ ok: false, reason: 'Verification failed.' });
  });

  it.each(['en', 'tr'] as const)('accepts the actual deterministic five-lens fallback in %s', (locale) => {
    const workspace = {
      currentIndex: 1,
      steps: [
        { lineNumber: 4, visualData: { vars: {} } },
        { lineNumber: 9, visualData: { vars: { i: 2 } } },
        { lineNumber: 12, visualData: { vars: {} } },
      ],
    } as any;
    const tutorAnswer = deterministicFiveLens(locale, workspace.steps[1], 1, 3);
    expect(verifyCurrentStepArtifact({ status: 'success', tutorAnswer } as any, {
      workspace,
      verificationFailureMessage: 'Verification failed.',
    })).toEqual({ ok: true });
  });

  it('accepts every Merge Sort fallback for the maximum 200-item input', async () => {
    const input = createMaximumInput('Merge Sort');
    const steps = await generateSimulationSteps('Merge Sort', '', input);
    const worstVarsChars = Math.max(...steps.map((step) => JSON.stringify(step.visualData.vars).length));
    expect(worstVarsChars).toBe(764);
    for (const locale of ['en', 'tr'] as const) {
      for (const [currentIndex, step] of steps.entries()) {
        const tutorAnswer = deterministicFiveLens(locale, step, currentIndex, steps.length);
        expect(verifyCurrentStepArtifact({ status: 'success', tutorAnswer } as any, {
          workspace: { steps, currentIndex } as any,
          verificationFailureMessage: 'Verification failed.',
        })).toEqual({ ok: true });
      }
    }
  });

  it('accepts every deterministic fallback at the maximum legal input size', async () => {
    let largestVarsChars = 0;
    for (const algorithm of algorithmRegistry.filter((candidate) => candidate.isSupported)) {
      const steps = await generateSimulationSteps(
        algorithm.name,
        algorithm.code,
        createMaximumInput(algorithm.name),
      );
      for (const [currentIndex, step] of steps.entries()) {
        largestVarsChars = Math.max(largestVarsChars, JSON.stringify(step.visualData.vars).length);
        for (const locale of ['en', 'tr'] as const) {
          const tutorAnswer = deterministicFiveLens(locale, step, currentIndex, steps.length);
          expect(verifyCurrentStepArtifact({ status: 'success', tutorAnswer } as any, {
            workspace: { steps, currentIndex } as any,
            verificationFailureMessage: 'Verification failed.',
          }), `${algorithm.name} step ${currentIndex + 1}/${steps.length} (${locale})`).toEqual({ ok: true });
        }
      }
    }
    expect(largestVarsChars).toBe(21_204);
  }, 120_000);

  it('rejects a Data binding that contradicts the committed variable value', () => {
    const workspace = {
      currentIndex: 0,
      steps: [{ lineNumber: 9, visualData: { vars: { i: 2 } } }],
    } as any;
    const tutorAnswer = 'Code: Line 9 is active.\nData: i = 3.\nVisual: array.\nReasoning: selected.\nTime: 1 / 1.';
    expect(verifyCurrentStepArtifact({ status: 'success', tutorAnswer } as any, {
      workspace,
      verificationFailureMessage: 'Verification failed.',
    })).toEqual({ ok: false, reason: 'Verification failed.' });
  });

  it.each([
    ['en', 'Code: Line 9 is active.\nData: i = 2.\nVisual: array.\nReasoning: selected.\nTime: 2 / 3.'],
    ['en', 'Code: Executing the source at line 9.\nData: i is 2.\nVisual: array.\nReasoning: selected.\nTime: Currently 2/3.'],
    ['en', 'Code: The source location is 9.\nData: The value of i: 2.\nVisual: array.\nReasoning: selected.\nTime: Position 2 / 3.'],
    ['tr', 'Kod: 9. satır çalışıyor.\nVeri: i = 2.\nGörsel: dizi.\nMantık: seçili.\nZaman: 2 / 3.'],
    ['tr', 'Kod: Kaynağın 9. satırı yürütülüyor.\nVeri: i değeri 2.\nGörsel: dizi.\nMantık: seçili.\nZaman: Şu anda 2/3.'],
    ['tr', 'Kod: Kod konumu 9.\nVeri: i: 2.\nGörsel: dizi.\nMantık: seçili.\nZaman: Konum 2 / 3.'],
  ] as const)('accepts differently phrased committed Code, Data, and Time facts in %s', (_locale, tutorAnswer) => {
    const workspace = {
      currentIndex: 1,
      steps: [
        { lineNumber: 4, visualData: { vars: {} } },
        { lineNumber: 9, visualData: { vars: { i: 2 } } },
        { lineNumber: 12, visualData: { vars: {} } },
      ],
    } as any;
    expect(verifyCurrentStepArtifact({ status: 'success', tutorAnswer } as any, {
      workspace,
      verificationFailureMessage: 'Verification failed.',
    })).toEqual({ ok: true });
  });

  it('rejects an ambiguous Code slot with two distinct integers', () => {
    const workspace = {
      currentIndex: 1,
      steps: [
        { lineNumber: 4, visualData: { vars: {} } },
        { lineNumber: 9, visualData: { vars: { i: 2 } } },
        { lineNumber: 12, visualData: { vars: {} } },
      ],
    } as any;
    const tutorAnswer = 'Code: Line 9 follows line 8.\nData: i = 2.\nVisual: array.\nReasoning: selected.\nTime: 2 / 3.';
    expect(verifyCurrentStepArtifact({ status: 'success', tutorAnswer } as any, {
      workspace,
      verificationFailureMessage: 'Verification failed.',
    })).toEqual({ ok: false, reason: 'Verification failed.' });
  });

  it.each([
    ['en', 'The current-step explanation could not be verified. The workspace was not changed.'],
    ['tr', 'Geçerli adım açıklaması doğrulanamadı. Çalışma alanı değiştirilmedi.'],
  ] as const)('does not apply an unverified current-step artifact in %s', async (locale, message) => {
    const applyResult = vi.fn();
    const committedWorkspace = { algorithmName: 'DFS' };
    const run = startDiscussCurrentStepPipeline({
      request: 'explain this step',
      intent: { type: 'discuss-current-step' },
      locale,
      workspace: { steps: [], currentIndex: 0 } as any,
      activePackage: null,
      onPlan: vi.fn(),
      applyPackage: vi.fn(),
      applyInput: vi.fn(),
      verificationFailureMessage: message,
      applyResult,
      startRun: () => ({
        runId: 'engine-run',
        promise: Promise.resolve({
          status: 'success',
          runId: 'engine-run',
          plan: { version: 1, runId: 'engine-run', request: 'explain this step', intent: 'discuss-current-step', jobs: [], createdAt: 1 },
          summary: 'Ungrounded explanation.',
        }),
        cancel: vi.fn(),
      }),
    });
    await expect(run.promise).rejects.toThrow(message);
    expect(applyResult).not.toHaveBeenCalled();
    expect(committedWorkspace).toEqual({ algorithmName: 'DFS' });
  });

  it('carries adapt-input through five stages and applies only the verified package', async () => {
    const applyInput = vi.fn();
    const input = { kind: 'array', text: '[4,9,2]' } as any;
    const workspace = {
      algorithmName: 'Bubble Sort', code: '', steps: [], currentIndex: 0,
    } as any;
    const steps = await generateSimulationSteps(workspace.algorithmName, workspace.code, input);
    const result = {
      status: 'success' as const,
      runId: 'engine-adapt',
      plan: { version: 1 as const, runId: 'engine-adapt', request: 'change input', intent: 'adapt-input' as const, jobs: [], createdAt: 1 },
      summary: 'Adapted.',
      input,
      steps,
    };
    const run = startAdaptInputPipeline({
      request: 'change input',
      intent: { type: 'adapt-input' },
      locale: 'en',
      workspace,
      activePackage: null,
      onPlan: vi.fn(),
      applyPackage: vi.fn(),
      applyInput,
      verificationFailureMessage: 'Adaptation failed.',
      startRun: (options) => {
        expect(options.deferApply).toBe(true);
        return { runId: 'engine-adapt', promise: Promise.resolve(result), cancel: vi.fn() };
      },
    });
    await expect(run.promise).resolves.toBe(result);
    expect(applyInput).toHaveBeenCalledOnce();
  });

  it('defers the deterministic array engine apply and applies its verified package exactly once', async () => {
    const applyPackage = vi.fn();
    const packageValue = {
      id: 'array-template',
      tests: { passed: true },
    } as any;
    const result = {
      status: 'success' as const,
      runId: 'engine-array',
      plan: { version: 1 as const, runId: 'engine-array', request: 'Jump Game DP', intent: 'create-algorithm' as const, jobs: [], createdAt: 1 },
      summary: 'Created.',
      package: packageValue,
      input: { kind: 'array', text: '[2,3,1,1,4]' } as any,
      steps: [{ explanation: 'Final', visualData: { type: 'variables', vars: { result: true } } }] as any,
    };
    const plans: string[][] = [];
    const run = startArrayTemplatePipeline({
      request: 'Jump Game DP çöz ve simüle et',
      intent: { type: 'create-algorithm', template: 'jump-game-dp' },
      locale: 'tr',
      workspace: { steps: [], currentIndex: 0 } as any,
      activePackage: null,
      onPlan: (plan) => plans.push(plan.jobs.map((job) => `${job.id}:${job.status}`)),
      applyPackage,
      applyInput: vi.fn(),
      verificationFailureMessage: 'Creation failed.',
      startRun: (options) => {
        expect(options.deferApply).toBe(true);
        expect(options.applyPackage).toBe(applyPackage);
        return { runId: 'engine-array', promise: Promise.resolve(result), cancel: vi.fn() };
      },
    });
    await expect(run.promise).resolves.toBe(result);
    expect(applyPackage).toHaveBeenCalledTimes(1);
    expect(applyPackage).toHaveBeenCalledWith(packageValue, run.runId);
    expect(plans.at(-1)).toEqual([
      'titan-route:completed',
      'titan-produce:completed',
      'titan-semantics:completed',
      'titan-verify:completed',
      'titan-apply:completed',
    ]);
  });

  it('independently verifies a model-authored package before previewing and applying it exactly once', async () => {
    const packageValue = createModelAuthoredPackage();
    const ordering: string[] = [];
    const previewSource = vi.fn(() => { ordering.push('preview'); });
    const applyPackage = vi.fn(() => { ordering.push('apply'); });
    const result = {
      status: 'success' as const,
      runId: 'engine-model',
      plan: { version: 1 as const, runId: 'engine-model', request: 'author', intent: 'create-algorithm' as const, jobs: [], createdAt: 1 },
      summary: 'Created.',
      package: packageValue,
      steps: packageValue.steps,
    };
    const run = startModelAuthoredPipeline({
      request: 'author a custom array scan',
      intent: { type: 'create-algorithm', template: 'model-authored' },
      locale: 'en',
      workspace: { steps: [], currentIndex: 0 } as any,
      activePackage: null,
      onPlan: vi.fn(),
      previewSource,
      applyPackage,
      applyInput: vi.fn(),
      verificationFailureMessage: 'Model artifact failed verification.',
      startRun: (options) => {
        expect(options.deferApply).toBe(true);
        expect(options.previewSource).toBeUndefined();
        ordering.push('produce');
        return { runId: 'engine-model', promise: Promise.resolve(result), cancel: vi.fn() };
      },
    });
    await expect(run.promise).resolves.toBe(result);
    expect(ordering).toEqual(['produce', 'preview', 'apply']);
    expect(previewSource).toHaveBeenCalledWith(packageValue.source.code, packageValue.title, run.runId);
    expect(previewSource).toHaveBeenCalledOnce();
    expect(applyPackage).toHaveBeenCalledWith(packageValue, run.runId);
    expect(applyPackage).toHaveBeenCalledOnce();
  });

  it('rejects an empty carried model trace before preview and preserves every workspace snapshot field', async () => {
    const packageValue = { ...createModelAuthoredPackage(), steps: [] };
    const workspace = {
      algorithmName: 'Committed Algorithm',
      code: 'function committed() {}',
      steps: [{ explanation: 'Committed step' }],
      currentIndex: 1,
      analysis: 'Committed analysis',
      inputError: 'Committed input error',
    };
    const snapshot = structuredClone(workspace);
    const previewSource = vi.fn();
    const applyPackage = vi.fn();
    const run = startModelAuthoredPipeline({
      request: 'author a custom array scan',
      intent: { type: 'create-algorithm', template: 'model-authored' },
      locale: 'en',
      workspace: workspace as any,
      activePackage: null,
      onPlan: vi.fn(),
      previewSource,
      applyPackage,
      applyInput: vi.fn(),
      verificationFailureMessage: 'Model artifact failed verification.',
      startRun: (options) => {
        expect(options.previewSource).toBeUndefined();
        return {
          runId: 'engine-model',
          promise: Promise.resolve({
            status: 'success' as const,
            runId: 'engine-model',
            plan: { version: 1 as const, runId: 'engine-model', request: 'author', intent: 'create-algorithm' as const, jobs: [], createdAt: 1 },
            summary: 'Created.',
            package: packageValue,
            steps: packageValue.steps,
          }),
          cancel: vi.fn(),
        };
      },
    });
    await expect(run.promise).rejects.toThrow('Model artifact failed verification.');
    expect(previewSource).not.toHaveBeenCalled();
    expect(applyPackage).not.toHaveBeenCalled();
    expect(workspace.algorithmName).toBe(snapshot.algorithmName);
    expect(workspace.code).toBe(snapshot.code);
    expect(workspace.steps).toEqual(snapshot.steps);
    expect(workspace.currentIndex).toBe(snapshot.currentIndex);
    expect(workspace.analysis).toBe(snapshot.analysis);
    expect(workspace.inputError).toBe(snapshot.inputError);
  });

  it('rejects a well-formed artifact whose carried trace disagrees with independent recomputation', async () => {
    const input = { kind: 'array', text: '[4,9,2]', origin: 'user' } as any;
    const workspace = {
      algorithmName: 'Bubble Sort', code: '', simulationInput: { kind: 'array', text: '[3,1,2]' },
      steps: [{ explanation: 'Committed timeline' }], currentIndex: 1,
    } as any;
    const correct = await generateSimulationSteps(workspace.algorithmName, workspace.code, input);
    const result = {
      status: 'success' as const, runId: 'engine-adapt',
      plan: { version: 1 as const, runId: 'engine-adapt', request: 'change input', intent: 'adapt-input' as const, jobs: [], createdAt: 1 },
      summary: 'Produced successfully.', input,
      steps: [{ ...correct[0], explanation: 'Tampered but well-formed trace.' }],
    };
    const inputIdentity = workspace.simulationInput;
    const timelineIdentity = workspace.steps;
    const packageIdentity = { id: 'committed-package' };
    const applyPackage = vi.fn();
    const applyInput = vi.fn();
    const ordering: string[] = [];
    const run = startAdaptInputPipeline({
      request: 'change input', intent: { type: 'adapt-input' }, locale: 'en', workspace,
      activePackage: packageIdentity as any, onPlan: vi.fn(), applyPackage, applyInput,
      verificationFailureMessage: 'The input adaptation could not be verified. The workspace was not changed.',
      startRun: (options) => {
        expect(options.deferApply).toBe(true);
        ordering.push('produce');
        return { runId: 'engine-adapt', promise: Promise.resolve(result), cancel: vi.fn() };
      },
    });
    await expect(run.promise).rejects.toThrow('workspace was not changed');
    ordering.push('rejected');
    expect(ordering).toEqual(['produce', 'rejected']);
    expect(applyPackage).not.toHaveBeenCalled();
    expect(applyInput).not.toHaveBeenCalled();
    expect(workspace.simulationInput).toBe(inputIdentity);
    expect(workspace.steps).toBe(timelineIdentity);
    expect(workspace.currentIndex).toBe(1);
    expect(packageIdentity).toEqual({ id: 'committed-package' });
  });

  it('measures independent verification on the largest semantic package input', async () => {
    const input = { kind: 'array', text: JSON.stringify(Array.from({ length: 20 }, (_, index) => 20 - index)), origin: 'user' } as any;
    const workspace = { algorithmName: 'Bubble Sort', code: '', simulationInput: input, steps: [], currentIndex: 0 } as any;
    const steps = await generateSimulationSteps(workspace.algorithmName, workspace.code, input);
    const result = {
      status: 'success' as const, runId: 'measure',
      plan: { version: 1 as const, runId: 'measure', request: 'resize', intent: 'adapt-input' as const, jobs: [], createdAt: 1 },
      summary: 'Measured.', input, steps,
    };
    const iterations = 25;
    const beforeStart = performance.now();
    for (let index = 0; index < iterations; index += 1) {
      Boolean(result.status === 'success' && result.input && result.steps.length);
    }
    const beforeMs = performance.now() - beforeStart;
    const afterStart = performance.now();
    for (let index = 0; index < iterations; index += 1) {
      await expect(verifyAdaptInputArtifact(result, {
        workspace, locale: 'en', verificationFailureMessage: 'failed',
      })).resolves.toEqual({ ok: true });
    }
    const afterMs = performance.now() - afterStart;
    console.info(`ADAPT_VERIFY_MEASUREMENT {"size":20,"iterations":${iterations},"beforeMs":${beforeMs.toFixed(3)},"afterMs":${afterMs.toFixed(3)}}`);
  });

  it('preserves workspace, package, and timeline identity when adapt-input verification fails', async () => {
    const committed = {
      workspace: { input: '[3,1,2]' },
      package: { id: 'committed' },
      timeline: [{ id: 'committed-step' }],
    };
    const applyPackage = vi.fn();
    const applyInput = vi.fn();
    const run = startAdaptInputPipeline({
      request: 'impossible input',
      intent: { type: 'adapt-input' },
      locale: 'en',
      workspace: { steps: committed.timeline, currentIndex: 0 } as any,
      activePackage: committed.package as any,
      onPlan: vi.fn(),
      applyPackage,
      applyInput,
      verificationFailureMessage: 'The input adaptation could not be verified. The workspace was not changed.',
      startRun: () => ({
        runId: 'engine-adapt',
        promise: Promise.resolve({
          status: 'success', runId: 'engine-adapt',
          plan: { version: 1, runId: 'engine-adapt', request: 'impossible input', intent: 'adapt-input', jobs: [], createdAt: 1 },
          summary: 'Invalid empty timeline.', input: { kind: 'array', text: '[]' }, steps: [],
        }),
        cancel: vi.fn(),
      }),
    });
    await expect(run.promise).rejects.toThrow('workspace was not changed');
    expect(applyPackage).not.toHaveBeenCalled();
    expect(applyInput).not.toHaveBeenCalled();
    expect(committed).toEqual({
      workspace: { input: '[3,1,2]' },
      package: { id: 'committed' },
      timeline: [{ id: 'committed-step' }],
    });
  });
});
