import type { GraphDocumentV1, GraphNode, InputKind, SimulationInput } from '../types/simulation';
import { parseBinaryTree } from './inputParsers';

const treePresets = [
  '[8,4,12,2,6,10,14,1,3,5,7,9,11,13,15]',
  '["root","left","right","leaf-A",null,"inner","leaf-B",null,null,null,null,"deep-L","deep-R"]',
  '[20,10,30,5,15,25,40,null,7,13,17,23,27,35,50]',
];

const positionsForLayers = (layers: string[][]): GraphNode[] => layers.flatMap((ids, layer) =>
  ids.map((id, index) => ({
    id,
    label: id,
    x: layers.length === 1 ? 50 : 8 + (84 * layer) / (layers.length - 1),
    y: ids.length === 1 ? 50 : 12 + (76 * index) / (ids.length - 1),
  })));

interface GraphPresetOptions {
  layers: string[][];
  edges: Array<[string, string, number?]>;
  directed?: boolean;
  weighted?: boolean;
  startId?: string;
  targetId?: string;
}

const graphFrom = ({
  layers,
  edges,
  directed = false,
  weighted = false,
  startId = layers[0][0],
  targetId = layers.at(-1)?.at(-1),
}: GraphPresetOptions): GraphDocumentV1 => ({
  version: 1,
  mode: 'graph',
  directed,
  weighted,
  nodes: positionsForLayers(layers),
  edges: edges.map(([from, to, weight], index) => ({
    id: `e${index + 1}`,
    from,
    to,
    weight: weighted ? weight ?? 1 : undefined,
  })),
  startId,
  targetId,
});

const traversalGraphs = (): GraphDocumentV1[] => [
  graphFrom({
    layers: [['S'], ['A', 'B'], ['C', 'D', 'E'], ['F', 'G']],
    edges: [['S', 'A'], ['S', 'B'], ['A', 'C'], ['A', 'D'], ['B', 'D'], ['B', 'E'], ['C', 'F'], ['D', 'F'], ['D', 'G'], ['E', 'G']],
    startId: 'S', targetId: 'G',
  }),
  graphFrom({
    layers: [['1'], ['2', '3', '4'], ['5', '6'], ['7', '8']],
    edges: [['1', '2'], ['1', '3'], ['1', '4'], ['2', '5'], ['3', '5'], ['3', '6'], ['4', '6'], ['5', '7'], ['6', '8'], ['7', '8'], ['2', '6']],
    startId: '1', targetId: '8',
  }),
  graphFrom({
    layers: [['Gate'], ['North', 'South'], ['Hub', 'Side'], ['Goal']],
    edges: [['Gate', 'North'], ['Gate', 'South'], ['North', 'Hub'], ['South', 'Hub'], ['South', 'Side'], ['Side', 'North'], ['Hub', 'Goal'], ['Side', 'Goal']],
    startId: 'Gate', targetId: 'Goal',
  }),
];

const weightedPathGraphs = (): GraphDocumentV1[] => [
  graphFrom({
    layers: [['S'], ['A', 'B'], ['C', 'D'], ['T']], weighted: true,
    edges: [['S', 'A', 2], ['S', 'B', 5], ['A', 'B', 1], ['A', 'C', 4], ['B', 'C', 2], ['B', 'D', 6], ['C', 'D', 1], ['C', 'T', 5], ['D', 'T', 2]],
    startId: 'S', targetId: 'T',
  }),
  graphFrom({
    layers: [['A'], ['B', 'C'], ['D', 'E', 'F'], ['G']], weighted: true,
    edges: [['A', 'B', 4], ['A', 'C', 2], ['B', 'D', 5], ['B', 'E', 2], ['C', 'E', 4], ['C', 'F', 7], ['D', 'G', 3], ['E', 'G', 6], ['F', 'G', 1], ['E', 'F', 1]],
    startId: 'A', targetId: 'G',
  }),
  graphFrom({
    layers: [['Start'], ['P', 'Q', 'R'], ['U', 'V'], ['Target']], weighted: true,
    edges: [['Start', 'P', 3], ['Start', 'Q', 8], ['Start', 'R', 2], ['P', 'U', 4], ['Q', 'U', 1], ['Q', 'V', 2], ['R', 'V', 6], ['U', 'Target', 5], ['V', 'Target', 3], ['P', 'Q', 2]],
    startId: 'Start', targetId: 'Target',
  }),
];

