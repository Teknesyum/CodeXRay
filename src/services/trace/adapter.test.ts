import { describe, expect, it } from 'vitest';
import type { RawTrace } from './types';
import { adaptRawTrace, buildTraceEntry } from './adapter';

describe('trace adapter', () => {
  it('maps typed input to a deterministic entry', () => {
    expect(buildTraceEntry('function solve(values, target) {}', {
      kind: 'array', text: '[3, 1, 2]', parameters: { target: '2' },
    })).toEqual({ functionName: 'solve', args: [[3, 1, 2], 2] });
    expect(buildTraceEntry('const value = 1;', { kind: 'string', text: 'ABABC' }))
      .toEqual({ functionName: undefined, args: ['ABABC'] });
  });

  it('preserves every raw step and terminal execution detail', () => {
    const trace: RawTrace = {
      steps: [
        { index: 0, line: 2, column: 1, kind: 'assign', callDepth: 1, scopes: { value: 1 }, mutated: ['value'] },
        { index: 1, line: 3, column: 1, kind: 'return', callDepth: 1, scopes: { value: 1 }, mutated: [] },
      ],
      truncated: false,
      budget: { maxSteps: 200_000, usedSteps: 2, elapsedMs: 1 },
      returnValue: 1,
      consoleOutput: ['done'],
      error: null,
    };
    const steps = adaptRawTrace(trace);
    expect(steps).toHaveLength(trace.steps.length);
    expect(steps[0].lineNumber).toBe(2);
    expect(steps[0].visualData.type).toBe('variables');
    expect(steps[0].visualData.vars).toMatchObject({ value: 1, _mutated: ['value'] });
    expect(steps[1].visualData.vars).toMatchObject({ _returnValue: 1, _consoleOutput: ['done'], _error: null });
  });

  it('makes parse failure and truncation visible', () => {
    const failed = adaptRawTrace({
      steps: [], truncated: false, budget: { maxSteps: 10, usedSteps: 0, elapsedMs: 0 },
      returnValue: null, consoleOutput: [], error: { message: 'Unexpected token', line: 4 },
    });
    expect(failed[0].explanation).toContain('Unexpected token');
    expect(failed[0].lineNumber).toBe(4);

    const truncated = adaptRawTrace({
      steps: [{ index: 0, line: 1, column: 0, kind: 'loop-iter', callDepth: 0, scopes: {}, mutated: [] }],
      truncated: true, budget: { maxSteps: 1, usedSteps: 1, elapsedMs: 1 },
      returnValue: null, consoleOutput: [], error: null,
    });
    expect(truncated[0].explanation).toContain('execution-budget-exceeded');
    expect(truncated[0].visualData.vars._truncated).toBe(true);
  });
});
