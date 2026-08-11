import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, GraphVisualData, MatrixVisualData, SimulationInput } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';
import { translateRuntimeText } from '../i18n/translations';

const nodes = (ids: string[]) => ids.map((id, index) => ({
  id, label: id, x: 12 + (index % 4) * 25, y: 22 + Math.floor(index / 4) * 50,
}));

const run = (name: string, graph: GraphDocumentV1) => {
  const preset = algorithmRegistry.find((candidate) => candidate.name === name);
  if (!preset) throw new Error(`Missing preset ${name}`);
  const input: SimulationInput = { kind: 'graph', text: '', graph, origin: 'user' };
  return simulateAlgorithm(preset.name, preset.code, input);
};

const graphVisual = (step: ReturnType<typeof run>[number]) => {
  expect(step.visualData.type).toBe('graph');
  return step.visualData as GraphVisualData;
};

const expectTeachingTextLocalized = (steps: ReturnType<typeof run>) => {
  for (const step of steps) {
    const { phase } = step.visualData.vars;
    if (typeof phase === 'string') expect(translateRuntimeText(phase, 'tr')).not.toBe(phase);
  }
};

describe('batch 02 pedagogical graph simulations', () => {
  it('Prim exposes the crossing cut before growing a minimum spanning tree', () => {
    const graph: GraphDocumentV1 = {
      version: 1, mode: 'graph', directed: false, weighted: true, startId: 'A',
      nodes: nodes(['A', 'B', 'C', 'D']),
      edges: [
        { id: 'ab', from: 'A', to: 'B', weight: 1 },
        { id: 'ac', from: 'A', to: 'C', weight: 4 },
        { id: 'bc', from: 'B', to: 'C', weight: 2 },
        { id: 'bd', from: 'B', to: 'D', weight: 5 },
        { id: 'cd', from: 'C', to: 'D', weight: 1 },
      ],
    };
    const steps = run("Prim's MST", graph);
    expectTeachingTextLocalized(steps);
    const cuts = steps.filter((step) => graphVisual(step).vars.phase === 'Prim · inspect frontier cut');
    expect(cuts).toHaveLength(3);
    expect(graphVisual(cuts[0]).vars.frontierEdges).toEqual(['ab', 'ac']);
    expect(graphVisual(cuts[0]).vars.keys).toMatchObject({ A: 0, B: 1, C: 4, D: '∞' });
    expect(cuts[0].lineNumber).toBe(8);
    const final = graphVisual(steps.at(-1)!);
    expect(final.vars.totalWeight).toBe(4);
    expect(final.vars.connected).toBe(true);
    expect(final.edges.filter((edge) => edge.state === 'path')).toHaveLength(3);
  });

  it('Bellman-Ford animates complete passes, accepted/rejected relaxations, and early stop', () => {
    const graph: GraphDocumentV1 = {
      version: 1, mode: 'graph', directed: true, weighted: true, startId: 'S', targetId: 'C',
      nodes: nodes(['S', 'A', 'B', 'C']),
      edges: [
        { id: 'sa', from: 'S', to: 'A', weight: 4 },
        { id: 'sb', from: 'S', to: 'B', weight: 5 },
        { id: 'ab', from: 'A', to: 'B', weight: -2 },
        { id: 'bc', from: 'B', to: 'C', weight: 3 },
        { id: 'ac', from: 'A', to: 'C', weight: 8 },
      ],
    };
    const steps = run('Bellman-Ford Algorithm', graph);
    expectTeachingTextLocalized(steps);
    expect(steps.some((step) => graphVisual(step).vars.phase === 'Bellman-Ford · begin pass')).toBe(true);
    expect(steps.some((step) => graphVisual(step).vars.phase === 'Bellman-Ford · relax edge')).toBe(true);
    expect(steps.some((step) => graphVisual(step).vars.phase === 'Bellman-Ford · reject relaxation')).toBe(true);
    expect(steps.filter((step) => graphVisual(step).vars.phase === 'Bellman-Ford · relax edge').every((step) => step.lineNumber === 7)).toBe(true);
    expect(steps.some((step) => graphVisual(step).edges.some((edge) => edge.state === 'rejected'))).toBe(true);
    const final = graphVisual(steps.at(-1)!);
    expect(final.vars.distances).toMatchObject({ S: 0, A: 4, B: 2, C: 5 });
    expect(final.vars.negativeCycle).toBe(false);
  });

  it('Floyd-Warshall uses a labelled matrix and highlights i-k, k-j, and i-j dependencies', () => {
    const graph: GraphDocumentV1 = {
      version: 1, mode: 'graph', directed: true, weighted: true, startId: 'A',
      nodes: nodes(['A', 'B', 'C']),
      edges: [
        { id: 'ab', from: 'A', to: 'B', weight: 2 },
        { id: 'bc', from: 'B', to: 'C', weight: 3 },
        { id: 'ac', from: 'A', to: 'C', weight: 9 },
      ],
    };
    const steps = run('Floyd-Warshall Algorithm', graph);
    expectTeachingTextLocalized(steps);
    expect(steps.every((step) => step.visualData.type === 'matrix')).toBe(true);
    const update = steps.find((step) => (step.visualData as MatrixVisualData).vars.phase === 'Floyd-Warshall · update through k');
    expect(update).toBeDefined();
    const matrix = update!.visualData as MatrixVisualData;
    expect(matrix.highlights.map((cell) => cell.label)).toEqual(['d[i][k]', 'd[k][j]', 'd[i][j]']);
    expect(update!.lineNumber).toBe(8);
    expect((steps.at(-1)!.visualData as MatrixVisualData).values[0][2]).toBe(5);
  });

  it('Topological Sort peels indegree-zero layers edge by edge', () => {
    const graph: GraphDocumentV1 = {
      version: 1, mode: 'graph', directed: true, weighted: false, startId: 'plan',
      nodes: nodes(['plan', 'design', 'data', 'code']),
      edges: [
        { id: 'pd', from: 'plan', to: 'design' },
        { id: 'pa', from: 'plan', to: 'data' },
        { id: 'dc', from: 'design', to: 'code' },
        { id: 'ac', from: 'data', to: 'code' },
      ],
    };
    const steps = run('Topological Sort', graph);
    expectTeachingTextLocalized(steps);
    expect(steps.filter((step) => graphVisual(step).vars.phase === 'Topological Sort · peel node')).toHaveLength(4);
    expect(steps.filter((step) => graphVisual(step).vars.phase === 'Topological Sort · release edge')).toHaveLength(4);
    expect(steps.filter((step) => graphVisual(step).vars.phase === 'Topological Sort · release edge').every((step) => step.lineNumber === 11)).toBe(true);
    expect(steps.some((step) => graphVisual(step).nodes.some((node) => node.state === 'queued'))).toBe(true);
    expect(steps.some((step) => graphVisual(step).nodes.some((node) => node.state === 'removed'))).toBe(true);
    expect(steps.some((step) => graphVisual(step).edges.some((edge) => edge.state === 'removed'))).toBe(true);
    expect(steps.filter((step) => graphVisual(step).vars.phase === 'Topological Sort · peel node')
      .map((step) => graphVisual(step).vars.wave)).toEqual([1, 2, 2, 3]);
    const final = graphVisual(steps.at(-1)!);
    expect(final.vars.order).toEqual(['plan', 'design', 'data', 'code']);
    expect(final.vars.hasCycle).toBe(false);
  });

  it('Kosaraju shows finish stack, a truly transposed graph, and SCC membership', () => {
    const graph: GraphDocumentV1 = {
      version: 1, mode: 'graph', directed: true, weighted: false, startId: 'A',
      nodes: nodes(['A', 'B', 'C', 'D', 'E']),
      edges: [
        { id: 'ab', from: 'A', to: 'B' }, { id: 'bc', from: 'B', to: 'C' },
        { id: 'ca', from: 'C', to: 'A' }, { id: 'cd', from: 'C', to: 'D' },
        { id: 'de', from: 'D', to: 'E' }, { id: 'ed', from: 'E', to: 'D' },
      ],
    };
    const steps = run("Kosaraju's SCC", graph);
    expectTeachingTextLocalized(steps);
    const transpose = steps.find((step) => graphVisual(step).vars.phase === 'Kosaraju · transpose graph');
    expect(transpose).toBeDefined();
    expect(graphVisual(transpose!).edges.find((edge) => edge.id === 'ab')).toMatchObject({ from: 'B', to: 'A' });
    expect(steps.some((step) => graphVisual(step).vars.phase === 'Kosaraju · push finish stack')).toBe(true);
    expect(steps.some((step) => graphVisual(step).vars.phase === 'Kosaraju · second DFS collect')).toBe(true);
    expect(steps.filter((step) => graphVisual(step).vars.phase === 'Kosaraju · second DFS collect').every((step) => step.lineNumber === 18)).toBe(true);
    const final = graphVisual(steps.at(-1)!);
    expect(final.vars.components).toEqual([['A', 'C', 'B'], ['D', 'E']]);
    expect(final.vars.componentOf).toEqual({ A: 1, B: 1, C: 1, D: 2, E: 2 });
  });
});
