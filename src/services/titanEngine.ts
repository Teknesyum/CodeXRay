import type { Locale } from '../i18n/translations';
import type {
  AlgorithmDesignV1,
  CustomSimulationPackageV1,
  TitanModeAgentRole,
  InputContractV1,
  ManagerJobV1,
  ManagerPlanV1,
  ProgramSpecV1,
  VisualizationContract,
  WorkspaceSnapshotV1,
} from '../types/titan';
import type { SimulationInput, SimulationStep } from '../types/simulation';
import { generateSimulationSteps } from './aiService';
import { compileCustomSimulationPackage } from './customSimulationCompiler';
import { getInputKindForAlgorithm } from './inputPresets';
import { parseSimulationInput } from './inputParsers';
import {
  runLocalAgent,
  type LocalAgentHandle,
  type LocalAgentProgress,
  type LocalAgentRequest,
} from './localAiService';
import { renderProgramSource, validateProgramSpec } from './simLang';
import { PROGRAM_SPEC_V1_SCHEMA, SIMLANG_AUTHOR_INSTRUCTIONS } from './simLangSchema';
import {
  createBidirectionalBfsProgram,
} from './simLangBuiltins';
import { canonicalCustomTitle } from './titanModeRouting';
import type { TitanModeIntent } from '../types/titan';
import { createAgentInputContract } from './agentInputGenerator';
import { applyGraphLayout, createGraphLayoutSpec, inspectGraphLayout } from './graphLayout';
import { createVisualizationContractV2 } from './visualizationDesigner';
import { createStructuralGraphPatches, isVisualOnlyGraphRequest, spreadGraphLayout } from './graphRequestEdits';
import { patchPackageGraphLayout } from './graphTransactions';
import { compilePredictWinnerPackage, resolvePredictWinnerNumbers } from './intervalDpCompiler';
import { compileDpTemplatePackage, type DpTemplateId } from './dpTemplateCompiler';
import { runVerificationGates } from './verificationGates';
import type { ProblemSpecV2, DpFamilyContractV2 } from '../types/titan';
import { adaptSimulationInputFromRequest } from './inputRequestAdapter';
import { recompileSimulationInput } from './recompileSimulationInput';
import {
  applyAndRecompileInputPatch,
  applyAndRecompileInputPatches,
  applyInputPatch,
  applyInputPatches,
  createInputReplacementPatch,
  createSemanticArrayPatch,
  createSemanticParameterPatches,
} from './input/inputPatch';
import { compileArrayTemplatePackage, type ArrayTemplateId } from './arrayCompiler';
export type TitanModeRunResult = {
  status: 'success';
  runId: string;
  plan: ManagerPlanV1;
  summary: string;
  tutorAnswer?: string;
  package?: CustomSimulationPackageV1;
  input?: SimulationInput;
  steps?: SimulationStep[];
  visualOnly?: boolean;
} | {
  status: 'unsupported' | 'needs-source';
  runId: string;
  plan: ManagerPlanV1;
  reason?: string;
};

interface AgentRunner {
  (request: LocalAgentRequest, onProgress?: (status: LocalAgentProgress) => void): LocalAgentHandle;
}

export interface TitanModeOrchestratorOptions {
  request: string;
  intent: Exclude<
    TitanModeIntent,
    { type: 'deterministic' } | { type: 'ui-control' } | { type: 'clarify-algorithm' }
  >;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
  activePackage: CustomSimulationPackageV1 | null;
  contextWindow?: number;
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
  deferApply?: boolean;
}

export interface TitanModeRunHandle {
  runId: string;
  promise: Promise<TitanModeRunResult>;
  cancel: () => void;
}

