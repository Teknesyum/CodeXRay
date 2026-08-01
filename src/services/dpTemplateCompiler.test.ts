import { describe, expect, it } from 'vitest';
import type { WorkspaceSnapshotV1 } from '../types/godMode';
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

describe('deterministic DP template compiler', () => {
  it.each([
    ['LeetCode 198 House Robber çöz ve simüle et', 'house-robber-1d-dp'],
    ['LCS tablosunu yaz ve göster', 'lcs-2d-dp'],
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