const directedGraphPresets = (algorithmName: string): GraphDocumentV1[] => {
  if (/Topological/i.test(algorithmName)) return [0, 1, 2].map((variant) => graphFrom({
    layers: [['plan'], ['design', 'data'], ['code', 'review'], ['test'], ['ship']], directed: true,
    edges: variant === 1
      ? [['plan', 'design'], ['plan', 'data'], ['design', 'code'], ['data', 'code'], ['data', 'review'], ['code', 'test'], ['review', 'test'], ['test', 'ship']]
      : variant === 2
        ? [['plan', 'data'], ['plan', 'design'], ['data', 'review'], ['design', 'review'], ['design', 'code'], ['review', 'test'], ['code', 'test'], ['test', 'ship']]
        : [['plan', 'design'], ['plan', 'data'], ['design', 'code'], ['data', 'review'], ['code', 'test'], ['review', 'test'], ['test', 'ship']],
    startId: 'plan', targetId: 'ship',
  }));
  if (/Kosaraju|Tarjan|SCC/i.test(algorithmName)) return [0, 1, 2].map((variant) => graphFrom({
    layers: [['A', 'B', 'C'], ['D', 'E'], ['F', 'G', 'H']], directed: true,
    edges: [
      ['A', 'B'], ['B', 'C'], ['C', 'A'], ['C', 'D'],
      ['D', 'E'], ['E', 'D'], ['E', 'F'], ['F', 'G'], ['G', 'H'], ['H', 'F'],
      ...(variant > 0 ? [['B', 'D'] as [string, string]] : []),
      ...(variant > 1 ? [['H', 'E'] as [string, string]] : []),
    ], startId: 'A', targetId: 'H',
  }));
  if (/Max Flow|Dinic|Edmonds/i.test(algorithmName)) return [
    [['S', 'A', 10], ['S', 'B', 8], ['A', 'C', 5], ['A', 'D', 5], ['B', 'D', 8], ['C', 'T', 7], ['D', 'T', 10]],
    [['S', 'A', 7], ['S', 'B', 9], ['A', 'C', 5], ['A', 'D', 3], ['B', 'C', 4], ['B', 'D', 6], ['C', 'T', 8], ['D', 'T', 7]],
    [['S', 'A', 12], ['S', 'B', 5], ['A', 'B', 3], ['A', 'C', 8], ['B', 'D', 8], ['C', 'D', 4], ['C', 'T', 7], ['D', 'T', 10]],
  ].map((edges) => graphFrom({ layers: [['S'], ['A', 'B'], ['C', 'D'], ['T']], edges: edges as Array<[string, string, number]>, directed: true, weighted: true, startId: 'S', targetId: 'T' }));
  if (/Bellman|Johnson|Floyd/i.test(algorithmName)) return [
    [['S', 'A', 4], ['S', 'B', 5], ['A', 'C', -2], ['B', 'C', 3], ['C', 'D', 4], ['D', 'B', -1]],
    [['S', 'A', 2], ['S', 'B', 7], ['A', 'B', -1], ['A', 'C', 5], ['B', 'C', 2], ['C', 'T', 3], ['B', 'T', 8]],
    [['S', 'A', 6], ['S', 'B', 3], ['B', 'A', 2], ['A', 'C', -3], ['B', 'C', 4], ['C', 'D', 2], ['D', 'T', 1]],
  ].map((edges, index) => graphFrom({
    layers: index === 1 ? [['S'], ['A', 'B'], ['C'], ['T']] : [['S'], ['A', 'B'], ['C'], ['D'], ['T']],
    edges: edges as Array<[string, string, number]>, directed: true, weighted: true, startId: 'S', targetId: index === 1 ? 'T' : 'D',
  }));
  return weightedPathGraphs().map((graph) => ({ ...graph, directed: true }));
};

