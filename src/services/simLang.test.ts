import { describe, expect, it } from 'vitest';
import type { ProgramSpecV1, VisualizationContractV1 } from '../types/titan';
import { compileCustomSimulationPackage } from './customSimulationCompiler';
import {
  BIDIRECTIONAL_BFS_VISUALIZATION,
  createBidirectionalBfsInput,
  createBidirectionalBfsProgram,
} from './simLangBuiltins';
import { executeSimLang, renderProgramSource, validateProgramSpec } from './simLang';

const variablesVisualization: VisualizationContractV1 = {
  version: 1,
  type: 'variables',
  activeVariables: [],
  queuedVariables: [],
  visitedVariables: [],
};

describe('SimLangV1', () => {
  it('renders and executes bidirectional BFS from one program specification', () => {
    const program = createBidirectionalBfsProgram('en');
    const input = createBidirectionalBfsInput();
    const compiled = compileCustomSimulationPackage({
      id: 'test-bidirectional-bfs',
      title: 'Bidirectional BFS',
      locale: 'en',
      program,
      input,
      visualization: BIDIRECTIONAL_BFS_VISUALIZATION,
      analysis: 'O(V + E) time and O(V) space.',
    });

    expect(compiled.source.code).toContain('while (');
    expect(compiled.source.lineMap.search_loop).toBeGreaterThan(0);
    expect(compiled.steps.length).toBeGreaterThan(3);
    expect(compiled.steps.at(-1)?.visualData.vars.path).toEqual(expect.any(Array));
    expect(compiled.steps.some((step) => step.visualData.type === 'graph'
      && step.visualData.edges.some((edge) => edge.state === 'active'))).toBe(true);
    const finalVisual = compiled.steps.at(-1)?.visualData;
    expect(finalVisual?.type === 'graph'
      && finalVisual.edges.some((edge) => edge.state === 'path')).toBe(true);
    expect(compiled.checkpoints.some((checkpoint) => checkpoint.category === 'result')).toBe(true);
    expect(compiled.tests.passed).toBe(true);
  });

  it('rejects a literal infinite loop before execution', () => {
    const program: ProgramSpecV1 = {
      version: 1,
      id: 'infinite_loop',
      title: 'Infinite loop',
      locale: 'en',
      inputKind: 'array',
      functions: [],
      budgets: { instructions: 100, traceSteps: 10, recursionDepth: 4, collectionSize: 100 },
      entry: [{
        id: 'forever',
        type: 'while',
        condition: { type: 'literal', value: true },
        body: [],
        maxIterations: 50,
      }],
    };
    const result = validateProgramSpec(program);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('unconditional infinite loop');
  });

  it('stops recursive programs at the call-stack budget', () => {
    const program: ProgramSpecV1 = {
      version: 1,
      id: 'recursive_budget',
      title: 'Recursive budget',
      locale: 'en',
      inputKind: 'array',
      budgets: { instructions: 100, traceSteps: 10, recursionDepth: 3, collectionSize: 100 },
      functions: [{
        name: 'recurse',
        parameters: [],
        body: [{ id: 'recursive_call', type: 'call', functionName: 'recurse', args: [] }],
      }],
      entry: [{ id: 'entry_call', type: 'call', functionName: 'recurse', args: [] }],
    };
    expect(() => executeSimLang(
      program,
      { kind: 'array', text: '[1]' },
      variablesVisualization,
      renderProgramSource(program),
    )).toThrow(/Recursion depth budget exceeded/);
  });

  it('enforces runtime loop budgets when a condition never changes', () => {
    const program: ProgramSpecV1 = {
      version: 1,
      id: 'bounded_loop',
      title: 'Bounded loop',
      locale: 'en',
      inputKind: 'array',
      functions: [],
      budgets: { instructions: 100, traceSteps: 10, recursionDepth: 4, collectionSize: 100 },
      entry: [
        { id: 'flag', type: 'declare', name: 'keepGoing', value: { type: 'literal', value: true } },
        {
          id: 'loop',
          type: 'while',
          condition: { type: 'variable', name: 'keepGoing' },
          body: [],
          maxIterations: 3,
        },
      ],
    };
    expect(() => executeSimLang(
      program,
      { kind: 'array', text: '[1]' },
      variablesVisualization,
    )).toThrow(/Loop iteration budget exceeded/);
  });

  it('supports indexed array reads, writes, ranges, and swaps for model-authored algorithms', () => {
    const program: ProgramSpecV1 = {
      version: 1,
      id: 'two_item_sort',
      title: 'Two item sort',
      locale: 'en',
      inputKind: 'array',
      functions: [],
      budgets: { instructions: 100, traceSteps: 10, recursionDepth: 4, collectionSize: 100 },
      entry: [
        { id: 'array', type: 'declare', name: 'array', value: { type: 'input-field', field: 'array' } },
        { id: 'indices', type: 'declare', name: 'indices', value: {
          type: 'range',
          start: { type: 'literal', value: 0 },
          end: { type: 'literal', value: 2 },
        } },
        {
          id: 'compare',
          type: 'if',
          condition: {
            type: 'binary',
            operator: '>',
            left: { type: 'array-at', value: { type: 'variable', name: 'array' }, index: { type: 'literal', value: 0 } },
            right: { type: 'array-at', value: { type: 'variable', name: 'array' }, index: { type: 'literal', value: 1 } },
          },
          then: [{
            id: 'swap_pair',
            type: 'swap',
            array: 'array',
            left: { type: 'literal', value: 0 },
            right: { type: 'literal', value: 1 },
          }],
        },
        { id: 'trace_result', type: 'trace', at: 'compare', explanation: 'Sorted the pair.', category: 'result', importance: 1 },
      ],
    };
    const result = executeSimLang(
      program,
      { kind: 'array', text: '[9, 2]' },
      { ...variablesVisualization, type: 'array' },
    );
    expect(result.finalVariables.array).toEqual([2, 9]);
    expect(result.finalVariables.indices).toEqual([0, 1]);
  });

  it('builds every typed pedagogical visual from validated model-authored variables', () => {
    const program: ProgramSpecV1 = {
      version: 1, id: 'typed_visuals', title: 'Typed visuals', locale: 'en', inputKind: 'array', functions: [],
      budgets: { instructions: 100, traceSteps: 10, recursionDepth: 4, collectionSize: 100 },
      entry: [
        { id: 'matrix', type: 'declare', name: 'matrix', value: { type: 'literal', value: [[0, 1], [1, 2]] } },
        { id: 'text', type: 'declare', name: 'text', value: { type: 'literal', value: 'ABABA' } },
        { id: 'pattern', type: 'declare', name: 'pattern', value: { type: 'literal', value: 'ABA' } },
        { id: 'alignment', type: 'declare', name: 'alignment', value: { type: 'literal', value: 2 } },
        { id: 'heights', type: 'declare', name: 'heights', value: { type: 'literal', value: [3, 0, 2] } },
        { id: 'water', type: 'declare', name: 'water', value: { type: 'literal', value: [0, 2, 0] } },
        { id: 'intervals', type: 'declare', name: 'intervals', value: { type: 'literal', value: [[1, 3], [2, 5]] } },
        { id: 'merged', type: 'declare', name: 'merged', value: { type: 'literal', value: [[1, 5]] } },
        { id: 'rowA', type: 'declare', name: 'rowA', value: { type: 'literal', value: [1, 2, 3] } },
        { id: 'rowB', type: 'declare', name: 'rowB', value: { type: 'literal', value: [1, 3, 6] } },
        { id: 'trace', type: 'trace', at: 'matrix', explanation: 'Render typed visual.', category: 'result', importance: 1 },
      ],
    };
    const base = { version: 1 as const, activeVariables: [], queuedVariables: [], visitedVariables: [] };
    const input = { kind: 'array' as const, text: '[1,2,3]' };
    expect(executeSimLang(program, input, { ...base, type: 'matrix', matrix: {
      valuesVariable: 'matrix', rowLabels: ['a', 'b'], columnLabels: ['x', 'y'], fillDirection: 'row',
    } }).steps.at(-1)?.visualData.type).toBe('matrix');
    expect(executeSimLang(program, input, { ...base, type: 'matrix' }).steps.at(-1)?.visualData)
      .toMatchObject({ type: 'matrix', values: [[0, 1], [1, 2]] });
    expect(executeSimLang(program, input, { ...base, type: 'string-match', stringMatch: {
      textVariable: 'text', patternVariable: 'pattern', alignmentVariable: 'alignment',
    } }).steps.at(-1)?.visualData).toMatchObject({ type: 'string-match', text: 'ABABA', pattern: 'ABA', alignment: 2 });
    expect(executeSimLang(program, input, { ...base, type: 'bars', bars: {
      valuesVariable: 'heights', waterVariable: 'water',
    } }).steps.at(-1)?.visualData).toMatchObject({ type: 'bars', values: [3, 0, 2], water: [0, 2, 0] });
    expect(executeSimLang(program, input, { ...base, type: 'intervals', intervals: {
      intervalsVariable: 'intervals', mergedVariable: 'merged',
    } }).steps.at(-1)?.visualData).toMatchObject({ type: 'intervals', merged: [[1, 5]] });
    expect(executeSimLang(program, input, { ...base, type: 'rows', rows: {
      mode: 'rows', rowVariables: [{ label: 'input', variable: 'rowA' }, { label: 'prefix', variable: 'rowB' }],
    } }).steps.at(-1)?.visualData).toMatchObject({ type: 'rows', rows: [
      { label: 'input', values: [1, 2, 3] }, { label: 'prefix', values: [1, 3, 6] },
    ] });
  });

  it('rejects incomplete specialized visual contracts before package execution', () => {
    const program: ProgramSpecV1 = {
      version: 1, id: 'invalid_visual', title: 'Invalid visual', locale: 'en', inputKind: 'array', functions: [],
      budgets: { instructions: 20, traceSteps: 5, recursionDepth: 2, collectionSize: 20 },
      entry: [{ id: 'trace', type: 'trace', at: 'trace', explanation: 'Trace.', category: 'result', importance: 1 }],
    };
    expect(() => compileCustomSimulationPackage({
      id: 'invalid-visual-package', title: 'Invalid visual', locale: 'en', program,
      input: { version: 1, kind: 'array', description: 'array', constraints: [], value: { kind: 'array', text: '[1]' } },
      visualization: { version: 1, type: 'rows', activeVariables: [], queuedVariables: [], visitedVariables: [] },
      analysis: 'Rejected before execution.',
    })).toThrow('at least one mapped row');
  });
});
