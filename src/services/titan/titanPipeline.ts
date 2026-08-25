import type { TitanModeOrchestratorOptions, TitanModeRunHandle, TitanModeRunResult } from '../titanEngine';
import { startTitanModeRun as startTitanEngineRun, preflightCatalogProblem } from '../titanEntry';
import type { AgentJobStatus, TitanModeAgentRole, ManagerJobV1, ManagerPlanV1 } from '../../types/titan';

export type TitanStageId = 'route' | 'produce' | 'semantics' | 'verify' | 'apply';
export type TitanStageStatus = 'waiting' | 'running' | 'completed' | 'skipped' | 'failed' | 'cancelled';

export interface TitanStageState {
  id: TitanStageId;
  status: TitanStageStatus;
  detail: string;
}

export interface TitanPipelineResult<T> {
  artifact: T;
  stages: TitanStageState[];
}

export interface TitanPipelineTasks<Route, Artifact> {
  route: () => Route | Promise<Route>;
  produce: (route: Route) => Artifact | Promise<Artifact>;
  semantics?: (artifact: Artifact) => Artifact | Promise<Artifact>;
  verify: (artifact: Artifact) => { ok: true } | { ok: false; reason: string } | Promise<{ ok: true } | { ok: false; reason: string }>;
  apply: (artifact: Artifact) => void | Promise<void>;
  signal?: AbortSignal;
  onStage?: (stage: TitanStageState) => void;
}

const stageOrder: TitanStageId[] = ['route', 'produce', 'semantics', 'verify', 'apply'];

export const executeTitanPipeline = async <Route, Artifact>(
  tasks: TitanPipelineTasks<Route, Artifact>,
): Promise<TitanPipelineResult<Artifact>> => {
  const states = new Map<TitanStageId, TitanStageState>(stageOrder.map((id) => [id, {
    id,
    status: 'waiting',
    detail: 'Waiting.',
  }]));
  const publish = (id: TitanStageId, status: TitanStageStatus, detail: string) => {
    const state = { id, status, detail };
    states.set(id, state);
    tasks.onStage?.(state);
  };
  const ensureActive = (id: TitanStageId) => {
    if (tasks.signal?.aborted) {
      publish(id, 'cancelled', 'Titan pipeline was cancelled before this stage completed.');
      throw new Error('Titan pipeline was cancelled.');
    }
  };
  const run = async <T>(id: TitanStageId, task: () => T | Promise<T>): Promise<T> => {
    ensureActive(id);
    publish(id, 'running', `${id} is running.`);
    try {
      const value = await task();
      ensureActive(id);
      publish(id, 'completed', `${id} completed.`);
      return value;
    } catch (error) {
      if (states.get(id)?.status !== 'cancelled') {
        publish(id, 'failed', error instanceof Error ? error.message : `${id} failed.`);
      }
      throw error;
    }
  };
  const route = await run('route', tasks.route);
  let artifact = await run('produce', () => tasks.produce(route));
  if (tasks.semantics) artifact = await run('semantics', () => tasks.semantics!(artifact));
  else publish('semantics', 'skipped', 'Skipped because deterministic semantics were already sufficient.');
  const verification = await run('verify', () => tasks.verify(artifact));
  if ('reason' in verification) {
    publish('verify', 'failed', verification.reason);
    throw new Error(verification.reason);
  }
  await run('apply', () => tasks.apply(artifact));
  return { artifact, stages: stageOrder.map((id) => states.get(id)!) };
};

const stagePatterns: Record<TitanStageId, RegExp> = {
  route: /manager-(?:decompose|freeze|catalog-request)/,
  produce: /scout-|architect-|code-author-|input-engineer-|compiler-/,
  semantics: /visual-designer-|layout-engineer-|trace-analyst-|trace-director-/,
  verify: /critic-|result-analyst-/,
  apply: /manager-apply|manager-atomic-apply|tutor-/,
};

const stageRole: Record<TitanStageId, TitanModeAgentRole> = {
  route: 'manager',
  produce: 'compiler',
  semantics: 'visual-designer',
  verify: 'critic',
  apply: 'manager',
};

const stageStateStatus = (status: TitanStageStatus): AgentJobStatus => {
  if (status === 'skipped') return 'completed';
  return status;
};

export interface DiscussCurrentStepPipelineOptions extends TitanModeOrchestratorOptions {
  verificationFailureMessage: string;
  applyResult: (result: TitanModeRunResult) => void | Promise<void>;
  startRun?: (options: TitanModeOrchestratorOptions) => TitanModeRunHandle;
}

export interface AdaptInputPipelineOptions extends TitanModeOrchestratorOptions {
  verificationFailureMessage: string;
  startRun?: (options: TitanModeOrchestratorOptions) => TitanModeRunHandle;
}