const specialUndirectedGraphs = (algorithmName: string): GraphDocumentV1[] | null => {
  if (/Bipartite Matching/i.test(algorithmName)) return [0, 1, 2].map((variant) => graphFrom({
    layers: [['U1', 'U2', 'U3', 'U4'], ['V1', 'V2', 'V3', 'V4']],
    edges: [
      ['U1', 'V1'], ['U1', 'V2'], ['U2', 'V1'], ['U2', 'V3'],
      ['U3', 'V2'], ['U3', 'V4'], ['U4', 'V3'],
      ...(variant > 0 ? [['U4', 'V4'] as [string, string]] : []),
      ...(variant > 1 ? [['U2', 'V4'] as [string, string]] : []),
    ], startId: 'U1', targetId: 'V4',
  }));
  if (/Articulation|Bridges/i.test(algorithmName)) return [0, 1, 2].map((variant) => graphFrom({
    layers: [['A', 'B', 'C'], ['X'], ['D', 'E', 'F'], ['Leaf']],
    edges: [['A', 'B'], ['B', 'C'], ['C', 'A'], ['C', 'X'], ['X', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'D'], ['D', 'Leaf'], ...(variant > 0 ? [['B', 'X'] as [string, string]] : []), ...(variant > 1 ? [['X', 'E'] as [string, string]] : [])],
    startId: 'A', targetId: 'Leaf',
  }));
  if (/Hamiltonian/i.test(algorithmName)) return [0, 1, 2].map((variant) => graphFrom({
    layers: [['1', '2', '3'], ['8', 'center', '4'], ['7', '6', '5']],
    edges: [['1', '2'], ['2', '3'], ['3', '4'], ['4', '5'], ['5', '6'], ['6', '7'], ['7', '8'], ['8', '1'], ['2', '7'], ['3', '6'], ...(variant > 0 ? [['1', 'center'] as [string, string], ['center', '5'] as [string, string]] : []), ...(variant > 1 ? [['center', '3'] as [string, string]] : [])],
    startId: '1', targetId: '8',
  }));
  if (/Eulerian/i.test(algorithmName)) return [0, 1, 2].map((variant) => graphFrom({
    layers: [['A', 'B'], ['F', 'C'], ['E', 'D']],
    edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'A'], ...(variant === 1 ? [['A', 'D'] as [string, string]] : []), ...(variant === 2 ? [['B', 'E'] as [string, string]] : [])],
    startId: 'A', targetId: 'F',
  }));
  if (/Graph Coloring/i.test(algorithmName)) return [0, 1, 2].map((variant) => graphFrom({
    layers: [['A', 'B', 'C'], ['D', 'E', 'F']],
    edges: [['A', 'B'], ['B', 'C'], ['C', 'A'], ['A', 'D'], ['B', 'E'], ['C', 'F'], ['D', 'E'], ['E', 'F'], ...(variant > 0 ? [['D', 'F'] as [string, string]] : []), ...(variant > 1 ? [['A', 'E'] as [string, string]] : [])],
    startId: 'A', targetId: 'F',
  }));
  return null;
};

export const createGraphPreset = (presetIndex = 0, algorithmName = ''): GraphDocumentV1 => {
  const normalized = Math.max(0, Math.min(2, presetIndex));
  if (!algorithmName) {
    const ids = Array.from({ length: 15 }, (_, index) => String(index + 1));
    return graphFrom({
      layers: [['1'], ['2', '3'], ['4', '5', '6', '7'], ['8', '9', '10'], ['11', '12', '13', '14'], ['15']],
      edges: ids.slice(0, -1).map((id, index) => [id, ids[index + 1], (index % 5) + 1]),
      weighted: true, startId: '1', targetId: '15',
    });
  }
  if (/Topological|SCC|Kosaraju|Tarjan|Max Flow|Dinic|Edmonds|Bellman|Johnson|Floyd/i.test(algorithmName)) {
    return directedGraphPresets(algorithmName)[normalized];
  }
  const special = specialUndirectedGraphs(algorithmName);
  if (special) return special[normalized];
  if (/Dijkstra|A\*|MST|Kruskal|Prim/i.test(algorithmName)) return weightedPathGraphs()[normalized];
  return traversalGraphs()[normalized];
};

export const getInputKindForAlgorithm = (name: string): InputKind => {
  if (/DFS|BFS|Dijkstra|A\*|MST|Bellman|Floyd|Topological|SCC|Max Flow|Bipartite|Graph Coloring|Eulerian|Hamiltonian|Articulation|Bridges|Johnson/i.test(name)) return 'graph';
  if (/Tree|Lowest Common Ancestor/i.test(name)) return 'tree';
  if (/Z-Algorithm|Manacher|KMP|Rabin-Karp|Boyer-Moore|Trie|Minimum Window|Longest Common Subsequence|Edit Distance/i.test(name)) return 'string';
  return 'array';
};

