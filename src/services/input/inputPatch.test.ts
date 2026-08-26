import { describe, expect, it } from 'vitest';
import type { InputContractV1, WorkspaceSnapshotV1 } from '../../types/titan';
import type { SimulationInput } from '../../types/simulation';
import { compilePredictWinnerPackage } from '../intervalDpCompiler';
import { createInputPreset, getInputKindForAlgorithm } from '../inputPresets';
import { parseSimulationInput } from '../inputParsers';
import {
  applyAndRecompileInputPatch,
  applyAndRecompileInputPatches,
  applyInputPatch,
  applyInputPatches,
  createInputReplacementPatch,
  createSemanticArrayPatch,
  createSemanticParameterPatches,
  parseInputPatch,
  type InputPatchV1,
} from './inputPatch';

const contract = (kind: SimulationInput['kind'], value: SimulationInput, constraints: string[] = []): InputContractV1 => ({
  version: 1,
  kind,
  description: 'Patch test input',
  constraints,
  value,
  origin: 'user',
});

const arrayInput: SimulationInput = { kind: 'array', text: '[3,1,2]', origin: 'user' };
const graphInput: SimulationInput = {
  kind: 'graph',
  text: '',
  origin: 'user',
  graph: {
    version: 1,
    mode: 'graph',
    directed: true,
    weighted: true,
    nodes: [
      { id: 'A', label: 'A', x: 10, y: 10 },
      { id: 'B', label: 'B', x: 20, y: 20 },
      { id: 'E', label: 'E', x: 30, y: 30 },
    ],
    edges: [{ id: 'A-B', from: 'A', to: 'B', weight: 2 }],
    startId: 'A',
    targetId: 'B',
  },
};

const applied = (input: SimulationInput, patch: InputPatchV1, constraints: string[] = []) => {
  const result = applyInputPatch(input, patch, contract(input.kind, input, constraints));
  if (result.ok === false) throw new Error(result.reason);
  return result.input;
};

