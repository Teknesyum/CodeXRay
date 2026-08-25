import { describe, expect, it, vi } from 'vitest';
import {
  executeTitanPipeline,
  startDiscussCurrentStepPipeline,
  type TitanStageState,
} from './titanPipeline';

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
});
