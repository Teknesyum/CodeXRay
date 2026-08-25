import { describe, expect, it } from 'vitest';
import { LOCAL_AI_MODELS } from './localAiModels';
import { createJavaFallbackPlan, isWebProblemSolveCapable, translateJavaFallbackCandidate, validateManagerPlanV2 } from './webProblemOrchestrator';

describe('web problem orchestration', () => {
  it('gates small profiles without switching models', () => {
    expect(LOCAL_AI_MODELS.map((model) => isWebProblemSolveCapable(model.id))).toEqual([false, false, true, true, true]);
  });

  it('creates a dependency-checked serial WebGPU plan', () => {
    const plan = createJavaFallbackPlan('solve');
    expect(() => validateManagerPlanV2(plan)).not.toThrow();
    expect(plan.jobs.filter((job) => job.resourceLocks.includes('webgpu')).map((job) => job.id)).toEqual(['java-author', 'critic', 'translator']);
    expect(plan.jobs.find((job) => job.id === 'java-author')?.maxAttempts).toBe(2);
  });

  it('rejects cycles and missing dependencies', () => {
    const missing = createJavaFallbackPlan('solve');
    missing.jobs[0].dependsOn = ['missing'];
    expect(() => validateManagerPlanV2(missing)).toThrow(/missing dependency/);
    const cyclic = createJavaFallbackPlan('solve');
    cyclic.jobs[0].dependsOn = ['publish'];
    expect(() => validateManagerPlanV2(cyclic)).toThrow(/cycle/);
  });

  it('keeps the committed workspace untouched when translation compilation fails', () => {
    const workspace = { code: 'committed code', input: '[9,4,1]', packageId: 'committed-package', badge: false };
    const apply = (packageId: string) => {
      workspace.packageId = packageId;
      workspace.badge = true;
    };
    const result = translateJavaFallbackCandidate({
      id: 'failed-web-translation',
      locale: 'en',
      originalSource: 'class Solution {}',
      envelope: {
        title: 'Rejected translation',
        attempts: [['not valid SimLang-Lite']],
        input: { version: 1, kind: 'array', description: 'Fixture', constraints: [], value: { kind: 'array', text: '[1]' } },
        visualization: { version: 1, type: 'variables', activeVariables: [], queuedVariables: [], visitedVariables: [] },
        analysis: 'Must not commit.',
      },
      verifiedAt: 123,
    });
    if (result.ok) apply(result.package.id);
    expect(result.ok).toBe(false);
    expect(workspace).toEqual({ code: 'committed code', input: '[9,4,1]', packageId: 'committed-package', badge: false });
  });
});
