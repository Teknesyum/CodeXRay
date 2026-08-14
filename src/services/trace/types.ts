import type { TraceValue } from '../../types/simulation';

export type RawTraceStepKind =
  | 'statement'
  | 'call'
  | 'return'
  | 'loop-enter'
  | 'loop-iter'
  | 'loop-exit'
  | 'branch'
  | 'assign'
  | 'mutate'
  | 'throw';

export type TraceEvent =
  | { t: 'loop-enter'; loopId: string }
  | { t: 'loop-exit'; loopId: string; iterations: number }
  | { t: 'call'; fn: string; depth: number }
  | { t: 'return'; fn: string; value: TraceValue }
  | { t: 'branch'; line: number; taken: boolean; firstTime: boolean }
  | { t: 'extremum'; name: string; from: TraceValue; to: TraceValue }
  | { t: 'collection'; name: string; op: 'push' | 'pop' | 'shift' | 'set' | 'delete'; size: number }
  | { t: 'first-visit'; name: string; key: string }
  | { t: 'swap'; array: string; i: number; j: number }
  | { t: 'result-write'; name: string }
  | { t: 'error'; message: string };

export interface RawTraceStep {
  index: number;
  line: number;
  column: number;
  kind: RawTraceStepKind;
  callDepth: number;
  scopes: Record<string, TraceValue>;
  mutated: string[];
  event?: TraceEvent;
}

export interface TraceBudget {
  maxSteps: number;
  maxHeapNodes: number;
  maxElapsedMs: number;
  seed: number;
}

export interface RawTrace {
  steps: RawTraceStep[];
  truncated: boolean;
  budget: {
    maxSteps: number;
    usedSteps: number;
    elapsedMs: number;
  };
  returnValue: TraceValue | null;
  consoleOutput: string[];
  error: { message: string; line: number } | null;
}

export interface TraceEntry {
  functionName?: string;
  args: TraceValue[];
}

export interface TracerWorkerRequest {
  id: string;
  source: string;
  entry: TraceEntry;
  options?: Partial<TraceBudget>;
}

export type TracerWorkerResponse =
  | { id: string; ok: true; trace: RawTrace }
  | { id: string; ok: false; reason: string };

export const DEFAULT_TRACE_BUDGET: TraceBudget = {
  maxSteps: 200_000,
  maxHeapNodes: 100_000,
  maxElapsedMs: 3_000,
  seed: 0x4358_5241,
};
