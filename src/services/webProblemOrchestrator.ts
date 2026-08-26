import type { Locale } from '../i18n/translations';
import type {
  AgentAttemptV1,
  LocalAgentResultV2,
  ManagerJobV2,
  ManagerPlanV2,
  SolutionArtifactV1,
  WebProblemSpecV1,
} from '../types/webSource';
import type { CustomSimulationPackageV1, InputContractV1, VisualizationContract } from '../types/titan';
import {
  isActiveAiAdvancedCapable,
  runLocalAgentDetailed,
  type DetailedLocalAgentHandle,
  type LocalAgentProgress,
} from './localAiService';
import { buildWebProblemPrompt } from './webSource';
import { translateToVerifiedPackage, type TranslationResult } from './titan/translate';

const JAVA_SCHEMA = {
  type: 'object',
  required: ['version', 'title', 'code', 'explanation', 'complexity'],
  properties: {
    version: { const: 1 },
    title: { type: 'string' },
    code: { type: 'string' },
    explanation: { type: 'string' },
    complexity: {
      type: 'object',
      required: ['time', 'space'],
      properties: { time: { type: 'string' }, space: { type: 'string' } },
    },
  },
} as const;

const CRITIC_SCHEMA = {
  type: 'object',
  required: ['version', 'passed', 'summary', 'findings'],
  properties: {
    version: { const: 1 },
    passed: { type: 'boolean' },
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' } },
  },
} as const;

const TRANSLATION_SCHEMA = {
  type: 'object',
  required: ['version', 'title', 'attempts', 'input', 'visualization', 'analysis'],
  properties: {
    version: { const: 1 },
    title: { type: 'string' },
    attempts: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'array', minItems: 1, items: { type: 'string' } } },
    input: { type: 'object' },
    visualization: { type: 'object' },
    analysis: { type: 'string' },
  },
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseJson = (text: string): unknown => {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
};

interface JavaCandidate {
  title: string;
  code: string;
  explanation: string;
  complexity: { time: string; space: string };
}

interface TranslationEnvelope {
  title: string;
  attempts: string[][];
  input: InputContractV1;
  visualization: VisualizationContract;
  analysis: string;
}

const validateTranslationEnvelope = (value: unknown): TranslationEnvelope => {
  if (!isRecord(value) || value.version !== 1 || typeof value.title !== 'string' || !value.title.trim()
    || !Array.isArray(value.attempts) || value.attempts.length < 1 || value.attempts.length > 3
    || !value.attempts.every((attempt) => Array.isArray(attempt) && attempt.length > 0
      && attempt.every((fragment) => typeof fragment === 'string' && fragment.trim()))
    || !isRecord(value.input) || !isRecord(value.visualization)
    || typeof value.analysis !== 'string' || !value.analysis.trim()) {
    throw new Error('Translator returned an invalid translation envelope.');
  }
  return {
    title: value.title.trim(),
    attempts: value.attempts as string[][],
    input: value.input as unknown as InputContractV1,
    visualization: value.visualization as unknown as VisualizationContract,
    analysis: value.analysis.trim(),
  };
};

export const translateJavaFallbackCandidate = (options: {
  id: string;
  locale: Locale;
  originalSource: string;
  envelope: TranslationEnvelope;
  verifiedAt: number;
}): TranslationResult => translateToVerifiedPackage({
  id: options.id,
  title: options.envelope.title,
  locale: options.locale,
  originalLanguage: 'java',
  originalSource: options.originalSource,
  attempts: options.envelope.attempts,
  input: options.envelope.input,
  visualization: options.envelope.visualization,
  analysis: options.envelope.analysis,
  verifiedAt: options.verifiedAt,
});

