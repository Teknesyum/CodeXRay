import { getProblem } from './algorithmCatalog';
import type { ArrayTemplateId } from './arrayCompiler';
import type { BacktrackingTemplateId } from './backtrackingCompiler';
import type { DpTemplateId } from './dpTemplateCompiler';
import type { GraphTemplateId } from './graphCompiler';
import type { LinkedListTemplateId } from './linkedListCompiler';
import type { MatrixTemplateId } from './matrixCompiler';
import type { StringTemplateId } from './stringCompiler';
import type { AdvancedGraphTemplateId } from './advancedGraphCompiler';
import type { AdvancedStructureTemplateId } from './advancedStructureCompiler';

export type ExactCatalogTemplate =
  | DpTemplateId
  | ArrayTemplateId
  | BacktrackingTemplateId
  | GraphTemplateId
  | LinkedListTemplateId
  | MatrixTemplateId
  | StringTemplateId
  | AdvancedGraphTemplateId
  | AdvancedStructureTemplateId
  | 'predict-winner-interval-dp'
  | 'bidirectional-bfs';

export type ExactSupportContract =
  | { type: 'exact-simulation'; template: ExactCatalogTemplate }
  | { type: 'unsupported'; reason: string }
  | { type: 'needs-source' };

const exactContracts = new Map<string, ExactCatalogTemplate>([
  ['leetcode:72', 'edit-distance-2d-dp'],
  ['leetcode:77', 'combinations-backtracking'],
  ['leetcode:78', 'subsets-backtracking'],
  ['leetcode:98', 'validate-bst'],
  ['leetcode:141', 'cycle-linked-list'],
  ['leetcode:167', 'two-pointers-array'],
  ['leetcode:198', 'house-robber-1d-dp'],
  ['leetcode:207', 'course-schedule-topological'],
  ['leetcode:208', 'implement-trie'],
  ['leetcode:206', 'reverse-linked-list'],
  ['leetcode:209', 'sliding-window-array'],
  ['leetcode:307', 'range-sum-segment-tree'],
  ['leetcode:560', 'prefix-sum-array'],
  ['leetcode:704', 'binary-search-array'],
  ['leetcode:322', 'coin-change-1d-dp'],
  ['leetcode:337', 'house-robber-tree-dp'],
  ['leetcode:46', 'permutations-backtracking'],
  ['leetcode:54', 'spiral-matrix'],
  ['leetcode:486', 'predict-winner-interval-dp'],
  ['leetcode:516', 'longest-palindrome-interval-dp'],
  ['leetcode:684', 'redundant-connection-union-find'],
  ['leetcode:743', 'network-delay-dijkstra'],
  ['leetcode:841', 'keys-and-rooms-dfs'],
  ['leetcode:847', 'shortest-path-all-nodes-bitmask'],
  ['leetcode:1143', 'lcs-2d-dp'],
  ['leetcode:1971', 'bfs-graph'],
  ['leetcode:3', 'sliding-window-string'],
  ['leetcode:9', 'palindrome-number'],
  ['leetcode:125', 'two-pointers-string'],
  ['leetcode:1584', 'min-cost-connect-points-mst'],
]);

export const getExactCatalogTemplate = (source: string, problemId: string): ExactCatalogTemplate | null => (
  exactContracts.get(`${source}:${problemId}`) ?? null
);

export const checkProblemSupport = async (
  source: string,
  problemId: string,
  locale: 'en' | 'tr',
): Promise<ExactSupportContract> => {
  const problem = await getProblem({ source, id: problemId });
  if (!problem) {
    return {
      type: 'unsupported',
      reason: locale === 'tr' ? 'Problem katalogda bulunamadı.' : 'Problem not found in catalog.',
    };
  }
  const template = getExactCatalogTemplate(source, problemId);
  return template ? { type: 'exact-simulation', template } : { type: 'needs-source' };
};
