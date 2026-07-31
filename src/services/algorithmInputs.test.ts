import { describe, expect, it } from 'vitest';
import { getAlgorithmParameterDefinitions } from './algorithmInputs';

describe('algorithm parameter definitions', () => {
  it.each([
    ['Rabin-Karp Algorithm', ['pattern', 'modulus']],
    ['0/1 Knapsack', ['values', 'capacity']],
    ['Longest Common Subsequence', ['other']],
    ['Sliding Window Maximum', ['windowSize']],
    ['Detect Cycle in Linked List', ['cycleEntry']],
  ])('provides the parameters required by %s', (name, keys) => {
    expect(getAlgorithmParameterDefinitions(name).map((item) => item.key)).toEqual(keys);
  });

  it('returns no unrelated controls for simple algorithms', () => {
    expect(getAlgorithmParameterDefinitions('Quick Sort')).toEqual([]);
    expect(getAlgorithmParameterDefinitions('Depth First Search (DFS)')).toEqual([]);
  });

  it('marks numeric controls so the browser can constrain input', () => {
    const numeric = getAlgorithmParameterDefinitions('Rabin-Karp Algorithm')
      .find((definition) => definition.key === 'modulus');
    expect(numeric?.type).toBe('number');
  });
});
