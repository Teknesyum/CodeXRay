import type { ManagerJobV1, ManagerPlanV1 } from '../types/titan';
import {
  startTitanModeRun as startLegacyTitanModeRun,
  type TitanModeOrchestratorOptions,
  type TitanModeRunHandle,
  type TitanModeRunResult,
} from './titanEngine';
import { checkProblemSupport } from './catalogSupportRegistry';
import { compileExactCatalogProblem } from './catalogProblemCompiler';
import { getProblem } from './algorithmCatalog';

export const preflightCatalogProblem = async (
  source: string,
  problemId: string,
  title: string,
  locale: 'en' | 'tr',
): Promise<{ exact: true } | { exact: false; request: string }> => {
  const support = await checkProblemSupport(source, problemId, locale);
  if (support.type === 'exact-simulation') return { exact: true };
  const problem = await getProblem({ source, id: problemId });
  return {
    exact: false,
    request: [
      locale === 'tr'
        ? 'Yerel model ile yeni, doğrulanabilir ve öğretici bir SimLang simülasyonu üret.'
        : 'Use the local model to create a new verifiable, educational SimLang simulation.',
      `Catalog problem: ${source}/${problemId} — ${title}`,
      `Category: ${problem?.category ?? 'unknown'}`,
      `Tags: ${problem?.tags.join(', ') || 'unknown'}`,
      'Generate source, a representative input, semantic visuals, deterministic trace, tests, and a teaching tour. Do not claim the original statement is known when it is absent.',
    ].join('\n'),
  };
};

const catalogJob = (
  id: string,
  role: ManagerJobV1['role'],
  label: string,
  weight: number,
): ManagerJobV1 => ({
  id,
  role,
  label,
  dependsOn: [],
  weight,
  status: 'waiting',
  attempt: 0,
  maxAttempts: 1,
});

const createCatalogJobs = (): ManagerJobV1[] => [
  catalogJob('manager-catalog-request', 'manager', 'Catalog request', 8),
  catalogJob('scout-exact-support', 'scout', 'Exact support', 10),
  catalogJob('architect-verified-contract', 'architect', 'Verified contract', 10),
  catalogJob('code-author-compile-source', 'code-author', 'Code', 18),
  catalogJob('input-engineer-teaching-input', 'input-engineer', 'Input', 10),
  catalogJob('visual-designer-semantic-view', 'visual-designer', 'Visual', 10),
  catalogJob('compiler-deterministic-trace', 'compiler', 'Simulation', 14),
  catalogJob('critic-verification-gates', 'critic', 'Test', 8),
  catalogJob('manager-atomic-apply', 'manager', 'Apply', 7),
  catalogJob('tutor-grounded-tour', 'tutor', 'Teaching', 5),
];

export const startTitanModeRun = (options: TitanModeOrchestratorOptions): TitanModeRunHandle => {
  if (options.intent.type !== 'create-catalog-problem') return startLegacyTitanModeRun(options);

  const runId = `gm-catalog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const plan: ManagerPlanV1 = {
    version: 1,
    runId,
    request: options.request,
    intent: 'create-catalog-problem',
    jobs: createCatalogJobs(),
    createdAt: Date.now(),
  };
  let cancelled = false;
  const publish = () => options.onPlan({ ...plan, jobs: plan.jobs.map((job) => ({ ...job })) });
  const setJob = (id: string, changes: Partial<ManagerJobV1>) => {
    const target = plan.jobs.find((job) => job.id === id);
    if (!target) throw new Error(`Unknown catalog Titan Mode job ${id}.`);
    Object.assign(target, changes);
    options.onEvent?.({ ...target });
    publish();
  };
  const runJob = async <T>(id: string, task: () => T | Promise<T>): Promise<T> => {
    if (cancelled) throw new Error('Titan Mode run was cancelled.');
    const target = plan.jobs.find((job) => job.id === id);
    if (!target) throw new Error(`Unknown catalog Titan Mode job ${id}.`);
    setJob(id, { status: 'running', attempt: target.attempt + 1, startedAt: Date.now() });
    try {
      const result = await task();
      if (cancelled) throw new Error('Titan Mode run was cancelled.');
      setJob(id, { status: 'completed', finishedAt: Date.now() });
      return result;
    } catch (error) {
      setJob(id, {
        status: cancelled ? 'cancelled' : 'failed',
        error: error instanceof Error ? error.message : 'Catalog Titan Mode job failed.',
        finishedAt: Date.now(),
      });
      throw error;
    }
  };

  publish();
  const promise = (async (): Promise<TitanModeRunResult> => {
    try {
      const problemRef = `${(options.intent as any).source}/${(options.intent as any).problemId}`;
      await runJob('manager-catalog-request', () => problemRef);
      const support = await runJob('scout-exact-support', () => checkProblemSupport(
        (options.intent as any).source,
        (options.intent as any).problemId,
        options.locale,
      ));
      if (support.type === 'unsupported') throw new Error(support.reason);
      if (support.type === 'needs-source') {
        throw new Error(options.locale === 'tr'
          ? `${problemRef} için doğrulanmış deterministik derleyici bulunmuyor.`
          : `No verified deterministic compiler exists for ${problemRef}.`);
      }
      await runJob('architect-verified-contract', () => support.template);
      const packageValue = await runJob('code-author-compile-source', async () => {
        const compiled = await compileExactCatalogProblem({
          template: support.template,
          id: runId,
          request: options.request,
          locale: options.locale,
          workspace: options.workspace,
        });
        await options.previewSource?.(compiled.source.code, compiled.title, runId);
        return compiled;
      });
      await runJob('input-engineer-teaching-input', () => packageValue.input);
      await runJob('visual-designer-semantic-view', () => packageValue.visualization);
      await runJob('compiler-deterministic-trace', () => {
        if (!packageValue.steps.length) throw new Error(`Verified compiler produced no trace for ${problemRef}.`);
        return packageValue.steps;
      });
      await runJob('critic-verification-gates', () => {
        if (!packageValue.tests.passed) throw new Error(`Verification gates failed for ${problemRef}.`);
        if (!packageValue.steps.every((step) => step.lineNumber === null || step.lineNumber >= 1)) {
          throw new Error(`Trace source mapping failed for ${problemRef}.`);
        }
        return packageValue.tests;
      });
      await runJob('manager-atomic-apply', () => options.applyPackage(packageValue, runId));
      const tutorAnswer = await runJob('tutor-grounded-tour', () => packageValue.teachingPlan.finalResult.summary);
      return {
        status: 'success',
        runId,
        plan,
        summary: options.locale === 'tr'
          ? `${packageValue.title} doğrulanmış katalog derleyicisiyle uygulandı.`
          : `${packageValue.title} was applied through its verified catalog compiler.`,
        tutorAnswer,
        package: packageValue,
        input: packageValue.input.value,
        steps: packageValue.steps,
      };
    } catch (error) {
      plan.jobs
        .filter((job) => job.status === 'waiting' || job.status === 'running')
        .forEach((job) => setJob(job.id, {
          status: 'cancelled',
          error: undefined,
          finishedAt: Date.now(),
        }));
      throw error;
    }
  })();

  return {
    runId,
    promise,
    cancel: () => { cancelled = true; },
  };
};

export type { TitanModeRunHandle } from './titanEngine';
