import { describe, expect, it } from 'vitest';
import type { RawTrace, RawTraceStep } from './types';
import { mostSignificantIndex, scoreTrace } from './significance';
import { buildTraceOutline, renderOutlineForModel, resolvePhaseId } from './traceOutline';
import { queryTrace } from './traceQuery';
import { simulationStepsToRawTrace } from './simulationTrace';
import type { SimulationStep } from '../../types/simulation';

const makeTrace = (): RawTrace => {
  const steps: RawTraceStep[] = Array.from({ length: 520 }, (_, index) => ({
    index,
    line: index % 12 + 1,
    column: 0,
    kind: index === 519 ? 'return' : index % 5 === 0 ? 'loop-iter' : 'assign',
    callDepth: 1,
    scopes: { i: index, best: index === 259 ? 999 : index % 20, answer: index >= 259 ? 42 : 0 },
    mutated: ['i'],
    event: index === 259 ? { t: 'result-write', name: 'answer' } : undefined,
  }));
  return {
    steps, truncated: false, budget: { maxSteps: 200_000, usedSteps: steps.length, elapsedMs: 2 },
    returnValue: 42, consoleOutput: [], error: null,
  };
};

describe('structural trace intelligence', () => {
  it('selects the structural result independently of presentation text', () => {
    const trace = makeTrace();
    expect(mostSignificantIndex(trace)).toBe(259);
    const outline = buildTraceOutline(trace);
    const result = outline.find((phase) => phase.kind === 'result');
    expect(result?.keyIndex).toBe(259);
    expect(resolvePhaseId(outline, result?.id ?? '')).toBe(259);
    expect(mostSignificantIndex(structuredClone(trace))).toBe(259);
  });

  it('applies repetition penalties and bounds model outline rows', () => {
    const trace = makeTrace();
    const scores = scoreTrace(trace);
    expect(scores[180].score).toBeLessThan(scores[60].score);
    expect(renderOutlineForModel(buildTraceOutline(trace), 40).split('\n').length).toBeLessThanOrEqual(40);
  });

  it('resolves the closed deterministic query language', () => {
    const trace = makeTrace();
    expect(queryTrace(trace, 'first(i == 7)')).toBe(7);
    expect(queryTrace(trace, 'last(answer == 0)')).toBe(258);
    expect(queryTrace(trace, 'nth(2, i >= 10)')).toBe(12);
    expect(queryTrace(trace, 'max(best)')).toBe(259);
    expect(queryTrace(trace, 'min(i)')).toBe(0);
    expect(queryTrace(trace, 'line(12)')).toBe(11);
    expect(queryTrace(trace, 'error()')).toBeNull();
    expect(() => queryTrace(trace, 'eval(i)')).toThrow('Unsupported trace query');
  });
});

const phaseKindOf = (kind: RawTraceStep['kind']): string => {
  if (kind.startsWith('loop')) return 'loop';
  if (kind === 'branch') return 'branch';
  if (kind === 'call' || kind === 'return') return 'recursion';
  if (kind === 'assign' || kind === 'mutate') return 'update';
  if (kind === 'throw') return 'error';
  return 'setup';
};

const phasedSteps = (): SimulationStep[] => [
  'scan · setup', 'scan · setup', 'scan · compare', 'scan · compare',
  'scan · swap', 'scan · compare', 'scan · finish',
].map((phase, index) => ({
  lineNumber: (index % 3) + 1,
  explanation: `step ${index}`,
  visualData: { type: 'variables' as const, vars: { phase, i: index } },
}));

describe('phase-aware trace outline', () => {
  it('carries the simulator phase label across the adapter', () => {
    const trace = simulationStepsToRawTrace(phasedSteps());
    expect(trace.steps.map((step) => step.phase)).toEqual([
      'scan · setup', 'scan · setup', 'scan · compare', 'scan · compare',
      'scan · swap', 'scan · compare', 'scan · finish',
    ]);
  });

  it('starts a new outline phase when the phase label changes', () => {
    const outline = buildTraceOutline(simulationStepsToRawTrace(phasedSteps()));
    expect(outline.map((phase) => [phase.startIndex, phase.endIndex])).toEqual([
      [0, 1], [2, 3], [4, 4], [5, 5], [6, 6],
    ]);
    expect(outline.length).toBeGreaterThan(1);
  });

  it('falls back to kind grouping when no step carries a phase label', () => {
    const trace = makeTrace();
    expect(trace.steps.every((step) => step.phase === undefined)).toBe(true);
    const outline = buildTraceOutline(trace);
    const expected: Array<[number, number]> = [];
    for (const step of trace.steps) {
      const key = step.event?.t === 'result-write' ? 'result' : phaseKindOf(step.kind);
      const previous = expected.at(-1);
      const previousKey = previous
        ? trace.steps[previous[0]].event?.t === 'result-write'
          ? 'result' : phaseKindOf(trace.steps[previous[0]].kind)
        : null;
      if (!previous || previousKey !== key) expected.push([step.index, step.index]);
      else previous[1] = step.index;
    }
    expect(outline.map((phase) => [phase.startIndex, phase.endIndex])).toEqual(expected);
  });

  it('resolves phase ids to indices deterministically across runs', () => {
    const steps = phasedSteps();
    const first = buildTraceOutline(simulationStepsToRawTrace(structuredClone(steps)));
    const second = buildTraceOutline(simulationStepsToRawTrace(structuredClone(steps)));
    expect(second).toEqual(first);
    for (const phase of first) {
      expect(resolvePhaseId(first, phase.id)).toBe(phase.keyIndex);
    }
    expect(resolvePhaseId(first, 'p999')).toBeNull();
  });
});
