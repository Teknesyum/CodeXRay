import type {
  InputKind,
  Locale,
  SimulationInput,
  SimulationStep,
  TraceValue,
} from './simulation';

export type GodModeAgentRole =
  | 'manager'
  | 'scout'
  | 'architect'
  | 'code-author'
  | 'input-engineer'
  | 'compiler'
  | 'critic'
  | 'trace-analyst'
  | 'tutor'
  | 'ui-director';

export type AgentJobStatus =
  | 'waiting'
  | 'running'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rolled-back';

export interface ManagerJobV1 {
  id: string;
  role: GodModeAgentRole;
  label: string;
  dependsOn: string[];
  weight: number;
  status: AgentJobStatus;
  attempt: number;
  maxAttempts: number;
  startedAt?: number;
  finishedAt?: number;
  summary?: string;
  error?: string;
}

export interface ManagerPlanV1 {
  version: 1;
  runId: string;
  request: string;
  intent:
    | 'load-preset'
    | 'adapt-input'
    | 'create-algorithm'
    | 'timeline'
    | 'ui-control'
    | 'discuss';
  jobs: ManagerJobV1[];
  createdAt: number;
}

export interface AgentRunEventV1 {
  version: 1;
  runId: string;
  jobId: string;
  role: GodModeAgentRole;
  status: AgentJobStatus;
  timestamp: number;
  summary?: string;
  error?: string;
}

export interface WorkspaceSnapshotV1 {
  version: 1;
  algorithmName: string;
  code: string;
  simulationInput: SimulationInput;
  steps: SimulationStep[];
  currentIndex: number;
  analysis: string | null;
  inputError: string | null;
  activePackageId: string | null;
  packageOutOfSync: boolean;
}

export type SimLangBinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'and'
  | 'or';

export type SimLangExpression =
  | { type: 'literal'; value: TraceValue }
  | { type: 'variable'; name: string }
  | { type: 'input-field'; field: 'text' | 'array' | 'graph' | 'startId' | 'targetId' }
  | {
    type: 'binary';
    operator: SimLangBinaryOperator;
    left: SimLangExpression;
    right: SimLangExpression;
  }
  | { type: 'unary'; operator: 'not' | 'negate'; value: SimLangExpression }
  | { type: 'length'; value: SimLangExpression }
  | { type: 'array-at'; value: SimLangExpression; index: SimLangExpression }
  | { type: 'range'; start: SimLangExpression; end: SimLangExpression }
  | { type: 'contains'; collection: SimLangExpression; value: SimLangExpression }
  | { type: 'map-get'; map: SimLangExpression; key: SimLangExpression }
  | { type: 'neighbors'; node: SimLangExpression }
  | { type: 'first-intersection'; left: SimLangExpression; right: SimLangExpression }
  | {
    type: 'reconstruct-bidirectional-path';
    meeting: SimLangExpression;
    parentFromStart: SimLangExpression;
    parentFromTarget: SimLangExpression;
  };

interface SimLangStatementBase {
  id: string;
}

export type SimLangStatement =
  | (SimLangStatementBase & { type: 'declare'; name: string; value: SimLangExpression })
  | (SimLangStatementBase & { type: 'assign'; name: string; value: SimLangExpression })
  | (SimLangStatementBase & { type: 'array-push'; array: string; value: SimLangExpression })
  | (SimLangStatementBase & { type: 'array-shift'; array: string; target: string })
  | (SimLangStatementBase & {
    type: 'array-set';
    array: string;
    index: SimLangExpression;
    value: SimLangExpression;
  })
  | (SimLangStatementBase & {
    type: 'swap';
    array: string;
    left: SimLangExpression;
    right: SimLangExpression;
  })
  | (SimLangStatementBase & { type: 'set-add'; set: string; value: SimLangExpression })
  | (SimLangStatementBase & {
    type: 'map-set';
    map: string;
    key: SimLangExpression;
    value: SimLangExpression;
  })
  | (SimLangStatementBase & {
    type: 'if';
    condition: SimLangExpression;
    then: SimLangStatement[];
    else?: SimLangStatement[];
  })
  | (SimLangStatementBase & {
    type: 'while';
    condition: SimLangExpression;
    body: SimLangStatement[];
    maxIterations: number;
  })
  | (SimLangStatementBase & {
    type: 'for-each';
    item: string;
    values: SimLangExpression;
    body: SimLangStatement[];
  })
  | (SimLangStatementBase & {
    type: 'call';
    functionName: string;
    args: SimLangExpression[];
    result?: string;
  })
  | (SimLangStatementBase & { type: 'return'; value?: SimLangExpression })
  | (SimLangStatementBase & { type: 'break' })
  | (SimLangStatementBase & { type: 'continue' })
  | (SimLangStatementBase & {
    type: 'trace';
    at: string;
    explanation: string;
    category?: DiscussionCheckpointCategory;
    importance?: number;
  });

