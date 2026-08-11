import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, GraphVisualData } from '../types/simulation';
import { translateRuntimeText } from '../i18n/translations';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const definition = (name: string) => {
  const value = algorithmRegistry.find((entry) => entry.name === name);
  if (!value) throw new Error(`Missing algorithm: ${name}`);
  return value;
};

const graph = (
  ids: string[],
  edges: Array<[string, string, number?]>,
  options: { directed?: boolean; start?: string; target?: string } = {},
): GraphDocumentV1 => ({
  version: 1,
  mode: 'graph',
  directed: options.directed ?? false,
  weighted: edges.some((edge) => edge[2] !== undefined),
  nodes: ids.map((id, index) => ({ id, label: id, x: 10 + index * (80 / Math.max(1, ids.length - 1)), y: 50 })),
  edges: edges.map(([from, to, weight], index) => ({ id: `e${index}`, from, to, weight })),
  startId: options.start ?? ids[0],
  targetId: options.target ?? ids.at(-1),
});

const run = (name: string, value: GraphDocumentV1) => {
  const algorithm = definition(name);
  return simulateAlgorithm(algorithm.name, algorithm.code, { kind: 'graph', text: '', graph: value, origin: 'user' });
};

describe('batch 01 independent edge-case and rejection oracles', () => {
  it('DFS limits traversal to the reachable component and visibly closes an empty recursion stack', () => {
    const steps = run('Depth First Search (DFS)', graph(
      ['S', 'A', 'B', 'X'], [['S', 'A'], ['A', 'B'], ['B', 'S']], { start: 'S', target: 'X' },
    ));
    const final = steps.at(-1)!;
    expect(final.visualData.vars).toMatchObject({
      phase: 'DFS · complete reachable component',
      visited: ['S', 'A', 'B'],
      recursionStack: [],
    });
    expect((final.visualData as GraphVisualData).nodes.find((node) => node.id === 'X')?.state).toBe('idle');
  });

  it('BFS assigns exact breadth levels without inventing a distance for an unreachable target', () => {
    const steps = run('Breadth First Search (BFS)', graph(
      ['S', 'A', 'B', 'X'], [['S', 'A'], ['A', 'B']], { start: 'S', target: 'X' },
    ));
    const final = steps.at(-1)!;
    expect(final.visualData.vars).toMatchObject({
      phase: 'BFS · complete reachable component',
      visited: ['S', 'A', 'B'],
      distances: { S: 0, A: 1, B: 2 },
    });
    expect((final.visualData.vars.distances as Record<string, number>).X).toBeUndefined();
  });

  it.each([
    ["Dijkstra's Shortest Path", false],
    ['A* Search Algorithm', true],
  ] as const)('%s chooses the cheaper indirect route and grounds an unreachable node', (name, heuristic) => {
    const value = graph(
      ['S', 'A', 'T', 'U'], [['S', 'T', 10], ['S', 'A', 1], ['A', 'T', 2]],
      { directed: true, start: 'S', target: 'T' },
    );
    const steps = run(name, value);
    const final = steps.at(-1)!;
    expect(final.visualData.vars.distances).toMatchObject({ S: 0, A: 1, T: 3, U: '∞' });
    expect(final.visualData.vars.path).toEqual(['S', 'A', 'T']);
    expect((final.visualData as GraphVisualData).nodes.filter((node) => node.state === 'path').map((node) => node.id))
      .toEqual(['S', 'A', 'T']);
    expect(final.visualData.vars.phase).toBe(heuristic
      ? 'A* · complete shortest path'
      : 'Dijkstra · complete shortest path');
  });

  it('Kruskal returns a minimum spanning forest and says the graph is disconnected', () => {
    const value = graph(['A', 'B', 'C', 'D', 'E'], [['A', 'B', 1], ['C', 'D', 2], ['A', 'B', 4]]);
    const steps = run("Kruskal's MST", value);
    const final = steps.at(-1)!;
    expect(final.visualData.vars).toMatchObject({
      phase: 'Kruskal · complete forest', connected: false, totalWeight: 3,
    });
    expect(final.visualData.vars.mstEdges).toEqual(['e0', 'e1']);
    expect(translateRuntimeText(final.explanation, 'tr')).not.toBe(final.explanation);
    expect(final.lineNumber).toBe(15);
  });

  it('rejects malformed or semantically incompatible graph domains before tracing', () => {
    const duplicate = graph(['A', 'B'], [['A', 'B']]);
    duplicate.nodes[1].id = 'A';
    expect(() => run('Depth First Search (DFS)', duplicate)).toThrow(/unique/i);

    const dangling = graph(['A', 'B'], [['A', 'B']]);
    dangling.edges[0].to = 'missing';
    expect(() => run('Breadth First Search (BFS)', dangling)).toThrow(/unknown/i);

    const negative = graph(['S', 'T'], [['S', 'T', -1]], { directed: true, start: 'S', target: 'T' });
    expect(() => run("Dijkstra's Shortest Path", negative)).toThrow(/Negative edge weights/);
    expect(() => run('A* Search Algorithm', negative)).toThrow(/Negative edge weights/);

    const directed = graph(['A', 'B'], [['A', 'B', 1]], { directed: true });
    expect(() => run("Kruskal's MST", directed)).toThrow(/undirected graph/);
  });
});
