import { describe, expect, it } from 'vitest';
import type { WorkspaceSnapshotV1 } from '../types/titan';
import { compileDpTemplatePackage, resolveDpTemplateFromRequest } from './dpTemplateCompiler';

const workspace: WorkspaceSnapshotV1 = {
  version: 1,
  algorithmName: 'Custom Code',
  code: '',
  simulationInput: { kind: 'array', text: '[4, 1, 1, 9]' },
  steps: [],
  currentIndex: 0,
  analysis: null,
  inputError: null,
  activePackageId: null,
  packageOutOfSync: false,
};

const finalResult = (template: Parameters<typeof compileDpTemplatePackage>[0]['template'], request: string) =>
  compileDpTemplatePackage({ template, id: `oracle-${request}`, request, locale: 'en', workspace })
    .steps.at(-1)?.visualData.vars.result;

let seed = 0xC0DE;
const randomInt = (minimum: number, maximum: number) => {
  seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
  return minimum + (seed % (maximum - minimum + 1));
};

const randomWord = (length: number) => Array.from(
  { length },
  () => String.fromCharCode(97 + randomInt(0, 3)),
).join('');

describe('deterministic DP template compiler', () => {
  it.each([
    ['LeetCode 198 House Robber çöz ve simüle et', 'house-robber-1d-dp'],
    ['LCS tablosunu yaz ve göster', 'lcs-2d-dp'],
    ['LCS memory optimize O(min(m,n)) kodunu yaz', 'lcs-space-optimized-1d-dp'],
    ['Coin Change Java çözümünü yaz ve simüle et', 'coin-change-1d-dp'],
    ['bana coin exchange problemi yaz ve simüle et', 'coin-change-1d-dp'],
    ['LeetCode 72 Edit Distance 2D tabloyla çöz', 'edit-distance-2d-dp'],
    ['0/1 Knapsack Java kodunu yaz ve simüle et', 'knapsack-2d-dp'],
    ['LeetCode 516 longest palindromic subsequence çöz', 'longest-palindrome-interval-dp'],
  ] as const)('recognizes %s', (request, template) => {
    expect(resolveDpTemplateFromRequest(request)).toBe(template);
  });

  it('fills a 1D recurrence from explicit input and grounds take/skip choices', () => {
    const packageValue = compileDpTemplatePackage({
      template: 'house-robber-1d-dp',
      id: 'test',
      request: 'House Robber [2,7,9,3,1] çöz ve simüle et',
      locale: 'tr',
      workspace,
    });
    expect(packageValue.input.value.text).toBe('[2,7,9,3,1]');
    expect(packageValue.source.code).toContain('dp[i] = max(take, skip);');
    expect(packageValue.steps.at(-1)?.visualData.vars.result).toBe(12);
    expect(packageValue.steps[3].visualData.vars).toMatchObject({ i: 2, take: 11, skip: 7, choice: 'take' });
  });

  it('preserves an explicit Java request in the simulatable House Robber source', () => {
    const packageValue = compileDpTemplatePackage({
      template: 'house-robber-1d-dp',
      id: 'java-house-robber',
      request: 'House Robber Java 17 çözümünü [2,7,9,3,1] ile simüle et',
      locale: 'tr',
      workspace,
    });

    expect(packageValue.source).toMatchObject({ language: 'java' });
    expect(packageValue.source.code).toContain('public int rob(int[] nums)');
    expect(packageValue.source.code).toContain('dp[i] = Math.max(take, skip);');
    expect(packageValue.source.code).not.toContain('vector<int>');
    expect(packageValue.steps.at(-1)?.lineNumber).toBe(packageValue.source.lineMap.result);
    expect(packageValue.steps.at(-1)?.visualData.vars.result).toBe(12);
  });

  it('fills a rectangular LCS table row-by-row from exact user strings', () => {
    const packageValue = compileDpTemplatePackage({
      template: 'lcs-2d-dp',
      id: 'test',
      request: 'LCS ["abcde","ace"] çöz ve 2D tabloyu göster',
      locale: 'en',
      workspace,
    });
    const final = packageValue.steps.at(-1)?.visualData;
    expect(final?.type).toBe('matrix');
    if (final?.type !== 'matrix') return;
    expect(final.values).toHaveLength(6);
    expect(final.values[0]).toHaveLength(4);
    expect(final.vars.result).toBe(3);
    expect(packageValue.steps.some((step) => step.visualData.type === 'matrix'
      && step.visualData.highlights.some((cell) => cell.role === 'dependency'))).toBe(true);
  });

  it('compiles LCS into one DP row with O(min(m,n)) memory', () => {
    const packageValue = compileDpTemplatePackage({
      template: 'lcs-space-optimized-1d-dp',
      id: 'optimized-lcs',
      request: 'LCS ["ace","abcde"] bellek optimize kodunu yaz ve simüle et',
      locale: 'en',
      workspace,
    });
    const final = packageValue.steps.at(-1)?.visualData;
    expect(packageValue.source).toMatchObject({ language: 'java' });
    expect(packageValue.source.code).toContain('int[] dp = new int[columns.length() + 1]');
    expect(packageValue.source.code).toContain('diagonal = upper');
    expect(packageValue.analysis).toContain('Space Complexity: O(min(m,n))');
    expect(final?.type).toBe('array');
    if (final?.type !== 'array') return;
    expect(final.values).toHaveLength(4);
    expect(final.vars).toMatchObject({ result: 3, memoryCells: 4 });
    expect(packageValue.steps.some((step) => step.visualData.vars.diagonal !== undefined)).toBe(true);
  });

  it('fills an interval-palindrome table diagonally and records grounded cell diffs', () => {
    const packageValue = compileDpTemplatePackage({
      template: 'longest-palindrome-interval-dp',
      id: 'test',
      request: 'Longest palindromic subsequence "bbbab" çöz ve simüle et',
      locale: 'en',
      workspace,
    });
    expect(packageValue.steps.at(-1)?.visualData.vars.result).toBe(4);
    expect(packageValue.teachingPlan.checkpoints.some(({ narration }) => narration.cellDiffs.length > 0)).toBe(true);
    expect(packageValue.source.code).toContain('dp[i][j] = max(dp[i + 1][j], dp[i][j - 1]);');
  });

  it('solves Coin Change with Java source, unreachable input, and amount zero', () => {
    const standard = compileDpTemplatePackage({
      template: 'coin-change-1d-dp', id: 'coin-standard',
      request: 'Coin Change coins=[1,2,5] amount=11', locale: 'en', workspace,
    });
    const impossible = compileDpTemplatePackage({
      template: 'coin-change-1d-dp', id: 'coin-impossible',
      request: 'Coin Change coins=[2] amount=3', locale: 'en', workspace,
    });
    const zero = compileDpTemplatePackage({
      template: 'coin-change-1d-dp', id: 'coin-zero',
      request: 'Coin Change coins=[2] amount=0', locale: 'en', workspace,
    });
    expect(standard.source).toMatchObject({ language: 'java' });
    expect(standard.source.code).toContain('public int coinChange(int[] coins, int amount)');
    expect(standard.steps.at(-1)?.visualData.vars.result).toBe(3);
    expect(impossible.steps.at(-1)?.visualData.vars.result).toBe(-1);
    expect(zero.steps.at(-1)?.visualData.vars.result).toBe(0);
  });

  it('turns the exact Turkish Coin Exchange request into a complete default simulation', () => {
    const packageValue = compileDpTemplatePackage({
      template: 'coin-change-1d-dp',
      id: 'coin-exchange-default',
      request: 'bana coin exchange problemi yaz ve simüle et',
      locale: 'tr',
      workspace,
    });

    expect(packageValue.input.value.text).toBe('[1,2,5]');
    expect(packageValue.input.value.parameters).toEqual({ amount: '11' });
    expect(packageValue.source).toMatchObject({ language: 'java' });
    expect(packageValue.source.code).toContain('public int coinChange(int[] coins, int amount)');
    expect(packageValue.steps.length).toBeGreaterThan(1);
    expect(packageValue.steps.at(-1)?.visualData.vars.result).toBe(3);
  });

  it('solves LCS and Edit Distance with exact Java signatures and matrix dependencies', () => {
    const lcs = compileDpTemplatePackage({
      template: 'lcs-2d-dp', id: 'lcs-java',
      request: 'LCS ["abcde","ace"]', locale: 'en', workspace,
    });
    const edit = compileDpTemplatePackage({
      template: 'edit-distance-2d-dp', id: 'edit-java',
      request: 'Edit Distance ["horse","ros"]', locale: 'en', workspace,
    });
    const emptyEdit = compileDpTemplatePackage({
      template: 'edit-distance-2d-dp', id: 'edit-empty',
      request: 'Edit Distance ["","abc"]', locale: 'en', workspace,
    });
    expect(lcs.source.code).toContain('public int longestCommonSubsequence(String text1, String text2)');
    expect(lcs.steps.at(-1)?.visualData.vars.result).toBe(3);
    expect(edit.source).toMatchObject({ language: 'java' });
    expect(edit.source.code).toContain('public int minDistance(String word1, String word2)');
    expect(edit.steps.at(-1)?.visualData.vars.result).toBe(3);
    expect(emptyEdit.steps.at(-1)?.visualData.vars.result).toBe(3);
    expect(edit.steps.some((step) => step.visualData.type === 'matrix'
      && step.visualData.highlights.filter((cell) => cell.role === 'dependency').length === 3)).toBe(true);
  });

  it('solves 0/1 Knapsack without reusing an item and exposes both choices', () => {
    const packageValue = compileDpTemplatePackage({
      template: 'knapsack-2d-dp', id: 'knapsack-java',
      request: '0/1 Knapsack weight=[1,3,4,5] value=[1,4,5,7] W=7', locale: 'en', workspace,
    });
    expect(packageValue.source).toMatchObject({ language: 'java' });
    expect(packageValue.source.code).toContain('public int knapsack(int[] weight, int[] value, int W)');
    expect(packageValue.steps.at(-1)?.visualData.vars.result).toBe(9);
    const choices = packageValue.steps.map((step) => step.visualData.vars.choice);
    expect(choices).toContain('take');
    expect(choices).toContain('skip');
    expect(packageValue.analysis).toContain('previous row');
  });

  it('matches independent oracles across randomized Coin Change, LCS, Edit Distance, and Knapsack inputs', () => {
    for (let trial = 0; trial < 30; trial += 1) {
      const coins = Array.from({ length: randomInt(1, 5) }, () => randomInt(1, 8));
      const amount = randomInt(0, 24);
      const coinDp = Array(amount + 1).fill(amount + 1) as number[];
      coinDp[0] = 0;
      for (let current = 1; current <= amount; current += 1) {
        for (const coin of coins) if (coin <= current) {
          coinDp[current] = Math.min(coinDp[current], coinDp[current - coin] + 1);
        }
      }
      const expectedCoins = coinDp[amount] > amount ? -1 : coinDp[amount];
      expect(finalResult('coin-change-1d-dp', `Coin Change coins=${JSON.stringify(coins)} amount=${amount}`))
        .toBe(expectedCoins);

      const first = randomWord(randomInt(1, 5));
      const second = randomWord(randomInt(1, 5));
      const lcs = Array.from({ length: first.length + 1 }, () => Array(second.length + 1).fill(0) as number[]);
      for (let i = 1; i <= first.length; i += 1) for (let j = 1; j <= second.length; j += 1) {
        lcs[i][j] = first[i - 1] === second[j - 1]
          ? lcs[i - 1][j - 1] + 1
          : Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
      expect(finalResult('lcs-2d-dp', `LCS ["${first}","${second}"]`))
        .toBe(lcs[first.length][second.length]);

      const word1 = randomWord(randomInt(0, 5));
      const word2 = randomWord(randomInt(0, 5));
      const edit = Array.from({ length: word1.length + 1 }, () => Array(word2.length + 1).fill(0) as number[]);
      for (let i = 0; i <= word1.length; i += 1) edit[i][0] = i;
      for (let j = 0; j <= word2.length; j += 1) edit[0][j] = j;
      for (let i = 1; i <= word1.length; i += 1) for (let j = 1; j <= word2.length; j += 1) {
        edit[i][j] = word1[i - 1] === word2[j - 1]
          ? edit[i - 1][j - 1]
          : 1 + Math.min(edit[i - 1][j - 1], edit[i - 1][j], edit[i][j - 1]);
      }
      expect(finalResult('edit-distance-2d-dp', `Edit Distance ["${word1}","${word2}"]`))
        .toBe(edit[word1.length][word2.length]);

      const itemCount = randomInt(1, 6);
      const weights = Array.from({ length: itemCount }, () => randomInt(1, 6));
      const values = Array.from({ length: itemCount }, () => randomInt(1, 10));
      const capacity = randomInt(1, 12);
      let expectedKnapsack = 0;
      for (let mask = 0; mask < 2 ** itemCount; mask += 1) {
        let totalWeight = 0;
        let totalValue = 0;
        for (let item = 0; item < itemCount; item += 1) if (mask & (1 << item)) {
          totalWeight += weights[item];
          totalValue += values[item];
        }
        if (totalWeight <= capacity) expectedKnapsack = Math.max(expectedKnapsack, totalValue);
      }
      expect(finalResult('knapsack-2d-dp', `0/1 Knapsack weight=${JSON.stringify(weights)} value=${JSON.stringify(values)} W=${capacity}`))
        .toBe(expectedKnapsack);
    }
  });

  it('preserves the current compatible array only when explicitly requested', () => {
    const current = compileDpTemplatePackage({
      template: 'house-robber-1d-dp', id: 'current',
      request: 'House Robber bu mevcut input ile çöz', locale: 'tr', workspace,
    });
    const canonical = compileDpTemplatePackage({
      template: 'house-robber-1d-dp', id: 'canonical',
      request: 'House Robber çöz', locale: 'tr', workspace,
    });
    expect(current.input.value.text).toBe('[4,1,1,9]');
    expect(canonical.input.value.text).toBe('[2,7,9,3,1]');
  });
});
