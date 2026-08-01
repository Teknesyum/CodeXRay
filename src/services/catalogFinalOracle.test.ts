import { describe, expect, it } from 'vitest';
import { algorithmRegistry } from './codeRegistry';
import { createInputPreset, getInputKindForAlgorithm } from './inputPresets';
import { simulateAlgorithm } from './simulators';

type Oracle = { path: Array<string | number>; expected: unknown };

const oracles: Record<string, Oracle> = {
  'Depth First Search (DFS)': { path: ['visited'], expected: ['S', 'A', 'C', 'F', 'D', 'B', 'E', 'G'] },
  'Breadth First Search (BFS)': { path: ['distances', 'G'], expected: 3 },
  "Dijkstra's Shortest Path": { path: ['distances', 'T'], expected: 8 },
  'A* Search Algorithm': { path: ['distances', 'T'], expected: 8 },
  "Kruskal's MST": { path: ['totalWeight'], expected: 8 },
  "Prim's MST": { path: ['totalWeight'], expected: 8 },
  'Bellman-Ford Algorithm': { path: ['distances', 'D'], expected: 6 },
  'Floyd-Warshall Algorithm': { path: ['distances', 0, 3], expected: 2 },
  'Topological Sort': { path: ['order'], expected: ['plan', 'design', 'data', 'code', 'review', 'test', 'ship'] },
  "Kosaraju's SCC": { path: ['components'], expected: [['A', 'C', 'B'], ['D', 'E'], ['F', 'H', 'G']] },
  "Tarjan's SCC": { path: ['components'], expected: [['H', 'G', 'F'], ['E', 'D'], ['C', 'B', 'A']] },
  'Edmonds-Karp Max Flow': { path: ['maxFlow'], expected: 15 },
  "Dinic's Max Flow": { path: ['maxFlow'], expected: 15 },
  'Bipartite Matching (Hopcroft-Karp)': { path: ['matchingSize'], expected: 4 },
  'Graph Coloring': { path: ['colorCount'], expected: 3 },
  'Eulerian Path/Circuit': { path: ['path'], expected: ['A', 'B', 'C', 'D', 'E', 'F', 'A'] },
  'Hamiltonian Cycle': { path: ['found'], expected: false },
  'Articulation Points': { path: ['articulationPoints'], expected: ['D', 'X', 'C'] },
  'Bridges in Graph': { path: ['bridges'], expected: ['e9', 'e5', 'e4'] },
  "Johnson's Algorithm": { path: ['allPairs', 'S', 'D'], expected: 6 },
  'Z-Algorithm': { path: ['z'], expected: [0, 1, 0, 5, 1, 0, 2, 1, 0] },
  'Knuth-Morris-Pratt (KMP)': { path: ['matches'], expected: [10] },
  'Rabin-Karp Algorithm': { path: ['matches'], expected: [10] },
  'Boyer-Moore Algorithm': { path: ['matches'], expected: [10] },
  "Kadane's Algorithm": { path: ['best'], expected: 6 },
  'Sliding Window Maximum': { path: ['maxima'], expected: [3, 3, 5, 5, 6, 7] },
  "Longest Palindromic Substring (Manacher's)": { path: ['palindrome'], expected: 'geeksskeeg' },
  'Trie Insert & Search': { path: ['found'], expected: true },
  'Two Pointers Technique': { path: ['pair'], expected: [0, 1] },
  'Prefix Sum Array': { path: ['prefix'], expected: [3, 1, 6, 7, 3, 9] },
  'Dutch National Flag': { path: ['result'], expected: [0, 0, 1, 1, 2, 2] },
  "Moore's Voting Algorithm": { path: ['candidate'], expected: 2 },
  'Minimum Window Substring': { path: ['window'], expected: 'BANC' },
  'Trapping Rain Water': { path: ['water'], expected: 6 },
  'Merge Intervals': { path: ['merged'], expected: [[1, 6], [8, 10], [15, 18]] },
  'Quick Sort': { path: ['array'], expected: [1, 2, 3, 5, 5, 7, 8, 9] },
  'Merge Sort': { path: ['array'], expected: [3, 9, 10, 27, 38, 43, 82] },
  'Binary Search': { path: ['foundIndex'], expected: 4 },
  'Heap Sort': { path: ['array'], expected: [5, 6, 7, 11, 12, 13] },
  'Radix Sort': { path: ['array'], expected: [2, 24, 45, 66, 75, 90, 170, 802] },
  'Counting Sort': { path: ['array'], expected: [1, 2, 2, 3, 3, 4, 8] },
  'Bubble Sort': { path: ['array'], expected: [1, 2, 4, 5, 8] },
  'Insertion Sort': { path: ['array'], expected: [5, 6, 11, 12, 13] },
  'Selection Sort': { path: ['array'], expected: [11, 12, 22, 25, 64] },
  'Ternary Search': { path: ['foundIndex'], expected: 4 },
  '0/1 Knapsack': { path: ['maxValue'], expected: 9 },
  'Longest Common Subsequence': { path: ['length'], expected: 4 },
  'Longest Increasing Subsequence': { path: ['length'], expected: 4 },
  'Matrix Chain Multiplication': { path: ['minimumCost'], expected: 26000 },
  'Edit Distance': { path: ['distance'], expected: 3 },
  'Coin Change': { path: ['minCoins'], expected: 3 },
  'Unique Paths': { path: ['uniquePaths'], expected: '28' },
  'Binary Tree Inorder Traversal': { path: ['traversal'], expected: ['n7', 'n3', 'n8', 'n1', 'n9', 'n4', 'n10', 'n0', 'n11', 'n5', 'n12', 'n2', 'n13', 'n6', 'n14'] },
  'Binary Tree Preorder Traversal': { path: ['traversal'], expected: ['n0', 'n1', 'n3', 'n7', 'n8', 'n4', 'n9', 'n10', 'n2', 'n5', 'n11', 'n12', 'n6', 'n13', 'n14'] },
  'Binary Tree Postorder Traversal': { path: ['traversal'], expected: ['n7', 'n8', 'n3', 'n9', 'n10', 'n4', 'n1', 'n11', 'n12', 'n5', 'n13', 'n14', 'n6', 'n2', 'n0'] },
  'Lowest Common Ancestor (LCA)': { path: ['lca'], expected: 'n1' },
  'Sieve of Eratosthenes': { path: ['primes'], expected: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
  'Fast Exponentiation (Modular)': { path: ['result'], expected: '24' },
  'Reverse Linked List': { path: ['reversed'], expected: [50, 40, 30, 20, 10] },
  'Detect Cycle in Linked List': { path: ['cycleEntry'], expected: 1 },
};

const readPath = (value: unknown, path: Array<string | number>): unknown =>
  path.reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string | number, unknown>)[key];
  }, value);

describe('all-algorithm final-result oracle', () => {
  it('checks an independently fixed expected result for every supported catalog entry', () => {
    const supported = algorithmRegistry.filter((algorithm) => algorithm.isSupported);
    expect(Object.keys(oracles).sort()).toEqual(supported.map((algorithm) => algorithm.name).sort());
    for (const algorithm of supported) {
      const kind = getInputKindForAlgorithm(algorithm.name);
      const steps = simulateAlgorithm(
        algorithm.name,
        algorithm.code,
        createInputPreset(kind, 0, algorithm.name),
      );
      const oracle = oracles[algorithm.name];
      expect(
        readPath(steps.at(-1)?.visualData.vars, oracle.path),
        `${algorithm.name} final ${oracle.path.join('.')}`,
      ).toEqual(oracle.expected);
    }
  });
});
