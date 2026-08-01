import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1 } from '../types/simulation';
import {
  applyStructuralGraphRequest,
  isVisualOnlyGraphRequest,
  spreadGraphLayout,
} from './graphRequestEdits';

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
    const edited = applyStructuralGraphRequest(source, 'Add two nodes and make the last one target');
    expect(edited.nodes.slice(-2).map((node) => node.id)).toEqual(['2', '3']);
    expect(edited.edges.slice(-2)).toMatchObject([
      { from: 'named', to: '2', weight: 1 },
      { from: '2', to: '3', weight: 1 },
    ]);
    expect(edited.targetId).toBe('3');
    expect(source.nodes).toHaveLength(2);
  });

  it('bounds a single request to five generated nodes', () => {
    const edited = applyStructuralGraphRequest(source, 'Add 99 nodes');
    expect(edited.nodes).toHaveLength(source.nodes.length + 5);
  });

  it('changes the target only to an existing explicit node', () => {
    expect(applyStructuralGraphRequest(source, 'target node 1 set').targetId).toBe('1');
    expect(applyStructuralGraphRequest(source, 'target node missing set').targetId).toBe('named');
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
    const edited = applyStructuralGraphRequest(
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
});
