import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, MatrixVisualData } from '../types/simulation';
import { translateRuntimeText } from '../i18n/translations';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const makeGraph = (
  ids: string[], edges: Array<[string, string, number?]>, directed: boolean,
  startId = ids[0], targetId = ids.at(-1),
): GraphDocumentV1 => ({
  version: 1, mode: 'graph', directed, weighted: edges.some((edge) => edge[2] !== undefined),
  nodes: ids.map((id, index) => ({ id, label: id, x: 8 + (index % 8) * 12, y: 12 + Math.floor(index / 8) * 12 })),
  edges: edges.map(([from, to, weight], index) => ({ id: `e${index}`, from, to, weight })),
  startId, targetId,
});

const run = (name: string, graph: GraphDocumentV1) => {
  const algorithm = algorithmRegistry.find((entry) => entry.name === name)!;
  return simulateAlgorithm(algorithm.name, algorithm.code, { kind: 'graph', text: '', graph, origin: 'user' });
};

describe('batch 02 independent edge-case and rejection oracles', () => {
  it('Prim reports a partial tree rather than claiming an MST for a disconnected graph', () => {
    const steps = run("Prim's MST", makeGraph(
      ['A', 'B', 'C', 'X'], [['A', 'B', 2], ['B', 'C', 1]], false, 'A', 'X',
    ));
    const final = steps.at(-1)!;
    expect(final.visualData.vars).toMatchObject({
      phase: 'Prim · disconnected graph', connected: false, totalWeight: 3, mstEdges: ['e0', 'e1'],
    });
    expect(translateRuntimeText(final.explanation, 'tr')).not.toBe(final.explanation);
  });

  it('Bellman-Ford detects a reachable negative cycle after the complete relaxation budget', () => {
    const steps = run('Bellman-Ford Algorithm', makeGraph(
      ['S', 'A', 'B', 'U'], [['S', 'A', 1], ['A', 'B', -2], ['B', 'A', -2]], true, 'S', 'U',
    ));
    const final = steps.at(-1)!;
    expect(final.visualData.vars).toMatchObject({
      phase: 'Bellman-Ford · negative cycle', negativeCycle: true,
    });
    expect((final.visualData.vars.distances as Record<string, number | string>).U).toBe('∞');
    expect(final.lineNumber).toBe(15);
  });

  it('Floyd-Warshall preserves infinity for disconnected pairs and zero self-distance', () => {
    const steps = run('Floyd-Warshall Algorithm', makeGraph(
      ['A', 'B', 'X'], [['A', 'B', 4]], true, 'A', 'X',
    ));
    const final = steps.at(-1)?.visualData as MatrixVisualData;
    expect(final.type).toBe('matrix');
    expect(final.values).toEqual([
      [0, 4, '∞'],
      ['∞', 0, '∞'],
      ['∞', '∞', 0],
    ]);
    expect(final.vars.phase).toBe('Floyd-Warshall · complete');
  });

  it('Topological Sort peels the acyclic remainder but rejects a residual directed cycle', () => {
    const steps = run('Topological Sort', makeGraph(
      ['A', 'B', 'C', 'Z'], [['A', 'B'], ['B', 'C'], ['C', 'A']], true, 'A', 'Z',
    ));
    const final = steps.at(-1)!;
    expect(final.visualData.vars).toMatchObject({
      phase: 'Topological Sort · cycle detected', order: ['Z'], hasCycle: true,
    });
    expect((final.visualData.vars.indegree as Record<string, number>)).toMatchObject({ A: 1, B: 1, C: 1, Z: 0 });
  });

  it('Kosaraju emits an isolated vertex as its own strongly connected component', () => {
    const final = run("Kosaraju's SCC", makeGraph(
      ['A', 'B', 'C', 'X'], [['A', 'B'], ['B', 'C'], ['C', 'A']], true, 'A', 'X',
    )).at(-1)!;
    const normalized = (final.visualData.vars.components as string[][])
      .map((component) => [...component].sort().join('|')).sort();
    expect(normalized).toEqual(['A|B|C', 'X']);
    expect(final.visualData.vars.componentOf).toMatchObject({ A: expect.any(Number), B: expect.any(Number), C: expect.any(Number), X: expect.any(Number) });
  });

  it('rejects incompatible directionality and visualization-budget overflow before tracing', () => {
    const directed = makeGraph(['A', 'B'], [['A', 'B', 1]], true);
    expect(() => run("Prim's MST", directed)).toThrow(/undirected graph/);

    const sixtyOne = Array.from({ length: 61 }, (_, index) => `n${index}`);
    expect(() => run('Bellman-Ford Algorithm', makeGraph(sixtyOne, [], true))).toThrow(/at most 60 nodes/);

    const fortyOne = Array.from({ length: 41 }, (_, index) => `n${index}`);
    expect(() => run('Floyd-Warshall Algorithm', makeGraph(fortyOne, [], true))).toThrow(/at most 40 nodes/);

    const undirected = makeGraph(['A', 'B'], [['A', 'B']], false);
    expect(() => run('Topological Sort', undirected)).toThrow(/directed graph/);
    expect(() => run("Kosaraju's SCC", undirected)).toThrow(/directed graph/);
  });
});
