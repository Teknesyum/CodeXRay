import type { TitanModeOrchestratorOptions, TitanModeRunHandle, TitanModeRunResult } from '../titanEngine';
import { startTitanModeRun as startTitanEngineRun, preflightCatalogProblem } from '../titanEntry';
import type { AgentJobStatus, TitanModeAgentRole, ManagerJobV1, ManagerPlanV1 } from '../../types/titan';
import type { SimulationStep } from '../../types/simulation';
import { generateSimulationSteps } from '../aiService';
import { recompileSimulationInput } from '../recompileSimulationInput';
import { compileCustomSimulationPackage } from '../customSimulationCompiler';
import type { JavaFallbackRun } from '../webProblemOrchestrator';
import type { AgentAttemptV1, ManagerPlanV2, SolutionArtifactV1 } from '../../types/webSource';
import type { CustomSimulationPackageV1 } from '../../types/titan';

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
  try {
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
  } catch (error) {
    for (const id of stageOrder) {
      if (states.get(id)?.status === 'waiting') {
        publish(id, 'cancelled', 'Skipped because an earlier pipeline stage failed.');
      }
    }
    throw error;
  }
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

export interface ArrayTemplatePipelineOptions extends TitanModeOrchestratorOptions {
  verificationFailureMessage: string;
  startRun?: (options: TitanModeOrchestratorOptions) => TitanModeRunHandle;
}

export interface ModelAuthoredPipelineOptions extends TitanModeOrchestratorOptions {
  verificationFailureMessage: string;
  startRun?: (options: TitanModeOrchestratorOptions) => TitanModeRunHandle;
}

const arrayTemplateIds = new Set([
  'jump-game-dp',
  'jump-game-greedy',
  'lis-quadratic-dp',
  'lis-binary-search',
]);

export const isArrayTemplateCreationIntent = (intent: TitanModeOrchestratorOptions['intent']): boolean =>
  intent.type === 'create-algorithm' && arrayTemplateIds.has(intent.template);

export const isModelAuthoredCreationIntent = (intent: TitanModeOrchestratorOptions['intent']): boolean =>
  intent.type === 'create-algorithm' && intent.template === 'model-authored';

