import { describe, expect, it } from 'vitest';
import { inferTraceVisual } from './semantics';

describe('deterministic trace semantics', () => {
  it('maps flat arrays and paired indices', () => {
    const visual = inferTraceVisual({ values: [4, 1, 3], left: 0, right: 2, note: 'ignored' });
    expect(visual.type).toBe('array');
    if (visual.type === 'array') {
      expect(visual.values).toEqual([4, 1, 3]);
      expect(visual.pointers).toEqual({ left: 0, right: 2 });
    }
  });

  it('maps rectangular matrices before flat arrays', () => {
    const visual = inferTraceVisual({ row: [1, 2], dp: [[1, 2], [3, 4]] });
    expect(visual.type).toBe('matrix');
    if (visual.type === 'matrix') expect(visual.values).toEqual([[1, 2], [3, 4]]);
  });

  it('maps adjacency objects without inventing nodes or edges', () => {
    const visual = inferTraceVisual({ adjacency: { A: ['B', 'C'], B: ['C'], C: [] } });
    expect(visual.type).toBe('graph');
    if (visual.type === 'graph') {
      expect(visual.nodes.map((node) => node.id)).toEqual(['A', 'B', 'C']);
      expect(visual.edges.map((edge) => `${edge.from}->${edge.to}`)).toEqual(['A->B', 'A->C', 'B->C']);
    }
  });

  it('falls back for empty, ragged, and ambiguous values', () => {
    expect(inferTraceVisual({}).type).toBe('variables');
    expect(inferTraceVisual({ ragged: [[1], [2, 3]] }).type).toBe('variables');
    expect(inferTraceVisual({ object: { value: 1 } }).type).toBe('variables');
  });
});
