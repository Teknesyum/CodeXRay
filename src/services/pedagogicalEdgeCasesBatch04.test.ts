import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, GraphVisualData, MatrixVisualData } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const makeGraph = (
  ids: string[], edges: Array<[string, string, number?]>, directed = false,
  startId = ids[0], targetId = ids.at(-1),
): GraphDocumentV1 => ({
  version: 1, mode: 'graph', directed, weighted: edges.some((edge) => edge[2] !== undefined),
  nodes: ids.map((id, index) => ({ id, label: id, x: 10 + (index % 6) * 16, y: 20 + Math.floor(index / 6) * 50 })),
  edges: edges.map(([from, to, weight], index) => ({ id: `e${index}`, from, to, weight })),
  startId, targetId,
});

const run = (name: string, graph: GraphDocumentV1) => {
  const algorithm = algorithmRegistry.find((entry) => entry.name === name)!;
  return simulateAlgorithm(algorithm.name, algorithm.code, { kind: 'graph', text: '', graph, origin: 'user' });
};

describe('batch 04 independent edge-case and rejection oracles', () => {
  it('Euler rejects a connected non-Eulerian star instead of presenting a spliced non-trail as valid', () => {
    const final = run('Eulerian Path/Circuit', makeGraph(
      ['C', 'A', 'B', 'D'], [['C', 'A'], ['C', 'B'], ['C', 'D']], false, 'C', 'D',
    )).at(-1)!;
    expect(final.visualData.vars).toMatchObject({
      phase: 'Euler · invalid start or graph', valid: false, path: [], trailEdges: [], usedEdgeCount: 3,
    });
    const visual = final.visualData as GraphVisualData;
    expect(visual.nodes.every((node) => node.state !== 'path')).toBe(true);
    expect(visual.edges.every((edge) => edge.state !== 'path')).toBe(true);
  });

  it('Hamiltonian search exhausts a simple path and leaves no false result highlight', () => {
    const final = run('Hamiltonian Cycle', makeGraph(
      ['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['C', 'D']], false, 'A', 'D',
    )).at(-1)!;
    expect(final.visualData.vars).toMatchObject({ phase: 'Hamilton · no cycle', found: false, cycle: [] });
    const visual = final.visualData as GraphVisualData;
    expect(visual.nodes.every((node) => node.state !== 'path')).toBe(true);
    expect(visual.edges.every((edge) => edge.state !== 'path')).toBe(true);
  });

  it('Articulation Points identifies a DFS root with multiple children but not isolated vertices', () => {
    const final = run('Articulation Points', makeGraph(
      ['R', 'A', 'B', 'X'], [['R', 'A'], ['R', 'B']], false, 'R', 'X',
    )).at(-1)!;
    expect(final.visualData.vars.articulationPoints).toEqual(['R']);
    expect((final.visualData as GraphVisualData).nodes.filter((node) => node.state === 'path').map((node) => node.id))
      .toEqual(['R']);
  });

  it('parallel undirected edges are back-edge alternatives, so neither is a bridge', () => {
    const graph = makeGraph(['A', 'B'], [['A', 'B'], ['A', 'B']], false, 'A', 'B');
    expect(run('Bridges in Graph', graph).at(-1)?.visualData.vars.bridges).toEqual([]);
    expect(run('Articulation Points', graph).at(-1)?.visualData.vars.articulationPoints).toEqual([]);
  });

  it('Johnson preserves unreachable pairs while restoring negative original distances', () => {
    const final = run("Johnson's Algorithm", makeGraph(
      ['A', 'B', 'C', 'X'], [['A', 'B', 2], ['B', 'C', -1]], true, 'A', 'X',
    )).at(-1)?.visualData as MatrixVisualData;
    expect(final.type).toBe('matrix');
    expect(final.values).toEqual([
      [0, 2, 1, '∞'],
      ['∞', 0, -1, '∞'],
      ['∞', '∞', 0, '∞'],
      ['∞', '∞', '∞', 0],
    ]);
  });

  it('rejects unsupported size, direction, and negative-cycle domains', () => {
    const thirteen = Array.from({ length: 13 }, (_, index) => `n${index}`);
    expect(() => run('Hamiltonian Cycle', makeGraph(thirteen, [], false))).toThrow(/at most 12 nodes/);

    const directed = makeGraph(['A', 'B'], [['A', 'B']], true);
    expect(() => run('Articulation Points', directed)).toThrow(/undirected graph/);
    expect(() => run('Bridges in Graph', directed)).toThrow(/undirected graph/);

    const negativeCycle = makeGraph(
      ['A', 'B', 'C'], [['A', 'B', 1], ['B', 'C', -3], ['C', 'A', 1]], true, 'A', 'C',
    );
    expect(() => run("Johnson's Algorithm", negativeCycle)).toThrow(/negative cycle/);
    expect(() => run("Johnson's Algorithm", makeGraph(['A', 'B'], [['A', 'B', 1]], false)))
      .toThrow(/directed graph/);
  });
});