const sameTrace = (left: SimulationStep[], right: SimulationStep[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const verifyAdaptInputArtifact = (
  result: TitanModeRunResult,
  options: Pick<AdaptInputPipelineOptions, 'workspace' | 'locale' | 'verificationFailureMessage'>,
): Promise<{ ok: true } | { ok: false; reason: string }> => {
  if (result.status !== 'success' || !result.input || !result.steps?.length) {
    return Promise.resolve({ ok: false, reason: options.verificationFailureMessage });
  }
  const input = result.input;
  const carriedSteps = result.steps;
  return (async () => {
    try {
      const verificationInput = structuredClone(input);
      const recomputed = result.package
        ? recompileSimulationInput({
          activePackage: result.package,
          input: verificationInput,
          locale: options.locale,
          workspace: options.workspace,
        }).steps
        : await generateSimulationSteps(options.workspace.algorithmName, options.workspace.code, verificationInput);
      return sameTrace(carriedSteps, recomputed)
        ? { ok: true }
        : { ok: false, reason: options.verificationFailureMessage };
    } catch {
      return { ok: false, reason: options.verificationFailureMessage };
    }
  })();
};

export const verifyModelAuthoredArtifact = (
  result: TitanModeRunResult,
  verificationFailureMessage: string,
): { ok: true } | { ok: false; reason: string } => {
  if (result.status !== 'success' || !result.package) {
    return { ok: false, reason: verificationFailureMessage };
  }
  try {
    const candidate = result.package;
    const recomputed = compileCustomSimulationPackage({
      id: candidate.id,
      title: candidate.title,
      locale: candidate.locale,
      program: structuredClone(candidate.program),
      input: structuredClone(candidate.input),
      visualization: structuredClone(candidate.visualization),
      analysis: candidate.analysis,
    });
    const sourceMatches = JSON.stringify(candidate.source) === JSON.stringify(recomputed.source);
    const traceMatches = sameTrace(candidate.steps, recomputed.steps);
    const testsMatch = candidate.tests.passed
      && recomputed.tests.passed
      && JSON.stringify(candidate.tests.results) === JSON.stringify(recomputed.tests.results);
    return sourceMatches && traceMatches && testsMatch
      ? { ok: true }
      : { ok: false, reason: verificationFailureMessage };
  } catch {
    return { ok: false, reason: verificationFailureMessage };
  }
};

export interface WebProblemFallbackArtifact {
  solution: SolutionArtifactV1;
  package: CustomSimulationPackageV1;
}

export const verifyWebProblemFallbackArtifact = (
  artifact: WebProblemFallbackArtifact,
  verificationFailureMessage: string,
): { ok: true } | { ok: false; reason: string } => {
  try {
    const candidate = artifact.package;
    const recomputed = compileCustomSimulationPackage({
      id: candidate.id,
      title: candidate.title,
      locale: candidate.locale,
      program: structuredClone(candidate.program),
      input: structuredClone(candidate.input),
      visualization: structuredClone(candidate.visualization),
      analysis: candidate.analysis,
    });
    const sourceMatches = JSON.stringify(candidate.source) === JSON.stringify(recomputed.source);
    const traceMatches = sameTrace(candidate.steps, recomputed.steps);
    const testsMatch = candidate.tests.passed
      && recomputed.tests.passed
      && JSON.stringify(candidate.tests.results) === JSON.stringify(recomputed.tests.results);
    return sourceMatches && traceMatches && testsMatch
      ? { ok: true }
      : { ok: false, reason: verificationFailureMessage };
  } catch {
    return { ok: false, reason: verificationFailureMessage };
  }
};

const fiveLensLabels = new Map([
  ['code', 'code'], ['kod', 'code'],
  ['data', 'data'], ['veri', 'data'],
  ['visual', 'visual'], ['görsel', 'visual'],
  ['reasoning', 'reasoning'], ['mantık', 'reasoning'],
  ['time', 'time'], ['zaman', 'time'],
]);

const extractFiveLenses = (answer: string): Map<string, string> | null => {
  const lenses = new Map<string, string>();
  for (const rawLine of answer.split(/\r?\n/)) {
    const match = rawLine.match(/^\s*(?:[-*]\s*)?(?:\*\*)?([^:*]+?)(?:\*\*)?\s*:\s*(.*)$/u);
    if (!match) continue;
    const key = fiveLensLabels.get(match[1].trim().toLocaleLowerCase('tr-TR'));
    if (key && !lenses.has(key)) lenses.set(key, match[2].trim());
  }
  return lenses.size === 5 ? lenses : null;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const extractDistinctIntegers = (value: string): number[] => [
  ...new Set([...value.matchAll(/(?<![\p{L}\p{N}_])-?\d+(?![\p{L}\p{N}_])/gu)]
    .map((match) => Number(match[0]))),
];

const dataLensMatchesVariables = (dataLens: string, variables: Record<string, unknown>): boolean => {
  const objectStart = dataLens.indexOf('{');
  const objectEnd = dataLens.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      const stated = JSON.parse(dataLens.slice(objectStart, objectEnd + 1)) as unknown;
      if (typeof stated !== 'object' || stated === null || Array.isArray(stated)) return false;
      const entries = Object.entries(stated);
      return entries.length > 0 && entries.every(([key, value]) =>
        Object.hasOwn(variables, key)
        && JSON.stringify(value) === JSON.stringify(variables[key]));
    } catch {
      return false;
    }
  }
  let bindingCount = 0;
  for (const [key, value] of Object.entries(variables)) {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) continue;
    const prefix = new RegExp(
      `(?:^|[^\\p{L}\\p{N}_])['"]?${escapeRegExp(key)}['"]?\\s*(?::|=|\\bis\\b|\\bvalue(?:\\s+is|\\s+of)?\\b|\\bdeğeri\\b)\\s*`,
      'giu',
    );
    for (const match of dataLens.matchAll(prefix)) {
      bindingCount += 1;
      const statedValue = dataLens.slice((match.index ?? 0) + match[0].length);
      const committedValue = new RegExp(
        `^${escapeRegExp(serialized)}(?=$|[^\\p{L}\\p{N}_])`,
        'u',
      );
      if (!committedValue.test(statedValue)) return false;
    }
  }
  return bindingCount > 0;
};

export const verifyCurrentStepArtifact = (
  result: TitanModeRunResult,
  options: Pick<DiscussCurrentStepPipelineOptions, 'workspace' | 'verificationFailureMessage'>,
): { ok: true } | { ok: false; reason: string } => {
  const fail = { ok: false as const, reason: options.verificationFailureMessage };
  const step = options.workspace.steps[options.workspace.currentIndex];
  if (result.status !== 'success' || !step) return fail;
  const answer = result.tutorAnswer?.trim() || '';
  if (!answer) return fail;
  const lenses = extractFiveLenses(answer);
  if (!lenses) return fail;

  const expectedLine = step.lineNumber;
  const codeLens = lenses.get('code')!;
  const lineNumbers = extractDistinctIntegers(codeLens);
  const lineMatches = expectedLine === null
    ? lineNumbers.length === 0 && /(?:result|final|sonuç)\s+(?:step|adım)/iu.test(codeLens)
    : lineNumbers.length === 1 && lineNumbers[0] === expectedLine;
  const dataMatches = dataLensMatchesVariables(lenses.get('data')!, step.visualData.vars);
  const timeMatch = lenses.get('time')!.match(/(?:Step\s+)?(\d+)\s*\/\s*(\d+)(?:\.\s*adım)?/iu);
  const timeMatches = Number(timeMatch?.[1]) === options.workspace.currentIndex + 1
    && Number(timeMatch?.[2]) === options.workspace.steps.length;
  return lineMatches && dataMatches && timeMatches ? { ok: true } : fail;
};

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
    verify: (result) => verifyCurrentStepArtifact(result, options),
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
    verify: (result) => verifyAdaptInputArtifact(result, options),
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

