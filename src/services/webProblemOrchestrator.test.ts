import { describe, expect, it } from 'vitest';
import { LOCAL_AI_MODELS } from './localAiModels';
import { createJavaFallbackPlan, isWebProblemSolveCapable, validateManagerPlanV2 } from './webProblemOrchestrator';

describe('web problem orchestration', () => {
  it('gates small profiles without switching models', () => {
    expect(LOCAL_AI_MODELS.map((model) => isWebProblemSolveCapable(model.id))).toEqual([false, false, true, true, true]);
  });

  it('creates a dependency-checked serial WebGPU plan', () => {
    const plan = createJavaFallbackPlan('solve');
    expect(() => validateManagerPlanV2(plan)).not.toThrow();
    expect(plan.jobs.filter((job) => job.resourceLocks.includes('webgpu')).map((job) => job.id)).toEqual(['java-author', 'critic']);
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
});
