import type { TitanModeAgentRole } from './titan';

export type WebReaderErrorCode =
  | 'invalid_url'
  | 'blocked_target'
  | 'unsupported_content_type'
  | 'too_large'
  | 'timeout'
  | 'redirect_limit'
  | 'rate_limited'
  | 'upstream_blocked'
  | 'empty_content'
  | 'dynamic_content_unsupported';

export type WebSourceSegmentKind =
  | 'title'
  | 'statement'
  | 'example'
  | 'constraints'
  | 'signature'
  | 'body';

export interface WebSourceSegmentV1 {
  id: string;
  kind: WebSourceSegmentKind;
  heading?: string;
  text: string;
}

export interface ExternalDocumentV1 {
  version: 1;
  id: string;
  requestedUrl: string;
  finalUrl: string;
  title: string;
  contentType: 'text/html' | 'text/plain';
  provider: 'generic-html' | 'plain-text' | 'leetcode';
  retrievedAt: string;
  segments: WebSourceSegmentV1[];
  contentHash: string;
  truncated: boolean;
  warnings: string[];
}

export interface ProblemExampleV1 {
  input: string;
  output: string;
  explanation?: string;
  sourceSegmentIds: string[];
}

export interface WebProblemSpecV1 {
  version: 1;
  id: string;
  sourceDocumentId: string;
  sourceHash: string;
  title: string;
  description: string;
  inputFormat: string | null;
  outputFormat: string | null;
  examples: ProblemExampleV1[];
  constraints: string[];
  notes: string[];
  signature: string | null;
  sourceSegmentIds: Record<'description' | 'inputFormat' | 'outputFormat' | 'examples' | 'constraints' | 'notes' | 'signature', string[]>;
  simulationCompatibility: {
    compatible: boolean;
    reason: string;
  };
}

export interface SolutionReviewV1 {
  passed: boolean;
  summary: string;
  findings: string[];
}

export type SolutionArtifactV1 =
  | {
    version: 1;
    kind: 'validated-simulation';
    sourceHash: string;
    problemHash: string;
    packageId: string;
    review: SolutionReviewV1;
  }
  | {
    version: 1;
    kind: 'unexecuted-java17';
    sourceHash: string;
    problemHash: string;
    title: string;
    code: string;
    explanation: string;
    complexity: { time: string; space: string };
    review: SolutionReviewV1;
  };

export type WebArtifactKind =
  | 'external-document'
  | 'problem-spec'
  | 'simulation-package'
  | 'java-solution'
  | 'critic-review';

export type WebAgentResourceLock = 'webgpu' | 'network' | 'workspace';

export interface ManagerJobV2 {
  version: 2;
  id: string;
  role: TitanModeAgentRole | 'fetcher' | 'extractor';
  label: string;
  dependsOn: string[];
  consumes: WebArtifactKind[];
  produces: WebArtifactKind[];
  resourceLocks: WebAgentResourceLock[];
  status: 'waiting' | 'running' | 'retrying' | 'completed' | 'completed_with_fallback' | 'failed' | 'cancelled';
  attempt: number;
  maxAttempts: number;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  queueMs?: number;
  firstTokenMs?: number | null;
  inferenceMs?: number;
  completionTokens?: number | null;
  promptTokens?: number | null;
  contextWindow?: number;
  promptTokensEstimated?: boolean;
  finishReason?: string;
  summary?: string;
  reasoning?: string;
  error?: string;
}

export interface ManagerPlanV2 {
  version: 2;
  runId: string;
  request: string;
  intent: 'read-web-source' | 'solve-web-problem' | 'explain-bound-solution';
  jobs: ManagerJobV2[];
  createdAt: number;
}

export interface AgentAttemptV1 {
  version: 1;
  runId: string;
  jobId: string;
  role: TitanModeAgentRole;
  attempt: number;
  model: string;
  contextWindow: number;
  promptBudget: number;
  outputBudget: number;
  finishReason: string;
  queueMs: number;
  inferenceMs: number;
  schemaMode: 'none' | 'json-object' | 'json-schema';
  validatorErrors: string[];
  outcome: 'completed' | 'retry' | 'fallback' | 'cancelled' | 'failed';
  reason?: string;
}

export interface LocalAgentResultV2 {
  version: 2;
  text: string;
  finishReason: string;
  model: string;
  contextWindow: number;
  promptTokens: number | null;
  completionTokens: number | null;
  queueMs: number;
  firstTokenMs: number | null;
  inferenceMs: number;
  schemaMode: AgentAttemptV1['schemaMode'];
}

export interface BoundWebSourceSessionV1 {
  version: 1;
  document: ExternalDocumentV1;
  problem: WebProblemSpecV1;
  solution: SolutionArtifactV1 | null;
}
