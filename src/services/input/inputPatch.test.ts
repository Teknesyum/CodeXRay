import { describe, expect, it } from 'vitest';
import type { InputContractV1, WorkspaceSnapshotV1 } from '../../types/titan';
import type { SimulationInput } from '../../types/simulation';
import { compilePredictWinnerPackage } from '../intervalDpCompiler';
import {
  applyAndRecompileInputPatch,
  applyInputPatch,
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
  it('runtime-validates every closed operation and rejects malformed variants', () => {
    const valid: unknown[] = [
      { op: 'set-array', values: [1, 2] },
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
  });

  it('sets text and parameters without changing the input kind', () => {
    const textInput: SimulationInput = { kind: 'string', text: 'old' };
    expect(applied(textInput, { op: 'set-text', value: 'ABABC' })).toMatchObject({ kind: 'string', text: 'ABABC' });
    expect(applied(arrayInput, { op: 'set-param', name: 'target', value: 9 }).parameters).toEqual({ target: '9' });
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
});
