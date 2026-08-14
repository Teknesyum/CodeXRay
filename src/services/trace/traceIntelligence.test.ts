import { describe, expect, it } from 'vitest';
import type { RawTrace, RawTraceStep } from './types';
import { mostSignificantIndex, scoreTrace } from './significance';
import { buildTraceOutline, renderOutlineForModel, resolvePhaseId } from './traceOutline';
import { queryTrace } from './traceQuery';

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
