import type { TraceValue } from '../../types/simulation';
import { Interpreter } from './interpreter';
import { parseTraceSource, TraceSourceError } from './parser';
import type { RawTrace, TraceBudget } from './types';

export const traceJavaScript = (
  source: string,
  entry: { functionName?: string; args: TraceValue[] },
  options: Partial<TraceBudget> = {},
): RawTrace => {
  try {
    const program = parseTraceSource(source);
    return new Interpreter(options).run(program, entry);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    const line = reason instanceof TraceSourceError ? reason.line : 1;
    return {
      steps: [],
      truncated: false,
      budget: { maxSteps: options.maxSteps ?? 200_000, usedSteps: 0, elapsedMs: 0 },
      returnValue: null,
      consoleOutput: [],
      error: { message, line },
    };
  }
};

export type { RawTrace, TraceBudget, TraceEntry } from './types';
