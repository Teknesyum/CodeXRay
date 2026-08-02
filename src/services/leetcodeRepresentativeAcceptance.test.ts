import { describe, expect, it } from 'vitest';
import type { WorkspaceSnapshotV1 } from '../types/godMode';
import { compileArrayTemplatePackage } from './arrayCompiler';
import { compileBacktrackingTemplatePackage } from './backtrackingCompiler';
import { compileDpTemplatePackage, type DpTemplateId } from './dpTemplateCompiler';
import { compileGraphTemplatePackage } from './graphCompiler';
import { compilePredictWinnerPackage } from './intervalDpCompiler';
import { compileLinkedListTemplatePackage } from './linkedListCompiler';
import { compileMatrixTemplatePackage } from './matrixCompiler';
import { compileStringTemplatePackage } from './stringCompiler';
import { compileAdvancedGraphPackage, type AdvancedGraphTemplateId } from './advancedGraphCompiler';
import { compileAdvancedStructurePackage, type AdvancedStructureTemplateId } from './advancedStructureCompiler';
import { routeGodModeRequest } from './godModeRouting';

const workspace: WorkspaceSnapshotV1 = {
  version: 1,
  algorithmName: 'Custom Code',
  code: '',
  simulationInput: { kind: 'array', text: '[9,2,7]' },
  steps: [],
  currentIndex: 0,
  analysis: null,
  inputError: null,
  activePackageId: null,
  packageOutOfSync: false,
};