const validateJavaCandidate = (value: unknown): JavaCandidate => {
  const errors: string[] = [];
  if (!isRecord(value) || value.version !== 1) errors.push('version must be 1');
  const code = isRecord(value) && typeof value.code === 'string' ? value.code.trim() : '';
  if (!/\bclass\s+Solution\b/.test(code)) errors.push('code must declare class Solution');
  if (!code || code.length > 20_000) errors.push('code must contain 1..20000 characters');
  if (/\b(?:Runtime|getRuntime|ProcessBuilder|System\.exit|java\.io|java\.net|reflect)\b/.test(code)) {
    errors.push('code contains APIs outside the algorithm-only Java 17 profile');
  }
  if (!isRecord(value) || typeof value.title !== 'string' || !value.title.trim()) errors.push('title is required');
  if (!isRecord(value) || typeof value.explanation !== 'string' || !value.explanation.trim()) errors.push('explanation is required');
  const complexity = isRecord(value) && isRecord(value.complexity) ? value.complexity : null;
  if (!complexity || typeof complexity.time !== 'string' || typeof complexity.space !== 'string') {
    errors.push('complexity.time and complexity.space are required');
  }
  if (errors.length) throw new Error(errors.join('; '));
  const record = value as Record<string, unknown>;
  return {
    title: String(record.title).trim(),
    code,
    explanation: String(record.explanation).trim(),
    complexity: { time: String(complexity?.time), space: String(complexity?.space) },
  };
};

const validateReview = (value: unknown): SolutionArtifactV1['review'] => {
  if (!isRecord(value) || value.version !== 1 || typeof value.passed !== 'boolean'
    || typeof value.summary !== 'string' || !Array.isArray(value.findings)
    || !value.findings.every((finding) => typeof finding === 'string')) {
    throw new Error('Critic returned an invalid review schema.');
  }
  return { passed: value.passed, summary: value.summary, findings: value.findings as string[] };
};

export const isWebProblemSolveCapable = (modelId: string): boolean =>
  isActiveAiAdvancedCapable(modelId);

