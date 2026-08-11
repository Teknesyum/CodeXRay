import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, GraphVisualData, MatrixVisualData, SimulationInput } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';
import { translateRuntimeText } from '../i18n/translations';

const nodes = (ids: string[]) => ids.map((id, index) => ({
  id, label: id, x: 12 + (index % 4) * 25, y: 22 + Math.floor(index / 4) * 52,
}));
const run = (name: string, graph: GraphDocumentV1) => {
  const item = algorithmRegistry.find((entry) => entry.name === name);
  if (!item) throw new Error(`Missing ${name}`);
  const input: SimulationInput = { kind: 'graph', text: '', graph, origin: 'user' };
  return simulateAlgorithm(name, item.code, input);
};
const visual = (step: ReturnType<typeof run>[number]) => step.visualData as GraphVisualData;
const assertPhases = (steps: ReturnType<typeof run>) => {
  for (const step of steps) {
    const phase = step.visualData.vars.phase;
    if (typeof phase === 'string') {
      expect(translateRuntimeText(phase, 'tr')).not.toBe(phase);
      expect(step.lineNumber).not.toBeNull();
    }
  }
};

describe('batch 04 pedagogical graph simulations', () => {
  it('Euler consumes each edge once and splices the circuit while backtracking', () => {
    const graph: GraphDocumentV1 = {
      version: 1, mode: 'graph', directed: false, weighted: false, startId: 'A',
      nodes: nodes(['A', 'B', 'C', 'D']),
      edges: [
        { id: 'ab', from: 'A', to: 'B' }, { id: 'bc', from: 'B', to: 'C' },
        { id: 'cd', from: 'C', to: 'D' }, { id: 'da', from: 'D', to: 'A' },
      ],
    };
    const steps = run('Eulerian Path/Circuit', graph);
    assertPhases(steps);
    expect(steps.filter((step) => visual(step).vars.phase === 'Euler · consume unused edge')).toHaveLength(4);
    expect(steps.some((step) => visual(step).vars.phase === 'Euler · splice circuit on dead end')).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.vars.valid).toBe(true);
    expect(final.vars.path).toHaveLength(5);
    expect(final.edges.every((edge) => edge.state === 'path')).toBe(true);
  });

  it('Hamilton shows repeated-vertex rejection, backtracking, and the closing edge', () => {
    const graph: GraphDocumentV1 = {
      version: 1, mode: 'graph', directed: false, weighted: false, startId: 'A',
      nodes: nodes(['A', 'B', 'C', 'D']),
      edges: [
        { id: 'ab', from: 'A', to: 'B' }, { id: 'bc', from: 'B', to: 'C' },
        { id: 'cd', from: 'C', to: 'D' }, { id: 'da', from: 'D', to: 'A' },
        { id: 'ac', from: 'A', to: 'C' },
      ],
    };
    const steps = run('Hamiltonian Cycle', graph);
    assertPhases(steps);
    expect(steps.some((step) => visual(step).vars.phase === 'Hamilton · reject repeated vertex'
      && visual(step).edges.some((edge) => edge.state === 'rejected'))).toBe(true);
    expect(steps.some((step) => visual(step).vars.phase === 'Hamilton · close cycle')).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.vars.found).toBe(true);
    expect(final.vars.cycle).toHaveLength(5);
  });

  const cutGraph = (): GraphDocumentV1 => ({
    version: 1, mode: 'graph', directed: false, weighted: false, startId: 'A',
    nodes: nodes(['A', 'B', 'C', 'X', 'D', 'E', 'F']),
    edges: [
      { id: 'ab', from: 'A', to: 'B' }, { id: 'bc', from: 'B', to: 'C' }, { id: 'ca', from: 'C', to: 'A' },
      { id: 'cx', from: 'C', to: 'X' }, { id: 'xd', from: 'X', to: 'D' },
      { id: 'de', from: 'D', to: 'E' }, { id: 'ef', from: 'E', to: 'F' }, { id: 'fd', from: 'F', to: 'D' },
    ],
  });

  it('Articulation Points explains low-link separation tests and highlights cut vertices', () => {
    const steps = run('Articulation Points', cutGraph());
    assertPhases(steps);
    expect(steps.some((step) => visual(step).vars.phase === 'articulation · separation test')).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.vars.articulationPoints).toEqual(expect.arrayContaining(['C', 'X', 'D']));
    expect(final.nodes.filter((node) => node.state === 'path').map((node) => node.id))
      .toEqual(expect.arrayContaining(['C', 'X', 'D']));
  });

  it('Bridges evaluates low[v] > disc[u] and preserves bridge edges', () => {
    const steps = run('Bridges in Graph', cutGraph());
    assertPhases(steps);
    expect(steps.some((step) => visual(step).vars.phase === 'bridges · bridge test')).toBe(true);
    const final = visual(steps.at(-1)!);
    expect(final.vars.bridges).toEqual(expect.arrayContaining(['cx', 'xd']));
    expect(final.edges.filter((edge) => edge.state === 'path').map((edge) => edge.id))
      .toEqual(expect.arrayContaining(['cx', 'xd']));
  });

  it('Johnson shows potentials, non-negative reweighting, per-source Dijkstra, and a final matrix', () => {
    const graph: GraphDocumentV1 = {
      version: 1, mode: 'graph', directed: true, weighted: true, startId: 'A',
      nodes: nodes(['A', 'B', 'C']),
      edges: [
        { id: 'ab', from: 'A', to: 'B', weight: 2 },
        { id: 'ac', from: 'A', to: 'C', weight: 5 },
        { id: 'bc', from: 'B', to: 'C', weight: -1 },
      ],
    };
    const steps = run("Johnson's Algorithm", graph);
    assertPhases(steps);
    const superSource = steps.find((step) => visual(step).vars.phase === 'Johnson · add zero-weight super-source');
    expect(visual(superSource!).nodes.find((node) => node.id === '__johnson_super_source__')?.label).toBe('Q');
    expect(visual(superSource!).edges.filter((edge) => edge.from === '__johnson_super_source__')).toHaveLength(3);
    const reweight = steps.find((step) => visual(step).vars.phase === 'Johnson · reweight edges');
    expect(reweight).toBeDefined();
    expect(visual(reweight!).edges.map((edge) => edge.displayLabel).every((label) => label?.startsWith("w'="))).toBe(true);
    expect(steps.some((step) => visual(step).vars.phase === 'Johnson · per-source Dijkstra')).toBe(true);
    const final = steps.at(-1)!.visualData as MatrixVisualData;
    expect(final.type).toBe('matrix');
    expect(final.values).toEqual([[0, 2, 1], ['∞', 0, -1], ['∞', '∞', 0]]);
  });
});
