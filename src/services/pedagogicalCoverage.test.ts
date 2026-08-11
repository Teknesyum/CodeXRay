import { describe, expect, it } from 'vitest';
import type { VisualData } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { createInputPreset, getInputKindForAlgorithm } from './inputPresets';
import { simulateAlgorithm } from './simulators';

type VisualType = VisualData['type'];

const expectedMetaphor: Record<string, VisualType> = {
  'Depth First Search (DFS)': 'graph',
  'Breadth First Search (BFS)': 'graph',
  "Dijkstra's Shortest Path": 'graph',
  'A* Search Algorithm': 'graph',
  "Kruskal's MST": 'graph',
  "Prim's MST": 'graph',
  'Bellman-Ford Algorithm': 'graph',
  'Floyd-Warshall Algorithm': 'matrix',
  'Topological Sort': 'graph',
  "Kosaraju's SCC": 'graph',
  "Tarjan's SCC": 'graph',
  'Edmonds-Karp Max Flow': 'graph',
  "Dinic's Max Flow": 'graph',
  'Bipartite Matching (Hopcroft-Karp)': 'graph',
  'Graph Coloring': 'graph',
  'Eulerian Path/Circuit': 'graph',
  'Hamiltonian Cycle': 'graph',
  'Articulation Points': 'graph',
  'Bridges in Graph': 'graph',
  "Johnson's Algorithm": 'matrix',
  'Z-Algorithm': 'string-match',
  'Knuth-Morris-Pratt (KMP)': 'string-match',
  'Rabin-Karp Algorithm': 'string-match',
  'Boyer-Moore Algorithm': 'string-match',
  "Kadane's Algorithm": 'array',
  'Sliding Window Maximum': 'array',
  "Longest Palindromic Substring (Manacher's)": 'string-match',
  'Trie Insert & Search': 'graph',
  'Two Pointers Technique': 'array',
  'Prefix Sum Array': 'rows',
  'Dutch National Flag': 'array',
  "Moore's Voting Algorithm": 'array',
  'Minimum Window Substring': 'string-match',
  'Trapping Rain Water': 'bars',
  'Merge Intervals': 'intervals',
  'Quick Sort': 'array',
  'Merge Sort': 'rows',
  'Binary Search': 'array',
  'Heap Sort': 'rows',
  'Radix Sort': 'rows',
  'Counting Sort': 'rows',
  'Bubble Sort': 'array',
  'Insertion Sort': 'array',
  'Selection Sort': 'array',
  'Ternary Search': 'array',
  '0/1 Knapsack': 'matrix',
  'Longest Common Subsequence': 'matrix',
  'Longest Increasing Subsequence': 'rows',
  'Matrix Chain Multiplication': 'matrix',
  'Edit Distance': 'matrix',
  'Coin Change': 'matrix',
  'Unique Paths': 'matrix',
  'Binary Tree Inorder Traversal': 'graph',
  'Binary Tree Preorder Traversal': 'graph',
  'Binary Tree Postorder Traversal': 'graph',
  'Lowest Common Ancestor (LCA)': 'graph',
  'Sieve of Eratosthenes': 'graph',
  'Fast Exponentiation (Modular)': 'rows',
  'Reverse Linked List': 'graph',
  'Detect Cycle in Linked List': 'graph',
};

describe('60-algorithm pedagogical coverage contract', () => {
  it('maps every supported registry entry to one domain-specific teaching metaphor', () => {
    const supportedNames = algorithmRegistry.filter((entry) => entry.isSupported).map((entry) => entry.name).sort();
    expect(Object.keys(expectedMetaphor).sort()).toEqual(supportedNames);
  });

  it('renders the expected metaphor and a multi-phase passive timeline for every algorithm', () => {
    for (const algorithm of algorithmRegistry.filter((entry) => entry.isSupported)) {
      const input = createInputPreset(getInputKindForAlgorithm(algorithm.name), 0, algorithm.name);
      const steps = simulateAlgorithm(algorithm.name, algorithm.code, input);
      expect(
        steps.some((step) => step.visualData.type === expectedMetaphor[algorithm.name]),
        `${algorithm.name} never renders ${expectedMetaphor[algorithm.name]}`,
      ).toBe(true);
      const phases = new Set(steps.map((step) => step.visualData.vars.phase).filter(
        (phase): phase is string => typeof phase === 'string' && phase.trim().length > 0,
      ));
      expect(phases.size, `${algorithm.name} needs initialization, transition, and result phases`)
        .toBeGreaterThanOrEqual(3);
      expect(steps.at(-1)?.visualData.vars.phase, `${algorithm.name} has no grounded final phase`)
        .toEqual(expect.any(String));
    }
  });
});