describe('LeetCode representative acceptance', () => {
  it('passes all five acceptance gates for 486 Predict the Winner', () => {
    const request = 'LeetCode 486 Predict the Winner sorusunu çöz ve simüle et';
    expect(routeGodModeRequest(request, [], 0)).toEqual({
      type: 'create-algorithm',
      template: 'predict-winner-interval-dp',
    });

    const first = compilePredictWinnerPackage({
      id: 'leetcode-486-acceptance',
      request,
      locale: 'tr',
      workspace,
    });
    const repeated = compilePredictWinnerPackage({
      id: 'leetcode-486-acceptance-repeat',
      request,
      locale: 'tr',
      workspace,
    });

    // Source gate: exact problem identity and recurrence are committed.
    expect(first.title).toBe('LeetCode 486 — Kazananı Tahmin Et');
    expect(first.source.language).toBe('cpp');
    expect(first.source.code).toContain('dp[i][j] = max(takeLeft, takeRight);');
    expect(first.source.code).toContain('return dp[0][n - 1] >= 0;');

    // Input gate: the canonical input is complete and parseable.
    expect(first.input.kind).toBe('array');
    expect(JSON.parse(first.input.value.text)).toEqual([8, 15, 3, 7, 10, 2]);

    // Trace gate: replay is deterministic and covers every interval cell.
    expect(first.steps).toEqual(repeated.steps);
    expect(first.steps).toHaveLength(23);
    expect(first.steps.every((step) => step.lineNumber !== null)).toBe(true);

    // Visual gate: matrix transitions expose the active cell and dependencies.
    expect(first.visualization.type).toBe('matrix');
    const transition = first.steps.find((step) => step.visualData.type === 'matrix'
      && step.visualData.highlights.some(({ role }) => role === 'dependency'));
    expect(transition?.visualData.type).toBe('matrix');
    if (transition?.visualData.type === 'matrix') {
      expect(transition.visualData.highlights.filter(({ role }) => role === 'dependency')).toHaveLength(2);
    }

    // Final-result gate: the result is grounded in the final deterministic snapshot.
    expect(first.steps.at(-1)?.visualData.vars).toMatchObject({
      scoreDifference: 3,
      winner: true,
      filledCells: 21,
    });
    expect(first.tests.passed).toBe(true);
    expect(first.checkpoints.length).toBeGreaterThan(3);
    expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(3);
  });

  it.each([
    {
      id: '198',
      template: 'house-robber-1d-dp',
      request: 'LeetCode 198 House Robber [2,7,9,3,1] çöz ve simüle et',
      title: 'LeetCode 198 — House Robber',
      sourceFragment: 'dp[i] = max(take, skip);',
      visualType: 'array',
      result: 12,
    },
    {
      id: '1143',
      template: 'lcs-2d-dp',
      request: 'LeetCode 1143 LCS ["abcde","ace"] çöz ve 2D tabloyu simüle et',
      title: 'LeetCode 1143 — Longest Common Subsequence',
      sourceFragment: 'public int longestCommonSubsequence(String text1, String text2)',
      visualType: 'matrix',
      result: 3,
    },
    {
      id: '322',
      template: 'coin-change-1d-dp',
      request: 'LeetCode 322 Coin Change coins=[1,2,5] amount=11 çöz ve simüle et',
      title: 'LeetCode 322 — Coin Change',
      sourceFragment: 'public int coinChange(int[] coins, int amount)',
      visualType: 'array',
      result: 3,
    },
    {
      id: '72',
      template: 'edit-distance-2d-dp',
      request: 'LeetCode 72 Edit Distance ["horse","ros"] çöz ve 2D tabloyu simüle et',
      title: 'LeetCode 72 — Edit Distance',
      sourceFragment: 'public int minDistance(String word1, String word2)',
      visualType: 'matrix',
      result: 3,
    },
    {
      id: '516',
      template: 'longest-palindrome-interval-dp',
      request: 'LeetCode 516 Longest Palindromic Subsequence "bbbab" çöz ve simüle et',
      title: 'LeetCode 516 — Longest Palindromic Subsequence',
      sourceFragment: 'dp[i][j] = max(dp[i + 1][j], dp[i][j - 1]);',
      visualType: 'matrix',
      result: 4,
    },
  ] as const)(
    'passes all five acceptance gates for LeetCode $id',
    ({ id, template, request, title, sourceFragment, visualType, result }) => {
      expect(routeGodModeRequest(request, [], 0)).toEqual({
        type: 'create-algorithm',
        template,
      });
      const first = compileDpTemplatePackage({
        template: template as DpTemplateId,
        id: `leetcode-${id}-acceptance`,
        request,
        locale: 'en',
        workspace,
      });
      const repeated = compileDpTemplatePackage({
        template: template as DpTemplateId,
        id: `leetcode-${id}-acceptance-repeat`,
        request,
        locale: 'en',
        workspace,
      });

      expect(first.title).toBe(title);
      expect(first.source.code).toContain(sourceFragment);
      expect(first.input.value.text.length).toBeGreaterThan(0);
      expect(first.steps.length).toBeGreaterThan(2);
      expect(first.steps).toEqual(repeated.steps);
      expect(first.visualization.type).toBe(visualType);
      expect(first.steps.at(-1)?.visualData.vars.result).toBe(result);
      expect(first.tests.passed).toBe(true);
      expect(first.checkpoints.length).toBeGreaterThan(1);
      expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(1);
      expect(first.steps.some((step) => step.visualData.type === visualType)).toBe(true);
    },
  );

  it('passes all five acceptance gates for 46 Permutations', () => {
    const compile = (id: string) => compileBacktrackingTemplatePackage({
      template: 'permutations-backtracking',
      id,
      request: 'LeetCode 46 Permutations [1,2,3] çöz ve simüle et',
      locale: 'en',
      workspace,
    });
    const first = compile('leetcode-46-acceptance');
    const repeated = compile('leetcode-46-acceptance-repeat');
    const resultValues = JSON.parse(String(first.steps.at(-1)?.visualData.vars.results)) as number[][];
    const mappedLines = new Set(Object.values(first.source.lineMap));

    expect(first.title).toBe('LeetCode 46 — Permutations');
    expect(first.source.code).toContain('vector<vector<int>> permute(vector<int>& nums)');
    expect(first.input.value.text).toBe('[1,2,3]');
    expect(first.steps).toEqual(repeated.steps);
    expect(first.steps.every((step) => step.lineNumber !== null && mappedLines.has(step.lineNumber))).toBe(true);
    expect(first.visualization.type).toBe('array');
    expect(resultValues).toHaveLength(6);
    expect(new Set(resultValues.map((value) => JSON.stringify(value))).size).toBe(6);
    expect(first.tests.passed).toBe(true);
    expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(1);
  });

  it('passes all five acceptance gates for 78 Subsets', () => {
    const compile = (id: string) => compileBacktrackingTemplatePackage({
      template: 'subsets-backtracking',
      id,
      request: 'LeetCode 78 Subsets [1,2,3] çöz ve simüle et',
      locale: 'en',
      workspace,
    });
    const first = compile('leetcode-78-acceptance');
    const repeated = compile('leetcode-78-acceptance-repeat');
    const resultValues = first.steps.at(-1)?.visualData.vars.results as number[][];
    const mappedLines = new Set(Object.values(first.source.lineMap));

    expect(first.title).toBe('LeetCode 78 — Subsets');
    expect(first.source.code).toContain('vector<vector<int>> subsets(vector<int>& nums)');
    expect(first.input.value.text).toBe('[1,2,3]');
    expect(first.steps).toEqual(repeated.steps);
    expect(first.steps.every((step) => step.lineNumber !== null && mappedLines.has(step.lineNumber))).toBe(true);
    expect(first.visualization.type).toBe('array');
    expect(resultValues).toHaveLength(8);
    expect(new Set(resultValues.map((value) => JSON.stringify(value))).size).toBe(8);
    expect(first.tests.passed).toBe(true);
    expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(1);
  });

  it('passes all five acceptance gates for 77 Combinations', () => {
    const compile = (id: string) => compileBacktrackingTemplatePackage({
      template: 'combinations-backtracking',
      id,
      request: 'LeetCode 77 Combinations n=4 k=2 solve and simulate',
      locale: 'en',
      workspace,
    });
    const first = compile('leetcode-77-acceptance');
    const repeated = compile('leetcode-77-acceptance-repeat');
    const resultValues = first.steps
      .filter((step) => step.lineNumber === 11)
      .map((step) => step.visualData.vars.current as number[]);
    const mappedLines = new Set(Object.values(first.source.lineMap));

    expect(first.title).toBe('LeetCode 77 — Combinations');
    expect(first.source.code).toContain('vector<vector<int>> combine(int n, int k)');
    expect(first.input.value.parameters).toEqual({ n: '4', k: '2' });
    expect(first.steps).toEqual(repeated.steps);
    expect(first.steps.every((step) => step.lineNumber !== null && mappedLines.has(step.lineNumber))).toBe(true);
    expect(resultValues).toEqual([[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]);
    expect(first.steps.at(-2)?.visualData.vars.results).toHaveLength(6);
    expect(first.tests.passed).toBe(true);
    expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(1);
  });

  it('passes all five acceptance gates for 206 Reverse Linked List', () => {
    const compile = (id: string) => compileLinkedListTemplatePackage({
      template: 'reverse-linked-list',
      id,
      request: 'LeetCode 206 Reverse Linked List çöz ve simüle et',
      locale: 'en',
      workspace,
    });
    const first = compile('leetcode-206-acceptance');
    const repeated = compile('leetcode-206-acceptance-repeat');
    const finalVisual = first.steps.at(-1)?.visualData;

    expect(first.title).toBe('LeetCode 206 — Reverse Linked List');
    expect(first.source.code).toContain('ListNode* reverseList(ListNode* head)');
    expect(first.input.value.kind).toBe('graph');
    expect(first.steps).toEqual(repeated.steps);
    expect(first.visualization.type).toBe('graph');
    expect(first.steps.some((step) => step.visualData.type === 'graph'
      && step.visualData.edges.some(({ state }) => state === 'active'))).toBe(true);
    expect(finalVisual?.type).toBe('graph');
    if (finalVisual?.type === 'graph') {
      expect(finalVisual.edges.map(({ from, to }) => `${from}->${to}`).sort()).toEqual([
        '2->1', '3->2', '4->3', '5->4',
      ]);
      expect(finalVisual.vars).toMatchObject({ prev: '5', curr: 'null' });
    }
    expect(first.tests.passed).toBe(true);
    expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(1);
  });

  it('passes all five acceptance gates for 141 Linked List Cycle', () => {
    const compile = (id: string) => compileLinkedListTemplatePackage({
      template: 'cycle-linked-list',
      id,
      request: 'LeetCode 141 Linked List Cycle çöz ve simüle et',
      locale: 'en',
      workspace,
    });
    const first = compile('leetcode-141-acceptance');
    const repeated = compile('leetcode-141-acceptance-repeat');
    const finalVisual = first.steps.at(-1)?.visualData;

    expect(first.title).toBe('LeetCode 141 — Linked List Cycle');
    expect(first.source.code).toContain('bool hasCycle(ListNode* head)');
    expect(first.input.value.kind).toBe('graph');
    expect(first.input.value.graph?.edges.map(({ from, to }) => `${from}->${to}`)).toContain('4->2');
    expect(first.steps).toEqual(repeated.steps);
    expect(first.visualization.type).toBe('graph');
    expect(first.steps.some((step) => step.visualData.type === 'graph'
      && step.visualData.edges.some(({ state }) => state === 'active'))).toBe(true);
    expect(finalVisual?.type).toBe('graph');
    if (finalVisual?.type === 'graph') {
      expect(finalVisual.vars).toMatchObject({ slow: '4', fast: '4', hasCycle: true });
    }
    expect(first.tests.passed).toBe(true);
    expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(1);
  });

  it('passes all five acceptance gates for 1971 Find if Path Exists in Graph', () => {
    const compile = (id: string) => compileGraphTemplatePackage({
      template: 'bfs-graph',
      id,
      request: 'LeetCode 1971 Find if Path Exists in Graph çöz ve simüle et',
      locale: 'en',
      workspace,
    });
    const first = compile('leetcode-1971-acceptance');
    const repeated = compile('leetcode-1971-acceptance-repeat');
    const finalVisual = first.steps.at(-1)?.visualData;
    const mappedLines = new Set(Object.values(first.source.lineMap));

    expect(first.title).toBe('LeetCode 1971 — Find if Path Exists in Graph');
    expect(first.source.code).toContain('bool validPath(int n, vector<vector<int>>& edges, int source, int destination)');
    expect(first.input.value.kind).toBe('graph');
    expect(first.input.value.graph).toMatchObject({ startId: 'A', targetId: 'D' });
    expect(first.steps).toEqual(repeated.steps);
    expect(first.steps.every((step) => step.lineNumber !== null && mappedLines.has(step.lineNumber))).toBe(true);
    expect(first.visualization.type).toBe('graph');
    expect(first.steps.some((step) => step.visualData.type === 'graph'
      && step.visualData.edges.some(({ state }) => state === 'active'))).toBe(true);
    expect(finalVisual?.type).toBe('graph');
    if (finalVisual?.type === 'graph') {
      expect(finalVisual.vars).toMatchObject({ result: true, path: ['A', 'B', 'D'] });
      expect(finalVisual.nodes.filter(({ state }) => state === 'path').map(({ id }) => id)).toEqual(['A', 'B', 'D']);
      expect(finalVisual.edges.filter(({ state }) => state === 'path')).toHaveLength(2);
    }
    expect(first.tests.passed).toBe(true);
    expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(1);
  });

  it('passes all five acceptance gates for 167 Two Sum II', () => {
    const compile = (id: string) => compileArrayTemplatePackage({
      template: 'two-pointers-array',
      id,
      request: 'LeetCode 167 Two Sum II numbers=[2,7,11,15] target=9 çöz ve simüle et',
      locale: 'en',
      workspace,
    });
    const first = compile('leetcode-167-acceptance');
    const repeated = compile('leetcode-167-acceptance-repeat');

    expect(first.title).toBe('LeetCode 167 — Two Sum II - Input Array Is Sorted');
    expect(first.source.code).toContain('vector<int> twoSum(vector<int>& numbers, int target)');
    expect(first.input.value).toMatchObject({
      kind: 'array',
      text: '[2,7,11,15]',
      parameters: { target: '9' },
    });
    expect(first.steps).toEqual(repeated.steps);
    expect(first.visualization.type).toBe('array');
    expect(first.steps.some((step) => step.visualData.vars.sum === 9)).toBe(true);
    expect(first.steps.at(-1)?.visualData.vars).toMatchObject({ result: [1, 2] });
    expect(first.tests.passed).toBe(true);
    expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(1);
  });

  it('passes all five acceptance gates for 704 Binary Search', () => {
    const compile = (id: string) => compileArrayTemplatePackage({
      template: 'binary-search-array',
      id,
      request: 'LeetCode 704 Binary Search nums=[-1,0,3,5,9,12] target=9 çöz ve simüle et',
      locale: 'en',
      workspace,
    });
    const first = compile('leetcode-704-acceptance');
    const repeated = compile('leetcode-704-acceptance-repeat');
    const mappedLines = new Set(Object.values(first.source.lineMap));

    expect(first.title).toBe('LeetCode 704 — Binary Search');
    expect(first.source.code).toContain('int search(vector<int>& nums, int target)');
    expect(first.input.value).toMatchObject({
      text: '[-1,0,3,5,9,12]', parameters: { target: '9' },
    });
    expect(first.steps).toEqual(repeated.steps);
    expect(first.steps.every((step) => step.lineNumber !== null && mappedLines.has(step.lineNumber))).toBe(true);
    expect(first.steps.at(-1)?.visualData.vars).toMatchObject({ result: 4 });
    expect(first.tests.passed).toBe(true);
    expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(1);
  });

  it('passes all five acceptance gates for 9 Palindrome Number', () => {
    const compile = (id: string) => compileArrayTemplatePackage({
      template: 'palindrome-number', id,
      request: 'LeetCode 9 Palindrome Number x=12321 solve and simulate',
      locale: 'en', workspace,
    });
    const first = compile('leetcode-9-acceptance');
    const repeated = compile('leetcode-9-acceptance-repeat');
    const mappedLines = new Set(Object.values(first.source.lineMap));

    expect(first.title).toBe('LeetCode 9 — Palindrome Number');
    expect(first.source.code).toContain('bool isPalindrome(int x)');
    expect(first.input.value.parameters).toEqual({ x: '12321' });
    expect(first.steps).toEqual(repeated.steps);
    expect(first.steps.every((step) => step.lineNumber !== null && mappedLines.has(step.lineNumber))).toBe(true);
    expect(first.steps.at(-1)?.visualData.vars.result).toBe(true);
    expect(first.tests.passed).toBe(true);
  });

  it.each([
    {
      id: '209',
      template: 'sliding-window-array',
      request: 'LeetCode 209 Minimum Size Subarray Sum nums=[2,3,1,2,4,3] target=7 solve and simulate',
      title: 'LeetCode 209 — Minimum Size Subarray Sum',
      sourceFragment: 'int minSubArrayLen(int target, vector<int>& nums)',
      parameters: { target: '7' },
      result: 2,
    },
    {
      id: '560',
      template: 'prefix-sum-array',
      request: 'LeetCode 560 Subarray Sum Equals K nums=[1,1,1] k=2 solve and simulate',
      title: 'LeetCode 560 — Subarray Sum Equals K',
      sourceFragment: 'int subarraySum(vector<int>& nums, int k)',
      parameters: { k: '2' },
      result: 2,
    },
  ] as const)('passes all five acceptance gates for LeetCode $id', ({
    id, template, request, title, sourceFragment, parameters, result,
  }) => {
    const compile = (packageId: string) => compileArrayTemplatePackage({
      template,
      id: packageId,
      request,
      locale: 'en',
      workspace,
    });
    const first = compile(`leetcode-${id}-acceptance`);
    const repeated = compile(`leetcode-${id}-acceptance-repeat`);
    const mappedLines = new Set(Object.values(first.source.lineMap));

    expect(first.title).toBe(title);
    expect(first.source.code).toContain(sourceFragment);
    expect(first.input.value.parameters).toEqual(parameters);
    expect(first.steps).toEqual(repeated.steps);
    expect(first.steps.every((step) => step.lineNumber !== null && mappedLines.has(step.lineNumber))).toBe(true);
    expect(first.visualization.type).toBe('array');
    expect(first.steps.at(-1)?.visualData.vars.result).toBe(result);
    expect(first.tests.passed).toBe(true);
    expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(1);
  });

  it('passes all five acceptance gates for 54 Spiral Matrix', () => {
    const request = 'LeetCode 54 Spiral Matrix [[1,2,3],[4,5,6],[7,8,9]] solve and simulate';
    const compile = (id: string) => compileMatrixTemplatePackage({
      template: 'spiral-matrix', id, request, locale: 'en', workspace,
    });
    const first = compile('leetcode-54-acceptance');
    const repeated = compile('leetcode-54-acceptance-repeat');
    const mappedLines = new Set(Object.values(first.source.lineMap));

    expect(first.title).toBe('LeetCode 54 — Spiral Matrix');
    expect(first.source.code).toContain('vector<int> spiralOrder(vector<vector<int>>& matrix)');
    expect(JSON.parse(first.input.value.text)).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    expect(first.steps).toEqual(repeated.steps);
    expect(first.steps.every((step) => step.lineNumber !== null && mappedLines.has(step.lineNumber))).toBe(true);
    expect(first.visualization.type).toBe('matrix');
    expect(first.steps.at(-1)?.visualData.vars).toMatchObject({
      result: [1, 2, 3, 6, 9, 8, 7, 4, 5], visitedCells: 9,
    });
    expect(first.tests.passed).toBe(true);
    expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(1);
  });

  it.each([
    ['841', 'keys-and-rooms-dfs', 'bool canVisitAllRooms', true],
    ['207', 'course-schedule-topological', 'bool canFinish', true],
    ['743', 'network-delay-dijkstra', 'int networkDelayTime', 2],
    ['1584', 'min-cost-connect-points-mst', 'int minCostConnectPoints', 20],
    ['684', 'redundant-connection-union-find', 'vector<int> findRedundantConnection', [2, 3]],
    ['847', 'shortest-path-all-nodes-bitmask', 'int shortestPathLength', 4],
  ] as const)('passes all five acceptance gates for advanced graph LeetCode %s', (id, template, signature, result) => {
    const compile = (packageId: string) => compileAdvancedGraphPackage({
      template: template as AdvancedGraphTemplateId, id: packageId,
      request: `Create catalog problem: leetcode/${id}`, locale: 'en', workspace,
    });
    const first = compile(`leetcode-${id}-acceptance`);
    const repeated = compile(`leetcode-${id}-acceptance-repeat`);
    const mappedLines = new Set(Object.values(first.source.lineMap));
    expect(first.source.code).toContain(signature);
    expect(first.input.value.graph?.nodes.length).toBeGreaterThan(2);
    expect(first.input.value.graph?.nodes.every((node) => (
      node.x >= 18 && node.x <= 82 && node.y >= 16 && node.y <= 76
    ))).toBe(true);
    expect(new Set(first.input.value.graph?.nodes.map((node) => `${node.x}:${node.y}`)).size)
      .toBe(first.input.value.graph?.nodes.length);
    expect(first.steps).toEqual(repeated.steps);
    expect(first.steps.every((item) => item.lineNumber !== null && mappedLines.has(item.lineNumber))).toBe(true);
    expect(first.steps.some((item) => item.visualData.type === 'graph' && item.visualData.edges.some((edge) => edge.state === 'active'))).toBe(true);
    expect(first.steps.at(-1)?.visualData.vars.result).toEqual(result);
    expect(first.tests.passed).toBe(true);
  });

  it.each([
    ['98', 'validate-bst', 'bool isValidBST', true, 'graph'],
    ['337', 'house-robber-tree-dp', 'int rob', 7, 'graph'],
    ['208', 'implement-trie', 'class Trie', true, 'graph'],
    ['307', 'range-sum-segment-tree', 'class NumArray', 8, 'array'],
  ] as const)('passes all five acceptance gates for structure LeetCode %s', (id, template, signature, result, visualType) => {
    const compile = (packageId: string) => compileAdvancedStructurePackage({
      template: template as AdvancedStructureTemplateId, id: packageId,
      request: `Create catalog problem: leetcode/${id}`, locale: 'en', workspace,
    });
    const first = compile(`leetcode-${id}-acceptance`), repeated = compile(`leetcode-${id}-acceptance-repeat`);
    const mappedLines = new Set(Object.values(first.source.lineMap));
    expect(first.source.code).toContain(signature);
    expect(first.steps).toEqual(repeated.steps);
    expect(first.steps.every((item) => item.lineNumber !== null && mappedLines.has(item.lineNumber))).toBe(true);
    expect(first.visualization.type).toBe(visualType);
    expect(first.steps.at(-1)?.visualData.vars.result).toEqual(result);
    expect(first.tests.passed).toBe(true);
  });

  it.each([
    {
      id: '3',
      template: 'sliding-window-string',
      request: 'LeetCode 3 Longest Substring Without Repeating Characters "abcabcbb" çöz ve simüle et',
      title: 'LeetCode 3 — Longest Substring Without Repeating Characters',
      sourceFragment: 'int lengthOfLongestSubstring(string s)',
      result: 3,
    },
    {
      id: '125',
      template: 'two-pointers-string',
      request: 'LeetCode 125 Valid Palindrome "A man, a plan, a canal: Panama" çöz ve simüle et',
      title: 'LeetCode 125 — Valid Palindrome',
      sourceFragment: 'bool isPalindrome(string s)',
      result: true,
    },
  ] as const)('passes all five acceptance gates for LeetCode $id', ({
    id, template, request, title, sourceFragment, result,
  }) => {
    const compile = (packageId: string) => compileStringTemplatePackage({
      template,
      id: packageId,
      request,
      locale: 'en',
      workspace,
    });
    const first = compile(`leetcode-${id}-acceptance`);
    const repeated = compile(`leetcode-${id}-acceptance-repeat`);
    const mappedLines = new Set(Object.values(first.source.lineMap));

    expect(first.title).toBe(title);
    expect(first.source.code).toContain(sourceFragment);
    expect(first.input.value.kind).toBe('string');
    expect(first.steps).toEqual(repeated.steps);
    expect(first.steps.every((step) => step.lineNumber !== null && mappedLines.has(step.lineNumber))).toBe(true);
    expect(first.visualization.type).toBe('array');
    expect(first.steps.at(-1)?.visualData.vars.result).toBe(result);
    expect(first.tests.passed).toBe(true);
    expect(first.teachingPlan.checkpoints.length).toBeGreaterThan(1);
  });
});