describe('InputPatchV1', () => {
  it.each([
    ['resize-array EN', 'resize the array to 10 descending values', { op: 'resize-array', count: 10, fill: 'descending' }],
    ['resize-array TR', 'diziyi 10 elemanli azalan yap', { op: 'resize-array', count: 10, fill: 'descending' }],
    ['sort-array EN', 'sort the array in ascending order', { op: 'sort-array', direction: 'asc' }],
    ['sort-array TR', 'diziyi azalan sirala', { op: 'sort-array', direction: 'desc' }],
    ['shuffle-array EN', 'shuffle the array with seed 17', { op: 'shuffle-array', seed: 17 }],
    ['shuffle-array TR', 'diziyi tohum 17 ile karistir', { op: 'shuffle-array', seed: 17 }],
  ])('classifies a real %s request into a validated semantic op', (_label, request, expected) => {
    expect(createSemanticArrayPatch(request)).toEqual(expected);
  });

  it('runtime-validates every closed operation and rejects malformed variants', () => {
    const valid: unknown[] = [
      { op: 'set-array', values: [1, 2] },
      { op: 'set-matrix', values: [[1, 2], [3, 4]] },
      { op: 'set-graph', graph: graphInput.graph },
      { op: 'resize-array', count: 12, fill: 'descending' },
      { op: 'sort-array', direction: 'asc' },
      { op: 'shuffle-array', seed: 7 },
      { op: 'set-text', value: 'ABABC' },
      { op: 'set-param', name: 'target', value: 4 },
      { op: 'set-target', nodeId: 'E' },
      { op: 'graph-add-node', id: 'D', label: 'Delta' },
      { op: 'graph-add-edge', from: 'B', to: 'E', weight: 4 },
      { op: 'graph-remove', id: 'A-B' },
      { op: 'load-preset-input', presetIndex: 1 },
    ];
    const invalid: unknown[] = [
      { op: 'set-array', values: [1, 'x'] },
      { op: 'set-matrix', values: [[1], [2, 3]] },
      { op: 'set-graph', graph: { nodes: [], edges: [] } },
      { op: 'resize-array', count: -1, fill: 'descending' },
      { op: 'sort-array', direction: 'sideways' },
      { op: 'shuffle-array', seed: 1.5 },
      { op: 'set-text', value: 4 },
      { op: 'set-param', name: '', value: 4 },
      { op: 'set-target', nodeId: '' },
      { op: 'graph-add-node', id: 4 },
      { op: 'graph-add-edge', from: 'A', to: 4 },
      { op: 'graph-remove', id: '' },
      { op: 'load-preset-input', presetIndex: 3 },
      { op: 'arbitrary-model-text', value: 'replace everything' },
    ];
    expect(valid.map(parseInputPatch).every(Boolean)).toBe(true);
    expect(invalid.map(parseInputPatch).every((patch) => patch === null)).toBe(true);
  });

  it('sets, resizes, sorts, and reproducibly shuffles arrays', () => {
    expect(applied(arrayInput, { op: 'set-array', values: [8, 5] }).text).toBe('[8,5]');
    expect(applied(arrayInput, { op: 'resize-array', count: 12, fill: 'descending' }).text)
      .toBe('[12,11,10,9,8,7,6,5,4,3,2,1]');
    expect(applied(arrayInput, { op: 'sort-array', direction: 'asc' }).text).toBe('[1,2,3]');
    const first = applied(arrayInput, { op: 'shuffle-array', seed: 42 }).text;
    expect(applied(arrayInput, { op: 'shuffle-array', seed: 42 }).text).toBe(first);
    const requestPatch = createSemanticArrayPatch('shuffle the array with seed 42');
    expect(requestPatch).not.toBeNull();
    expect(applied(arrayInput, requestPatch!).text).toBe(applied(arrayInput, requestPatch!).text);
  });

  it('runtime-validates complete matrix and graph replacements', () => {
    expect(applied(arrayInput, { op: 'set-matrix', values: [[1, 2], [3, 4]] }).text)
      .toBe('[[1,2],[3,4]]');
    expect(applied(graphInput, { op: 'set-graph', graph: graphInput.graph! }).graph)
      .toEqual(graphInput.graph);
  });

  it('converts deterministic adapter output into parser-validated closed operations', () => {
    expect(createInputReplacementPatch({ kind: 'array', text: '[8,5]' })).toEqual({ op: 'set-array', values: [8, 5] });
    expect(createInputReplacementPatch({ kind: 'array', text: '[[1,2],[3,4]]' }, { matrix: true }))
      .toEqual({ op: 'set-matrix', values: [[1, 2], [3, 4]] });
    expect(createInputReplacementPatch(graphInput)).toEqual({ op: 'set-graph', graph: graphInput.graph });
    expect(() => createInputReplacementPatch({ kind: 'array', text: '[1,"bad"]' })).toThrow('invalid typed patch');
  });

  it('sets text and parameters without changing the input kind', () => {
    const textInput: SimulationInput = { kind: 'string', text: 'old' };
    expect(applied(textInput, { op: 'set-text', value: 'ABABC' })).toMatchObject({ kind: 'string', text: 'ABABC' });
    const parameter = applyInputPatch(arrayInput, { op: 'set-param', name: 'target', value: 9 },
      contract('array', arrayInput), { algorithmName: 'Binary Search' });
    expect(parameter.ok && parameter.input.parameters).toEqual({ target: '9' });
  });

  it.each([
    ['target', 'Binary Search', 'set target to 42', 'hedefi 42 yap'],
    ['windowSize', 'Sliding Window Maximum', 'set window size to 4', 'pencereyi 4 yap'],
    ['capacity', '0/1 Knapsack', 'set capacity to 15', 'kapasiteyi 15 yap'],
    ['amount', 'Coin Change', 'set amount to 11', 'miktarı 11 yap'],
    ['modulus', 'Rabin-Karp Algorithm', 'set modulus to 101', 'modülü 101 yap'],
    ['cycleEntry', 'Detect Cycle in Linked List', 'set cycle entry to 2', 'döngü başlangıcını 2 yap'],
  ])('classifies numeric %s requests in English and Turkish', (key, algorithm, english, turkish) => {
    for (const request of [english, turkish]) {
      expect(createSemanticParameterPatches(request, algorithm)).toEqual([
        { op: 'set-param', name: key, value: expect.any(Number) },
      ]);
    }
  });

  it('rejects undeclared keys and non-numeric values before parsing the input', () => {
    expect(applyInputPatch(arrayInput, { op: 'set-param', name: 'nonsense', value: 1 },
      contract('array', arrayInput), { algorithmName: 'Binary Search' }))
      .toMatchObject({ ok: false, reason: expect.stringContaining('not declared') });
    expect(applyInputPatch(arrayInput, { op: 'set-param', name: 'target', value: 'forty-two' },
      contract('array', arrayInput), { algorithmName: 'Binary Search' }))
      .toMatchObject({ ok: false, reason: expect.stringContaining('numeric') });
  });

  it.each([
    ['Binary Search', 'target'],
    ['Sliding Window Maximum', 'windowSize'],
    ['0/1 Knapsack', 'capacity'],
    ['Coin Change', 'amount'],
    ['Rabin-Karp Algorithm', 'modulus'],
    ['Detect Cycle in Linked List', 'cycleEntry'],
  ])('measures that parseSimulationInput preserves non-numeric %s/%s unchanged', (algorithm, key) => {
    const input = createInputPreset(getInputKindForAlgorithm(algorithm), 1, algorithm);
    const parameters = { ...input.parameters, [key]: 'not-a-number' };
    const parsed = parseSimulationInput(input.kind, input.text, input.graph, parameters);
    expect(parsed.error).toBeUndefined();
    expect(parsed.input?.parameters?.[key]).toBe('not-a-number');
  });

  it('adds and removes validated graph nodes and edges and sets the target', () => {
    const targeted = applied(graphInput, { op: 'set-target', nodeId: 'E' });
    expect(targeted.graph?.targetId).toBe('E');
    const withNode = applied(targeted, { op: 'graph-add-node', id: 'D', label: 'Delta' });
    expect(withNode.graph?.nodes.find((node) => node.id === 'D')?.label).toBe('Delta');
    const withEdge = applied(withNode, { op: 'graph-add-edge', from: 'B', to: 'E', weight: 4 });
    expect(withEdge.graph?.edges).toContainEqual(expect.objectContaining({ from: 'B', to: 'E', weight: 4 }));
    const removed = applied(withEdge, { op: 'graph-remove', id: 'B' });
    expect(removed.graph?.nodes.some((node) => node.id === 'B')).toBe(false);
    expect(removed.graph?.edges.some((edge) => edge.from === 'B' || edge.to === 'B')).toBe(false);
  });

  it('rejects a multi-op graph transaction without mutating its input when any op fails', () => {
    const before = structuredClone(graphInput);
    const originalGraph = graphInput.graph;
    const result = applyInputPatches(graphInput, [
      { op: 'graph-add-node', id: 'X', label: 'X' },
      { op: 'graph-add-edge', from: 'X', to: 'missing', weight: 4 },
      { op: 'set-target', nodeId: 'X' },
    ], contract('graph', graphInput));
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('endpoints') });
    expect(graphInput).toEqual(before);
    expect(graphInput.graph).toBe(originalGraph);
  });

  it('loads same-kind presets and rejects kind, constraint, and graph violations visibly', () => {
    expect(applied(arrayInput, { op: 'load-preset-input', presetIndex: 0 }).kind).toBe('array');
    expect(applyInputPatch(arrayInput, { op: 'set-text', value: 'wrong' }, contract('array', arrayInput)))
      .toMatchObject({ ok: false, reason: expect.stringContaining('string input') });
    expect(applyInputPatch(arrayInput, { op: 'set-array', values: [-1, 2] }, contract('array', arrayInput, ['Non-negative values only'])))
      .toMatchObject({ ok: false, reason: expect.stringContaining('negative') });
    expect(applyInputPatch(graphInput, { op: 'graph-add-edge', from: 'B', to: 'missing', weight: 4 }, contract('graph', graphInput)))
      .toMatchObject({ ok: false, reason: expect.stringContaining('endpoints') });
    expect(applyInputPatch(graphInput, { op: 'set-target', nodeId: 'missing' }, contract('graph', graphInput)))
      .toMatchObject({ ok: false, reason: expect.stringContaining('does not exist') });
  });

  it('recompiles atomically, resets the timeline, and preserves source and program identity', () => {
    const workspace: WorkspaceSnapshotV1 = {
      version: 1,
      algorithmName: 'Predict the Winner',
      code: '',
      simulationInput: arrayInput,
      steps: [],
      currentIndex: 7,
      analysis: null,
      inputError: null,
      activePackageId: null,
      packageOutOfSync: false,
    };
    const activePackage = compilePredictWinnerPackage({
      id: 'patch-original', request: 'Predict the Winner', locale: 'en', workspace,
    });
    const result = applyAndRecompileInputPatch({
      activePackage,
      currentInput: activePackage.input.value,
      patch: { op: 'set-array', values: [4, 9, 2, 11, 6] },
      locale: 'en',
      workspace,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.currentIndex).toBe(0);
    expect(result.package.program.id).toBe(activePackage.program.id);
    expect(result.package.source).toEqual(activePackage.source);
    expect(result.package.input.value.text).toBe('[4,9,2,11,6]');
  });

  it('preserves workspace, package, and timeline identity when a semantic op violates the contract', () => {
    const workspace: WorkspaceSnapshotV1 = {
      version: 1, algorithmName: 'Predict the Winner', code: '', simulationInput: arrayInput,
      steps: [], currentIndex: 4, analysis: null, inputError: null, activePackageId: null,
      packageOutOfSync: false,
    };
    const original = compilePredictWinnerPackage({
      id: 'patch-guarded', request: 'Predict the Winner', locale: 'en', workspace,
    });
    const guarded = { ...original, input: { ...original.input, constraints: ['Non-negative values only'] } };
    const timeline = guarded.steps;
    const result = applyAndRecompileInputPatch({
      activePackage: guarded,
      currentInput: { kind: 'array', text: '[-3,1,2]', origin: 'user' },
      patch: { op: 'sort-array', direction: 'asc' },
      locale: 'en',
      workspace,
    });
    expect(result).toMatchObject({ ok: false, package: guarded });
    expect(result.package).toBe(guarded);
    expect(result.package.steps).toBe(timeline);
    expect(workspace).toMatchObject({ currentIndex: 4, simulationInput: arrayInput });
  });

  it('preserves package and timeline identity when a later parameter op rejects the transaction', () => {
    const workspace: WorkspaceSnapshotV1 = {
      version: 1, algorithmName: 'Binary Search', code: '', simulationInput: arrayInput,
      steps: [], currentIndex: 3, analysis: null, inputError: null, activePackageId: null,
      packageOutOfSync: false,
    };
    const activePackage = compilePredictWinnerPackage({
      id: 'parameter-atomicity', request: 'Predict the Winner', locale: 'en', workspace,
    });
    const inputIdentity = activePackage.input.value;
    const timelineIdentity = activePackage.steps;
    const result = applyAndRecompileInputPatches({
      activePackage,
      currentInput: inputIdentity,
      patches: [
        { op: 'set-param', name: 'target', value: 42 },
        { op: 'set-param', name: 'nonsense', value: 1 },
      ],
      locale: 'en',
      workspace,
    });
    expect(result).toMatchObject({ ok: false, package: activePackage });
    expect(result.package).toBe(activePackage);
    expect(result.package.input.value).toBe(inputIdentity);
    expect(result.package.steps).toBe(timelineIdentity);
  });
});
