import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, GraphVisualData, SimulationInput } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';
import { translateRuntimeText } from '../i18n/translations';

const makeNodes = (ids: string[]) => ids.map((id, index) => ({
  id, label: id, x: 15 + (index % 4) * 24, y: 25 + Math.floor(index / 4) * 50,
}));
const run = (name: string, graph: GraphDocumentV1) => {
  const definition = algorithmRegistry.find((item) => item.name === name);
  if (!definition) throw new Error(`Missing ${name}`);
  const input: SimulationInput = { kind: 'graph', text: '', graph, origin: 'user' };
  return simulateAlgorithm(name, definition.code, input);
};
const visual = (step: ReturnType<typeof run>[number]) => {
  expect(step.visualData.type).toBe('graph');
  return step.visualData as GraphVisualData;
};
const expectPhasesLocalized = (steps: ReturnType<typeof run>) => {
  for (const step of steps) {
    const phase = step.visualData.vars.phase;
    if (typeof phase === 'string') {
      expect(translateRuntimeText(phase, 'tr')).not.toBe(phase);
      expect(step.lineNumber).not.toBeNull();
    }
  }
};

describe('batch 03 pedagogical graph simulations', () => {
  it('Tarjan animates discovery, back edges, low-link propagation, stack, and SCC pops', () => {
    const graph: GraphDocumentV1 = {
      version: 1, mode: 'graph', directed: true, weighted: false, startId: 'A',
      nodes: makeNodes(['A', 'B', 'C', 'D', 'E']),
      edges: [
        { id: 'ab', from: 'A', to: 'B' }, { id: 'bc', from: 'B', to: 'C' },
        { id: 'ca', from: 'C', to: 'A' }, { id: 'cd', from: 'C', to: 'D' },
        { id: 'de', from: 'D', to: 'E' }, { id: 'ed', from: 'E', to: 'D' },
      ],
    };
    const steps = run("Tarjan's SCC", graph);
    expectPhasesLocalized(steps);
    expect(steps.some((step) => visual(step).vars.phase === 'Tarjan · process back edge')).toBe(true);
    expect(steps.some((step) => visual(step).vars.phase === 'Tarjan · propagate low-link')).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.vars.components).toEqual([['E', 'D'], ['C', 'B', 'A']]);
    expect(final.vars.componentOf).toEqual({ A: 2, B: 2, C: 2, D: 1, E: 1 });
    expect(final.nodes.every((node) => node.semanticRoles?.[0]?.startsWith('SCC'))).toBe(true);
  });

  const flowGraph = (): GraphDocumentV1 => ({
    version: 1, mode: 'graph', directed: true, weighted: true, startId: 'S', targetId: 'T',
    nodes: makeNodes(['S', 'A', 'B', 'T']),
    edges: [
      { id: 'sa', from: 'S', to: 'A', weight: 3 }, { id: 'sb', from: 'S', to: 'B', weight: 2 },
      { id: 'ab', from: 'A', to: 'B', weight: 1 }, { id: 'at', from: 'A', to: 'T', weight: 2 },
      { id: 'bt', from: 'B', to: 'T', weight: 3 },
    ],
  });

  it('Edmonds-Karp shows residual BFS, augmenting paths, f/c labels, and the min cut', () => {
    const steps = run('Edmonds-Karp Max Flow', flowGraph());
    expectPhasesLocalized(steps);
    expect(steps.some((step) => visual(step).vars.phase === 'Edmonds-Karp · BFS residual path')).toBe(true);
    expect(steps.some((step) => visual(step).vars.phase === 'Edmonds-Karp · augment shortest path'
      && visual(step).edges.some((edge) => edge.state === 'path'))).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.vars.maxFlow).toBe(5);
    expect(final.edges.filter((edge) => ['sa', 'sb', 'ab', 'at', 'bt'].includes(edge.id))
      .map((edge) => edge.displayLabel?.split(' · ')[0])).toEqual(['3/3', '2/2', '1/1', '2/2', '3/3']);
    expect(final.edges.some((edge) => edge.id.startsWith('residual:') && edge.displayLabel?.startsWith('r='))).toBe(true);
    expect(steps.some((step) => visual(step).vars.phase === 'Edmonds-Karp · min-cut reached')).toBe(true);
  });

  it('Dinic exposes level graphs, blocking-flow paths, residual labels, and final flow', () => {
    const steps = run("Dinic's Max Flow", flowGraph());
    expectPhasesLocalized(steps);
    expect(steps.some((step) => visual(step).vars.phase === 'Dinic · build level graph')).toBe(true);
    expect(steps.some((step) => visual(step).vars.phase === 'Dinic · send blocking flow'
      && visual(step).edges.some((edge) => edge.state === 'path'))).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.vars.maxFlow).toBe(5);
    expect(final.edges.filter((edge) => !edge.id.startsWith('residual:'))
      .every((edge) => /^\d+\/\d+ · r=\d+$/.test(edge.displayLabel ?? ''))).toBe(true);
    expect(final.edges.some((edge) => edge.semanticRoles?.includes('residual reverse arc'))).toBe(true);
  });

  it('Hopcroft-Karp shows partitions, alternating layers, augmenting paths, and matching edges', () => {
    const graph: GraphDocumentV1 = {
      version: 1, mode: 'graph', directed: false, weighted: false, startId: 'U1',
      nodes: makeNodes(['U1', 'U2', 'U3', 'V1', 'V2', 'V3']),
      edges: [
        { id: '11', from: 'U1', to: 'V1' }, { id: '12', from: 'U1', to: 'V2' },
        { id: '21', from: 'U2', to: 'V1' }, { id: '23', from: 'U2', to: 'V3' },
        { id: '32', from: 'U3', to: 'V2' },
      ],
    };
    const steps = run('Bipartite Matching (Hopcroft-Karp)', graph);
    expectPhasesLocalized(steps);
    const partition = visual(steps.find((step) => visual(step).vars.phase === 'Hopcroft-Karp · validate bipartition')!);
    expect(new Set(partition.nodes.filter((node) => String(node.id).startsWith('U')).map((node) => node.x))).toEqual(new Set([22]));
    expect(new Set(partition.nodes.filter((node) => String(node.id).startsWith('V')).map((node) => node.x))).toEqual(new Set([78]));
    expect(steps.some((step) => visual(step).vars.phase === 'Hopcroft-Karp · alternating BFS layers')).toBe(true);
    expect(steps.some((step) => visual(step).vars.phase === 'Hopcroft-Karp · augment shortest path')).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.vars.matchingSize).toBe(3);
    expect(final.nodes.every((node) => node.semanticRoles?.[0]?.startsWith('color'))).toBe(true);
  });

  it('Graph Coloring visualizes tried colors, conflict edges, assignments, and final palette', () => {
    const graph: GraphDocumentV1 = {
      version: 1, mode: 'graph', directed: false, weighted: false, startId: 'A',
      nodes: makeNodes(['A', 'B', 'C']),
      edges: [
        { id: 'ab', from: 'A', to: 'B' }, { id: 'bc', from: 'B', to: 'C' },
        { id: 'ca', from: 'C', to: 'A' },
      ],
    };
    const steps = run('Graph Coloring', graph);
    expectPhasesLocalized(steps);
    expect(visual(steps.find((step) => visual(step).vars.phase === 'Graph Coloring · prepare palette')!).vars.palette)
      .toHaveLength(3);
    expect(steps.some((step) => visual(step).vars.phase === 'Graph Coloring · reject conflict'
      && visual(step).edges.some((edge) => edge.state === 'rejected'))).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.vars.colorCount).toBe(3);
    expect(final.nodes.map((node) => node.semanticRoles?.[0])).toEqual(['color 1', 'color 2', 'color 3']);
  });
});
