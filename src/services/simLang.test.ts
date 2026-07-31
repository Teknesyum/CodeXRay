import { describe, expect, it } from 'vitest';
import type { ProgramSpecV1, VisualizationContractV1 } from '../types/godMode';
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
});
