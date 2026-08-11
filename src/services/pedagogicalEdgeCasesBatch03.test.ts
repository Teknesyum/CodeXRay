import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, GraphVisualData } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const makeGraph = (
  ids: string[], edges: Array<[string, string, number?]>, directed: boolean,
  startId = ids[0], targetId = ids.at(-1),
): GraphDocumentV1 => ({
  version: 1, mode: 'graph', directed, weighted: edges.some((edge) => edge[2] !== undefined),
  nodes: ids.map((id, index) => ({ id, label: id, x: 12 + (index % 5) * 19, y: 18 + Math.floor(index / 5) * 55 })),
  edges: edges.map(([from, to, weight], index) => ({ id: `e${index}`, from, to, weight })),
  startId, targetId,
});

const run = (name: string, graph: GraphDocumentV1) => {
  const algorithm = algorithmRegistry.find((entry) => entry.name === name)!;
  return simulateAlgorithm(algorithm.name, algorithm.code, { kind: 'graph', text: '', graph, origin: 'user' });
};

describe('batch 03 independent edge-case and rejection oracles', () => {
  it('Tarjan emits an isolated node as a singleton SCC with a stable component badge', () => {
    const final = run("Tarjan's SCC", makeGraph(
      ['A', 'B', 'C', 'X'], [['A', 'B'], ['B', 'C'], ['C', 'A']], true, 'A', 'X',
    )).at(-1)!;
    const components = (final.visualData.vars.components as string[][])
      .map((component) => [...component].sort().join('|')).sort();
    expect(components).toEqual(['A|B|C', 'X']);
    const visual = final.visualData as GraphVisualData;
    expect(visual.nodes.find((node) => node.id === 'X')?.semanticRoles?.[0]).toMatch(/^SCC \d+$/);
  });

  it.each([
    ['Edmonds-Karp Max Flow', 'Edmonds-Karp · min-cut reached'],
    ["Dinic's Max Flow", 'Dinic · build level graph'],
  ] as const)('%s grounds zero maximum flow when the sink is unreachable', (name, terminalSearchPhase) => {
    const steps = run(name, makeGraph(
      ['S', 'A', 'T'], [['S', 'A', 7]], true, 'S', 'T',
    ));
    expect(steps.some((step) => step.visualData.vars.phase === terminalSearchPhase)).toBe(true);
    const final = steps.at(-1)!;
    expect(final.visualData.vars.maxFlow).toBe(0);
    expect((final.visualData as GraphVisualData).edges[0].displayLabel).toMatch(/^0\/7 · r=7$/);
  });

  it('Hopcroft-Karp leaves isolated/free vertices unmatched without inventing edges', () => {
    const final = run('Bipartite Matching (Hopcroft-Karp)', makeGraph(
      ['U1', 'U2', 'V1', 'Lone'], [['U1', 'V1']], false, 'U1', 'V1',
    )).at(-1)!;
    expect(final.visualData.vars).toMatchObject({ matchingSize: 1, matching: { U1: 'V1' } });
    const visual = final.visualData as GraphVisualData;
    expect(visual.edges.filter((edge) => edge.state === 'path')).toHaveLength(1);
    expect(visual.nodes.find((node) => node.id === 'U2')?.state).not.toBe('path');
    expect(visual.nodes.find((node) => node.id === 'Lone')?.state).not.toBe('path');
  });

  it('Graph Coloring uses four distinct colors for K4 and exposes the complete palette', () => {
    const ids = ['A', 'B', 'C', 'D'];
    const edges: Array<[string, string]> = [];
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) edges.push([ids[left], ids[right]]);
    }
    const final = run('Graph Coloring', makeGraph(ids, edges, false, 'A', 'D')).at(-1)!;
    expect(final.visualData.vars.colorCount).toBe(4);
    expect(new Set(Object.values(final.visualData.vars.colors as Record<string, number>))).toEqual(new Set([1, 2, 3, 4]));
    expect(final.visualData.vars.palette).toHaveLength(4);
  });

  it('rejects incompatible graph domains before any misleading partial trace', () => {
    const undirected = makeGraph(['A', 'B'], [['A', 'B']], false);
    expect(() => run("Tarjan's SCC", undirected)).toThrow(/directed graph/);

    const negativeCapacity = makeGraph(['S', 'T'], [['S', 'T', -1]], true, 'S', 'T');
    expect(() => run('Edmonds-Karp Max Flow', negativeCapacity)).toThrow(/non-negative/);

    const sameEndpoint = makeGraph(['S', 'A'], [['S', 'A', 1]], true, 'S', 'S');
    expect(() => run("Dinic's Max Flow", sameEndpoint)).toThrow(/distinct start and target/);

    const triangle = makeGraph(['A', 'B', 'C'], [['A', 'B'], ['B', 'C'], ['C', 'A']], false);
    expect(() => run('Bipartite Matching (Hopcroft-Karp)', triangle)).toThrow(/bipartite graph/);

    const selfLoop = makeGraph(['A'], [['A', 'A']], false, 'A', 'A');
    expect(() => run('Graph Coloring', selfLoop)).toThrow(/self-loop/);
  });
});
