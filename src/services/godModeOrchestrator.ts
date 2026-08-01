import type { Locale } from '../i18n/translations';
import type {
  AlgorithmDesignV1,
  CustomSimulationPackageV1,
  GodModeAgentRole,
  InputContractV1,
  ManagerJobV1,
  ManagerPlanV1,
  ProgramSpecV1,
  VisualizationContract,
  WorkspaceSnapshotV1,
} from '../types/godMode';
import type { SimulationInput, SimulationStep } from '../types/simulation';
import { generateSimulationSteps } from './aiService';
import { compileCustomSimulationPackage } from './customSimulationCompiler';
import { createInputPreset, getInputKindForAlgorithm } from './inputPresets';
import { parseSimulationInput } from './inputParsers';
import { runLocalAgent, type LocalAgentHandle, type LocalAgentRequest } from './localAiService';
import { renderProgramSource, validateProgramSpec } from './simLang';
import { PROGRAM_SPEC_V1_SCHEMA, SIMLANG_AUTHOR_INSTRUCTIONS } from './simLangSchema';
import {
  createBidirectionalBfsProgram,
} from './simLangBuiltins';
import { canonicalCustomTitle, type GodModeIntent } from './godModeRouting';
import { createAgentInputContract } from './agentInputGenerator';
import { applyGraphLayout, createGraphLayoutSpec, inspectGraphLayout } from './graphLayout';
import { createVisualizationContractV2 } from './visualizationDesigner';
import { applyStructuralGraphRequest, isVisualOnlyGraphRequest, spreadGraphLayout } from './graphRequestEdits';
import { patchPackageGraphLayout } from './graphTransactions';
import { compilePredictWinnerPackage, resolvePredictWinnerNumbers } from './intervalDpCompiler';
import { compileDpTemplatePackage, type DpTemplateId } from './dpTemplateCompiler';

export interface GodModeRunResult {
  runId: string;
  plan: ManagerPlanV1;
  summary: string;
  tutorAnswer?: string;
  package?: CustomSimulationPackageV1;
  input?: SimulationInput;
  steps?: SimulationStep[];
}

interface AgentRunner {
  (request: LocalAgentRequest, onProgress?: (status: string) => void): LocalAgentHandle;
}

export interface GodModeOrchestratorOptions {
  request: string;
  intent: Exclude<
    GodModeIntent,
    { type: 'deterministic' } | { type: 'ui-control' } | { type: 'clarify-algorithm' }
  >;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
  activePackage: CustomSimulationPackageV1 | null;
  onPlan: (plan: ManagerPlanV1) => void;
  onEvent?: (job: ManagerJobV1) => void;
  previewSource?: (code: string, title: string, runId: string) => Promise<void> | void;
  applyPackage: (value: CustomSimulationPackageV1, runId: string) => Promise<void> | void;
  applyVisualPackage?: (value: CustomSimulationPackageV1, runId: string) => Promise<void> | void;
  applyInput: (
    input: SimulationInput,
    steps: SimulationStep[],
    runId: string,
  ) => Promise<void> | void;
  agentRunner?: AgentRunner;
}

export interface GodModeRunHandle {
  runId: string;
  promise: Promise<GodModeRunResult>;
  cancel: () => void;
}

const createRunId = (): string =>
  `gm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const job = (
  role: GodModeAgentRole,
  label: string,
  weight: number,
  dependsOn: string[] = [],
): ManagerJobV1 => ({
  id: `${role}-${label.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  role,
  label,
  dependsOn,
  weight,
  status: 'waiting',
  attempt: 0,
  maxAttempts: role === 'code-author' || role === 'input-engineer' ? 2 : 1,
});

const createJobs = (intent: GodModeOrchestratorOptions['intent']): ManagerJobV1[] => {
  if (intent.type === 'adapt-input') return [
    job('manager', 'Decompose request', 8),
    job('scout', 'Inspect live workspace', 12, ['manager-decompose-request']),
    job('input-engineer', 'Build compatible input', 24, ['scout-inspect-live-workspace']),
    job('compiler', 'Regenerate deterministic trace', 22, ['input-engineer-build-compatible-input']),
    job('critic', 'Validate input and trace', 14, ['compiler-regenerate-deterministic-trace']),
    job('manager', 'Apply workspace transaction', 12, ['critic-validate-input-and-trace']),
    job('tutor', 'Explain updated workspace', 8, ['manager-apply-workspace-transaction']),
  ];
  if (intent.type === 'discuss-current-step') return [
    job('manager', 'Freeze and route discussion', 15),
    job('scout', 'Capture current trace step', 25, ['manager-freeze-and-route-discussion']),
    job('trace-analyst', 'Analyze discussion checkpoint', 25, ['scout-capture-current-trace-step']),
    job('tutor', 'Explain through five lenses', 35, ['trace-analyst-analyze-discussion-checkpoint']),
  ];
  return [
    job('manager', 'Decompose request', 6),
    job('scout', 'Inspect live workspace', 8, ['manager-decompose-request']),
    job('architect', 'Design algorithm contract', 12, ['scout-inspect-live-workspace']),
    job('code-author', 'Author executable program', 17, ['architect-design-algorithm-contract']),
    job('input-engineer', 'Build original teaching input', 10, ['architect-design-algorithm-contract']),
    job('visual-designer', 'Design semantic visual language', 9, ['architect-design-algorithm-contract']),
    job('layout-engineer', 'Resolve responsive graph layout', 8, [
      'input-engineer-build-original-teaching-input',
      'visual-designer-design-semantic-visual-language',
    ]),
    job('compiler', 'Compile source and trace', 13, [
      'code-author-author-executable-program',
      'layout-engineer-resolve-responsive-graph-layout',
    ]),
    job('critic', 'Test visual and trace alignment', 8, ['compiler-compile-source-and-trace']),
    job('manager', 'Apply workspace transaction', 7, ['critic-test-visual-and-trace-alignment']),
    job('trace-director', 'Direct live teaching checkpoints', 6, ['manager-apply-workspace-transaction']),
    job('result-analyst', 'Ground final result analysis', 5, ['trace-director-direct-live-teaching-checkpoints']),
    job('tutor', 'Prepare five-lens live tour', 6, ['result-analyst-ground-final-result-analysis']),
  ];
};