export const startArrayTemplatePipeline = (
  options: ArrayTemplatePipelineOptions,
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
      if (!isArrayTemplateCreationIntent(options.intent)) {
        throw new Error('The array-template pipeline only accepts deterministic array templates.');
      }
      activeRun = (options.startRun ?? startTitanEngineRun)({
        ...options,
        deferApply: true,
        onPlan: () => undefined,
        onEvent: undefined,
      });
      return activeRun.promise;
    },
    verify: (result) => {
      if (result.status !== 'success') {
        return { ok: false as const, reason: options.verificationFailureMessage };
      }
      const finalStep = result.steps?.at(-1);
      return Boolean(result.package?.tests.passed)
        && Boolean(result.steps?.length)
        && Boolean(finalStep && Object.prototype.hasOwnProperty.call(finalStep.visualData.vars, 'result'))
        ? { ok: true as const }
        : { ok: false as const, reason: options.verificationFailureMessage };
    },
    apply: (result) => {
      if (result.status !== 'success' || !result.package) throw new Error(options.verificationFailureMessage);
      return options.applyPackage(result.package, runId);
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

export const startModelAuthoredPipeline = (
  options: ModelAuthoredPipelineOptions,
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
      if (!isModelAuthoredCreationIntent(options.intent)) {
        throw new Error('The model-authored pipeline only accepts the model-authored template.');
      }
      activeRun = (options.startRun ?? startTitanEngineRun)({
        ...options,
        deferApply: true,
        previewSource: undefined,
        onPlan: () => undefined,
        onEvent: undefined,
      });
      return activeRun.promise;
    },
    verify: (result) => verifyModelAuthoredArtifact(result, options.verificationFailureMessage),
    apply: async (result) => {
      if (result.status !== 'success' || !result.package) throw new Error(options.verificationFailureMessage);
      await options.previewSource?.(result.package.source.code, result.package.title, runId);
      await options.applyPackage(result.package, runId);
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

export interface WebProblemFallbackPipelineOptions {
  request: string;
  verificationFailureMessage: string;
  onPlan?: (plan: ManagerPlanV2) => void;
  startRun: () => JavaFallbackRun;
  applyArtifact: (artifact: WebProblemFallbackArtifact, runId: string) => void | Promise<void>;
}

export const startWebProblemFallbackPipeline = (
  options: WebProblemFallbackPipelineOptions,
): JavaFallbackRun => {
  const controller = new AbortController();
  const runId = `titan-web-pipeline-${crypto.randomUUID()}`;
  let activeRun: JavaFallbackRun | null = null;
  const createdAt = Date.now();
  const stages = new Map<TitanStageId, TitanStageState>(stageOrder.map((id) => [id, {
    id,
    status: 'waiting',
    detail: 'Waiting.',
  }]));
  const buildPlan = (): ManagerPlanV2 => ({
    version: 2,
    runId,
    request: options.request,
    intent: 'solve-web-problem',
    createdAt,
    jobs: stageOrder.map((id, index) => {
      const state = stages.get(id)!;
      return {
        version: 2,
        id: `titan-${id}`,
        role: stageRole[id],
        label: id,
        dependsOn: index === 0 ? [] : [`titan-${stageOrder[index - 1]}`],
        consumes: [],
        produces: [],
        resourceLocks: id === 'apply' ? ['workspace'] : [],
        status: state.status === 'skipped' ? 'completed' : state.status,
        attempt: state.status === 'waiting' ? 0 : 1,
        maxAttempts: 1,
        summary: state.status === 'skipped' ? state.detail : undefined,
        error: state.status === 'failed' ? state.detail : undefined,
      };
    }),
  });
  const publishPlan = (stage: TitanStageState) => {
    stages.set(stage.id, stage);
    options.onPlan?.(buildPlan());
  };
  const promise = executeTitanPipeline({
    route: () => ({ type: 'solve-web-problem' as const }),
    produce: async () => {
      activeRun = options.startRun();
      return activeRun.promise;
    },
    verify: (artifact) => verifyWebProblemFallbackArtifact(
      artifact,
      options.verificationFailureMessage,
    ),
    apply: (artifact) => options.applyArtifact(artifact, runId),
    signal: controller.signal,
    onStage: publishPlan,
  }).then(({ artifact }) => artifact);
  return {
    runId,
    get plan() { return buildPlan(); },
    get attempts(): AgentAttemptV1[] { return activeRun?.attempts ?? []; },
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
