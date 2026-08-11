import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, GraphVisualData, SimulationInput } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const graph: GraphDocumentV1 = {
  version: 1,
  mode: 'graph',
  directed: false,
  weighted: true,
  startId: 'A',
  targetId: 'E',
  nodes: [
    { id: 'A', label: 'A', x: 10, y: 50 },
    { id: 'B', label: 'B', x: 30, y: 20 },
    { id: 'C', label: 'C', x: 50, y: 45 },
    { id: 'D', label: 'D', x: 68, y: 75 },
    { id: 'E', label: 'E', x: 90, y: 50 },
  ],
  edges: [
    { id: 'ab', from: 'A', to: 'B', weight: 1 },
    { id: 'bc', from: 'B', to: 'C', weight: 1 },
    { id: 'ac', from: 'A', to: 'C', weight: 2 },
    { id: 'ad', from: 'A', to: 'D', weight: 3 },
    { id: 'cd', from: 'C', to: 'D', weight: 5 },
    { id: 'ce', from: 'C', to: 'E', weight: 4 },
    { id: 'de', from: 'D', to: 'E', weight: 6 },
  ],
};

const input: SimulationInput = { kind: 'graph', text: '', graph, origin: 'user' };
const run = (name: string) => {
  const preset = algorithmRegistry.find((candidate) => candidate.name === name);
  if (!preset) throw new Error(`Missing preset ${name}`);
  return simulateAlgorithm(preset.name, preset.code, input);
};
const visual = (value: ReturnType<typeof run>[number]): GraphVisualData => {
  expect(value.visualData.type).toBe('graph');
  return value.visualData as GraphVisualData;
};

describe('batch 01 pedagogical graph simulations', () => {
  it('DFS animates descent, the recursion path, tree edges, and unwind', () => {
    const steps = run('Depth First Search (DFS)');
    expect(steps.some((step) => visual(step).vars.phase === 'DFS · descend')).toBe(true);
    expect(steps.some((step) => visual(step).vars.phase === 'DFS · backtrack')).toBe(true);
    expect(steps.some((step) => visual(step).nodes.filter((node) => node.state === 'path').length >= 2)).toBe(true);
    expect(steps.some((step) => visual(step).edges.some((edge) => edge.state === 'visited'))).toBe(true);
    expect(visual(steps.at(-1)!).vars.recursionStack).toEqual([]);
  });

  it('BFS exposes FIFO operations, breadth distances, and discovery tree edges', () => {
    const steps = run('Breadth First Search (BFS)');
    expect(steps.some((step) => visual(step).vars.phase === 'BFS · dequeue')).toBe(true);
    expect(steps.some((step) => visual(step).vars.phase === 'BFS · discover')).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.vars.distances).toMatchObject({ A: 0, B: 1, C: 1, D: 1, E: 2 });
    expect(steps.some((step) => visual(step).edges.some((edge) => edge.state === 'visited'))).toBe(true);
  });

  it('Dijkstra shows accepted and rejected relaxations, distance badges, and final path', () => {
    const steps = run("Dijkstra's Shortest Path");
    expect(steps.some((step) => visual(step).vars.phase === 'Dijkstra · relax edge')).toBe(true);
    expect(steps.some((step) => visual(step).vars.phase === 'Dijkstra · reject relaxation')).toBe(true);
    expect(steps.some((step) => visual(step).edges.some((edge) => edge.state === 'rejected'))).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.vars.distances).toMatchObject({ A: 0, B: 1, C: 2, D: 3, E: 6 });
    expect(final.nodes.filter((node) => node.state === 'path').map((node) => node.id)).toEqual(['A', 'C', 'E']);
  });

  it('A* exposes f scores, open/closed state, failed relaxations, and a valid target path', () => {
    const steps = run('A* Search Algorithm');
    expect(steps.some((step) => visual(step).vars.phase === 'A* · select minimum f')).toBe(true);
    expect(steps.some((step) => Object.keys(visual(step).vars.fScores as object).length === graph.nodes.length)).toBe(true);
    expect(steps.some((step) => visual(step).vars.phase === 'A* · reject relaxation')).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.nodes.find((node) => node.id === 'E')?.state).toBe('path');
    expect(final.nodes.filter((node) => node.state === 'path' || node.state === 'active').map((node) => node.id))
      .toEqual(expect.arrayContaining(['A', 'E']));
  });

  it('Kruskal shows sorted weights, disjoint components, accepted edges, and crossed cycle edges', () => {
    const steps = run("Kruskal's MST");
    const first = visual(steps[0]);
    expect(first.vars.phase).toBe('Kruskal · sort edges');
    expect(first.vars.sortedWeights).toEqual([1, 1, 2, 3, 4, 5, 6]);
    expect(steps.some((step) => visual(step).vars.phase === 'Kruskal · reject cycle')).toBe(true);
    expect(steps.some((step) => visual(step).edges.some((edge) => edge.state === 'rejected'))).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.vars.totalWeight).toBe(9);
    expect(final.edges.filter((edge) => edge.state === 'path')).toHaveLength(graph.nodes.length - 1);
  });
});