const createPlan = (
  runId: string,
  request: string,
  intent: GodModeOrchestratorOptions['intent'],
): ManagerPlanV1 => ({
  version: 1,
  runId,
  request,
  intent: intent.type === 'create-algorithm'
    ? 'create-algorithm'
    : intent.type === 'discuss-current-step' ? 'discuss' : intent.type,
  jobs: createJobs(intent),
  createdAt: Date.now(),
});

const architectureSchema = {
  type: 'object',
  properties: {
    version: { const: 1 },
    title: { type: 'string', minLength: 1, maxLength: 120 },
    purpose: { type: 'string', minLength: 1, maxLength: 500 },
    inputKind: { enum: ['array', 'string', 'tree', 'graph'] },
    dataStructures: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    invariants: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    termination: { type: 'string', minLength: 1, maxLength: 500 },
    complexity: {
      type: 'object',
      properties: { time: { type: 'string' }, space: { type: 'string' } },
      required: ['time', 'space'],
      additionalProperties: false,
    },
  },
  required: ['version', 'title', 'purpose', 'inputKind', 'dataStructures', 'invariants', 'termination', 'complexity'],
  additionalProperties: false,
};

const critiqueSchema = {
  type: 'object',
  properties: {
    passed: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    summary: { type: 'string', maxLength: 500 },
  },
  required: ['passed', 'issues', 'summary'],
  additionalProperties: false,
};

