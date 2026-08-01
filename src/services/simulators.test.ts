import { describe, expect, it } from 'vitest';
import { algorithmRegistry } from './codeRegistry';
import { createInputPreset, getInputKindForAlgorithm } from './inputPresets';
import { simulateAlgorithm } from './simulators';
import type { GraphDocumentV1, GraphVisualData } from '../types/simulation';
import { translateRuntimeText } from '../i18n/translations';

const supported = algorithmRegistry.filter((algorithm) => algorithm.isSupported);

describe('deterministic simulators', () => {
  it('has a non-empty simulator for every supported algorithm', () => {
    expect(supported).toHaveLength(60);
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
        const sourceLineCount = algorithm.code.split('\n').length;
        expect(
          steps.every((step) => step.lineNumber === null
            || (step.lineNumber >= 1 && step.lineNumber <= sourceLineCount)),
          `${algorithm.name} preset ${presetIndex + 1} line mapping`,
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

  it('replays identical inputs deterministically without mutating them', () => {
    for (const algorithm of supported) {
      const kind = getInputKindForAlgorithm(algorithm.name);
      const input = createInputPreset(kind, 1, algorithm.name);
      const snapshot = structuredClone(input);
      const first = simulateAlgorithm(algorithm.name, algorithm.code, input);
      const second = simulateAlgorithm(algorithm.name, algorithm.code, input);
      expect(second, algorithm.name).toEqual(first);
      expect(input, `${algorithm.name} input mutation`).toEqual(snapshot);
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

  it('keeps large array, string, tree, and graph trace collections structured and complete', () => {
    const quick = supported.find((candidate) => candidate.name === 'Quick Sort')!;
    const array = Array.from({ length: 80 }, (_, index) => ((index * 37) % 101) - 50);
    const sorted = simulateAlgorithm(quick.name, quick.code, {
      kind: 'array', text: JSON.stringify(array), origin: 'user',
    }).at(-1)?.visualData;
    expect(sorted?.type === 'array' ? sorted.values : []).toEqual([...array].sort((left, right) => left - right));

    const kmp = supported.find((candidate) => candidate.name.includes('Knuth-Morris'))!;
    const text = `${'abç😀'.repeat(20)}needle${'ğü'.repeat(40)}`;
    const stringFinal = simulateAlgorithm(kmp.name, kmp.code, {
      kind: 'string', text, parameters: { pattern: 'needle' }, origin: 'user',
    }).at(-1)?.visualData.vars;
    expect(stringFinal?.text).toBe(text);
    expect(stringFinal?.matches).toEqual([text.indexOf('needle')]);

    const graphNodes = Array.from({ length: 75 }, (_, index) => ({
      id: `large-${index}`, label: `N${index}`, x: 5 + (index % 10) * 9, y: 8 + Math.floor(index / 10) * 11,
    }));
    const graph: GraphDocumentV1 = {
      version: 1, mode: 'graph', directed: false, weighted: false,
      nodes: graphNodes,
      edges: graphNodes.slice(1).map((node, index) => ({
        id: `large-edge-${index}`, from: graphNodes[index].id, to: node.id,
      })),
      startId: graphNodes[0].id,
      targetId: graphNodes.at(-1)?.id,
    };
    const dfs = supported.find((candidate) => candidate.name.includes('Depth First'))!;
    const graphFinal = simulateAlgorithm(dfs.name, dfs.code, {
      kind: 'graph', text: '', graph, origin: 'user',
    }).at(-1)?.visualData.vars;
    expect(graphFinal?.visited).toEqual(graphNodes.map((node) => node.id));

    const treeNodes = Array.from({ length: 63 }, (_, index) => ({
      id: `tree-${index}`, label: `T${index}`, x: 5 + (index % 16) * 6, y: 6 + Math.floor(Math.log2(index + 1)) * 17,
    }));
    const tree: GraphDocumentV1 = {
      version: 1, mode: 'tree', directed: true, weighted: false,
      nodes: treeNodes,
      edges: treeNodes.slice(1).map((node, index) => ({
        id: `tree-edge-${index}`, from: treeNodes[Math.floor(index / 2)].id, to: node.id,
      })),
      rootId: treeNodes[0].id,
      startId: treeNodes[0].id,
    };
    const preorder = supported.find((candidate) => candidate.name.includes('Preorder'))!;
    const treeFinal = simulateAlgorithm(preorder.name, preorder.code, {
      kind: 'tree', text: '', graph: tree, origin: 'user',
    }).at(-1)?.visualData.vars;
    expect(treeFinal?.traversal).toHaveLength(63);
    expect(JSON.stringify({ stringFinal, graphFinal, treeFinal })).not.toContain('...');
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

  it('has no unsupported preset after compound inputs were added', () => {
    const blocked = algorithmRegistry.filter((algorithm) => !algorithm.isSupported);
    expect(blocked).toEqual([]);
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

  it('computes correct results for every compound-input algorithm', () => {
    const run = (
      name: string,
      kind: 'array' | 'string',
      text: string,
      parameters: Record<string, string>,
    ) => {
      const algorithm = algorithmRegistry.find((candidate) => candidate.name === name);
      return simulateAlgorithm(
        algorithm?.name ?? '',
        algorithm?.code ?? '',
        { kind, text, parameters },
      ).at(-1)?.visualData.vars;
    };

    for (const name of [
      'Knuth-Morris-Pratt (KMP)',
      'Rabin-Karp Algorithm',
      'Boyer-Moore Algorithm',
    ]) {
      expect(run(name, 'string', 'ABABA', {
        pattern: 'ABA',
        modulus: '101',
      })?.matches, name).toEqual([0, 2]);
    }
    expect(run('Sliding Window Maximum', 'array', '[1,3,-1,-3,5,3,6,7]', {
      windowSize: '3',
    })?.maxima).toEqual([3, 3, 5, 5, 6, 7]);
    expect(run('Trie Insert & Search', 'string', 'code,coder,trace', {
      query: 'coder',
    })?.found).toBe(true);
    expect(run('Two Pointers Technique', 'array', '[2,7,11,15]', {
      target: '9',
    })?.found).toBe(true);
    expect(run('Minimum Window Substring', 'string', 'ADOBECODEBANC', {
      target: 'ABC',
    })?.window).toBe('BANC');
    expect(run('Merge Intervals', 'array', '[1,3,2,6,8,10,15,18]', {})
      ?.merged).toEqual([[1, 6], [8, 10], [15, 18]]);
    expect(run('Binary Search', 'array', '[1,3,5,7,9]', {
      target: '7',
    })?.foundIndex).toBe(3);
    expect(run('Ternary Search', 'array', '[1,3,5,7,9]', {
      target: '7',
    })?.foundIndex).toBe(3);
    expect(run('0/1 Knapsack', 'array', '[1,3,4,5]', {
      values: '[1,4,5,7]',
      capacity: '7',
    })?.maxValue).toBe(9);
    expect(run('Longest Common Subsequence', 'string', 'ABCBDAB', {
      other: 'BDCABA',
    })?.length).toBe(4);
    expect(run('Edit Distance', 'string', 'kitten', {
      other: 'sitting',
    })?.distance).toBe(3);
    expect(run('Coin Change', 'array', '[1,2,5]', {
      amount: '11',
    })?.minCoins).toBe(3);
    expect(run('Detect Cycle in Linked List', 'array', '[3,2,0,-4]', {
      cycleEntry: '1',
    })).toMatchObject({ hasCycle: true, cycleEntry: 1 });
  });

  it('rejects invalid compound inputs with actionable errors', () => {
    const simulate = (
      name: string,
      text: string,
      parameters: Record<string, string>,
    ) => simulateAlgorithm(name, name, { kind: 'array', text, parameters });

    expect(() => simulate('Sliding Window Maximum', '[1,2]', {
      windowSize: '3',
    })).toThrow('cannot exceed');
    expect(() => simulate('Merge Intervals', '[1,2,3]', {}))
      .toThrow('even number');
    expect(() => simulate('Binary Search', '[2,1]', { target: '1' }))
      .toThrow('sorted');
    expect(() => simulate('0/1 Knapsack', '[1,2]', {
      values: '[4]',
      capacity: '3',
    })).toThrow('same length');
    expect(() => simulate('Coin Change', '[1,0]', { amount: '3' }))
      .toThrow('positive integers');
    expect(() => simulate('Detect Cycle in Linked List', '[1,2]', {
      cycleEntry: '2',
    })).toThrow('valid node index');
  });
});
