import { describe, expect, it } from 'vitest';
import type { RawTrace, RawTraceStep } from './types';
import { mostSignificantIndex, scoreTrace } from './significance';
import { buildTraceOutline } from './traceOutline';

const wrap = (steps: RawTraceStep[]): RawTrace => ({
  steps,
  truncated: false,
  budget: { maxSteps: 200_000, usedSteps: steps.length, elapsedMs: 0 },
  returnValue: null,
  consoleOutput: [],
  error: null,
});

const step = (index: number, overrides: Partial<RawTraceStep> = {}): RawTraceStep => ({
  index,
  line: 1,
  column: 0,
  kind: 'mutate',
  callDepth: 1,
  scopes: {},
  mutated: [],
  ...overrides,
});

const scoresOf = (trace: RawTrace, from: number, to: number): number[] =>
  scoreTrace(trace).slice(from, to + 1).map((item) => item.score);

describe('within-phase discrimination', () => {
  it('varies the score across a phase whose steps mutate different numbers of variables', () => {
    const trace = wrap([
      step(0, { phase: 'scan', mutated: ['a'], scopes: { a: 1 } }),
      step(1, { phase: 'scan', mutated: ['a', 'b', 'c'], scopes: { a: 1, b: 1, c: 1 } }),
      step(2, { phase: 'scan', mutated: ['a', 'b'], scopes: { a: 1, b: 1 } }),
    ]);
    const scores = scoresOf(trace, 0, 2);
    expect(new Set(scores).size).toBe(3);
    expect(buildTraceOutline(trace)[0].keyIndex).toBe(1);
  });

  it('varies the score across a phase whose only varying signal is the decision label', () => {
    const trace = wrap([
      step(0, { phase: 'compare', mutated: ['a'], scopes: { a: 1, decision: 'keep' } }),
      step(1, { phase: 'compare', mutated: ['a'], scopes: { a: 1, decision: 'swap' } }),
    ]);
    const scores = scoresOf(trace, 0, 1);
    expect(scores[0]).not.toBe(scores[1]);
  });

  it('leaves a phase with no varying signal at a constant score', () => {
    const trace = wrap([
      step(0, { phase: 'open', mutated: ['a'], scopes: { a: 1 } }),
      step(1, { phase: 'idle', mutated: ['a'], scopes: { a: 1 } }),
      step(2, { phase: 'idle', mutated: ['a'], scopes: { a: 1 } }),
    ]);
    const scores = scoresOf(trace, 1, 2);
    expect(scores[0]).toBe(scores[1]);
    const phase = buildTraceOutline(trace)[1];
    expect(phase.keyIndex).toBe(phase.startIndex);
  });

  it('keeps the new terms below the smallest kind weight difference', () => {
    const trace = wrap([
      step(0, {
        phase: 'scan',
        kind: 'mutate',
        mutated: ['a', 'b', 'c', 'd', 'e', 'f'],
        scopes: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, decision: 'novel' },
      }),
      step(1, { phase: 'scan', kind: 'loop-exit', mutated: [], scopes: {} }),
    ]);
    const scores = scoresOf(trace, 0, 1);
    expect(scores[0]).toBeLessThan(scores[1]);
    expect(buildTraceOutline(trace)[0].keyIndex).toBe(1);
  });

  it('keeps a single-step phase pointing at its own step', () => {
    const trace = wrap([
      step(0, { phase: 'setup', mutated: ['a'], scopes: { a: 1 } }),
      step(1, { phase: 'scan', mutated: ['b'], scopes: { b: 1 } }),
    ]);
    for (const phase of buildTraceOutline(trace)) {
      expect(phase.startIndex).toBe(phase.endIndex);
      expect(phase.keyIndex).toBe(phase.startIndex);
    }
  });
});

describe('mostSignificantIndex', () => {
  it('does not return index 0 merely because a strict comparison kept the first tie', () => {
    const trace = wrap([
      step(0, { mutated: ['a'], scopes: { a: 1 } }),
      step(1, { mutated: ['a'], scopes: { a: 1 } }),
      step(2, { mutated: ['a', 'b', 'c'], scopes: { a: 1, b: 1, c: 1 } }),
    ]);
    const best = mostSignificantIndex(trace);
    expect(best).toBe(2);
    const scores = scoreTrace(trace).map((item) => item.score);
    const top = Math.max(...scores);
    expect(scores.filter((value) => value === top)).toHaveLength(1);
  });
});

describe('phase kind', () => {
  it('takes the kind most of the phase shares rather than the first step it happens to open with', () => {
    const trace = wrap([
      step(0, { phase: 'scan', kind: 'mutate', mutated: ['a'], scopes: { a: 1 } }),
      step(1, { phase: 'scan', kind: 'statement' }),
      step(2, { phase: 'scan', kind: 'statement' }),
    ]);
    expect(buildTraceOutline(trace)[0].kind).toBe('setup');
  });

  it('still reports result when any step of the phase writes the result', () => {
    const trace = wrap([
      step(0, { phase: 'finish', kind: 'statement' }),
      step(1, { phase: 'finish', kind: 'statement' }),
      step(2, { phase: 'finish', kind: 'mutate', mutated: ['out'], scopes: { out: 1 }, event: { t: 'result-write', name: 'out' } }),
    ]);
    expect(buildTraceOutline(trace)[0].kind).toBe('result');
  });
});