export interface SimLangFunctionV1 {
  name: string;
  parameters: string[];
  body: SimLangStatement[];
}

export interface ProgramSpecV1 {
  version: 1;
  id: string;
  title: string;
  locale: Locale;
  inputKind: InputKind;
  entry: SimLangStatement[];
  functions: SimLangFunctionV1[];
  budgets: {
    instructions: number;
    traceSteps: number;
    recursionDepth: number;
    collectionSize: number;
  };
}

export interface RenderedSourceV1 {
  version: 1;
  language: 'cpp';
  code: string;
  lineMap: Record<string, number>;
}

export interface InputContractV1 {
  version: 1;
  kind: InputKind;
  description: string;
  constraints: string[];
  value: SimulationInput;
}

export interface VisualizationContractV1 {
  version: 1;
  type: 'array' | 'graph' | 'variables';
  activeVariables: string[];
  queuedVariables: string[];
  visitedVariables: string[];
  pathVariable?: string;
  activeEdges?: Array<{ fromVariable: string; toVariable: string }>;
  traversedEdgeMapVariables?: string[];
}

export type DiscussionCheckpointCategory =
  | 'initialization'
  | 'branch'
  | 'mutation'
  | 'frontier'
  | 'invariant'
  | 'meeting'
  | 'result'
  | 'error';

export interface DiscussionCheckpointV1 {
  stepIndex: number;
  category: DiscussionCheckpointCategory;
  priority: number;
  reason: string;
  lenses: Array<'code' | 'data' | 'visual' | 'reasoning' | 'time'>;
  autoPause: boolean;
}

export interface PackageTestCaseV1 {
  id: string;
  name: string;
  input: SimulationInput;
  expectation: {
    minimumSteps?: number;
    finalVariable?: { name: string; value: TraceValue };
    path?: string[];
  };
}

export interface PackageTestResultV1 {
  id: string;
  passed: boolean;
  message: string;
}

export interface PackageTestReportV1 {
  version: 1;
  passed: boolean;
  results: PackageTestResultV1[];
}

export interface CustomSimulationPackageV1 {
  version: 1;
  id: string;
  title: string;
  locale: Locale;
  createdAt: number;
  program: ProgramSpecV1;
  source: RenderedSourceV1;
  input: InputContractV1;
  visualization: VisualizationContractV1;
  steps: SimulationStep[];
  analysis: string;
  checkpoints: DiscussionCheckpointV1[];
  tests: PackageTestReportV1;
}

export interface AlgorithmDesignV1 {
  version: 1;
  title: string;
  purpose: string;
  inputKind: InputKind;
  dataStructures: string[];
  invariants: string[];
  termination: string;
  complexity: { time: string; space: string };
}

export interface TraceReviewV1 {
  version: 1;
  checkpoints: DiscussionCheckpointV1[];
}

export type UiActionV1 =
  | { type: 'focus-panel'; panel: 'code' | 'variables' | 'visualizer' | 'assistant' | 'controls' }
  | { type: 'collapse-panel'; panel: 'code' | 'variables' | 'visualizer' | 'assistant' | 'controls' }
  | { type: 'expand-panel'; panel: 'code' | 'variables' | 'visualizer' | 'assistant' | 'controls' }
  | { type: 'maximize-panel'; panel: 'visualizer' | 'assistant' }
  | { type: 'set-theme'; theme: 'neon' | 'dark' | 'light' }
  | { type: 'set-radio-state'; state: 'open' | 'play' | 'pause' }
  | { type: 'set-workspace-layout'; layout: 'focus-code' | 'focus-simulation' | 'focus-assistant' | 'balanced' };
