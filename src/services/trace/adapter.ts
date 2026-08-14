import type { SimulationInput, SimulationStep, TraceValue } from '../../types/simulation';
import { parseArrayInput } from '../inputParsers';
import type { RawTrace, TraceEntry } from './types';

const firstFunctionName = (source: string): string | undefined =>
  /(?:^|\s)(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(source)?.[1];

const parameterValues = (input: SimulationInput): TraceValue[] =>
  Object.values(input.parameters ?? {}).map((value) => {
    const numeric = Number(value);
    return value.trim() !== '' && Number.isFinite(numeric) ? numeric : value;
  });

const graphValue = (input: SimulationInput): TraceValue => input.graph
  ? JSON.parse(JSON.stringify(input.graph)) as TraceValue
  : {};

export const buildTraceEntry = (source: string, input: SimulationInput): TraceEntry => {
  const primary: TraceValue = input.kind === 'array'
    ? parseArrayInput(input.text)
    : input.kind === 'string'
      ? input.text
      : graphValue(input);
  return {
    functionName: firstFunctionName(source),
    args: [primary, ...parameterValues(input)],
  };
};

const statusStep = (message: string, lineNumber: number | null, vars: Record<string, TraceValue>): SimulationStep => ({
  lineNumber,
  visualData: { type: 'variables', vars },
  explanation: message,
});

export const adaptRawTrace = (trace: RawTrace): SimulationStep[] => {
  if (trace.steps.length === 0) {
    const message = trace.error
      ? `error · line ${trace.error.line} · ${trace.error.message}`
      : trace.truncated
        ? 'execution-budget-exceeded · no-step-produced'
        : 'execution-finished · no-step-produced';
    return [statusStep(message, trace.error?.line ?? null, {
      error: trace.error?.message ?? null,
      truncated: trace.truncated,
    })];
  }

  return trace.steps.map((step, index) => {
    const isLast = index === trace.steps.length - 1;
    const vars: Record<string, TraceValue> = {
      ...step.scopes,
      _traceKind: step.kind,
      _callDepth: step.callDepth,
      _mutated: step.mutated,
    };
    if (isLast) {
      vars._returnValue = trace.returnValue;
      vars._consoleOutput = trace.consoleOutput;
      vars._truncated = trace.truncated;
      vars._budget = {
        maxSteps: trace.budget.maxSteps,
        usedSteps: trace.budget.usedSteps,
        elapsedMs: trace.budget.elapsedMs,
      };
      vars._error = trace.error?.message ?? null;
    }
    const mutation = step.mutated.length ? ` · ${step.mutated.join(',')}` : '';
    const terminal = isLast && trace.truncated
      ? ' · execution-budget-exceeded'
      : isLast && trace.error
        ? ` · error: ${trace.error.message}`
        : '';
    return statusStep(`${step.kind} · line ${step.line}${mutation}${terminal}`, step.line, vars);
  });
};