const stringPreset = (algorithmName: string, index: number): SimulationInput => {
  const matching = [
    { text: 'ABABDABACDABABCABAB', pattern: 'ABABCABAB', modulus: '101' },
    { text: 'AABAACAADAABAABA', pattern: 'AABA', modulus: '1009' },
    { text: 'NEEDLEINAHAYSTACKNEEDLE', pattern: 'NEEDLE', modulus: '10007' },
  ];
  if (/KMP|Rabin-Karp|Boyer-Moore/i.test(algorithmName)) {
    const value = matching[index];
    return { kind: 'string', text: value.text, parameters: { pattern: value.pattern, ...(/Rabin-Karp/i.test(algorithmName) ? { modulus: value.modulus } : {}) } };
  }
  if (/Trie/i.test(algorithmName)) {
    const values = [
      { text: 'code,coder,coding,trace,tree', query: 'coder' },
      { text: 'algorithm,algebra,align,allocate', query: 'align' },
      { text: 'graph,gravity,grape,grid', query: 'grow' },
    ];
    return { kind: 'string', text: values[index].text, parameters: { query: values[index].query } };
  }
  if (/Minimum Window/i.test(algorithmName)) {
    const values = [
      { text: 'ADOBECODEBANC', target: 'ABC' },
      { text: 'AAABBCAC', target: 'AABC' },
      { text: 'TIMELINECHECKPOINT', target: 'POINT' },
    ];
    return { kind: 'string', text: values[index].text, parameters: { target: values[index].target } };
  }
  if (/Longest Common Subsequence/i.test(algorithmName)) {
    const values = [['ABCBDAB', 'BDCABA'], ['ALGORITHM', 'LOGARITHM'], ['VISUALTRACE', 'VIRTUALSPACE']];
    return { kind: 'string', text: values[index][0], parameters: { other: values[index][1] } };
  }
  if (/Edit Distance/i.test(algorithmName)) {
    const values = [['kitten', 'sitting'], ['algorithm', 'altruistic'], ['trace', 'track']];
    return { kind: 'string', text: values[index][0], parameters: { other: values[index][1] } };
  }
  if (/Manacher/i.test(algorithmName)) return { kind: 'string', text: ['forgeeksskeegfor', 'abacabadabacaba', 'noonracecarlevel'][index] };
  return { kind: 'string', text: ['AABAABAAZ', 'abacabadabacaba', 'aabcaabxaaaz'][index] };
};

