export interface AlgorithmParameterDefinition {
  key: string;
  labelKey: string;
  placeholderKey: string;
  type?: 'text' | 'number';
}

const definitions: Array<[RegExp, AlgorithmParameterDefinition[]]> = [
  [/KMP|Boyer-Moore/, [
    { key: 'pattern', labelKey: 'pattern', placeholderKey: 'patternHelp' },
  ]],
  [/Rabin-Karp/, [
    { key: 'pattern', labelKey: 'pattern', placeholderKey: 'patternHelp' },
    { key: 'modulus', labelKey: 'modulus', placeholderKey: 'modulusHelp', type: 'number' },
  ]],
  [/Sliding Window Maximum/, [
    { key: 'windowSize', labelKey: 'windowSize', placeholderKey: 'windowSizeHelp', type: 'number' },
  ]],
  [/Trie Insert & Search/, [
    { key: 'query', labelKey: 'searchQuery', placeholderKey: 'searchQueryHelp' },
  ]],
  [/Two Pointers|Binary Search|Ternary Search/, [
    { key: 'target', labelKey: 'searchTarget', placeholderKey: 'searchTargetHelp', type: 'number' },
  ]],
  [/Minimum Window Substring/, [
    { key: 'target', labelKey: 'targetText', placeholderKey: 'targetTextHelp' },
  ]],
  [/0\/1 Knapsack/, [
    { key: 'values', labelKey: 'itemValues', placeholderKey: 'itemValuesHelp' },
    { key: 'capacity', labelKey: 'capacity', placeholderKey: 'capacityHelp', type: 'number' },
  ]],
  [/Longest Common Subsequence|Edit Distance/, [
    { key: 'other', labelKey: 'secondText', placeholderKey: 'secondTextHelp' },
  ]],
  [/Coin Change/, [
    { key: 'amount', labelKey: 'amount', placeholderKey: 'amountHelp', type: 'number' },
  ]],
  [/Detect Cycle in Linked List/, [
    { key: 'cycleEntry', labelKey: 'cycleEntry', placeholderKey: 'cycleEntryHelp', type: 'number' },
  ]],
];

export const getAlgorithmParameterDefinitions = (
  algorithmName: string,
): AlgorithmParameterDefinition[] =>
  definitions.find(([pattern]) => pattern.test(algorithmName))?.[1] ?? [];
