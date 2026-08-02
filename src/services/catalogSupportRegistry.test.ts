import { describe, expect, it, vi } from 'vitest';

vi.mock('./algorithmCatalog', () => ({
  getProblem: vi.fn(async ({ source, id }: { source: string; id: string }) => (
    id === 'missing' ? null : {
      id,
      source,
      title: `Problem ${id}`,
      slug: `problem-${id}`,
      difficulty: 'Medium',
      category: 'other',
      derivedCategories: ['other'],
      tags: [],
    }
  )),
}));

import { checkProblemSupport, getExactCatalogTemplate } from './catalogSupportRegistry';

describe('catalog exact-support registry', () => {
  it.each([
    ['72', 'edit-distance-2d-dp'],
    ['77', 'combinations-backtracking'],
    ['78', 'subsets-backtracking'],
    ['98', 'validate-bst'],
    ['125', 'two-pointers-string'],
    ['141', 'cycle-linked-list'],
    ['167', 'two-pointers-array'],
    ['198', 'house-robber-1d-dp'],
    ['207', 'course-schedule-topological'],
    ['208', 'implement-trie'],
    ['206', 'reverse-linked-list'],
    ['209', 'sliding-window-array'],
    ['307', 'range-sum-segment-tree'],
    ['322', 'coin-change-1d-dp'],
    ['337', 'house-robber-tree-dp'],
    ['46', 'permutations-backtracking'],
    ['486', 'predict-winner-interval-dp'],
    ['516', 'longest-palindrome-interval-dp'],
    ['54', 'spiral-matrix'],
    ['560', 'prefix-sum-array'],
    ['684', 'redundant-connection-union-find'],
    ['704', 'binary-search-array'],
    ['743', 'network-delay-dijkstra'],
    ['841', 'keys-and-rooms-dfs'],
    ['847', 'shortest-path-all-nodes-bitmask'],
    ['9', 'palindrome-number'],
    ['3', 'sliding-window-string'],
    ['1143', 'lcs-2d-dp'],
    ['1584', 'min-cost-connect-points-mst'],
    ['1971', 'bfs-graph'],
  ] as const)('maps LeetCode numeric ID %s to its exact compiler', (problemId, template) => {
    expect(getExactCatalogTemplate('leetcode', problemId)).toBe(template);
  });

  it('uses source plus ID so another platform cannot inherit LeetCode support', async () => {
    await expect(checkProblemSupport('cses', '486', 'en')).resolves.toEqual({ type: 'needs-source' });
    expect(getExactCatalogTemplate('cses', '486')).toBeNull();
  });

  it('distinguishes a missing record from a present record that needs source', async () => {
    await expect(checkProblemSupport('leetcode', '1', 'en')).resolves.toEqual({ type: 'needs-source' });
    await expect(checkProblemSupport('leetcode', 'missing', 'tr')).resolves.toEqual({
      type: 'unsupported',
      reason: 'Problem katalogda bulunamadı.',
    });
  });
});