export const startDiscussCurrentStepPipeline = (
  options: DiscussCurrentStepPipelineOptions,
): TitanModeRunHandle => {
  const controller = new AbortController();
  const runId = `titan-pipeline-${crypto.randomUUID()}`;
  let activeRun: TitanModeRunHandle | null = null;
  const stages = new Map<TitanStageId, TitanStageState>(stageOrder.map((id) => [id, {
    id,
    status: 'waiting',
    detail: 'Waiting.',
  }]));
  const publishPlan = (stage: TitanStageState) => {
    stages.set(stage.id, stage);
    options.onPlan({
      version: 1,
      runId,
      request: options.request,
      intent: options.intent.type,
      createdAt: Date.now(),
      jobs: stageOrder.map((id, index) => {
        const state = stages.get(id)!;
        return {
          id: `titan-${id}`,
          role: stageRole[id],
          label: id,
          dependsOn: index === 0 ? [] : [`titan-${stageOrder[index - 1]}`],
          weight: 20,
          status: stageStateStatus(state.status),
          attempt: state.status === 'waiting' ? 0 : 1,
          maxAttempts: 1,
          summary: state.status === 'skipped' ? state.detail : undefined,
          error: state.status === 'failed' ? state.detail : undefined,
        };
      }),
    });
  };
  const promise = executeTitanPipeline({
    route: () => options.intent,
    produce: async () => {
      activeRun = (options.startRun ?? startTitanEngineRun)({
        ...options,
        onPlan: () => undefined,
        onEvent: undefined,
      });
      return activeRun.promise;
    },
    verify: (result) => {
      const selectedStepExists = options.workspace.steps[options.workspace.currentIndex] !== undefined;
      const artifactIsNonempty = result.status === 'success'
        && Boolean(result.summary.trim() || result.tutorAnswer?.trim());
      return selectedStepExists && artifactIsNonempty
        ? { ok: true as const }
        : { ok: false as const, reason: options.verificationFailureMessage };
    },
    apply: options.applyResult,
    signal: controller.signal,
    onStage: publishPlan,
  }).then(({ artifact }) => artifact);
  return {
    runId,
    promise,
    cancel: () => {
      controller.abort();
      activeRun?.cancel();
    },
  };
};

export const startAdaptInputPipeline = (
  options: AdaptInputPipelineOptions,
): TitanModeRunHandle => {
  const controller = new AbortController();
  const runId = `titan-pipeline-${crypto.randomUUID()}`;
  let activeRun: TitanModeRunHandle | null = null;
  const stages = new Map<TitanStageId, TitanStageState>(stageOrder.map((id) => [id, {
    id,
    status: 'waiting',
    detail: 'Waiting.',
  }]));
  const publishPlan = (stage: TitanStageState) => {
    stages.set(stage.id, stage);
    options.onPlan({
      version: 1,
      runId,
      request: options.request,
      intent: options.intent.type,
      createdAt: Date.now(),
      jobs: stageOrder.map((id, index) => {
        const state = stages.get(id)!;
        return {
          id: `titan-${id}`,
          role: stageRole[id],
          label: id,
          dependsOn: index === 0 ? [] : [`titan-${stageOrder[index - 1]}`],
          weight: 20,
          status: stageStateStatus(state.status),
          attempt: state.status === 'waiting' ? 0 : 1,
          maxAttempts: 1,
          summary: state.status === 'skipped' ? state.detail : undefined,
          error: state.status === 'failed' ? state.detail : undefined,
        };
      }),
    });
  };
  const promise = executeTitanPipeline({
    route: () => options.intent,
    produce: async () => {
      activeRun = (options.startRun ?? startTitanEngineRun)({
        ...options,
        deferApply: true,
        onPlan: () => undefined,
        onEvent: undefined,
      });
      return activeRun.promise;
    },
    verify: (result) => result.status === 'success' && result.input && result.steps?.length
      ? { ok: true as const }
      : { ok: false as const, reason: options.verificationFailureMessage },
    apply: (result) => {
      if (result.status !== 'success' || !result.input || !result.steps) return;
      if (result.package) {
        return result.visualOnly && options.applyVisualPackage
          ? options.applyVisualPackage(result.package, runId)
          : options.applyPackage(result.package, runId);
      }
      return options.applyInput(result.input, result.steps, runId);
    },
    signal: controller.signal,
    onStage: publishPlan,
  }).then(({ artifact }) => artifact);
  return {
    runId,
    promise,
    cancel: () => {
      controller.abort();
      activeRun?.cancel();
    },
  };
};

const aggregateStatus = (jobs: ManagerJobV1[]): AgentJobStatus => {
  if (!jobs.length) return 'completed';
  if (jobs.some((job) => job.status === 'failed')) return 'failed';
  if (jobs.some((job) => job.status === 'rolled-back')) return 'rolled-back';
  if (jobs.some((job) => job.status === 'running' || job.status === 'retrying')) return 'running';
  if (jobs.every((job) => job.status === 'cancelled')) return 'cancelled';
  if (jobs.every((job) => job.status === 'completed' || job.status === 'cancelled')) return 'completed';
  return 'waiting';
};

export const collapseTitanPlan = (plan: ManagerPlanV1): ManagerPlanV1 => ({
  ...plan,
  jobs: stageOrder.map((id, index): ManagerJobV1 => {
    const jobs = plan.jobs.filter((job) => stagePatterns[id].test(job.id));
    const status = aggregateStatus(jobs);
    return {
      id: `titan-${id}`,
      role: stageRole[id],
      label: id,
      dependsOn: index === 0 ? [] : [`titan-${stageOrder[index - 1]}`],
      weight: 20,
      status,
      attempt: Math.max(0, ...jobs.map((job) => job.attempt)),
      maxAttempts: Math.max(1, ...jobs.map((job) => job.maxAttempts)),
      startedAt: jobs.map((job) => job.startedAt).filter((value): value is number => value !== undefined).sort()[0],
      finishedAt: jobs.every((job) => job.finishedAt !== undefined)
        ? Math.max(0, ...jobs.map((job) => job.finishedAt ?? 0)) : undefined,
      summary: jobs.length ? undefined : 'Skipped because this stage was not required.',
      error: jobs.find((job) => job.error)?.error,
    };
  }),
});

export const startTitanModeRun = (options: TitanModeOrchestratorOptions): TitanModeRunHandle =>
  startTitanEngineRun({
    ...options,
    onPlan: (plan) => options.onPlan(collapseTitanPlan(plan)),
    onEvent: undefined,
  });

export { preflightCatalogProblem };
export type { TitanModeOrchestratorOptions, TitanModeRunHandle, TitanModeRunResult };
