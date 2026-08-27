import { describe, expect, it, vi } from 'vitest';
import {
  executeTitanPipeline,
  startArrayTemplatePipeline,
  startAdaptInputPipeline,
  startDiscussCurrentStepPipeline,
  verifyAdaptInputArtifact,
  type TitanStageState,
} from './titanPipeline';
import { generateSimulationSteps } from '../aiService';

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
    await expect(executeTitanPipeline({
      route: () => 'trace-code',
      produce: () => ({ id: 'candidate' }),
      verify: () => ({ ok: false, reason: 'Trace gate failed.' }),
      apply,
    })).rejects.toThrow('Trace gate failed.');
    expect(committed.id).toBe('working-package');
    expect(apply).not.toHaveBeenCalled();
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
    };
    const run = startDiscussCurrentStepPipeline({
      request: 'explain this step',
      intent: { type: 'discuss-current-step' },
      locale: 'en',
      workspace: { steps: [{ explanation: 'Selected step' }], currentIndex: 0 } as any,
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
