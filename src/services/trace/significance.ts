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

const decisionLabel = (step: RawTraceStep): string | null => {
  const value = step.scopes.decision;
  return typeof value === 'string' && value.length ? value : null;
};

const mutationBreadth = (step: RawTraceStep): number => {
  const count = step.mutated.length;
  return 0.08 * (count / (count + 1));
};

const decisionBreadth = (
  step: RawTraceStep,
  previous: RawTraceStep | undefined,
  introduction: Map<string, { index: number; rank: number }>,
): number => {
  const label = decisionLabel(step);
  if (label === null) return 0;
  const introduced = introduction.get(label);
  if (!introduced) return 0;
  const novel = introduced.index === step.index ? 0.05 : 0;
  const shifted = decisionLabel(previous ?? step) !== label ? 0.03 : 0;
  const rank = 0.01 * (1 - 1 / (introduced.rank + 1));
  return novel + shifted + rank;
};

const firstWriteBreadth = (step: RawTraceStep, alreadyWritten: Set<string>): number => {
  let novel = 0;
  for (const name of step.mutated) if (!alreadyWritten.has(name)) novel += 1;
  return 0.02 * (novel / (novel + 1));
};

export interface ScoredTraceStep {
  step: RawTraceStep;
  score: number;
}

export const scoreTrace = (trace: RawTrace): ScoredTraceStep[] => {
  const repetitions = new Map<string, number>();
  const introduction = new Map<string, { index: number; rank: number }>();
  for (const step of trace.steps) {
    const label = decisionLabel(step);
    if (label !== null && !introduction.has(label)) {
      introduction.set(label, { index: step.index, rank: introduction.size + 1 });
    }
  }
  const alreadyWritten = new Set<string>();
  return trace.steps.map((step, index) => {
    const signature = `${step.line}:${step.event?.t ?? step.kind}`;
    const repeated = (repetitions.get(signature) ?? 0) + 1;
    repetitions.set(signature, repeated);
    const penalty = repeated > 3 ? 0.5 : 0;
    const scored = {
      step,
      score: Math.max(0, eventWeight(step) || kindWeight(step))
        + numericDelta(trace.steps[index - 1], step)
        + mutationBreadth(step)
        + decisionBreadth(step, trace.steps[index - 1], introduction)
        + firstWriteBreadth(step, alreadyWritten)
        - penalty,
    };
    for (const name of step.mutated) alreadyWritten.add(name);
    return scored;
  });
};

export const mostSignificantIndex = (trace: RawTrace): number | null => {
  const scored = scoreTrace(trace);
  if (!scored.length) return null;
  return scored.reduce((best, item) => item.score > best.score ? item : best).step.index;
};
