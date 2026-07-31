import { describe, expect, it } from 'vitest';
import { algorithmRegistry } from './codeRegistry';
import {
  createGraphPreset,
  createInputPreset,
  getInputKindForAlgorithm,
} from './inputPresets';
import { validateGraphDocument } from './inputParsers';

describe('input preset contracts', () => {
  it.each([
    ['Depth First Search (DFS)', 'graph'],
    ['Lowest Common Ancestor (LCA)', 'tree'],
    ['Knuth-Morris-Pratt (KMP)', 'string'],
    ['Quick Sort', 'array'],
  ] as const)('routes %s to %s input', (name, expected) => {
    expect(getInputKindForAlgorithm(name)).toBe(expected);
  });

  it('clamps preset indices and produces fresh deterministic values', () => {
    const low = createInputPreset('array', -10, 'Quick Sort');
    const first = createInputPreset('array', 0, 'Quick Sort');
    const high = createInputPreset('array', 99, 'Quick Sort');
    const third = createInputPreset('array', 2, 'Quick Sort');
    expect(low).toEqual(first);
    expect(high).toEqual(third);

    const graphA = createGraphPreset(0, 'Depth First Search (DFS)');
    const graphB = createGraphPreset(0, 'Depth First Search (DFS)');
    graphA.nodes[0].label = 'mutated';
    expect(graphB.nodes[0].label).not.toBe('mutated');
  });

  it('marks every generated preset honestly and validates every graph reference', () => {
    for (const algorithm of algorithmRegistry) {
      const kind = getInputKindForAlgorithm(algorithm.name);
      for (let index = 0; index < 3; index += 1) {
        const input = createInputPreset(kind, index, algorithm.name);
        expect(input.origin, `${algorithm.name} preset ${index}`).toBe('preset');
        expect(input.kind).toBe(kind);
        if (input.graph) expect(validateGraphDocument(input.graph)).toEqual(input.graph);
      }
    }
  });

  it('uses safe weights for shortest-path presets and negative edges only where supported', () => {
    for (const name of ["Dijkstra's Shortest Path", 'A* Search Algorithm']) {
      const graph = createGraphPreset(0, name);
      expect(graph.weighted).toBe(true);
      expect(graph.edges.every((edge) => (edge.weight ?? 0) >= 0)).toBe(true);
    }
    const bellman = createGraphPreset(0, 'Bellman-Ford Algorithm');
    expect(bellman.directed).toBe(true);
    expect(bellman.edges.some((edge) => (edge.weight ?? 0) < 0)).toBe(true);
  });

  it('selects two existing LCA nodes without changing the tree root', () => {
    const input = createInputPreset('tree', 0, 'Lowest Common Ancestor (LCA)');
    const ids = new Set(input.graph?.nodes.map((node) => node.id));
    expect(ids.has(input.graph?.startId ?? '')).toBe(true);
    expect(ids.has(input.graph?.targetId ?? '')).toBe(true);
    expect(input.graph?.rootId).toBe('n0');
  });
});