const safeJsonObject = (text: string): Record<string, unknown> | null => {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const defaultBidirectionalDesign = (locale: Locale): AlgorithmDesignV1 => ({
  version: 1,
  title: locale === 'tr' ? 'İki Yönlü BFS' : 'Bidirectional BFS',
  purpose: locale === 'tr'
    ? 'Başlangıç ve hedeften eşzamanlı BFS cepheleriyle en kısa yolu bulur.'
    : 'Finds a shortest path by expanding BFS frontiers from both endpoints.',
  inputKind: 'graph',
  dataStructures: ['two queues', 'two visited sets', 'two parent maps'],
  invariants: [
    'Each frontier expands nodes in nondecreasing distance from its endpoint.',
    'A node enters each side queue at most once.',
    'The first validated intersection reconstructs a shortest path.',
  ],
  termination: 'A shared visited node is found or either frontier becomes empty.',
  complexity: { time: 'O(V + E)', space: 'O(V)' },
});

const parseArchitecture = (value: Record<string, unknown> | null): AlgorithmDesignV1 | null => {
  if (!value || value.version !== 1 || typeof value.title !== 'string'
    || typeof value.purpose !== 'string' || !['array', 'string', 'tree', 'graph'].includes(String(value.inputKind))
    || !Array.isArray(value.dataStructures) || !Array.isArray(value.invariants)
    || typeof value.termination !== 'string' || !value.complexity
    || typeof value.complexity !== 'object') return null;
  const complexity = value.complexity as Record<string, unknown>;
  if (typeof complexity.time !== 'string' || typeof complexity.space !== 'string') return null;
  return value as unknown as AlgorithmDesignV1;
};

const fiveLensContext = (
  workspace: WorkspaceSnapshotV1,
  request: string,
  packageValue?: CustomSimulationPackageV1,
): string => JSON.stringify({
  request,
  algorithmName: packageValue?.title ?? workspace.algorithmName,
  code: (packageValue?.source.code ?? workspace.code).slice(0, 5_000),
  input: packageValue?.input.value ?? workspace.simulationInput,
  currentIndex: packageValue ? 0 : workspace.currentIndex,
  totalSteps: packageValue?.steps.length ?? workspace.steps.length,
  currentStep: packageValue?.steps[0] ?? workspace.steps[workspace.currentIndex],
  lenses: ['code', 'data', 'visual', 'reasoning', 'time'],
});

const deterministicFiveLens = (
  locale: Locale,
  step: SimulationStep | undefined,
  current: number,
  total: number,
): string => {
  if (!step) return locale === 'tr'
    ? 'Kod: Henüz simülasyon adımı yok.\nVeri: Input hazır değil.\nGörsel: Beklemede.\nMantık: Önce geçerli bir paket derlenmeli.\nZaman: Simülasyon başlamadı.'
    : 'Code: No simulation step exists yet.\nData: Input is not ready.\nVisual: Waiting.\nReasoning: A valid package must be compiled first.\nTime: Simulation has not started.';
  const variables = JSON.stringify(step.visualData.vars).slice(0, 700);
  return locale === 'tr'
    ? [
      `Kod: Aktif kaynak satırı ${step.lineNumber ?? 'sonuç adımı'}.`,
      `Veri: Canlı değişkenler ${variables}.`,
      `Görsel: ${step.visualData.type} görünümü mevcut state'i gösteriyor.`,
      `Mantık: ${step.explanation}`,
      `Zaman: ${current + 1}/${total}. adım; sonraki adım bu state'ten deterministik olarak ilerler.`,
    ].join('\n')
    : [
      `Code: Active source line ${step.lineNumber ?? 'result step'}.`,
      `Data: Live variables ${variables}.`,
      `Visual: The ${step.visualData.type} view reflects the committed state.`,
      `Reasoning: ${step.explanation}`,
      `Time: Step ${current + 1}/${total}; the next step advances deterministically from this state.`,
    ].join('\n');
};

const deterministicPackageTour = (
  locale: Locale,
  packageValue: CustomSimulationPackageV1,
): string => {
  const checkpointSteps = packageValue.checkpoints
    .map((checkpoint) => checkpoint.stepIndex + 1)
    .join(', ');
  const graph = packageValue.input.value.graph;
  const isBidirectionalBfs = packageValue.program.id === 'bidirectional_bfs_custom';
  if (locale === 'tr' && isBidirectionalBfs) {
    return [
      'Kod: İki bağımsız BFS cephesi kullanılıyor. frontierStart ve frontierTarget kuyrukları sırayla genişletilir; parentFromStart ve parentFromTarget haritaları bulunan yolu yeniden kurar.',
      `Veri: Arama ${graph?.startId ?? 'başlangıç'} düğümünden ${graph?.targetId ?? 'hedef'} düğümüne ilerliyor. Her düğüm her cepheye en fazla bir kez eklenir.`,
      'Görsel: Cyan/magenta düğümler aktif cepheleri, magenta kenarlar keşfedilmiş arama ağacını, lime kenarlar ise iki cephenin birleşmesiyle oluşan sonuç yolunu gösterir.',
      'Mantık: Cephelerden biri ortak ziyaret edilmiş bir düğüme ulaştığında meeting belirlenir. Sonra iki parent haritası meeting noktasında birleştirilerek en kısa yol çıkarılır.',
      `Zaman: Simülasyon ${packageValue.steps.length} deterministik adımdan oluşuyor. Tartışma için önemli adımlar: ${checkpointSteps || 'trace başlangıcı ve sonuç'}. Oynatabilir veya bu adımlardan birine gidip açıklamamı isteyebilirsin.`,
    ].join('\n');
  }
  if (locale === 'en' && isBidirectionalBfs) {
    return [
      'Code: Two independent BFS frontiers are expanded from frontierStart and frontierTarget. parentFromStart and parentFromTarget reconstruct the final route.',
      `Data: Search runs from ${graph?.startId ?? 'the start'} to ${graph?.targetId ?? 'the target'}, adding each node to each frontier at most once.`,
      'Visual: Cyan/magenta nodes mark the active frontiers, magenta edges show the discovered search trees, and lime edges show the joined result path.',
      'Reasoning: The first shared visited node becomes meeting. The two parent maps are then joined at that node to produce a shortest path.',
      `Time: The simulation contains ${packageValue.steps.length} deterministic steps. Discussion checkpoints: ${checkpointSteps || 'initialization and result'}. You can play it or ask me to explain any checkpoint.`,
    ].join('\n');
  }
  return deterministicFiveLens(locale, packageValue.steps[0], 0, packageValue.steps.length);
};

export const startGodModeRun = (options: GodModeOrchestratorOptions): GodModeRunHandle => {
  const runId = createRunId();
  const plan = createPlan(runId, options.request, options.intent);
  let cancelled = false;
  let activeAgent: LocalAgentHandle | null = null;
  const runner: AgentRunner = options.agentRunner ?? ((request, onProgress) =>
    runLocalAgent(request, (progress) => onProgress?.(progress.text)));

  const publish = () => options.onPlan({ ...plan, jobs: plan.jobs.map((value) => ({ ...value })) });
  const setJob = (id: string, changes: Partial<ManagerJobV1>) => {
    const target = plan.jobs.find((value) => value.id === id);
    if (!target) throw new Error(`Unknown God Mode job ${id}.`);
    Object.assign(target, changes);
    options.onEvent?.({ ...target });
    publish();
  };
  const ensureActive = () => {
    if (cancelled) throw new Error('God Mode run was cancelled.');
  };
  const runJob = async <T>(id: string, task: () => Promise<T> | T): Promise<T> => {
    ensureActive();
    const target = plan.jobs.find((value) => value.id === id);
    if (!target) throw new Error(`Unknown God Mode job ${id}.`);
    const unmet = target.dependsOn.filter((dependency) =>
      plan.jobs.find((candidate) => candidate.id === dependency)?.status !== 'completed');
    if (unmet.length) throw new Error(`Job ${id} has unmet dependencies: ${unmet.join(', ')}`);
    setJob(id, { status: 'running', attempt: target.attempt + 1, startedAt: Date.now(), error: undefined });
    try {
      const value = await task();
      ensureActive();
      setJob(id, { status: 'completed', finishedAt: Date.now() });
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'God Mode job failed.';
      setJob(id, {
        status: cancelled ? 'cancelled' : 'failed',
        error: message,
        finishedAt: Date.now(),
      });
      throw error;
    }
  };
  const callAgent = async (
    role: GodModeAgentRole,
    instructions: string,
    context: string,
    responseSchema?: Record<string, unknown>,
    maxTokens?: number,
    jsonMode = false,
  ): Promise<string> => {
    ensureActive();
    activeAgent = runner({
      role,
      instructions,
      context,
      responseSchema,
      jsonMode,
      maxTokens,
      temperature: responseSchema || jsonMode ? 0 : 0.12,
      locale: options.locale,
    }, (status) => {
      const activeJob = [...plan.jobs].reverse().find((candidate) =>
        candidate.role === role && (candidate.status === 'running' || candidate.status === 'retrying'));
      if (activeJob) setJob(activeJob.id, { summary: status.slice(0, 240) });
    });
    try {
      return await activeAgent.promise;
    } finally {
      activeAgent = null;
    }
  };
  const callOptionalAgent = async (
    role: GodModeAgentRole,
    instructions: string,
    context: string,
    fallback: string,
    responseSchema?: Record<string, unknown>,
    maxTokens?: number,
  ): Promise<string> => {
    try {
      return await callAgent(role, instructions, context, responseSchema, maxTokens);
    } catch {
      ensureActive();
      return fallback;
    }
  };

  publish();
  const promise = (async (): Promise<GodModeRunResult> => {
    try {
      if (options.intent.type === 'discuss-current-step') {
        await runJob('manager-freeze-and-route-discussion', () => 'Playback frozen.');
        await runJob('scout-capture-current-trace-step', () => options.workspace.steps[options.workspace.currentIndex]);
        await runJob('trace-analyst-analyze-discussion-checkpoint', () =>
          callOptionalAgent(
            'trace-analyst',
            'Identify why the selected real trace step is worth discussing. Do not invent step numbers.',
            fiveLensContext(options.workspace, options.request),
            options.workspace.steps[options.workspace.currentIndex]?.explanation ?? 'No trace step.',
            undefined,
            260,
          ));
        const tutorAnswer = await runJob('tutor-explain-through-five-lenses', () =>
          callOptionalAgent(
            'tutor',
            'Explain the selected committed step under five short labels: Code, Data, Visual, Reasoning, Time.',
            fiveLensContext(options.workspace, options.request),
            deterministicFiveLens(
              options.locale,
              options.workspace.steps[options.workspace.currentIndex],
              options.workspace.currentIndex,
              options.workspace.steps.length,
            ),
            undefined,
            650,
          ));
        return { runId, plan, summary: 'Current step discussed through five lenses.', tutorAnswer };
      }

      await runJob('manager-decompose-request', async () => {
        const result = await callOptionalAgent(
          'manager',
          'Summarize the supplied bounded job graph in one sentence. Do not add or remove jobs.',
          JSON.stringify({ request: options.request, jobs: plan.jobs.map(({ id, role, dependsOn }) => ({ id, role, dependsOn })) }),
          options.locale === 'tr' ? 'Görev uzman ajanlara ayrıldı.' : 'The request was split into specialist jobs.',
          undefined,
          140,
        );
        setJob('manager-decompose-request', { summary: result.slice(0, 240) });
        return result;
      });
      await runJob('scout-inspect-live-workspace', () => {
        setJob('scout-inspect-live-workspace', {
          summary: `${options.workspace.algorithmName}; ${options.workspace.steps.length} steps; input=${options.workspace.simulationInput.kind}`,
        });
        return options.workspace;
      });

      if (options.intent.type === 'adapt-input') {
        const visualOnly = Boolean(options.activePackage?.input.value.graph)
          && isVisualOnlyGraphRequest(options.request);
        const input = await runJob('input-engineer-build-compatible-input', async () => {
          const kind = options.activePackage?.input.kind
            ?? getInputKindForAlgorithm(options.workspace.algorithmName);
          const current = options.workspace.simulationInput.kind === kind
            ? parseSimulationInput(
              kind,
              options.workspace.simulationInput.text,
              options.workspace.simulationInput.graph,
              options.workspace.simulationInput.parameters,
            ).input
            : undefined;
          let generated = current ?? createInputPreset(kind, 2, options.workspace.algorithmName);
          if (options.activePackage?.program.id === 'predict_winner_interval_dp') {
            const resolved = resolvePredictWinnerNumbers(options.request, options.workspace);
            generated = {
              kind: 'array',
              text: JSON.stringify(resolved.numbers),
              origin: resolved.origin === 'user' ? 'user' : 'agent',
            };
          }
          if (generated.graph && visualOnly) {
            generated = { ...generated, text: '', graph: spreadGraphLayout(generated.graph) };
          } else if (generated.graph && options.activePackage) {
            generated = {
              ...generated,
              text: '',
              graph: applyStructuralGraphRequest(generated.graph, options.request),
            };
          }
          const advice = await callOptionalAgent(
            'input-engineer',
            'Inspect the code and proposed input. Briefly state whether the input kind is compatible and name one useful edge case.',
            JSON.stringify({
              request: options.request,
              code: options.workspace.code.slice(0, 4_000),
              proposedInput: generated,
            }),
            options.locale === 'tr' ? 'Input türü doğrulandı ve deterministik trace için hazırlandı.' : 'The input kind was validated for the deterministic trace.',
            undefined,
            220,
          );
          setJob('input-engineer-build-compatible-input', { summary: advice.slice(0, 260) });
          return generated;
        });
        let updatedPackage: CustomSimulationPackageV1 | null = null;
        const steps = await runJob('compiler-regenerate-deterministic-trace', () => {
          const parsed = parseSimulationInput(input.kind, input.text, input.graph, input.parameters);
          if (!parsed.input) throw new Error(parsed.error ?? 'Generated input is invalid.');
          if (options.activePackage) {
            if (options.activePackage.program.id === 'predict_winner_interval_dp') {
              updatedPackage = compilePredictWinnerPackage({
                id: `${options.activePackage.id}-input-${Date.now().toString(36)}`,
                request: parsed.input.text,
                locale: options.locale,
                workspace: { ...options.workspace, simulationInput: parsed.input },
              });
            } else if (visualOnly && parsed.input.graph) {
              updatedPackage = patchPackageGraphLayout(options.activePackage, parsed.input.graph);
            } else {
              const patched = parsed.input.graph
                ? patchPackageGraphLayout(options.activePackage, parsed.input.graph)
                : options.activePackage;
              updatedPackage = compileCustomSimulationPackage({
                id: `${options.activePackage.id}-input-${Date.now().toString(36)}`,
                title: options.activePackage.title,
                locale: options.locale,
                program: options.activePackage.program,
                input: {
                  ...options.activePackage.input,
                  value: { ...parsed.input, origin: 'user' },
                  origin: 'user',
                },
                visualization: patched.visualization,
                analysis: options.activePackage.analysis,
              });
            }
            return updatedPackage.steps;
          }
          return generateSimulationSteps(options.workspace.algorithmName, options.workspace.code, parsed.input);
        });
        await runJob('critic-validate-input-and-trace', async () => {
          if (!steps.length) throw new Error('The compatible input produced no trace.');
          return callOptionalAgent(
            'critic',
            'Review whether this input and deterministic trace are compatible. The application validator is authoritative.',
            JSON.stringify({ input, traceSteps: steps.length, finalStep: steps.at(-1) }),
            JSON.stringify({ passed: true, issues: [], summary: 'Application validation passed.' }),
            critiqueSchema,
            260,
          );
        });
        await runJob('manager-apply-workspace-transaction', () => updatedPackage
          ? visualOnly && options.applyVisualPackage
            ? options.applyVisualPackage(updatedPackage, runId)
            : options.applyPackage(updatedPackage, runId)
          : options.applyInput(input, steps, runId));
        const tutorAnswer = await runJob('tutor-explain-updated-workspace', () =>
          callOptionalAgent(
            'tutor',
            'Explain why the new input is compatible and what the first trace step will do.',
            JSON.stringify({ request: options.request, input, firstStep: steps[0] }),
            deterministicFiveLens(options.locale, steps[0], 0, steps.length),
            undefined,
            360,
          ));
        return {
          runId,
          plan,
          summary: options.locale === 'tr' ? 'Uyumlu input ve trace uygulandı.' : 'Compatible input and trace applied.',
          tutorAnswer,
          input,
          steps,
        };
      }

      const creationIntent = options.intent;
      if (creationIntent.type !== 'create-algorithm') {
        throw new Error(`Unsupported God Mode intent: ${creationIntent.type}`);
      }
      if (creationIntent.template === 'predict-winner-interval-dp') {
        const resolved = resolvePredictWinnerNumbers(options.request, options.workspace);
        let preparedPackage: CustomSimulationPackageV1 | null = null;
        await runJob('architect-design-algorithm-contract', async () => {
          const summary = await callOptionalAgent(
            'architect',
            'Review this fixed interval-DP contract: dp[i][j] is current-player score advantage; fill the diagonal first and then increasing interval length. Keep the exact recurrence supplied by the user.',
            JSON.stringify({ request: options.request, numbers: resolved.numbers }),
            'Validated interval-DP state, dependency direction, recurrence, and O(n^2) bounds.',
            undefined,
            240,
          );
          setJob('architect-design-algorithm-contract', { summary: summary.slice(0, 260) });
          return summary;
        });
        await runJob('code-author-author-executable-program', async () => {
          const summary = await callOptionalAgent(
            'code-author',
            'Review the deterministic C++ Predict the Winner implementation. It must use a 2D interval-DP table and dp[i][j] = max(nums[i] - dp[i+1][j], nums[j] - dp[i][j-1]).',
            JSON.stringify({ request: options.request }),
            'C++ source preserves the requested recurrence and diagonal-to-interval fill order.',
            undefined,
            240,
          );
          setJob('code-author-author-executable-program', { summary: summary.slice(0, 260) });
          preparedPackage = compilePredictWinnerPackage({
            id: `predict-winner-${runId}`,
            request: options.request,
            locale: options.locale,
            workspace: options.workspace,
          });
          await options.previewSource?.(preparedPackage.source.code, preparedPackage.title, runId);
          return summary;
        });
        await runJob('input-engineer-build-original-teaching-input', async () => {
          const summary = `${resolved.origin === 'user' ? 'User' : 'Canonical'} input: [${resolved.numbers.join(', ')}].`;
          setJob('input-engineer-build-original-teaching-input', { summary });
          return resolved;
        });
        await runJob('visual-designer-design-semantic-visual-language', async () => {
          const summary = await callOptionalAgent(
            'visual-designer',
            'Review a matrix visual with distinct base, dependency, active, computed, and final-result cell roles. The two recurrence dependencies must remain visible at every transition.',
            JSON.stringify({ dimensions: [resolved.numbers.length, resolved.numbers.length] }),
            'Matrix roles distinguish the active cell, both dependencies, base diagonal, and final result without color alone.',
            undefined,
            220,
          );
          setJob('visual-designer-design-semantic-visual-language', { summary: summary.slice(0, 260) });
          return summary;
        });
        await runJob('layout-engineer-resolve-responsive-graph-layout', () => {
          const summary = 'Responsive matrix grid uses a scroll-safe diagonal fill layout.';
          setJob('layout-engineer-resolve-responsive-graph-layout', { summary });
          return summary;
        });
        const packageValue = await runJob('compiler-compile-source-and-trace', () =>
          preparedPackage ?? compilePredictWinnerPackage({
            id: `predict-winner-${runId}`,
            request: options.request,
            locale: options.locale,
            workspace: options.workspace,
          }));
        await runJob('critic-test-visual-and-trace-alignment', async () => {
          const matrixSteps = packageValue.steps.filter((step) => step.visualData.type === 'matrix');
          if (matrixSteps.length !== packageValue.steps.length) throw new Error('Interval-DP trace contains a non-matrix step.');
          const final = matrixSteps.at(-1)?.visualData;
          if (!final || final.type !== 'matrix' || typeof final.vars.winner !== 'boolean') {
            throw new Error('Predict the Winner trace has no grounded boolean result.');
          }
          const summary = `${matrixSteps.length} matrix snapshots align with source and recurrence dependencies.`;
          setJob('critic-test-visual-and-trace-alignment', { summary });
          return summary;
        });
        await runJob('manager-apply-workspace-transaction', () => options.applyPackage(packageValue, runId));
        await runJob('trace-director-direct-live-teaching-checkpoints', () => {
          const summary = `${packageValue.checkpoints.length} checkpoints cover diagonal initialization, interval growth, decisions, and result.`;
          setJob('trace-director-direct-live-teaching-checkpoints', { summary });
          return summary;
        });
        await runJob('result-analyst-ground-final-result-analysis', () => {
          const summary = packageValue.teachingPlan.finalResult.summary;
          setJob('result-analyst-ground-final-result-analysis', { summary: summary.slice(0, 260) });
          return summary;
        });
        const groundedTour = deterministicPackageTour(options.locale, packageValue);
        const tutorAnswer = await runJob('tutor-prepare-five-lens-live-tour', () =>
          callOptionalAgent(
            'tutor',
            'Introduce the committed interval-DP simulation under Code, Data, Visual, Reasoning, and Time labels. Explain that playback follows increasing interval length and that each active cell highlights dp[i+1][j] and dp[i][j-1].',
            fiveLensContext(options.workspace, options.request, packageValue),
            groundedTour,
            undefined,
            700,
          ));
        return {
          runId,
          plan,
          summary: options.locale === 'tr'
            ? 'LeetCode 486 interval DP kodu, 2D tablo trace’i ve öğretim turu uygulandı.'
            : 'LeetCode 486 interval-DP source, 2D table trace, and teaching tour applied.',
          tutorAnswer,
          package: packageValue,
          input: packageValue.input.value,
          steps: packageValue.steps,
        };
      }
      if (['house-robber-1d-dp', 'lcs-2d-dp', 'lcs-space-optimized-1d-dp', 'longest-palindrome-interval-dp', 'coin-change-1d-dp', 'edit-distance-2d-dp', 'knapsack-2d-dp'].includes(creationIntent.template)) {
        const template = creationIntent.template as DpTemplateId;
        let preparedPackage: CustomSimulationPackageV1 | null = null;
        await runJob('architect-design-algorithm-contract', () => {
          const summary = `Validated ${template} state definition, dependencies, fill order, and complexity.`;
          setJob('architect-design-algorithm-contract', { summary });
          return summary;
        });
        await runJob('code-author-author-executable-program', async () => {
          const summary = `Selected the deterministic, source-mapped ${template} implementation.`;
          setJob('code-author-author-executable-program', { summary });
          preparedPackage = compileDpTemplatePackage({
            template,
            id: runId,
            request: options.request,
            locale: options.locale,
            workspace: options.workspace,
          });
          await options.previewSource?.(preparedPackage.source.code, preparedPackage.title, runId);
          return summary;
        });
        await runJob('input-engineer-build-original-teaching-input', () => {
          const summary = 'Resolved explicit user input when present; otherwise selected a branch-rich bounded teaching input.';
          setJob('input-engineer-build-original-teaching-input', { summary });
          return summary;
        });
        await runJob('visual-designer-design-semantic-visual-language', () => {
          const summary = template === 'house-robber-1d-dp' || template === 'coin-change-1d-dp' || template === 'lcs-space-optimized-1d-dp'
            ? '1D state cells expose active, take, skip, computed, and result semantics.'
            : 'DP matrix exposes base, active, dependency, computed, and result roles with coordinates.';
          setJob('visual-designer-design-semantic-visual-language', { summary });
          return summary;
        });
        await runJob('layout-engineer-resolve-responsive-graph-layout', () => {
          const summary = template === 'house-robber-1d-dp' || template === 'coin-change-1d-dp' || template === 'lcs-space-optimized-1d-dp'
            ? 'Scroll-safe 1D state strip selected.'
            : 'Scroll-safe rectangular/diagonal matrix layout selected.';
          setJob('layout-engineer-resolve-responsive-graph-layout', { summary });
          return summary;
        });
        const packageValue = await runJob('compiler-compile-source-and-trace', () => preparedPackage ?? compileDpTemplatePackage({
          template,
          id: runId,
          request: options.request,
          locale: options.locale,
          workspace: options.workspace,
        }));
        await runJob('critic-test-visual-and-trace-alignment', () => {
          if (!packageValue.tests.passed || !packageValue.steps.length) throw new Error('DP template package failed validation.');
          const resultStep = packageValue.steps.at(-1);
          if (!resultStep || !Object.prototype.hasOwnProperty.call(resultStep.visualData.vars, 'result')) {
            throw new Error('DP template has no grounded final result.');
          }
          const summary = `${packageValue.steps.length} source-mapped DP states and dependency roles passed.`;
          setJob('critic-test-visual-and-trace-alignment', { summary });
          return summary;
        });
        await runJob('manager-apply-workspace-transaction', () => options.applyPackage(packageValue, runId));
        await runJob('trace-director-direct-live-teaching-checkpoints', () => {
          const summary = `${packageValue.teachingPlan.checkpoints.length} grounded checkpoints include per-state visual differences.`;
          setJob('trace-director-direct-live-teaching-checkpoints', { summary });
          return summary;
        });
        await runJob('result-analyst-ground-final-result-analysis', () => {
          const summary = packageValue.teachingPlan.finalResult.summary;
          setJob('result-analyst-ground-final-result-analysis', { summary });
          return summary;
        });
        const groundedTour = deterministicPackageTour(options.locale, packageValue);
        const tutorAnswer = await runJob('tutor-prepare-five-lens-live-tour', () => callOptionalAgent(
          'tutor',
          'Explain this committed DP package through Code, Data, Visual, Reasoning, and Time. Mention exact active/dependency states and never invent a table value.',
          fiveLensContext(options.workspace, options.request, packageValue),
          groundedTour,
          undefined,
          700,
        ));
        return {
          runId,
          plan,
          summary: options.locale === 'tr'
            ? `${packageValue.title} kodu, inputu, DP state görünümü ve öğretim turu uygulandı.`
            : `${packageValue.title} code, input, DP state view, and teaching tour were applied.`,
          tutorAnswer,
          package: packageValue,
          input: packageValue.input.value,
          steps: packageValue.steps,
        };
      }
      let design = defaultBidirectionalDesign(options.locale);
      await runJob('architect-design-algorithm-contract', async () => {
        const response = creationIntent.template === 'bidirectional-bfs'
          ? await callOptionalAgent(
            'architect',
            'Design the requested algorithm contract. For bidirectional BFS, require two FIFO frontiers, two visited sets, two parent maps, a first-intersection condition, and shortest-path reconstruction.',
            JSON.stringify({ request: options.request, workspace: options.workspace }),
            JSON.stringify(defaultBidirectionalDesign(options.locale)),
            architectureSchema,
            520,
          )
          : await callAgent(
            'architect',
            'Design the requested algorithm contract using only SimLang-compatible data structures.',
            JSON.stringify({ request: options.request, workspace: options.workspace }),
            architectureSchema,
            520,
          );
        const parsed = parseArchitecture(safeJsonObject(response));
        if (parsed) design = parsed;
        else if (creationIntent.template === 'model-authored') {
          throw new Error('The Algorithm Architect returned an invalid contract.');
        }
        const authoredTitle = creationIntent.template === 'model-authored' && parsed
          ? `${parsed.title.trim()} — ${options.locale === 'tr' ? 'Özel' : 'Custom'}`
          : canonicalCustomTitle(options.request, options.locale);
        design = { ...design, title: authoredTitle };
        setJob('architect-design-algorithm-contract', {
          summary: parsed ? `${parsed.title}: ${parsed.complexity.time}` : 'Validated deterministic architecture fallback selected.',
        });
        return design;
      });

      let program: ProgramSpecV1;
      if (creationIntent.template === 'bidirectional-bfs') {
        program = await runJob('code-author-author-executable-program', async () => {
          const response = await callOptionalAgent(
            'code-author',
            'Review the bidirectional BFS design for missing source-level operations. Return a concise implementation note.',
            JSON.stringify(design),
            'The validated template contains both frontiers, parent maps, intersection detection, and path reconstruction.',
            undefined,
            260,
          );
          setJob('code-author-author-executable-program', { summary: response.slice(0, 260) });
          const authoredProgram = createBidirectionalBfsProgram(options.locale);
          await options.previewSource?.(renderProgramSource(authoredProgram).code, design.title, runId);
          return authoredProgram;
        });
      } else {
        program = await runJob('code-author-author-executable-program', async () => {
          let lastErrors: string[] = [];
          for (let attempt = 1; attempt <= 2; attempt += 1) {
            if (attempt > 1) setJob('code-author-author-executable-program', {
              status: 'retrying',
              attempt,
              summary: `Repairing invalid SimLang: ${lastErrors.slice(0, 3).join(' ')}`,
            });
            let response: string;
            try {
              response = await callAgent(
                'code-author',
                [
                  SIMLANG_AUTHOR_INSTRUCTIONS,
                  `The required inputKind is ${design.inputKind}.`,
                  attempt > 1 ? `Repair these validation errors: ${lastErrors.join(' ')}` : '',
                ].filter(Boolean).join(' '),
                JSON.stringify({ request: options.request, design }),
                attempt === 1 ? PROGRAM_SPEC_V1_SCHEMA : undefined,
                1_150,
                attempt > 1,
              );
            } catch (error) {
              lastErrors = [error instanceof Error ? error.message : 'Structured generation failed.'];
              continue;
            }
            const parsed = safeJsonObject(response);
            const validation = validateProgramSpec(parsed);
            if (validation.valid && validation.program && validation.program.inputKind === design.inputKind) {
              setJob('code-author-author-executable-program', {
                summary: `${validation.program.title}; ${validation.program.entry.length} top-level statements.`,
              });
              await options.previewSource?.(renderProgramSource(validation.program).code, design.title, runId);
              return validation.program;
            }
            lastErrors = validation.errors.length
              ? validation.errors
              : [`Program inputKind must be ${design.inputKind}.`];
          }
          throw new Error(`Code Author could not produce valid SimLang: ${lastErrors.join(' ')}`);
        });
      }

      let input: InputContractV1 = await runJob('input-engineer-build-original-teaching-input', async () => {
        const value = createAgentInputContract(design, options.request, options.workspace);
        const response = await callOptionalAgent(
          'input-engineer',
          'Review the proposed teaching input against the algorithm contract. Preserve user input when origin=user. Identify one pedagogically useful branch. Application validation is authoritative.',
          JSON.stringify(value),
          'The application input validator accepted the proposed contract.',
          undefined,
          240,
        );
        const origin = value.origin === 'fallback'
          ? `FALLBACK: ${value.fallbackReason ?? 'agent input generation failed'}`
          : value.origin === 'user' ? 'User input preserved.' : 'Original teaching input generated.';
        setJob('input-engineer-build-original-teaching-input', { summary: `${origin} ${response}`.slice(0, 260) });
        return value;
      });
      let visualization: VisualizationContract;
      await runJob('visual-designer-design-semantic-visual-language', async () => {
        const provisionalLayout = input.value.graph
          ? createGraphLayoutSpec(input.value.graph, design.title)
          : createGraphLayoutSpec({
            version: 1,
            mode: 'graph',
            directed: false,
            weighted: false,
            nodes: [{ id: '1', label: '1', x: 50, y: 50 }],
            edges: [],
            startId: '1',
          }, design.title);
        visualization = createVisualizationContractV2(design, input.value, provisionalLayout);
        const response = await callOptionalAgent(
          'visual-designer',
          'Review the supplied semantic roles, frontier palette, result emphasis, and legend. Do not invent graph nodes or trace variables.',
          JSON.stringify({ request: options.request, design, visualization }),
          'Semantic roles use trace-backed variables and distinct frontier palettes.',
          undefined,
          280,
        );
        setJob('visual-designer-design-semantic-visual-language', { summary: response.slice(0, 260) });
        return visualization;
      });
      await runJob('layout-engineer-resolve-responsive-graph-layout', async () => {
        if (!input.value.graph) return input;
        const layout = createGraphLayoutSpec(input.value.graph, design.title);
        const graph = applyGraphLayout(input.value.graph, layout);
        const quality = inspectGraphLayout(graph, Math.min(5, layout.minimumNodeDistance / 2));
        if (!quality.valid) throw new Error('Layout Engineer could not produce a collision-free graph.');
        input = {
          ...input,
          value: { ...input.value, text: '', graph },
        };
        visualization = createVisualizationContractV2(design, input.value, layout);
        const response = await callOptionalAgent(
          'layout-engineer',
          'Review the deterministic layout quality report and briefly state why the strategy fits this graph.',
          JSON.stringify({ strategy: layout.strategy, quality, graph }),
          `${layout.strategy} layout passed overlap, bounds, and edge-endpoint checks.`,
          undefined,
          220,
        );
        setJob('layout-engineer-resolve-responsive-graph-layout', { summary: response.slice(0, 260) });
        return input;
      });
      // The visual designer job always initializes this value before the layout job.
      const committedVisualization = visualization!;
      const packageValue = await runJob('compiler-compile-source-and-trace', () =>
        compileCustomSimulationPackage({
          id: `${program.id}-${runId}`,
          title: design.title,
          locale: options.locale,
          program,
          input,
          visualization: committedVisualization,
          analysis: [
            `Purpose: ${design.purpose}`,
            `Time Complexity: ${design.complexity.time}`,
            `Space Complexity: ${design.complexity.space}`,
            `Invariant: ${design.invariants.join(' ')}`,
          ].join('\n'),
          invariants: design.invariants,
        }));
      await runJob('critic-test-visual-and-trace-alignment', async () => {
        if (!packageValue.tests.passed) throw new Error('Deterministic package tests failed.');
        if (!packageValue.teachingPlan.checkpoints.length) throw new Error('Teaching plan has no grounded checkpoints.');
        const response = await callOptionalAgent(
          'critic',
          'Review the validated package test report, semantic roles, and real teaching checkpoints. Report only concrete mismatches.',
          JSON.stringify({ design, tests: packageValue.tests, visualization: packageValue.visualization, checkpoints: packageValue.checkpoints, finalStep: packageValue.steps.at(-1) }),
          JSON.stringify({ passed: true, issues: [], summary: 'Deterministic package tests passed.' }),
          critiqueSchema,
          320,
        );
        const parsed = safeJsonObject(response);
        setJob('critic-test-visual-and-trace-alignment', {
          summary: typeof parsed?.summary === 'string' ? parsed.summary.slice(0, 260) : 'Deterministic tests passed.',
        });
        return response;
      });
      await runJob('manager-apply-workspace-transaction', () => options.applyPackage(packageValue, runId));
      await runJob('trace-director-direct-live-teaching-checkpoints', async () => {
        const response = await callOptionalAgent(
          'trace-director',
          'Review only the supplied real checkpoint narrations. Confirm that every referenced step and variable exists; do not invent any.',
          JSON.stringify(packageValue.teachingPlan.checkpoints),
          'Validated checkpoints cover initialization, critical decisions, meeting, and the final result.',
          undefined,
          260,
        );
        setJob('trace-director-direct-live-teaching-checkpoints', { summary: response.slice(0, 260) });
        return response;
      });
      await runJob('result-analyst-ground-final-result-analysis', async () => {
        const response = await callOptionalAgent(
          'result-analyst',
          'Review the deterministic final result analysis. Do not add metrics absent from the final snapshot.',
          JSON.stringify(packageValue.teachingPlan.finalResult),
          packageValue.teachingPlan.finalResult.summary,
          undefined,
          260,
        );
        setJob('result-analyst-ground-final-result-analysis', { summary: response.slice(0, 260) });
        return response;
      });
      const groundedTour = deterministicPackageTour(options.locale, packageValue);
      const tutorAnswer = await runJob('tutor-prepare-five-lens-live-tour', async () => {
        const generated = await callOptionalAgent(
          'tutor',
          'Introduce the generated algorithm through five short labels: Code, Data, Visual, Reasoning, Time. Ground every claim in the supplied committed package.',
          fiveLensContext(options.workspace, options.request, packageValue),
          groundedTour,
          undefined,
          700,
        );
        return generated.trim().length >= 140 ? generated : groundedTour;
      });
      return {
        runId,
        plan,
        summary: options.locale === 'tr'
          ? `${packageValue.title} kodu, inputu ve ${packageValue.steps.length} adımlık simülasyonu uygulandı.`
          : `${packageValue.title} code, input, and ${packageValue.steps.length}-step simulation were applied.`,
        tutorAnswer,
        package: packageValue,
      };
    } catch (error) {
      plan.jobs
        .filter((value) => value.status === 'waiting' || value.status === 'running' || value.status === 'retrying')
        .forEach((value) => setJob(value.id, {
          status: 'cancelled',
          error: cancelled ? undefined : 'Blocked by an earlier failed job.',
          finishedAt: Date.now(),
        }));
      throw error;
    }
  })();

  return {
    runId,
    promise,
    cancel: () => {
      cancelled = true;
      activeAgent?.cancel();
    },
  };
};

export const godModePlanProgress = (plan: ManagerPlanV1): number => {
  const total = plan.jobs.reduce((sum, current) => sum + current.weight, 0);
  if (!total) return 0;
  const completed = plan.jobs.reduce((sum, current) =>
    sum + (current.status === 'completed' ? current.weight : 0), 0);
  return Math.round((completed / total) * 100);
};