const arrayPreset = (algorithmName: string, index: number): SimulationInput => {
  const choose = (values: string[]) => ({ kind: 'array' as const, text: values[index] });
  if (/Binary Search|Ternary Search/i.test(algorithmName)) {
    const values = [
      { text: '[-12,-3,0,4,9,15,22,31]', target: '9' },
      { text: '[2,5,8,12,16,23,38,56,72]', target: '23' },
      { text: '[1,4,7,10,13,16,19,22,25,28]', target: '26' },
    ];
    return { kind: 'array', text: values[index].text, parameters: { target: values[index].target } };
  }
  if (/Sliding Window Maximum/i.test(algorithmName)) {
    const values = [
      { text: '[1,3,-1,-3,5,3,6,7]', windowSize: '3' },
      { text: '[9,8,7,6,5,4,3,2]', windowSize: '4' },
      { text: '[4,2,12,3,8,7,9,1,6]', windowSize: '2' },
    ];
    return { kind: 'array', text: values[index].text, parameters: { windowSize: values[index].windowSize } };
  }
  if (/Two Pointers/i.test(algorithmName)) {
    const values = [
      { text: '[2,7,11,15]', target: '9' },
      { text: '[-5,-1,0,4,8,13]', target: '7' },
      { text: '[1,3,4,6,8,10,14]', target: '11' },
    ];
    return { kind: 'array', text: values[index].text, parameters: { target: values[index].target } };
  }
  if (/0\/1 Knapsack/i.test(algorithmName)) {
    const values = [
      { weights: '[1,3,4,5]', values: '[1,4,5,7]', capacity: '7' },
      { weights: '[2,3,4,6]', values: '[4,5,7,10]', capacity: '9' },
      { weights: '[2,5,7,3,1]', values: '[6,12,14,7,3]', capacity: '10' },
    ];
    return { kind: 'array', text: values[index].weights, parameters: { values: values[index].values, capacity: values[index].capacity } };
  }
  if (/Coin Change/i.test(algorithmName)) {
    const values = [["[1,2,5]", '11'], ["[2,3,7]", '17'], ["[1,3,4]", '23']];
    return { kind: 'array', text: values[index][0], parameters: { amount: values[index][1] } };
  }
  if (/Detect Cycle/i.test(algorithmName)) {
    const values = [["[3,2,0,-4]", '1'], ["[1,2,3,4,5,6]", '-1'], ["[8,6,7,5,3,0,9]", '3']];
    return { kind: 'array', text: values[index][0], parameters: { cycleEntry: values[index][1] } };
  }
  if (/Merge Intervals/i.test(algorithmName)) return choose(['[1,3,2,6,8,10,15,18]', '[1,4,4,5,7,9,8,12]', '[5,7,1,2,2,4,10,13,12,15]']);
  if (/Dutch National Flag/i.test(algorithmName)) return choose(['[2,0,2,1,1,0]', '[2,1,0,2,1,0,1,2]', '[0,2,1,2,0,1,0,2,1]']);
  if (/Unique Paths/i.test(algorithmName)) return choose(['[3,7]', '[5,6]', '[8,10]']);
  if (/Sieve of Eratosthenes/i.test(algorithmName)) return choose(['[30]', '[50]', '[100]']);
  if (/Fast Exponentiation/i.test(algorithmName)) return choose(['[2,10,1000]', '[7,13,97]', '[19,23,1000000007]']);
  if (/Matrix Chain/i.test(algorithmName)) return choose(['[40,20,30,10,30]', '[10,20,30,40,30]', '[5,10,3,12,5,50,6]']);
  if (/Kadane/i.test(algorithmName)) return choose(['[-2,1,-3,4,-1,2,1,-5,4]', '[-8,-3,-6,-2,-5,-4]', '[5,-2,3,4,-10,8,2,-1]']);
  if (/Moore/i.test(algorithmName)) return choose(['[2,2,1,1,1,2,2]', '[4,4,2,4,3,4,4,1,4]', '[1,2,3,2,2,2,5,2,2]']);
  if (/Trapping Rain Water/i.test(algorithmName)) return choose(['[0,1,0,2,1,0,1,3,2,1,2,1]', '[4,2,0,3,2,5]', '[3,0,2,0,4]']);
  if (/Longest Increasing Subsequence/i.test(algorithmName)) return choose(['[10,9,2,5,3,7,101,18]', '[0,1,0,3,2,3]', '[7,7,7,7,7,7]']);
  if (/Radix Sort/i.test(algorithmName)) return choose(['[170,45,75,90,802,24,2,66]', '[9,81,702,14,5,300,27]', '[1000,1,10,100,999,101,11]']);
  if (/Counting Sort/i.test(algorithmName)) return choose(['[4,2,2,8,3,3,1]', '[9,0,5,2,9,1,5,3]', '[12,11,15,12,10,14,11]']);
  if (/Quick Sort/i.test(algorithmName)) return choose(['[9,3,7,1,8,2,5,5]', '[1,2,3,4,5,6,7,8]', '[8,1,6,2,7,3,5,4]']);
  if (/Merge Sort/i.test(algorithmName)) return choose(['[38,27,43,3,9,82,10]', '[5,1,4,2,8,0,3,7,6]', '[12,-4,7,7,0,19,-8,5]']);
  if (/Heap Sort/i.test(algorithmName)) return choose(['[12,11,13,5,6,7]', '[4,10,3,5,1,8,2,9]', '[20,18,15,13,9,7,6,5,3]']);
  if (/Bubble Sort/i.test(algorithmName)) return choose(['[5,1,4,2,8]', '[1,2,3,5,4,6]', '[9,8,7,6,5,4,3,2,1]']);
  if (/Insertion Sort/i.test(algorithmName)) return choose(['[12,11,13,5,6]', '[2,4,6,8,1,3,5,7]', '[9,3,3,7,1,8,2]']);
  if (/Selection Sort/i.test(algorithmName)) return choose(['[64,25,12,22,11]', '[3,1,2,3,0,2]', '[20,18,5,12,7,3,15]']);
  if (/Prefix Sum/i.test(algorithmName)) return choose(['[3,-2,5,1,-4,6]', '[10,20,-5,7,3]', '[1,1,2,3,5,8,13]']);
  if (/Reverse Linked List/i.test(algorithmName)) return choose(['[10,20,30,40,50]', '[1]', '[7,3,9,2,8,4]']);
  return choose(['[12,-4,7,7,0,19,-8,5]', '[31,4,18,9,27,1,16,8,23]', '[6,2,9,3,8,1,7,4,5,0]']);
};

export const createInputPreset = (
  kind: InputKind,
  presetIndex = 0,
  algorithmName = '',
): SimulationInput => {
  const normalized = Math.max(0, Math.min(2, presetIndex));
  if (kind === 'string') return { ...stringPreset(algorithmName, normalized), origin: 'preset' };
  if (kind === 'array') return { ...arrayPreset(algorithmName, normalized), origin: 'preset' };
  if (kind === 'tree') {
    let graph = parseBinaryTree(treePresets[normalized]);
    if (/Lowest Common Ancestor/i.test(algorithmName) && graph.nodes.length >= 5) {
      graph = { ...graph, startId: graph.nodes[3].id, targetId: graph.nodes[4].id };
    }
    return { kind, text: treePresets[normalized], graph, origin: 'preset' };
  }
  const graph = createGraphPreset(normalized, algorithmName);
  return { kind, text: '', graph, origin: 'preset' };
};
