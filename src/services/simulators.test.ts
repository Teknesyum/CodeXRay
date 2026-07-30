import { describe, expect, it } from 'vitest';
import { algorithmRegistry } from './codeRegistry';
import { createInputPreset, getInputKindForAlgorithm } from './inputPresets';
import { simulateAlgorithm } from './simulators';
import type { GraphVisualData } from '../types/simulation';

const supported = algorithmRegistry.filter((algorithm) => algorithm.isSupported);

describe('deterministic simulators', () => {
  it('has a non-empty simulator for every supported algorithm', () => {
    expect(supported).toHaveLength(13);
    for (const algorithm of supported) {
      const kind = getInputKindForAlgorithm(algorithm.name);
      const steps = simulateAlgorithm(
        algorithm.name,
        algorithm.code,
        createInputPreset(kind, 1),
      );
      expect(steps.length, algorithm.name).toBeGreaterThan(1);
      expect(steps.every((step) => step.explanation.length > 0), algorithm.name).toBe(true);
    }
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
      /Sort/.test(algorithm.name),
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
});
