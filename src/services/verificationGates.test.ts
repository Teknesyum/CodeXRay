import { describe, expect, it } from 'vitest';
import { validateProblemSpec, validateDpFamilyContract, runVerificationGates } from './verificationGates';
import type { ProblemSpecV2, DpFamilyContractV2 } from '../types/godMode';

describe('Verification Gates for Mega Update', () => {
  const validProblem: ProblemSpecV2 = {
    version: 2,
    platform: 'LeetCode',
    problemId: '516',
    title: 'Longest Palindromic Subsequence',
    family: 'dp',
    statement: 'Given a string s, find the longest palindromic subsequence length in s.',
    signature: {
      language: 'java',
      name: 'longestPalindromeSubseq',
      parameters: [{ name: 's', type: 'String' }],
      returnType: 'int',
    },
    constraints: ['1 <= s.length <= 1000', 's consists only of lowercase English letters.'],
    examples: [{ input: '"bbbab"', output: '4', explanation: 'One possible longest palindromic subsequence is "bbbb".' }],
    edgeCases: ['s.length == 1'],
    requestedComplexity: { time: 'O(n^2)', space: 'O(n^2)' },
    focus: {},
    provenance: { title: 'registry' }
  };

  const validDpContract: DpFamilyContractV2 = {
    version: 2,
    family: 'dp',
    technique: 'interval',
    stateVariables: [{ name: 'dp[i][j]', meaning: 'LPS length in s[i..j]' }],
    invariants: ['Before dp[i][j] is calculated, smaller intervals are final.'],
    transitionRules: ['if match: 2 + inner else max(left, right)'],
    initialization: ['dp[i][i] = 1'],
    iterationOrder: 'increasing interval length',
    termination: 'interval covers 0 to n-1',
    sourceControlFlow: 'nested loops: len from 2 to n, i from 0 to n-len',
    complexity: { time: 'O(n^2)', space: 'O(n^2)' },
    semanticRoles: { nodes: [], edges: [] },
    checkpoints: [{ name: 'Match', condition: 's[i] == s[j]', focus: 'Data and Visual' }]
  };

  it('validates a complete ProblemSpecV2', () => {
    expect(validateProblemSpec(validProblem)).toBe(true);
    expect(validateProblemSpec({ ...validProblem, title: '' })).toBe(false);
  });

  it('validates a complete DpFamilyContractV2', () => {
    expect(validateDpFamilyContract(validDpContract)).toBe(true);
    // @ts-ignore intentionally invalid
    expect(validateDpFamilyContract({ ...validDpContract, family: 'array' })).toBe(false);
  });

  it('aggregates VerificationGatesV1 correctly', () => {
    const gates = runVerificationGates(
      validProblem,
      validDpContract,
      true, true, true, true, true, true, true, true, true, true
    );
    expect(gates.schemaValid).toBe(true);
    expect(gates.traceDeterministic).toBe(true);
    expect(gates.transactionSafe).toBe(true);
  });
});
