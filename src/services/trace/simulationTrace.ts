import type { SimulationStep, TraceValue } from '../../types/simulation';
import type { RawTrace, RawTraceStepKind, TraceEvent } from './types';

const kinds = new Set<RawTraceStepKind>([
  'statement', 'call', 'return', 'loop-enter', 'loop-iter', 'loop-exit', 'branch', 'assign', 'mutate', 'throw',
]);

const traceEvent = (value: TraceValue | undefined): TraceEvent | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return typeof value.t === 'string' ? value as unknown as TraceEvent : undefined;
};

const publicScopes = (vars: Record<string, TraceValue>): Record<string, TraceValue> =>
  Object.fromEntries(Object.entries(vars).filter(([name]) => !name.startsWith('_trace')
    && name !== '_callDepth' && name !== '_mutated'));

const changedKeys = (
  previous: Record<string, TraceValue>,
  current: Record<string, TraceValue>,
): string[] => Object.keys(current).filter((name) => JSON.stringify(previous[name]) !== JSON.stringify(current[name]));

export const simulationStepsToRawTrace = (steps: SimulationStep[]): RawTrace => {
  let previous: Record<string, TraceValue> = {};
  const rawSteps = steps.map((step, index) => {
    const vars = step.visualData.vars;
    const scopes = publicScopes(vars);
    const explicitKind = typeof vars._traceKind === 'string' && kinds.has(vars._traceKind as RawTraceStepKind)
      ? vars._traceKind as RawTraceStepKind : null;
    const explicitMutated = Array.isArray(vars._mutated)
      ? vars._mutated.filter((value): value is string => typeof value === 'string')
      : null;
    const mutated = explicitMutated ?? changedKeys(previous, scopes);
    const event = traceEvent(vars._traceEvent);
    const raw = {
      index,
      line: step.lineNumber ?? 0,
      column: 0,
      kind: explicitKind ?? (event?.t === 'error' ? 'throw' : mutated.length ? 'mutate' : 'statement'),
      callDepth: typeof vars._callDepth === 'number' ? vars._callDepth : 0,
      scopes,
      mutated,
      event,
    };
    previous = scopes;
    return raw;
  });
  const finalVars = steps.at(-1)?.visualData.vars;
  const errorMessage = typeof finalVars?._error === 'string' ? finalVars._error : null;
  return {
    steps: rawSteps,
    truncated: finalVars?._truncated === true,
    budget: {
      maxSteps: steps.length,
      usedSteps: steps.length,
      elapsedMs: 0,
    },
    returnValue: finalVars?._returnValue ?? null,
    consoleOutput: Array.isArray(finalVars?._consoleOutput)
      ? finalVars._consoleOutput.filter((value): value is string => typeof value === 'string') : [],
    error: errorMessage ? { message: errorMessage, line: steps.at(-1)?.lineNumber ?? 0 } : null,
  };
};
