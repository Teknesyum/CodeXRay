import type {
  CustomSimulationPackageV1,
  DiscussionCheckpointCategory,
  DiscussionCheckpointV1,
  InputContractV1,
  PackageTestCaseV1,
  PackageTestReportV1,
  ProgramSpecV1,
  VisualizationContract,
} from '../types/godMode';
import type { Locale, SimulationStep, TraceValue } from '../types/simulation';
import { parseSimulationInput } from './inputParsers';
import {
  executeSimLang,
  renderProgramSource,
  SimLangError,
  validateProgramSpec,
} from './simLang';
import { inspectGraphLayout } from './graphLayout';
import { createTeachingPlan } from './teachingPlan';
import { isVisualizationV2, validateVisualizationContractV2 } from './visualizationDesigner';

const checkpointCategory = (explanation: string, index: number, total: number): DiscussionCheckpointCategory => {
  const normalized = explanation.toLocaleLowerCase('tr-TR');
  if (index === 0) return 'initialization';
  if (index === total - 1 || /result|sonu[cç]|path|yol/.test(normalized)) return 'result';
  if (/meet|bulu[sş]/.test(normalized)) return 'meeting';
  if (/frontier|cephe|queue|kuyruk/.test(normalized)) return 'frontier';
  if (/invariant|de[gğ]i[sş]mez/.test(normalized)) return 'invariant';
  if (/if |branch|ko[sş]ul/.test(normalized)) return 'branch';
  return 'mutation';
};

export const reviewTrace = (steps: SimulationStep[], maximum = 10): DiscussionCheckpointV1[] => {
  if (!steps.length || maximum <= 0) return [];
  const candidates = steps.map((step, stepIndex) => {
    const category = checkpointCategory(step.explanation, stepIndex, steps.length);
    const priority = category === 'meeting' || category === 'result'
      ? 1
      : category === 'initialization' ? 0.9 : category === 'frontier' ? 0.72 : 0.5;
    return {
      stepIndex,
      category,
      priority,
      reason: step.explanation,
      lenses: ['code', 'data', 'visual', 'reasoning', 'time'] as const,
      autoPause: priority >= 0.9,
    };
  });
  const limit = Math.min(maximum, steps.length);
  const required = new Set([0]);
  if (limit > 1) required.add(steps.length - 1);
  const remaining = candidates
    .filter((candidate) => !required.has(candidate.stepIndex))
    .sort((left, right) => right.priority - left.priority || left.stepIndex - right.stepIndex);
  remaining.slice(0, Math.max(0, limit - required.size)).forEach((candidate) => required.add(candidate.stepIndex));
  return candidates.filter((candidate) => required.has(candidate.stepIndex))
    .sort((left, right) => left.stepIndex - right.stepIndex)
    .map((candidate) => ({ ...candidate, lenses: [...candidate.lenses] }));
};

const finalVariables = (steps: SimulationStep[]): Record<string, TraceValue> =>
  steps.at(-1)?.visualData.vars ?? {};

export const runPackageTests = (
  program: ProgramSpecV1,
  visualization: VisualizationContract,
  testCases: PackageTestCaseV1[],
): PackageTestReportV1 => {
  const source = renderProgramSource(program);
  const results = testCases.map((test) => {
    try {
      const parsed = parseSimulationInput(
        test.input.kind,
        test.input.text,
        test.input.graph,
        test.input.parameters,
      );
      if (!parsed.input) return { id: test.id, passed: false, message: parsed.error ?? 'Invalid test input.' };
      const execution = executeSimLang(program, parsed.input, visualization, source);
      if (test.expectation.minimumSteps !== undefined && execution.steps.length < test.expectation.minimumSteps) {
        return { id: test.id, passed: false, message: `Expected at least ${test.expectation.minimumSteps} steps.` };
      }
      const variables = finalVariables(execution.steps);
      if (test.expectation.finalVariable) {
        const actual = variables[test.expectation.finalVariable.name];
        if (JSON.stringify(actual) !== JSON.stringify(test.expectation.finalVariable.value)) {
          return { id: test.id, passed: false, message: `Unexpected ${test.expectation.finalVariable.name}.` };
        }
      }
      if (test.expectation.path && JSON.stringify(variables.path) !== JSON.stringify(test.expectation.path)) {
        return { id: test.id, passed: false, message: 'The reconstructed path did not match.' };
      }
      return { id: test.id, passed: true, message: `${execution.steps.length} deterministic steps generated.` };
    } catch (error) {
      return { id: test.id, passed: false, message: error instanceof Error ? error.message : 'Test execution failed.' };
    }
  });
  return { version: 1, passed: results.every((result) => result.passed), results };
};

interface CompilePackageOptions {
  id: string;
  title: string;
  locale: Locale;
  program: ProgramSpecV1;
  input: InputContractV1;
  visualization: VisualizationContract;
  analysis: string;
  testCases?: PackageTestCaseV1[];
  invariants?: string[];
}

export const compileCustomSimulationPackage = (
  options: CompilePackageOptions,
): CustomSimulationPackageV1 => {
  const programValidation = validateProgramSpec(options.program);
  if (!programValidation.valid || !programValidation.program) {
    throw new SimLangError(programValidation.errors.join(' '));
  }
  if (options.input.version !== 1 || options.input.kind !== options.program.inputKind) {
    throw new SimLangError('Input contract does not match the program input kind.');
  }
  if (options.visualization.version !== 1 && options.visualization.version !== 2) {
    throw new SimLangError('Visualization contract is invalid.');
  }
  const inputValidation = parseSimulationInput(
    options.input.value.kind,
    options.input.value.text,
    options.input.value.graph,
    options.input.value.parameters,
  );
  if (!inputValidation.input) throw new SimLangError(inputValidation.error ?? 'Invalid package input.');
  if (isVisualizationV2(options.visualization)) {
    const visualizationIssues = validateVisualizationContractV2(options.visualization);
    if (visualizationIssues.length) throw new SimLangError(visualizationIssues.join(' '));
    if (inputValidation.input.graph) {
      const quality = inspectGraphLayout(
        inputValidation.input.graph,
        Math.min(5, options.visualization.layout.minimumNodeDistance / 2),
      );
      if (!quality.valid) {
        throw new SimLangError(`Graph layout failed quality checks: overlaps=${quality.overlaps.length}, bounds=${quality.outOfBounds.length}, edges=${quality.missingEdgeEndpoints.length}.`);
      }
    }
  }
  const source = renderProgramSource(options.program);
  const execution = executeSimLang(options.program, inputValidation.input, options.visualization, source);
  const tests = runPackageTests(options.program, options.visualization, options.testCases ?? [{
    id: 'active-input',
    name: 'Active input compiles and runs',
    input: inputValidation.input,
    expectation: { minimumSteps: 1 },
  }]);
  if (!tests.passed) {
    throw new SimLangError(`Package tests failed: ${tests.results.filter((result) => !result.passed).map((result) => result.message).join(' ')}`);
  }
  const checkpoints = reviewTrace(execution.steps);
  const teachingPlan = createTeachingPlan(
    execution.steps,
    checkpoints,
    inputValidation.input,
    options.locale,
    options.invariants,
  );
  return {
    version: 1,
    id: options.id,
    title: options.title,
    locale: options.locale,
    createdAt: Date.now(),
    program: options.program,
    source,
    input: {
      ...options.input,
      value: { ...inputValidation.input, origin: options.input.value.origin },
    },
    visualization: options.visualization,
    steps: execution.steps,
    analysis: options.analysis,
    checkpoints,
    teachingPlan,
    tests,
  };
};