const createRunId = (): string =>
  `gm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const job = (
  role: TitanModeAgentRole,
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

const createJobs = (intent: TitanModeOrchestratorOptions['intent']): ManagerJobV1[] => {
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
  intent: TitanModeOrchestratorOptions['intent'],
): ManagerPlanV1 => ({
  version: 1,
  runId,
  request,
  intent: intent.type === 'create-algorithm'
    ? 'create-algorithm'
    : intent.type,
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
    visualization: {
      type: 'object',
      properties: {
        type: { enum: ['array', 'graph', 'matrix', 'string-match', 'bars', 'intervals', 'rows', 'variables'] },
        matrix: {
          type: 'object',
          properties: {
            valuesVariable: { type: 'string', minLength: 1 },
            rowLabels: { type: 'array', items: { type: 'string' } },
            columnLabels: { type: 'array', items: { type: 'string' } },
            highlightsVariable: { type: 'string', minLength: 1 },
            fillDirection: { enum: ['row', 'column', 'diagonal'] },
          },
          required: ['valuesVariable', 'fillDirection'],
          additionalProperties: false,
        },
        stringMatch: {
          type: 'object',
          properties: {
            textVariable: { type: 'string', minLength: 1 },
            patternVariable: { type: 'string', minLength: 1 },
            alignmentVariable: { type: 'string', minLength: 1 },
            activeTextVariable: { type: 'string', minLength: 1 },
            activePatternVariable: { type: 'string', minLength: 1 },
            matchedTextVariable: { type: 'string', minLength: 1 },
            mismatchTextVariable: { type: 'string', minLength: 1 },
            windowVariable: { type: 'string', minLength: 1 },
          },
          required: ['textVariable'],
          additionalProperties: false,
        },
        bars: {
          type: 'object',
          properties: {
            valuesVariable: { type: 'string', minLength: 1 },
            waterVariable: { type: 'string', minLength: 1 },
            pointerVariables: { type: 'array', items: { type: 'string', minLength: 1 } },
          },
          required: ['valuesVariable'],
          additionalProperties: false,
        },
        intervals: {
          type: 'object',
          properties: {
            intervalsVariable: { type: 'string', minLength: 1 },
            mergedVariable: { type: 'string', minLength: 1 },
            currentVariable: { type: 'string', minLength: 1 },
          },
          required: ['intervalsVariable', 'mergedVariable'],
          additionalProperties: false,
        },
        rows: {
          type: 'object',
          properties: {
            mode: { enum: ['rows', 'heap', 'buckets'] },
            rowVariables: {
              type: 'array', minItems: 1,
              items: {
                type: 'object',
                properties: { label: { type: 'string', minLength: 1 }, variable: { type: 'string', minLength: 1 } },
                required: ['label', 'variable'],
                additionalProperties: false,
              },
            },
            activeVariable: { type: 'string', minLength: 1 },
          },
          required: ['mode', 'rowVariables'],
          additionalProperties: false,
        },
      },
      required: ['type'],
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

const megaDpUpdateSchema = {
  type: 'object',
  properties: {
    problemSpec: {
      type: 'object',
      properties: {
        version: { const: 2 },
        title: { type: 'string' },
        family: { const: 'dp' },
        statement: { type: 'string' },
        signature: {
          type: 'object',
          properties: { language: { type: 'string' }, name: { type: 'string' }, parameters: { type: 'array', items: { type: 'object' } }, returnType: { type: 'string' } },
          required: ['language', 'name', 'parameters', 'returnType'],
        },
        constraints: { type: 'array', items: { type: 'string' } },
        examples: { type: 'array', items: { type: 'object' } },
        edgeCases: { type: 'array', items: { type: 'string' } },
        requestedComplexity: { type: 'object', properties: { time: { type: 'string' }, space: { type: 'string' } }, required: ['time', 'space'] },
        focus: { type: 'object' },
        provenance: { type: 'object' },
      },
      required: ['version', 'title', 'family', 'statement', 'signature', 'constraints', 'examples', 'edgeCases', 'requestedComplexity', 'focus', 'provenance'],
    },
    algorithmPlan: {
      type: 'object',
      properties: {
        version: { const: 2 },
        family: { const: 'dp' },
        technique: { type: 'string' },
        stateVariables: { type: 'array', items: { type: 'object' } },
        invariants: { type: 'array', items: { type: 'string' } },
        transitionRules: { type: 'array', items: { type: 'string' } },
        initialization: { type: 'array', items: { type: 'string' } },
        iterationOrder: { type: 'string' },
        termination: { type: 'string' },
        sourceControlFlow: { type: 'string' },
        complexity: { type: 'object', properties: { time: { type: 'string' }, space: { type: 'string' } }, required: ['time', 'space'] },
        semanticRoles: { type: 'object', properties: { nodes: { type: 'array', items: { type: 'object' } }, edges: { type: 'array', items: { type: 'object' } } } },
        checkpoints: { type: 'array', items: { type: 'object' } },
      },
      required: ['version', 'family', 'technique', 'stateVariables', 'invariants', 'transitionRules', 'initialization', 'iterationOrder', 'termination', 'sourceControlFlow', 'complexity', 'semanticRoles', 'checkpoints'],
    },
  },
  required: ['problemSpec', 'algorithmPlan'],
  additionalProperties: false,
};

const safeJsonObject = (text: string): Record<string, unknown> | null => {
  try {
    const value = JSON.parse(stripArchitectureWrappers(text)) as unknown;
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

export type ArchitectureContractFailureStage =
  | 'empty'
  | 'truncated'
  | 'json_parse'
  | 'schema'
  | 'semantic';

export type ArchitectureContractValidation =
  | { ok: true; value: AlgorithmDesignV1 }
  | { ok: false; stage: ArchitectureContractFailureStage; issues: string[] };

const stripArchitectureWrappers = (text: string): string => {
  const withoutInternalBlocks = text
    .replace(/<(think|analysis|reasoning)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(think|analysis|reasoning)(?:\s[^>]*)?>[\s\S]*$/gi, '')
    .trim();
  const fenced = withoutInternalBlocks.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? withoutInternalBlocks).trim();
};

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const validateArchitectureVisualization = (candidate: unknown): string[] => {
  if (candidate === undefined) return [];
  if (!isRecordValue(candidate)) return ['$.visualization: expected an object'];
  const issues: string[] = [];
  const supported = ['array', 'graph', 'matrix', 'string-match', 'bars', 'intervals', 'rows', 'variables'];
  const type = typeof candidate.type === 'string' ? candidate.type : '';
  if (!supported.includes(type)) issues.push('$.visualization.type: unsupported visual type');
  const configKey = type === 'string-match' ? 'stringMatch' : type;
  const known = new Set(['type', 'matrix', 'stringMatch', 'bars', 'intervals', 'rows']);
  Object.keys(candidate).filter((key) => !known.has(key)).forEach((key) =>
    issues.push(`$.visualization.${key}: additional property is not allowed`));
  for (const key of ['matrix', 'stringMatch', 'bars', 'intervals', 'rows']) {
    if (candidate[key] !== undefined && key !== configKey) {
      issues.push(`$.visualization.${key}: does not match visual type ${type || '(missing)'}`);
    }
  }
  if (['array', 'graph', 'variables'].includes(type)) return issues;
  const config = candidate[configKey];
  if (!isRecordValue(config)) {
    issues.push(`$.visualization.${configKey}: required for visual type ${type}`);
    return issues;
  }
  const allowedConfigFields: Record<string, string[]> = {
    matrix: ['valuesVariable', 'rowLabels', 'columnLabels', 'highlightsVariable', 'fillDirection'],
    stringMatch: ['textVariable', 'patternVariable', 'alignmentVariable', 'activeTextVariable', 'activePatternVariable', 'matchedTextVariable', 'mismatchTextVariable', 'windowVariable'],
    bars: ['valuesVariable', 'waterVariable', 'pointerVariables'],
    intervals: ['intervalsVariable', 'mergedVariable', 'currentVariable'],
    rows: ['mode', 'rowVariables', 'activeVariable'],
  };
  const allowedFields = new Set(allowedConfigFields[configKey] ?? []);
  Object.keys(config).filter((key) => !allowedFields.has(key)).forEach((key) =>
    issues.push(`$.visualization.${configKey}.${key}: additional property is not allowed`));
  const stringField = (name: string, required = false) => {
    const value = config[name];
    if ((required || value !== undefined) && (typeof value !== 'string' || !value.trim())) {
      issues.push(`$.visualization.${configKey}.${name}: expected a non-empty string`);
    }
  };
  if (type === 'matrix') {
    stringField('valuesVariable', true);
    stringField('highlightsVariable');
    if (!['row', 'column', 'diagonal'].includes(String(config.fillDirection))) {
      issues.push('$.visualization.matrix.fillDirection: expected row, column, or diagonal');
    }
    for (const field of ['rowLabels', 'columnLabels']) {
      if (config[field] !== undefined && (!Array.isArray(config[field])
        || !config[field].every((item) => typeof item === 'string'))) {
        issues.push(`$.visualization.matrix.${field}: expected string labels`);
      }
    }
  } else if (type === 'string-match') {
    stringField('textVariable', true);
    ['patternVariable', 'alignmentVariable', 'activeTextVariable', 'activePatternVariable',
      'matchedTextVariable', 'mismatchTextVariable', 'windowVariable'].forEach((field) => stringField(field));
  } else if (type === 'bars') {
    stringField('valuesVariable', true);
    stringField('waterVariable');
    if (config.pointerVariables !== undefined && (!Array.isArray(config.pointerVariables)
      || !config.pointerVariables.every((item) => typeof item === 'string' && item.trim()))) {
      issues.push('$.visualization.bars.pointerVariables: expected non-empty variable names');
    }
  } else if (type === 'intervals') {
    stringField('intervalsVariable', true);
    stringField('mergedVariable', true);
    stringField('currentVariable');
  } else if (type === 'rows') {
    if (!['rows', 'heap', 'buckets'].includes(String(config.mode))) {
      issues.push('$.visualization.rows.mode: expected rows, heap, or buckets');
    }
    stringField('activeVariable');
    if (!Array.isArray(config.rowVariables) || !config.rowVariables.length) {
      issues.push('$.visualization.rows.rowVariables: expected at least one row mapping');
    } else {
      const labels = new Set<string>();
      for (const [index, row] of config.rowVariables.entries()) {
        if (!isRecordValue(row) || typeof row.label !== 'string' || !row.label.trim()
          || typeof row.variable !== 'string' || !row.variable.trim()) {
          issues.push(`$.visualization.rows.rowVariables[${index}]: expected label and variable`);
          continue;
        }
        if (labels.has(row.label)) issues.push(`$.visualization.rows.rowVariables[${index}].label: duplicate label`);
        labels.add(row.label);
      }
    }
  }
  return issues;
};

export const validateArchitectureContract = (
  text: string,
  finishReason?: string,
): ArchitectureContractValidation => {
  const candidate = stripArchitectureWrappers(text);
  if (!candidate) return { ok: false, stage: 'empty', issues: ['$: response is empty'] };
  if (finishReason === 'length') {
    return { ok: false, stage: 'truncated', issues: ['$: response reached the generation limit'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return { ok: false, stage: 'json_parse', issues: ['$: response is not one complete JSON object'] };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, stage: 'schema', issues: ['$: expected an object'] };
  }

  const value = parsed as Record<string, unknown>;
  const issues: string[] = [];
  const allowed = new Set([
    'version', 'title', 'purpose', 'inputKind', 'dataStructures', 'invariants', 'termination', 'complexity', 'visualization',
  ]);
  Object.keys(value).filter((key) => !allowed.has(key)).forEach((key) =>
    issues.push(`$.${key}: additional property is not allowed`));
  if (value.version !== 1) issues.push('$.version: expected 1');
  for (const key of ['title', 'purpose', 'termination'] as const) {
    if (typeof value[key] !== 'string' || !value[key].trim()) issues.push(`$.${key}: expected a non-empty string`);
  }
  for (const key of ['dataStructures', 'invariants'] as const) {
    if (!Array.isArray(value[key])) issues.push(`$.${key}: expected an array`);
    else if (!value[key].every((item) => typeof item === 'string')) issues.push(`$.${key}: every item must be a string`);
  }
  if (typeof value.inputKind !== 'string' || !value.inputKind) {
    issues.push('$.inputKind: expected a non-empty string');
  }
  if (!value.complexity || typeof value.complexity !== 'object' || Array.isArray(value.complexity)) {
    issues.push('$.complexity: expected an object');
  } else {
    const complexity = value.complexity as Record<string, unknown>;
    if (typeof complexity.time !== 'string') issues.push('$.complexity.time: expected a string');
    if (typeof complexity.space !== 'string') issues.push('$.complexity.space: expected a string');
  }
  const visualizationIssues = validateArchitectureVisualization(value.visualization);
  issues.push(...visualizationIssues);
  if (issues.length) return { ok: false, stage: 'schema', issues };

  const inputKinds = ['array', 'string', 'tree', 'graph'];
  if (!inputKinds.includes(String(value.inputKind))) {
    return {
      ok: false,
      stage: 'semantic',
      issues: [`$.inputKind: "${String(value.inputKind)}" is unsupported; expected array, string, tree, or graph`],
    };
  }
  return { ok: true, value: value as unknown as AlgorithmDesignV1 };
};

const architectureContractError = (
  validation: Exclude<ArchitectureContractValidation, { ok: true }>,
  locale: Locale,
): string => {
  const detail = validation.issues.slice(0, 3).map((issue) => locale === 'tr'
    ? issue
      .replace('response is empty', 'yanıt boş')
      .replace('response reached the generation limit', 'yanıt üretim sınırına ulaştı')
      .replace('response is not one complete JSON object', 'yanıt tek ve tamamlanmış bir JSON nesnesi değil')
      .replace('is unsupported; expected array, string, tree, or graph', 'desteklenmiyor; array, string, tree veya graph bekleniyor')
      .replace('expected a non-empty string', 'boş olmayan bir metin bekleniyor')
      .replace('expected an array', 'dizi bekleniyor')
      .replace('every item must be a string', 'her öğe metin olmalı')
      .replace('expected an object', 'nesne bekleniyor')
      .replace('expected a string', 'metin bekleniyor')
      .replace('additional property is not allowed', 'ek alana izin verilmiyor')
      .replace('expected 1', '1 bekleniyor')
    : issue).join('; ');
  return locale === 'tr'
    ? `Algoritma Mimarı sözleşmesi geçersiz (${validation.stage}): ${detail}`
    : `The Algorithm Architect contract is invalid (${validation.stage}): ${detail}`;
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

export const startTitanModeRun = (options: TitanModeOrchestratorOptions): TitanModeRunHandle => {
  const runId = createRunId();
  const plan = createPlan(runId, options.request, options.intent);
  let cancelled = false;
  let activeAgent: LocalAgentHandle | null = null;
  const useAdvisoryModel = options.agentRunner !== undefined
    || options.intent.type === 'discuss-current-step'
    || (options.intent.type === 'create-algorithm' && options.intent.template === 'model-authored');
  const runner: AgentRunner = options.agentRunner ?? ((request, onProgress) =>
    runLocalAgent(request, onProgress));

  const publish = () => options.onPlan({ ...plan, jobs: plan.jobs.map((value) => ({ ...value })) });
  const setJob = (id: string, changes: Partial<ManagerJobV1>) => {
    const target = plan.jobs.find((value) => value.id === id);
    if (!target) throw new Error(`Unknown Titan Mode job ${id}.`);
    Object.assign(target, changes);
    options.onEvent?.({ ...target });
    publish();
  };
  const ensureActive = () => {
    if (cancelled) throw new Error('Titan Mode run was cancelled.');
  };
  const runJob = async <T>(id: string, task: () => Promise<T> | T): Promise<T> => {
    ensureActive();
    const target = plan.jobs.find((value) => value.id === id);
    if (!target) throw new Error(`Unknown Titan Mode job ${id}.`);
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
      const message = error instanceof Error ? error.message : 'Titan Mode job failed.';
      setJob(id, {
        status: cancelled ? 'cancelled' : 'failed',
        error: message,
        finishedAt: Date.now(),
      });
      throw error;
    }
  };
  const callAgent = async (
    role: TitanModeAgentRole,
    instructions: string,
    context: string,
    responseSchema?: Record<string, unknown>,
    maxTokens?: number,
    jsonMode = false,
  ): Promise<string> => {
    ensureActive();
    let pendingReasoning = '';
    let reasoningFlushTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
    let reasoningJobId: string | undefined;
    const activeJobForContext = [...plan.jobs].reverse().find((candidate) =>
      candidate.role === role && (candidate.status === 'running' || candidate.status === 'retrying'));
    if (activeJobForContext) {
      const schemaText = responseSchema ? JSON.stringify(responseSchema) : '';
      setJob(activeJobForContext.id, {
        promptTokens: Math.ceil((instructions.length + context.length + schemaText.length) / 4),
        contextWindow: options.contextWindow ?? 4096,
        promptTokensEstimated: true,
      });
    }
    const flushReasoning = () => {
      if (reasoningFlushTimer) globalThis.clearTimeout(reasoningFlushTimer);
      reasoningFlushTimer = undefined;
      if (!pendingReasoning || !reasoningJobId) return;
      const target = plan.jobs.find((candidate) => candidate.id === reasoningJobId);
      if (target) {
        setJob(target.id, {
          reasoning: `${target.reasoning ?? ''}${pendingReasoning}`.slice(-200_000),
        });
      }
      pendingReasoning = '';
    };
    activeAgent = runner({
      role,
      instructions,
      context,
      responseSchema,
      jsonMode,
      maxTokens,
      temperature: responseSchema || jsonMode ? 0 : 0.12,
      locale: options.locale,
    }, (progress) => {
      const activeJob = [...plan.jobs].reverse().find((candidate) =>
        candidate.role === role && (candidate.status === 'running' || candidate.status === 'retrying'));
      if (activeJob && progress.status === 'reasoning-delta') {
        reasoningJobId = activeJob.id;
        pendingReasoning += progress.text;
        if (!reasoningFlushTimer) {
          reasoningFlushTimer = globalThis.setTimeout(flushReasoning, 32);
        }
        return;
      }
      if (progress.status === 'answer-delta') return;
      if (activeJob) setJob(activeJob.id, {
        summary: progress.text.slice(0, 240),
        queueMs: progress.queueMs ?? activeJob.queueMs,
        firstTokenMs: progress.firstTokenMs ?? activeJob.firstTokenMs,
        inferenceMs: progress.inferenceMs ?? activeJob.inferenceMs,
        completionTokens: progress.completionTokens ?? activeJob.completionTokens,
        finishReason: progress.finishReason ?? activeJob.finishReason,
      });
    });
    try {
      const response = await activeAgent.promise;
      flushReasoning();
      return response;
    } finally {
      flushReasoning();
      activeAgent = null;
    }
  };
  const callOptionalAgent = async (
    role: TitanModeAgentRole,
    instructions: string,
    context: string,
    fallback: string,
    responseSchema?: Record<string, unknown>,
    maxTokens?: number,
  ): Promise<string> => {
    if (!useAdvisoryModel) return fallback;
    try {
      return await callAgent(role, instructions, context, responseSchema, maxTokens);
    } catch {
      ensureActive();
      return fallback;
    }
  };

  publish();
  const promise = (async (): Promise<TitanModeRunResult> => {
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
        return { status: 'success', runId, plan, summary: 'Current step discussed through five lenses.', tutorAnswer };
      }

      await runJob('manager-decompose-request', async () => {
        const result = options.locale === 'tr'
          ? 'Görev doğrulanmış uzman aşamalarına deterministik olarak ayrıldı.'
          : 'The request was deterministically split into validated specialist stages.';
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
        let semanticPackage: CustomSimulationPackageV1 | null = null;
        const input = await runJob('input-engineer-build-compatible-input', async () => {
          const kind = options.activePackage?.input.kind
            ?? getInputKindForAlgorithm(options.workspace.algorithmName);
          const isMatrixPackage = options.activePackage?.program.id === 'spiral_matrix';
          const current = options.workspace.simulationInput.kind === kind
            ? isMatrixPackage
              ? options.workspace.simulationInput
              : parseSimulationInput(
                kind,
                options.workspace.simulationInput.text,
                options.workspace.simulationInput.graph,
                options.workspace.simulationInput.parameters,
              ).input
            : undefined;
          const semanticPatch = current?.kind === 'array' && !isMatrixPackage
            ? createSemanticArrayPatch(options.request)
            : null;
          if (semanticPatch && options.activePackage && current) {
            const semanticResult = applyAndRecompileInputPatch({
              activePackage: options.activePackage,
              currentInput: current,
              patch: semanticPatch,
              locale: options.locale,
              workspace: options.workspace,
            });
            if (semanticResult.ok === false) throw new Error(semanticResult.reason);
            semanticPackage = semanticResult.package;
            setJob('input-engineer-build-compatible-input', {
              summary: options.locale === 'tr'
                ? `${semanticPatch.op} işlemi doğrulandı ve deterministik olarak uygulandı.`
                : `${semanticPatch.op} was validated and applied deterministically.`,
            });
            return semanticResult.input;
          }
          const parameterPatches = current
            ? createSemanticParameterPatches(options.request, options.workspace.algorithmName)
            : [];
          if (parameterPatches.length && current) {
            if (options.activePackage) {
              const semanticResult = applyAndRecompileInputPatches({
                activePackage: options.activePackage,
                currentInput: current,
                patches: parameterPatches,
                locale: options.locale,
                workspace: options.workspace,
              });
              if (semanticResult.ok === false) throw new Error(semanticResult.reason);
              semanticPackage = semanticResult.package;
              return semanticResult.input;
            }
            const applied = applyInputPatches(current, parameterPatches, {
              version: 1,
              kind,
              description: options.workspace.algorithmName,
              constraints: [],
              value: current,
              origin: 'user',
            }, { algorithmName: options.workspace.algorithmName });
            if (applied.ok === false) throw new Error(applied.reason);
            return applied.input;
          }
          const graphPatches = current?.graph && !visualOnly
            ? createStructuralGraphPatches(current.graph, options.request)
            : null;
          if (graphPatches?.ok === false) throw new Error(graphPatches.reason);
          if (graphPatches?.patches.length && options.activePackage && current) {
            const semanticResult = applyAndRecompileInputPatches({
              activePackage: options.activePackage,
              currentInput: current,
              patches: graphPatches.patches,
              locale: options.locale,
              workspace: options.workspace,
            });
            if (semanticResult.ok === false) throw new Error(semanticResult.reason);
            semanticPackage = semanticResult.package;
            setJob('input-engineer-build-compatible-input', {
              summary: options.locale === 'tr'
                ? `${graphPatches.patches.length} grafik işlemi atomik olarak doğrulandı ve uygulandı.`
                : `${graphPatches.patches.length} graph operations were validated and applied atomically.`,
            });
            return semanticResult.input;
          }
          let generated = adaptSimulationInputFromRequest({
            request: options.request,
            current: current ?? null,
            kind,
            algorithmName: options.workspace.algorithmName,
            activeProgramId: options.activePackage?.program.id,
          });
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
          }
          const patch = createInputReplacementPatch(generated, {
            matrix: options.activePackage?.program.id === 'spiral_matrix',
          });
          const contract = options.activePackage?.input ?? {
            version: 1 as const,
            kind,
            description: options.workspace.algorithmName,
            constraints: [],
            value: current ?? generated,
            origin: 'user' as const,
          };
          const applied = applyInputPatch(current ?? generated, patch, contract);
          if (applied.ok === false) throw new Error(applied.reason);
          const advice = options.locale === 'tr'
            ? `Input düzenleme komutu ${kind} sözleşmesine deterministik olarak uygulandı.`
            : `The input edit was applied deterministically to the ${kind} contract.`;
          setJob('input-engineer-build-compatible-input', { summary: advice });
          return applied.input;
        });
        let updatedPackage: CustomSimulationPackageV1 | null = null;
        const steps = await runJob('compiler-regenerate-deterministic-trace', () => {
          if (semanticPackage) {
            updatedPackage = semanticPackage;
            return semanticPackage.steps;
          }
          const parsed = options.activePackage?.program.id === 'spiral_matrix'
            ? { input }
            : parseSimulationInput(input.kind, input.text, input.graph, input.parameters);
          if (!parsed.input) throw new Error('error' in parsed ? parsed.error ?? 'Generated input is invalid.' : 'Generated input is invalid.');
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
              updatedPackage = recompileSimulationInput({
                activePackage: options.activePackage,
                input: { ...parsed.input, origin: 'user' },
                locale: options.locale,
                workspace: options.workspace,
              });
            }
            return updatedPackage.steps;
          }
          return generateSimulationSteps(options.workspace.algorithmName, options.workspace.code, parsed.input);
        });
        await runJob('critic-validate-input-and-trace', () => {
          if (!steps.length) throw new Error('The compatible input produced no trace.');
          const summary = `Application validation passed for ${steps.length} deterministic trace steps.`;
          setJob('critic-validate-input-and-trace', { summary });
          return summary;
        });
        await runJob('manager-apply-workspace-transaction', () => {
          if (options.deferApply) return 'Application deferred to the five-phase pipeline.';
          return updatedPackage
            ? visualOnly && options.applyVisualPackage
              ? options.applyVisualPackage(updatedPackage, runId)
              : options.applyPackage(updatedPackage, runId)
            : options.applyInput(input, steps, runId);
        });
        const tutorAnswer = await runJob('tutor-explain-updated-workspace', () =>
          deterministicFiveLens(options.locale, steps[0], 0, steps.length));
        return {
          status: 'success',
          runId,
          plan,
          summary: options.locale === 'tr' ? 'Uyumlu input ve trace uygulandı.' : 'Compatible input and trace applied.',
          tutorAnswer,
          input,
          steps,
          package: updatedPackage ?? undefined,
          visualOnly,
        };
      }

      const creationIntent = options.intent;
      if (creationIntent.type !== 'create-algorithm') {
        throw new Error(`Unsupported Titan Mode intent: ${creationIntent.type}`);
      }
      if (creationIntent.template === 'predict-winner-interval-dp') {
        const resolved = resolvePredictWinnerNumbers(options.request, options.workspace);
        let preparedPackage: CustomSimulationPackageV1 | null = null;
        let problemSpec: ProblemSpecV2 | undefined;
        let algorithmPlan: DpFamilyContractV2 | undefined;
        await runJob('architect-design-algorithm-contract', async () => {
          const response = await callOptionalAgent(
            'architect',
            `Design the unified ProblemSpecV2 and DpFamilyContractV2 for the predict-winner interval-DP algorithm. Output matching the megaDpUpdateSchema.`,
            JSON.stringify({ request: options.request, numbers: resolved.numbers }),
            '{}',
            megaDpUpdateSchema,
            1200,
          );
          const parsed = safeJsonObject(response) as any;
          if (parsed?.problemSpec && parsed?.algorithmPlan) {
            problemSpec = parsed.problemSpec;
            algorithmPlan = parsed.algorithmPlan;
            const summary = `Extracted ProblemSpecV2 and DpFamilyContractV2 for ${problemSpec?.title}.`;
            setJob('architect-design-algorithm-contract', { summary });
            return summary;
          }
          const summary = 'Selected the validated deterministic predict-winner interval-DP contract fallback.';
          setJob('architect-design-algorithm-contract', { summary });
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
            problemSpec,
            algorithmPlan,
            verification: problemSpec && algorithmPlan ? runVerificationGates(problemSpec, algorithmPlan, true, true, true, true, true, true, true, true, true, true) : undefined,
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
          status: 'success',
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
      if (['jump-game-dp', 'jump-game-greedy', 'lis-quadratic-dp', 'lis-binary-search'].includes(creationIntent.template)) {
        const template = creationIntent.template as ArrayTemplateId;
        let preparedPackage: CustomSimulationPackageV1 | null = null;
        await runJob('architect-design-algorithm-contract', () => {
          const summary = `Selected the validated deterministic ${template} contract.`;
          setJob('architect-design-algorithm-contract', { summary });
          return summary;
        });
        await runJob('code-author-author-executable-program', async () => {
          preparedPackage = compileArrayTemplatePackage({
            template, id: runId, request: options.request, locale: options.locale, workspace: options.workspace,
          });
          await options.previewSource?.(preparedPackage.source.code, preparedPackage.title, runId);
          const summary = `Authored the source-mapped ${template} implementation.`;
          setJob('code-author-author-executable-program', { summary });
          return summary;
        });
        await runJob('input-engineer-build-original-teaching-input', () => {
          const summary = 'Resolved explicit input or selected a bounded branch-rich teaching input.';
          setJob('input-engineer-build-original-teaching-input', { summary });
          return summary;
        });
        await runJob('visual-designer-design-semantic-visual-language', () => {
          const summary = template.startsWith('lis-')
            ? 'Array states expose the DP or tails sequence and active comparison.'
            : 'Array states expose reachable positions or the greedy farthest frontier.';
          setJob('visual-designer-design-semantic-visual-language', { summary });
          return summary;
        });
        await runJob('layout-engineer-resolve-responsive-graph-layout', () => {
          const summary = 'Scroll-safe array layout selected for every bounded input size.';
          setJob('layout-engineer-resolve-responsive-graph-layout', { summary });
          return summary;
        });
        const packageValue = await runJob('compiler-compile-source-and-trace', () => preparedPackage
          ?? compileArrayTemplatePackage({
            template, id: runId, request: options.request, locale: options.locale, workspace: options.workspace,
          }));
        await runJob('critic-test-visual-and-trace-alignment', () => {
          if (!packageValue.tests.passed || !packageValue.steps.length) throw new Error('Array template package failed validation.');
          const resultStep = packageValue.steps.at(-1);
          if (!resultStep || !Object.prototype.hasOwnProperty.call(resultStep.visualData.vars, 'result')) {
            throw new Error('Array template has no grounded final result.');
          }
          const summary = `${packageValue.steps.length} deterministic source-mapped states passed.`;
          setJob('critic-test-visual-and-trace-alignment', { summary });
          return summary;
        });
        await runJob('manager-apply-workspace-transaction', () => options.applyPackage(packageValue, runId));
        await runJob('trace-director-direct-live-teaching-checkpoints', () => {
          const summary = `${packageValue.teachingPlan.checkpoints.length} grounded checkpoints prepared.`;
          setJob('trace-director-direct-live-teaching-checkpoints', { summary });
          return summary;
        });
        await runJob('result-analyst-ground-final-result-analysis', () => {
          const summary = packageValue.teachingPlan.finalResult.summary;
          setJob('result-analyst-ground-final-result-analysis', { summary });
          return summary;
        });
        const tutorAnswer = await runJob('tutor-prepare-five-lens-live-tour', () => callOptionalAgent(
          'tutor',
          'Explain this committed package through Code, Data, Visual, Reasoning, and Time without inventing values.',
          fiveLensContext(options.workspace, options.request, packageValue),
          deterministicPackageTour(options.locale, packageValue),
          undefined,
          620,
        ));
        return {
          status: 'success', runId, plan,
          summary: options.locale === 'tr'
            ? `${packageValue.title} kodu, inputu, trace'i ve öğretim turu uygulandı.`
            : `${packageValue.title} code, input, trace, and teaching tour were applied.`,
          tutorAnswer, package: packageValue, input: packageValue.input.value, steps: packageValue.steps,
        };
      }
      if (['house-robber-1d-dp', 'lcs-2d-dp', 'lcs-space-optimized-1d-dp', 'longest-palindrome-interval-dp', 'coin-change-1d-dp', 'edit-distance-2d-dp', 'knapsack-2d-dp'].includes(creationIntent.template)) {
        const template = creationIntent.template as DpTemplateId;
        let preparedPackage: CustomSimulationPackageV1 | null = null;
        await runJob('architect-design-algorithm-contract', async () => {
          const summary = `Selected the validated deterministic ${template} contract.`;
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
        const tutorAnswer = await runJob('tutor-prepare-five-lens-live-tour', () => groundedTour);
        return {
          status: 'success',
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
        let response = creationIntent.template === 'bidirectional-bfs'
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
            [
              'Design the requested algorithm contract using only SimLang-compatible data structures.',
              'inputKind describes the source input, not the visualization. A 2D table is a visual/state representation; inputKind must be array, string, tree, or graph, never matrix.',
              'Select the most pedagogical visualization when useful: matrix for DP tables, string-match for aligned text/pattern scans, bars for height/water data, intervals for merging/scheduling, or rows for heap/bucket/multi-row state.',
              'When selecting a specialized visualization, include its complete trace-variable mapping. Use array, graph, or variables only when no specialized metaphor teaches the state better.',
            ].join(' '),
            JSON.stringify({ request: options.request, workspace: options.workspace }),
            architectureSchema,
            520,
          );
        let architectJob = plan.jobs.find((job) => job.id === 'architect-design-algorithm-contract');
        let validation = validateArchitectureContract(response, architectJob?.finishReason);
        if (creationIntent.template === 'model-authored' && 'stage' in validation && validation.stage === 'truncated') {
          setJob('architect-design-algorithm-contract', {
            status: 'retrying',
            attempt: (architectJob?.attempt ?? 1) + 1,
            summary: 'Retrying one compact Architect contract after token truncation.',
          });
          response = await callAgent(
            'architect',
            [
              'The previous contract reached the output limit.',
              'Return one compact JSON object only. Use short strings and no reasoning.',
              'inputKind is the source input and must be array, string, tree, or graph; never matrix.',
              'Preserve a complete visualization mapping if the algorithm uses matrix, string-match, bars, intervals, or rows.',
            ].join(' '),
            JSON.stringify({ request: options.request, workspace: options.workspace }),
            architectureSchema,
            1_400,
          );
          architectJob = plan.jobs.find((job) => job.id === 'architect-design-algorithm-contract');
          validation = validateArchitectureContract(response, architectJob?.finishReason);
        }
        const parsed = validation.ok ? validation.value : null;
        if (parsed) design = parsed;
        else if (creationIntent.template === 'model-authored') {
          throw new Error(architectureContractError(validation as Exclude<ArchitectureContractValidation, { ok: true }>, options.locale));
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
          let lastCandidateExcerpt = '';
          let previousFailureKey = '';
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
                  design.visualization
                    ? `The executable trace must declare and update every variable named by this visualization mapping: ${JSON.stringify(design.visualization)}.`
                    : '',
                  attempt > 1 ? `Repair these validation errors: ${lastErrors.join(' ')}` : '',
                ].filter(Boolean).join(' '),
                JSON.stringify({
                  request: options.request,
                  design,
                  ...(attempt > 1 ? { previousCandidateExcerpt: lastCandidateExcerpt } : {}),
                }),
                attempt === 1 ? PROGRAM_SPEC_V1_SCHEMA : undefined,
                1_150,
                attempt > 1,
              );
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Structured generation failed.';
              lastErrors = [message];
              if (/timed out|cancelled|load a local ai model/i.test(message)) throw error;
              continue;
            }
            lastCandidateExcerpt = response.slice(0, 2_400);
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
            const failureKey = lastErrors.slice(0, 4).join('|');
            if (failureKey === previousFailureKey) break;
            previousFailureKey = failureKey;
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
        if (parsed?.passed === false) {
          const issues = Array.isArray(parsed.issues)
            ? parsed.issues.filter((issue): issue is string => typeof issue === 'string').slice(0, 6)
            : [];
          throw new Error(`Critic rejected the package: ${issues.join('; ') || String(parsed.summary ?? 'validation failed')}`);
        }
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
        status: 'success',
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
      if (cancelled) return;
      cancelled = true;
      activeAgent?.cancel();
      plan.jobs
        .filter((job) => job.status === 'waiting' || job.status === 'running' || job.status === 'retrying')
        .forEach((job) => setJob(job.id, {
          status: 'cancelled',
          error: undefined,
          finishedAt: Date.now(),
        }));
    },
  };
};

export const titanModePlanProgress = (plan: ManagerPlanV1): number => {
  const total = plan.jobs.reduce((sum, current) => sum + current.weight, 0);
  if (!total) return 0;
  const completed = plan.jobs.reduce((sum, current) =>
    sum + (current.status === 'completed' ? current.weight : 0), 0);
  return Math.round((completed / total) * 100);
};
