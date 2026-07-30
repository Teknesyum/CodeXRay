import type { GraphDocumentV1, InputKind, SimulationInput } from '../types/simulation';
import { parseBinaryTree } from './inputParsers';

const treePresets = [
  '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]',
  '["A","B","C","D",null,"E","F",null,null,null,null,"G","H"]',
  '[10,5,15,2,7,12,20,1,3,6,8,11,13,18,25]',
];

const graphPositions = [
  [10, 50], [24, 20], [24, 80], [40, 12], [40, 40],
  [40, 68], [40, 90], [58, 20], [58, 52], [58, 82],
  [74, 12], [74, 38], [74, 64], [74, 88], [92, 50],
];

const graphEdgeSets: Array<Array<[number, number, number]>> = [
  [
    [1, 2, 2], [1, 3, 4], [2, 4, 3], [2, 5, 1], [3, 6, 2],
    [3, 7, 5], [4, 8, 2], [5, 8, 4], [5, 9, 3], [6, 9, 1],
    [6, 10, 4], [8, 11, 2], [8, 12, 3], [9, 12, 1], [9, 13, 5],
    [10, 13, 2], [10, 14, 3], [11, 15, 8], [12, 15, 3], [13, 15, 2],
    [14, 15, 1],
  ],
  [
    [1, 2, 1], [2, 3, 1], [3, 4, 1], [4, 5, 1], [5, 6, 1],
    [6, 7, 1], [7, 8, 1], [8, 9, 1], [9, 10, 1], [10, 11, 1],
    [11, 12, 1], [12, 13, 1], [13, 14, 1], [14, 15, 1], [2, 8, 4],
    [5, 12, 3], [9, 15, 2],
  ],
  [
    [1, 4, 7], [1, 2, 2], [1, 3, 5], [2, 6, 3], [2, 5, 8],
    [3, 5, 1], [3, 7, 4], [4, 8, 6], [5, 9, 2], [6, 10, 2],
    [7, 10, 7], [8, 11, 1], [8, 12, 5], [9, 12, 2], [9, 13, 6],
    [10, 13, 2], [10, 14, 4], [11, 15, 9], [12, 15, 3], [13, 15, 1],
    [14, 15, 2],
  ],
];

export const createGraphPreset = (presetIndex = 0): GraphDocumentV1 => {
  const positions = presetIndex === 1
    ? graphPositions.map(([x, y], index) => [x, index % 2 ? 100 - y : y])
    : graphPositions;
  const nodes = positions.map(([x, y], index) => ({
    id: String(index + 1),
    label: String(index + 1),
    x,
    y,
  }));
  const edges = graphEdgeSets[presetIndex % graphEdgeSets.length].map(
    ([from, to, weight], index) => ({
      id: `e${index + 1}`,
      from: String(from),
      to: String(to),
      weight,
    }),
  );
  return {
    version: 1,
    mode: 'graph',
    directed: false,
    weighted: true,
    nodes,
    edges,
    startId: '1',
    targetId: '15',
  };
};

export const getInputKindForAlgorithm = (name: string): InputKind => {
  if (/DFS|BFS|Dijkstra|A\*/i.test(name)) return 'graph';
  if (/Z-Algorithm/i.test(name)) return 'string';
  return 'array';
};

export const createInputPreset = (
  kind: InputKind,
  presetIndex = 0,
): SimulationInput => {
  const normalized = Math.max(0, Math.min(2, presetIndex));
  if (kind === 'string') {
    const values = ['AABAABAAZ', 'abacabadabacaba', 'AABAACAADAABAACAABAA'];
    return { kind, text: values[normalized] };
  }
  if (kind === 'array') {
    const values = [
      '[3, 9, 10, 15, 20, 38, 27, 5, 43, 82]',
      '[38, 27, 43, 3, 9, 82, 10, 5, 20, 15, 31, 1, 6]',
      '[99, 82, 75, 66, 52, 45, 33, 21, 15, 8, 4, 1, 95, 71, 62]',
    ];
    return { kind, text: values[normalized] };
  }
  if (kind === 'tree') {
    const graph = parseBinaryTree(treePresets[normalized]);
    return { kind, text: treePresets[normalized], graph };
  }
  return { kind, text: '', graph: createGraphPreset(normalized) };
};