export const validateManagerPlanV2 = (plan: ManagerPlanV2): void => {
  const ids = new Set(plan.jobs.map((job) => job.id));
  if (ids.size !== plan.jobs.length) throw new Error('ManagerPlanV2 job IDs must be unique.');
  for (const job of plan.jobs) {
    if (job.dependsOn.some((dependency) => !ids.has(dependency))) {
      throw new Error(`ManagerPlanV2 job ${job.id} has a missing dependency.`);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error('ManagerPlanV2 contains a dependency cycle.');
    if (visited.has(id)) return;
    visiting.add(id);
    const job = plan.jobs.find((candidate) => candidate.id === id);
    job?.dependsOn.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  plan.jobs.forEach((job) => visit(job.id));
};

const newJob = (job: Omit<ManagerJobV2, 'version' | 'status' | 'attempt'>): ManagerJobV2 => ({
  version: 2,
  status: 'waiting',
  attempt: 0,
  ...job,
});

export const createJavaFallbackPlan = (request: string): ManagerPlanV2 => {
  const now = Date.now();
  return {
    version: 2,
    runId: `web-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    request,
    intent: 'solve-web-problem',
    createdAt: now,
    jobs: [
      newJob({ id: 'capability-gate', role: 'manager', label: 'Select safe solution branch', dependsOn: [], consumes: ['problem-spec'], produces: [], resourceLocks: [], maxAttempts: 1 }),
      newJob({ id: 'java-author', role: 'code-author', label: 'Draft Java 17 Solution', dependsOn: ['capability-gate'], consumes: ['problem-spec'], produces: ['java-solution'], resourceLocks: ['webgpu'], maxAttempts: 2 }),
      newJob({ id: 'critic', role: 'critic', label: 'Review against source and examples', dependsOn: ['java-author'], consumes: ['problem-spec', 'java-solution'], produces: ['critic-review'], resourceLocks: ['webgpu'], maxAttempts: 1 }),
      newJob({ id: 'translator', role: 'compiler', label: 'Translate into verified SimLang-Lite', dependsOn: ['critic'], consumes: ['java-solution', 'critic-review'], produces: ['simulation-package'], resourceLocks: ['webgpu'], maxAttempts: 1 }),
      newJob({ id: 'publish', role: 'manager', label: 'Publish verified simulation', dependsOn: ['translator'], consumes: ['simulation-package', 'critic-review'], produces: ['simulation-package'], resourceLocks: [], maxAttempts: 1 }),
    ],
  };
};

const diagnostic = (
  result: LocalAgentResultV2,
  plan: ManagerPlanV2,
  jobId: string,
  attempt: number,
  outcome: AgentAttemptV1['outcome'],
  validatorErrors: string[] = [],
  reason?: string,
): AgentAttemptV1 => ({
  version: 1,
  runId: plan.runId,
  jobId,
  role: jobId === 'critic' ? 'critic' : 'code-author',
  attempt,
  model: result.model,
  contextWindow: result.contextWindow,
  promptBudget: result.promptTokens ?? 0,
  outputBudget: result.completionTokens ?? 0,
  finishReason: result.finishReason,
  queueMs: result.queueMs,
  inferenceMs: result.inferenceMs,
  schemaMode: result.schemaMode,
  validatorErrors,
  outcome,
  ...(reason ? { reason } : {}),
});

export interface JavaFallbackRun {
  runId: string;
  plan: ManagerPlanV2;
  attempts: AgentAttemptV1[];
  promise: Promise<{ solution: SolutionArtifactV1; package: CustomSimulationPackageV1 }>;
  cancel: () => void;
}

export const startJavaFallbackRun = (options: {
  request: string;
  problem: WebProblemSpecV1;
  locale: Locale;
  modelId: string;
  onPlan?: (plan: ManagerPlanV2) => void;
}): JavaFallbackRun => {
  if (!isWebProblemSolveCapable(options.modelId)) {
    throw new Error('The selected local model is not benchmarked for web problem solving.');
  }
  let plan = createJavaFallbackPlan(options.request);
  validateManagerPlanV2(plan);
  const attempts: AgentAttemptV1[] = [];
  let cancelled = false;
  let active: DetailedLocalAgentHandle | null = null;
  const updateJob = (id: string, patch: Partial<ManagerJobV2>) => {
    const now = Date.now();
    plan = {
      ...plan,
      jobs: plan.jobs.map((job) => {
        if (job.id !== id) return job;
        const startedAt = job.startedAt ?? (patch.status && patch.status !== 'waiting' ? now : undefined);
        const terminal = patch.status === 'completed' || patch.status === 'completed_with_fallback'
          || patch.status === 'failed' || patch.status === 'cancelled';
        const finishedAt = terminal ? now : job.finishedAt;
        return {
          ...job,
          ...patch,
          ...(startedAt ? { startedAt } : {}),
          ...(finishedAt ? { finishedAt } : {}),
          ...(startedAt && finishedAt ? { durationMs: Math.max(0, finishedAt - startedAt) } : {}),
        };
      }),
    };
    options.onPlan?.(plan);
  };
  const reasoningBuffers = new Map<string, string>();
  const reasoningTimers = new Map<string, ReturnType<typeof globalThis.setTimeout>>();
  const flushReasoning = (jobId: string) => {
    const timer = reasoningTimers.get(jobId);
    if (timer) globalThis.clearTimeout(timer);
    reasoningTimers.delete(jobId);
    const delta = reasoningBuffers.get(jobId) ?? '';
    reasoningBuffers.delete(jobId);
    if (!delta) return;
    const current = plan.jobs.find((job) => job.id === jobId)?.reasoning ?? '';
    updateJob(jobId, { reasoning: `${current}${delta}`.slice(-200_000) });
  };
  const trackReasoning = (jobId: string) => (progress: LocalAgentProgress) => {
    if (progress.status !== 'reasoning-delta') return;
    reasoningBuffers.set(jobId, `${reasoningBuffers.get(jobId) ?? ''}${progress.text}`);
    if (!reasoningTimers.has(jobId)) {
      reasoningTimers.set(jobId, globalThis.setTimeout(() => flushReasoning(jobId), 32));
    }
  };
  updateJob('capability-gate', { status: 'completed', attempt: 1, summary: 'Java 17 fallback selected; workspace remains unchanged.' });

  const promise = (async (): Promise<{ solution: SolutionArtifactV1; package: CustomSimulationPackageV1 }> => {
    let candidate: JavaCandidate | null = null;
    let previousFailure = '';
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      if (cancelled) throw new Error('Web problem run was cancelled.');
      updateJob('java-author', { status: attempt === 1 ? 'running' : 'retrying', attempt, error: undefined });
      const repair = previousFailure
        ? `\nREPAIR DIAGNOSTIC: ${previousFailure.slice(0, 1_500)}\nPrevious candidate excerpt: ${candidate?.code.slice(0, 2_000) ?? 'unparseable output'}`
        : '';
      active = runLocalAgentDetailed({
        role: 'code-author',
        locale: options.locale,
        instructions: options.locale === 'tr'
          ? 'Yalnızca kısa bir Java 17 algoritma taslağı üret. class Solution ve verilen imzayı kullan. Başlık Türkçe ve kısa olsun. Açıklama tam iki kısa Türkçe cümle içersin: önce yaklaşım, sonra neden doğru olduğu. Dosya sistemi, ağ, süreçler, reflection veya package bildirimi kullanma.'
          : 'Produce a compact Java 17 algorithm draft only. Use class Solution and the supplied signature. Keep the title short. The explanation must contain exactly two short English sentences: first the approach, then why it is correct. Do not use filesystem, network, processes, reflection, or package declarations.',
        context: buildWebProblemPrompt(options.problem, `Return the required compact Java solution JSON.${repair}`),
        responseSchema: JAVA_SCHEMA as unknown as Record<string, unknown>,
        jsonMode: true,
        maxTokens: 520,
        temperature: 0,
      }, trackReasoning('java-author'));
      const result = await active.promise;
      flushReasoning('java-author');
      active = null;
      try {
        candidate = validateJavaCandidate(parseJson(result.text));
        attempts.push(diagnostic(result, plan, 'java-author', attempt, 'completed'));
        updateJob('java-author', {
          status: 'completed',
          queueMs: attempts.filter((item) => item.jobId === 'java-author').reduce((sum, item) => sum + item.queueMs, 0),
          firstTokenMs: result.firstTokenMs,
          inferenceMs: attempts.filter((item) => item.jobId === 'java-author').reduce((sum, item) => sum + item.inferenceMs, 0),
          completionTokens: result.completionTokens,
          finishReason: result.finishReason,
          summary: `Validated Java schema on attempt ${attempt}.`,
        });
        break;
      } catch (error) {
        const failure = error instanceof Error ? error.message : 'Invalid Java artifact.';
        attempts.push(diagnostic(result, plan, 'java-author', attempt, attempt < 2 ? 'retry' : 'failed', [failure], failure));
        if (failure === previousFailure || attempt === 2) {
          updateJob('java-author', { status: 'failed', error: failure });
          throw new Error(`Java author validation failed: ${failure}`);
        }
        previousFailure = failure;
      }
    }
    if (!candidate) throw new Error('Java author did not produce a valid artifact.');
    if (cancelled) throw new Error('Web problem run was cancelled.');
    updateJob('critic', { status: 'running', attempt: 1 });
    active = runLocalAgentDetailed({
      role: 'critic',
      locale: options.locale,
      instructions: options.locale === 'tr'
        ? 'Adayı yalnızca verilen kaynak problem, imza, kısıtlar ve örneklere göre incele. Doğruluk, imza, karmaşıklık veya kaynağa bağlılık kusurunda passed=false yap. summary alanını kısa bir Türkçe doğruluk gerekçesi olarak yaz.'
        : 'Review the candidate only against the supplied source problem, signature, constraints, and examples. Set passed=false for any correctness, signature, complexity, or source-grounding defect. Write summary as one short English correctness justification.',
      context: buildWebProblemPrompt(options.problem, `Review this Java 17 candidate:\n${candidate.code}\nExplanation: ${candidate.explanation}`),
      responseSchema: CRITIC_SCHEMA as unknown as Record<string, unknown>,
      jsonMode: true,
      maxTokens: 260,
      temperature: 0,
    }, trackReasoning('critic'));
    const criticResult = await active.promise;
    flushReasoning('critic');
    active = null;
    const review = validateReview(parseJson(criticResult.text));
    attempts.push(diagnostic(criticResult, plan, 'critic', 1, review.passed ? 'completed' : 'failed', review.findings, review.summary));
    if (!review.passed) {
      updateJob('critic', { status: 'failed', error: review.summary });
      throw new Error(`Critic rejected the Java draft: ${review.summary}`);
    }
    updateJob('critic', {
      status: 'completed',
      queueMs: criticResult.queueMs,
      firstTokenMs: criticResult.firstTokenMs,
      inferenceMs: criticResult.inferenceMs,
      completionTokens: criticResult.completionTokens,
      finishReason: criticResult.finishReason,
      summary: review.summary,
    });
    const artifact: SolutionArtifactV1 = {
      version: 1,
      kind: 'unexecuted-java17',
      sourceHash: options.problem.sourceHash,
      problemHash: options.problem.id,
      ...candidate,
      review,
    };
    if (cancelled) throw new Error('Web problem run was cancelled.');
    updateJob('translator', { status: 'running', attempt: 1 });
    active = runLocalAgentDetailed({
      role: 'compiler',
      locale: options.locale,
      instructions: options.locale === 'tr'
        ? 'İncelenmiş Java algoritmasını SimLang-Lite parçalarına çevir. Özgün Java kodunu çalıştırma. Tam bir input sözleşmesi, görselleştirme sözleşmesi ve en çok üç parça denemesi döndür. Her deneme birlikte tam programı oluşturmalıdır.'
        : 'Translate the reviewed Java algorithm into SimLang-Lite fragments. Never execute the original Java. Return a complete input contract, visualization contract, and at most three fragment attempts. Each attempt must merge into a complete program.',
      context: buildWebProblemPrompt(options.problem, `Translate this reviewed Java 17 candidate without executing it:\n${candidate.code}`),
      responseSchema: TRANSLATION_SCHEMA as unknown as Record<string, unknown>,
      jsonMode: true,
      maxTokens: 1_200,
      temperature: 0,
    }, trackReasoning('translator'));
    const translationAgentResult = await active.promise;
    flushReasoning('translator');
    active = null;
    const envelope = validateTranslationEnvelope(parseJson(translationAgentResult.text));
    const translation = translateJavaFallbackCandidate({
      id: `web-translation-${options.problem.id}`,
      locale: options.locale,
      originalSource: candidate.code,
      envelope,
      verifiedAt: Date.now(),
    });
    if (translation.ok === false) {
      updateJob('translator', { status: 'failed', error: translation.reason });
      throw new Error(`Translation verification failed: ${translation.reason}`);
    }
    updateJob('translator', {
      status: 'completed',
      attempt: 1,
      queueMs: translationAgentResult.queueMs,
      firstTokenMs: translationAgentResult.firstTokenMs,
      inferenceMs: translationAgentResult.inferenceMs,
      completionTokens: translationAgentResult.completionTokens,
      finishReason: translationAgentResult.finishReason,
      summary: `Verified deterministic translation after ${translation.attempts} attempt(s).`,
    });
    updateJob('publish', { status: 'completed', attempt: 1, summary: 'Verified translated simulation is ready for atomic apply.' });
    return { solution: artifact, package: translation.package };
  })().catch((error) => {
    if (cancelled) {
      plan = { ...plan, jobs: plan.jobs.map((job) => job.status === 'waiting' || job.status === 'running' || job.status === 'retrying'
        ? { ...job, status: 'cancelled' as const, error: undefined }
        : job) };
      options.onPlan?.(plan);
    }
    throw error;
  });

  return {
    runId: plan.runId,
    get plan() { return plan; },
    attempts,
    promise,
    cancel: () => {
      cancelled = true;
      for (const jobId of reasoningBuffers.keys()) flushReasoning(jobId);
      active?.cancel();
    },
  };
};
