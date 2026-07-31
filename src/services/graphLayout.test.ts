import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1 } from '../types/simulation';
import { applyGraphLayout, createGraphLayoutSpec, inspectGraphLayout } from './graphLayout';

const graph = (overrides: Partial<GraphDocumentV1> = {}): GraphDocumentV1 => ({
  version: 1,
  mode: 'graph',
  directed: false,
  weighted: false,
  nodes: [
    { id: 'A', label: 'A', x: 50, y: 50 },
    { id: 'B', label: 'B', x: 50, y: 50 },
    { id: 'C', label: 'C', x: 50, y: 50 },
    { id: 'D', label: 'D', x: 50, y: 50 },
  ],
  edges: [
    { id: 'ab', from: 'A', to: 'B' },
    { id: 'bc', from: 'B', to: 'C' },
  ],
  startId: 'A',
  targetId: 'C',
  ...overrides,
});

describe('graph layout', () => {
  it('chooses layouts from graph semantics', () => {
    expect(createGraphLayoutSpec(graph({ mode: 'tree', directed: true, rootId: 'A' })).strategy)
      .toBe('tree');
    expect(createGraphLayoutSpec(graph({ directed: true })).strategy).toBe('layered');
    expect(createGraphLayoutSpec(graph(), 'Bidirectional BFS').strategy).toBe('dual-frontier');
    expect(createGraphLayoutSpec(graph({ targetId: undefined })).strategy).toBe('force-directed');
    expect(createGraphLayoutSpec(graph({
      edges: [...graph().edges, { id: 'ca', from: 'C', to: 'A' }, { id: 'ad', from: 'A', to: 'D' }],
    })).strategy).toBe('radial');
  });

  it('places disconnected nodes in a deterministic final layer', () => {
    const spec = createGraphLayoutSpec(graph());
    expect(spec.layers).toEqual([['A'], ['B'], ['C'], ['D']]);
    expect(spec.axis).toEqual({ startId: 'A', targetId: 'C' });
  });

  it('preserves pinned user positions and resolves automatic collisions', () => {
    const source = graph({ directed: true });
    const spec = createGraphLayoutSpec(source, '', { A: { x: 14, y: 22 } });
    const laidOut = applyGraphLayout(source, spec);
    expect(laidOut.nodes.find((node) => node.id === 'A')).toMatchObject({ x: 14, y: 22 });
    expect(inspectGraphLayout(laidOut, 5).valid).toBe(true);
    expect(source.nodes.every((node) => node.x === 50 && node.y === 50)).toBe(true);
  });

  it('reports overlaps, invalid bounds, and missing endpoints independently', () => {
    const quality = inspectGraphLayout(graph({
      nodes: [
        { id: 'A', label: 'A', x: -1, y: 50 },
        { id: 'B', label: 'B', x: 0, y: 50 },
      ],
      edges: [{ id: 'missing', from: 'A', to: 'Z' }],
      startId: 'A',
      targetId: undefined,
    }), 5);
    expect(quality.valid).toBe(false);
    expect(quality.overlaps).toEqual([['A', 'B']]);
    expect(quality.outOfBounds).toEqual(['A']);
    expect(quality.missingEdgeEndpoints).toEqual(['missing']);
  });
});
