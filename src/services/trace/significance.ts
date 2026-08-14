import type { RawTrace, RawTraceStep } from './types';

const eventWeight = (step: RawTraceStep): number => {
  switch (step.event?.t) {
    case 'result-write': return 4;
    case 'error': return 3.5;
    case 'extremum': return 3;
    case 'first-visit': return 2.5;
    case 'branch': return step.event.firstTime ? 2.5 : 0;
    case 'loop-exit': return 2;
    case 'call':
    case 'return': return step.callDepth <= 2 ? 1.5 : 0;
    case 'swap':
    case 'collection': return 1;
    case 'loop-enter': return 0.5;
    default: return 0;
  }
};

const kindWeight = (step: RawTraceStep): number => {
  if (step.kind === 'throw') return 3.5;
  if ((step.kind === 'call' || step.kind === 'return') && step.callDepth <= 2) return 1.5;
  if (step.kind === 'loop-exit') return 2;
  if (step.kind === 'loop-enter') return 0.5;
  if (step.kind === 'mutate') return 1;
  if (step.kind === 'branch') return 0.5;
  return 0;
};

const numericDelta = (previous: RawTraceStep | undefined, step: RawTraceStep): number => {
  if (!previous) return 0;
  let largest = 0;
  for (const name of step.mutated) {
    const before = previous.scopes[name];
    const after = step.scopes[name];
    if (typeof before === 'number' && typeof after === 'number') {
      largest = Math.max(largest, Math.abs(after - before) / Math.max(1, Math.abs(before), Math.abs(after)));
    }
  }
  return Math.min(1, largest) * 0.3;
};

export interface ScoredTraceStep {
  step: RawTraceStep;
  score: number;
}

export const scoreTrace = (trace: RawTrace): ScoredTraceStep[] => {
  const repetitions = new Map<string, number>();
  return trace.steps.map((step, index) => {
    const signature = `${step.line}:${step.event?.t ?? step.kind}`;
    const repeated = (repetitions.get(signature) ?? 0) + 1;
    repetitions.set(signature, repeated);
    const penalty = repeated > 3 ? 0.5 : 0;
    return {
      step,
      score: Math.max(0, eventWeight(step) || kindWeight(step)) + numericDelta(trace.steps[index - 1], step) - penalty,
    };
  });
};

export const mostSignificantIndex = (trace: RawTrace): number | null => {
  const scored = scoreTrace(trace);
  if (!scored.length) return null;
  return scored.reduce((best, item) => item.score > best.score ? item : best).step.index;
};
