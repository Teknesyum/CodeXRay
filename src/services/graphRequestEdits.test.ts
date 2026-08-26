import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1 } from '../types/simulation';
import {
  createStructuralGraphPatches,
  isVisualOnlyGraphRequest,
  spreadGraphLayout,
} from './graphRequestEdits';
import { applyInputPatches } from './input/inputPatch';

const source: GraphDocumentV1 = {
  version: 1,
  mode: 'graph',
  directed: false,
  weighted: true,
  nodes: [
    { id: '1', label: 'One', x: 10, y: 10 },
    { id: 'named', label: 'Named', x: 90, y: 90 },
  ],
  edges: [{ id: 'base', from: '1', to: 'named', weight: 4 }],
  startId: '1',
  targetId: 'named',
};

const edit = (graph: GraphDocumentV1, request: string): GraphDocumentV1 => {
  const planned = createStructuralGraphPatches(graph, request);
  if (planned.ok === false) throw new Error(planned.reason);
  const input = { kind: graph.mode, text: '', graph, origin: 'user' as const };
  const applied = applyInputPatches(input, planned.patches, {
    version: 1,
    kind: graph.mode,
    description: 'graph test',
    constraints: [],
    value: input,
    origin: 'user',
  });
  if (applied.ok === false) throw new Error(applied.reason);
  if (!applied.input.graph) throw new Error('Missing graph');
  return applied.input.graph;
};

describe('natural-language graph edits', () => {
  it.each([
    ['Nodeları daha geniş yay', true],
    ['Change the layout arrangement', true],
    ['Node ekle ve yerleşimi değiştir', false],
    ['Remove a node and spread the graph', false],
  ])('classifies %s', (request, expected) => {
    expect(isVisualOnlyGraphRequest(request)).toBe(expected);
  });

  it('spreads positions without mutating the input and clamps safe bounds', () => {
    const spread = spreadGraphLayout(source, 4);
    expect(spread).not.toBe(source);
    expect(spread.nodes).not.toBe(source.nodes);
    expect(spread.nodes[0]).toMatchObject({ x: 5, y: 7 });
    expect(spread.nodes[1]).toMatchObject({ x: 95, y: 93 });
    expect(source.nodes[0]).toMatchObject({ x: 10, y: 10 });
  });

  it('adds a weighted chain using the smallest numeric ID gaps', () => {
    const edited = edit(source, 'Add two nodes and make the last one target');
    expect(edited.nodes.slice(-2).map((node) => node.id)).toEqual(['2', '3']);
    expect(edited.edges.slice(-2)).toMatchObject([
      { from: 'named', to: '2', weight: 1 },
      { from: '2', to: '3', weight: 1 },
    ]);
    expect(edited.targetId).toBe('3');
    expect(source.nodes).toHaveLength(2);
  });

  it('bounds a single request to five generated nodes', () => {
    const edited = edit(source, 'Add 99 nodes');
    expect(edited.nodes).toHaveLength(source.nodes.length + 5);
  });

  it('changes the target only to an existing explicit node and rejects a missing node', () => {
    expect(edit(source, 'target node 1 set').targetId).toBe('1');
    expect(createStructuralGraphPatches(source, 'target node missing set')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('does not exist'),
    });
  });

  it('adds a requested named node and connects it to real user nodes and the target', () => {
    const graph: GraphDocumentV1 = {
      ...source,
      nodes: [
        { id: 'A', label: 'A', x: 10, y: 40 },
        { id: 'B', label: 'B', x: 45, y: 40 },
        { id: 'T', label: 'Target', x: 90, y: 40 },
      ],
      edges: [{ id: 'ab', from: 'A', to: 'B', weight: 2 }],
      startId: 'A',
      targetId: 'T',
    };
    const edited = edit(
      graph,
      "X node'unu ekle, B ile X ve X ile hedef arasında bağlantı kur",
    );
    expect(edited.nodes.map((node) => node.id)).toContain('X');
    expect(edited.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'B', to: 'X', weight: 1 }),
      expect.objectContaining({ from: 'X', to: 'T', weight: 1 }),
    ]));
    expect(graph.nodes).toHaveLength(3);
  });

  it('removes a numbered node atomically with its incident edges and endpoint references', () => {
    const graph: GraphDocumentV1 = {
      ...source,
      nodes: [...source.nodes, { id: '17', label: '17', x: 50, y: 50 }],
      edges: [...source.edges, { id: 'to-17', from: 'named', to: '17', weight: 2 }],
      targetId: '17',
    };
    const edited = edit(graph, '17. nolu nodu kaldır');
    expect(edited.nodes.some((node) => node.id === '17')).toBe(false);
    expect(edited.edges.some((edge) => edge.from === '17' || edge.to === '17')).toBe(false);
    expect(edited.targetId).toBe('named');
    expect(edited.nodes).toHaveLength(2);
  });

  it('adds and connects one node directly below the requested anchor', () => {
    const edited = edit(source, "1 nolu node'un aşağısına bir node ekle");
    const added = edited.nodes.find((node) => !source.nodes.some((original) => original.id === node.id));
    expect(added).toBeDefined();
    expect(added?.x).toBe(source.nodes[0].x);
    expect(added?.y).toBeGreaterThan(source.nodes[0].y);
    expect(edited.edges).toContainEqual(expect.objectContaining({ from: '1', to: added?.id }));
  });

  it('doubles graph size without exceeding the interactive bound', () => {
    const edited = edit(source, 'inputumuzu 2 kat karmaşıklaştır');
    expect(edited.nodes).toHaveLength(source.nodes.length * 2);
  });

  it('rejects missing endpoints and the final-node removal without partially editing the source', () => {
    const before = structuredClone(source);
    expect(createStructuralGraphPatches(source, 'add node X and connect X to missing')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('endpoints'),
    });
    const singleNode = { ...source, nodes: [source.nodes[0]], edges: [], targetId: '1' };
    expect(createStructuralGraphPatches(singleNode, 'remove node 1')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('final graph node'),
    });
    expect(source).toEqual(before);
  });

  it.each([
    ['graph-add-node', 'add node X'],
    ['graph-add-node', 'X düğüm ekle'],
    ['graph-add-edge', 'add node X and connect 1 to X'],
    ['graph-add-edge', 'X düğüm ekle, 1 ile X arasında bağlantı kur'],
    ['graph-remove', 'remove node 1'],
    ['graph-remove', '1 nolu nodu kaldır'],
    ['set-target', 'target node 1 set'],
    ['set-target', 'hedefi 1 yap'],
  ])('emits typed %s for %s', (expectedOp, request) => {
    const result = createStructuralGraphPatches(source, request);
    if (result.ok === false) throw new Error(result.reason);
    expect(result.patches.map((patch) => patch.op)).toContain(expectedOp);
  });
});
