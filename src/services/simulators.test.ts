import { describe, expect, it } from 'vitest';
import { algorithmRegistry } from './codeRegistry';
import { createInputPreset, getInputKindForAlgorithm } from './inputPresets';
import { simulateAlgorithm } from './simulators';
import type { GraphVisualData } from '../types/simulation';
import { translateRuntimeText } from '../i18n/translations';

const supported = algorithmRegistry.filter((algorithm) => algorithm.isSupported);

describe('deterministic simulators', () => {
  it('has a non-empty simulator for every supported algorithm', () => {
    expect(supported).toHaveLength(45);
    const untranslated = new Set<string>();
    for (const algorithm of supported) {
      const kind = getInputKindForAlgorithm(algorithm.name);
      for (let presetIndex = 0; presetIndex < 3; presetIndex += 1) {
        const steps = simulateAlgorithm(
          algorithm.name,
          algorithm.code,
          createInputPreset(kind, presetIndex, algorithm.name),
        );
        expect(steps.length, `${algorithm.name} preset ${presetIndex + 1}`).toBeGreaterThan(1);
        expect(
          steps.every((step) => step.explanation.length > 0),
          `${algorithm.name} preset ${presetIndex + 1}`,
        ).toBe(true);
        for (const step of steps) {
          if (translateRuntimeText(step.explanation, 'tr') === step.explanation) {
            untranslated.add(step.explanation);
          }
        }
      }
    }
    expect([...untranslated]).toEqual([]);
  });

  it('keeps all 15 visited DFS nodes in structured trace data', () => {
    const algorithm = supported.find((candidate) => candidate.name.includes('Depth First'));
    expect(algorithm).toBeDefined();
    const steps = simulateAlgorithm(
      algorithm?.name ?? '',
      algorithm?.code ?? '',
      createInputPreset('graph', 0),
    );
    const finalGraphStep = [...steps].reverse().find((step) => step.visualData.type === 'graph');
    const visited = finalGraphStep?.visualData.vars.visited;
    expect(visited).toBeInstanceOf(Array);
    expect(visited).toHaveLength(15);
    expect(JSON.stringify(visited)).not.toContain('...');
  });

  it('finds and marks the shortest A* path to the configured target', () => {
    const algorithm = supported.find((candidate) => candidate.name.includes('A*'));
    const steps = simulateAlgorithm(
      algorithm?.name ?? '',
      algorithm?.code ?? '',
      createInputPreset('graph', 0),
    );
    const finalData = steps.at(-1)?.visualData as GraphVisualData;
    expect(finalData.nodes.find((node) => node.id === '15')?.state).toBe('path');
    expect(finalData.vars.heuristicScale).toEqual(expect.any(Number));
  });

  it('sorts with every supported sorting implementation', () => {
    const sortingAlgorithms = supported.filter((algorithm) =>
      getInputKindForAlgorithm(algorithm.name) === 'array'
      && /Sort/.test(algorithm.name),
    );
    expect(sortingAlgorithms).toHaveLength(8);
    for (const algorithm of sortingAlgorithms) {
      const steps = simulateAlgorithm(
        algorithm.name,
        algorithm.code,
        { kind: 'array', text: '[5, 1, 4, 2, 3]' },
      );
      const finalVisualData = steps.at(-1)?.visualData;
      const finalValues = finalVisualData?.type === 'array'
        ? finalVisualData.values
        : [];
      expect(finalValues, algorithm.name).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('flags every unsupported preset with an actionable blocked reason', () => {
    const blocked = algorithmRegistry.filter((algorithm) => !algorithm.isSupported);
    expect(blocked).toHaveLength(15);
    expect(blocked.every((algorithm) =>
      (algorithm.blockedReason?.length ?? 0) > 10)).toBe(true);
  });

  it('rejects unsupported numeric domains with actionable errors', () => {
    expect(() => simulateAlgorithm(
      'Radix Sort',
      'radixsort',
      { kind: 'array', text: '[3, -1, 2]' },
    )).toThrow('non-negative');
    expect(() => simulateAlgorithm(
      'Counting Sort',
      'countSort',
      { kind: 'array', text: '[3, 1.5, 2]' },
    )).toThrow('integer');
  });

  it('supports negative edges in Bellman-Ford but rejects them in Dijkstra', () => {
    const graph = {
      version: 1 as const,
      mode: 'graph' as const,
      directed: true,
      weighted: true,
      nodes: [
        { id: 'A', label: 'A', x: 10, y: 20 },
        { id: 'B', label: 'B', x: 50, y: 20 },
        { id: 'C', label: 'C', x: 90, y: 20 },
      ],
      edges: [
        { id: 'ab', from: 'A', to: 'B', weight: 4 },
        { id: 'bc', from: 'B', to: 'C', weight: -2 },
      ],
      startId: 'A',
      targetId: 'C',
    };
    const bellman = algorithmRegistry.find((algorithm) => algorithm.name.includes('Bellman'));
    const steps = simulateAlgorithm(
      bellman?.name ?? '',
      bellman?.code ?? '',
      { kind: 'graph', text: '', graph },
    );
    expect(steps.at(-1)?.visualData.vars.distances).toMatchObject({ C: 2 });
    expect(() => simulateAlgorithm(
      "Dijkstra's Shortest Path",
      'dijkstra',
      { kind: 'graph', text: '', graph },
    )).toThrow('Negative edge weights');
  });

  it('computes matching maximum-flow values with Edmonds-Karp and Dinic', () => {
    const graph = {
      version: 1 as const,
      mode: 'graph' as const,
      directed: true,
      weighted: true,
      nodes: [
        { id: 'A', label: 'A', x: 10, y: 50 },
        { id: 'B', label: 'B', x: 40, y: 20 },
        { id: 'C', label: 'C', x: 40, y: 80 },
        { id: 'D', label: 'D', x: 90, y: 50 },
      ],
      edges: [
        { id: 'ab', from: 'A', to: 'B', weight: 3 },
        { id: 'ac', from: 'A', to: 'C', weight: 2 },
        { id: 'bc', from: 'B', to: 'C', weight: 1 },
        { id: 'bd', from: 'B', to: 'D', weight: 2 },
        { id: 'cd', from: 'C', to: 'D', weight: 3 },
      ],
      startId: 'A',
      targetId: 'D',
    };
    for (const name of ['Edmonds-Karp Max Flow', "Dinic's Max Flow"]) {
      const algorithm = algorithmRegistry.find((candidate) => candidate.name === name);
      const steps = simulateAlgorithm(
        algorithm?.name ?? '',
        algorithm?.code ?? '',
        { kind: 'graph', text: '', graph },
      );
      expect(steps.at(-1)?.visualData.vars.maxFlow, name).toBe(5);
    }
  });

  it('produces correct representative array, string, and tree results', () => {
    const cases = [
      ["Kadane's Algorithm", '[-2,1,-3,4,-1,2,1,-5,4]', 'best', 6],
      ['Prefix Sum Array', '[1,2,3,4]', 'prefix', [1, 3, 6, 10]],
      ['Longest Increasing Subsequence', '[10,9,2,5,3,7,101,18]', 'length', 4],
      ['Sieve of Eratosthenes', '[10]', 'primes', [2, 3, 5, 7]],
      ['Fast Exponentiation (Modular)', '[2,10,1000]', 'result', '24'],
    ] as const;
    for (const [name, text, key, expected] of cases) {
      const algorithm = algorithmRegistry.find((candidate) => candidate.name === name);
      const steps = simulateAlgorithm(
        algorithm?.name ?? '',
        algorithm?.code ?? '',
        { kind: 'array', text },
      );
      expect(steps.at(-1)?.visualData.vars[key], name).toEqual(expected);
    }

    const manacherAlgorithm = algorithmRegistry.find((candidate) =>
      candidate.name.includes('Manacher'));
    const manacherSteps = simulateAlgorithm(
      manacherAlgorithm?.name ?? '',
      manacherAlgorithm?.code ?? '',
      { kind: 'string', text: 'abacaba' },
    );
    expect(manacherSteps.at(-1)?.visualData.vars.palindrome).toBe('abacaba');

    const lcaAlgorithm = algorithmRegistry.find((candidate) =>
      candidate.name.includes('Lowest Common'));
    const lcaInput = createInputPreset('tree', 0, lcaAlgorithm?.name);
    const lcaSteps = simulateAlgorithm(
      lcaAlgorithm?.name ?? '',
      lcaAlgorithm?.code ?? '',
      lcaInput,
    );
    expect(lcaSteps.at(-1)?.visualData.vars.lca).toBe('n1');
  });
});
