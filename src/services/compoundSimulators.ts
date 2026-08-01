import type {
  ArrayVisualData,
  SimulationInput,
  SimulationStep,
  TracePrimitive,
  TraceValue,
  VariablesVisualData,
} from '../types/simulation';
import { parseArrayInput, parseStringInput } from './inputParsers';

type Emit = (
  explanation: string,
  vars?: Record<string, TraceValue>,
  pointers?: Record<string, number>,
  shown?: TracePrimitive[],
) => void;

const arrayEmitter = (steps: SimulationStep[], source: TracePrimitive[]): Emit =>
  (explanation, vars = {}, pointers = {}, shown = source) => {
    const visualData: ArrayVisualData = {
      type: 'array',
      values: [...shown],
      pointers: { ...pointers },
      vars: { source: [...source], ...vars },
    };
    steps.push({ lineNumber: null, visualData, explanation });
  };

const variableEmitter = (steps: SimulationStep[]): Emit =>
  (explanation, vars = {}) => {
    const visualData: VariablesVisualData = { type: 'variables', vars };
    steps.push({ lineNumber: null, visualData, explanation });
  };

const requiredParameter = (input: SimulationInput, key: string, label: string): string => {
  const value = input.parameters?.[key]?.trim();
  if (!value) throw new Error(`${label} is required.`);
  return value;
};

const numericParameter = (
  input: SimulationInput,
  key: string,
  label: string,
  options: { integer?: boolean; min?: number } = {},
): number => {
  const raw = requiredParameter(input, key, label);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  if (options.integer && !Number.isInteger(value)) throw new Error(`${label} must be an integer.`);
  if (options.min !== undefined && value < options.min) {
    throw new Error(`${label} must be at least ${options.min}.`);
  }
  return value;
};

const stringSearchInput = (input: SimulationInput) => ({
  text: parseStringInput(input.text),
  pattern: requiredParameter(input, 'pattern', 'Pattern'),
});

const kmp = (input: SimulationInput): SimulationStep[] => {
  const { text, pattern } = stringSearchInput(input);
  const steps: SimulationStep[] = [];
  const emit = variableEmitter(steps);
  const lps = Array(pattern.length).fill(0) as number[];
  emit('Initialize the KMP prefix table.', { text, pattern, lps: [...lps] });
  for (let i = 1, length = 0; i < pattern.length;) {
    if (pattern[i] === pattern[length]) {
      length += 1;
      lps[i] = length;
      emit('Extend the KMP prefix table.', { text, pattern, lps: [...lps], i, length });
      i += 1;
    } else if (length > 0) {
      length = lps[length - 1];
    } else {
      lps[i] = 0;
      i += 1;
    }
  }
  const matches: number[] = [];
  for (let i = 0, j = 0; i < text.length;) {
    if (text[i] === pattern[j]) {
      i += 1;
      j += 1;
      emit('Compare text and pattern with the KMP prefix table.', { text, pattern, lps, matches: [...matches], i, j });
      if (j === pattern.length) {
        matches.push(i - j);
        j = lps[j - 1];
      }
    } else if (j > 0) {
      j = lps[j - 1];
    } else {
      i += 1;
    }
  }
  emit('KMP search is complete.', { text, pattern, lps, matches });
  return steps;
};

const rabinKarp = (input: SimulationInput): SimulationStep[] => {
  const { text, pattern } = stringSearchInput(input);
  const modulus = numericParameter(input, 'modulus', 'Modulus', { integer: true, min: 2 });
  const steps: SimulationStep[] = [];
  const emit = variableEmitter(steps);
  const base = 256;
  let high = 1;
  let patternHash = 0;
  let windowHash = 0;
  for (let i = 0; i < pattern.length - 1; i += 1) high = (high * base) % modulus;
  for (let i = 0; i < pattern.length; i += 1) {
    patternHash = (base * patternHash + pattern.charCodeAt(i)) % modulus;
    windowHash = (base * windowHash + (text.charCodeAt(i) || 0)) % modulus;
  }
  const matches: number[] = [];
  emit('Initialize the Rabin-Karp rolling hashes.', { text, pattern, modulus, patternHash, windowHash });
  if (pattern.length <= text.length) {
    for (let index = 0; index <= text.length - pattern.length; index += 1) {
      const hashMatches = patternHash === windowHash;
      if (hashMatches && text.slice(index, index + pattern.length) === pattern) matches.push(index);
      emit('Check the current Rabin-Karp window.', {
        index, patternHash, windowHash, hashMatches, matches: [...matches],
      });
      if (index < text.length - pattern.length) {
        windowHash = (
          base * (windowHash - text.charCodeAt(index) * high)
          + text.charCodeAt(index + pattern.length)
        ) % modulus;
        if (windowHash < 0) windowHash += modulus;
      }
    }
  }
  emit('Rabin-Karp search is complete.', { text, pattern, modulus, matches });
  return steps;
};

const boyerMoore = (input: SimulationInput): SimulationStep[] => {
  const { text, pattern } = stringSearchInput(input);
  const steps: SimulationStep[] = [];
  const emit = variableEmitter(steps);
  const last: Record<string, number> = {};
  [...pattern].forEach((character, index) => { last[character] = index; });
  const matches: number[] = [];
  emit('Build the Boyer-Moore bad-character table.', { text, pattern, last });
  let shift = 0;
  while (shift <= text.length - pattern.length) {
    let index = pattern.length - 1;
    while (index >= 0 && pattern[index] === text[shift + index]) index -= 1;
    if (index < 0) {
      matches.push(shift);
      shift += shift + pattern.length < text.length
        ? pattern.length - (last[text[shift + pattern.length]] ?? -1)
        : 1;
    } else {
      shift += Math.max(1, index - (last[text[shift + index]] ?? -1));
    }
    emit('Shift the Boyer-Moore pattern.', { text, pattern, last, shift, matches: [...matches] });
  }
  emit('Boyer-Moore search is complete.', { text, pattern, matches });
  return steps;
};

const slidingWindowMaximum = (input: SimulationInput): SimulationStep[] => {
  const source = parseArrayInput(input.text);
  const windowSize = numericParameter(input, 'windowSize', 'Window size', { integer: true, min: 1 });
  if (windowSize > source.length) throw new Error('Window size cannot exceed the array length.');
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, source);
  const deque: number[] = [];
  const maxima: number[] = [];
  emit('Initialize the monotonic window deque.', { windowSize, deque, maxima });
  source.forEach((value, index) => {
    while (deque.length && deque[0] <= index - windowSize) deque.shift();
    while (deque.length && source[deque.at(-1)!] <= value) deque.pop();
    deque.push(index);
    if (index >= windowSize - 1) maxima.push(source[deque[0]]);
    emit('Advance the maximum window.', { windowSize, deque: [...deque], maxima: [...maxima] }, { index, maximum: deque[0] });
  });
  emit('Sliding-window maxima are complete.', { windowSize, maxima });
  return steps;
};

interface TrieNode {
  children: Record<string, TrieNode>;
  terminal: boolean;
}

const trieInsertSearch = (input: SimulationInput): SimulationStep[] => {
  const words = parseStringInput(input.text).split(/[\s,]+/).filter(Boolean);
  if (!words.length) throw new Error('Provide at least one word for the trie.');
  const query = requiredParameter(input, 'query', 'Search query');
  const steps: SimulationStep[] = [];
  const emit = variableEmitter(steps);
  const root: TrieNode = { children: {}, terminal: false };
  const inserted: string[] = [];
  emit('Initialize an empty trie.', { words, query, inserted });
  for (const word of words) {
    let node = root;
    for (const character of word) {
      node.children[character] ??= { children: {}, terminal: false };
      node = node.children[character];
    }
    node.terminal = true;
    inserted.push(word);
    emit('Insert a word into the trie.', { words, query, inserted: [...inserted], currentWord: word });
  }
  let node: TrieNode | undefined = root;
  for (let index = 0; index < query.length; index += 1) {
    node = node?.children[query[index]];
    emit('Follow the trie search path.', { query, index, character: query[index], pathExists: Boolean(node) });
    if (!node) break;
  }
  const found = Boolean(node?.terminal);
  emit('Trie search is complete.', { words, query, found });
  return steps;
};

const twoPointers = (input: SimulationInput): SimulationStep[] => {
  const source = parseArrayInput(input.text);
  const target = numericParameter(input, 'target', 'Target');
  const sorted = source.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const shown = sorted.map((item) => item.value);
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, shown);
  let left = 0;
  let right = sorted.length - 1;
  let pair: number[] = [];
  emit('Sort values and initialize two pointers.', { target }, { left, right });
  while (left < right) {
    const sum = sorted[left].value + sorted[right].value;
    emit('Compare the two-pointer sum with the target.', { target, sum }, { left, right });
    if (sum === target) {
      pair = [sorted[left].index, sorted[right].index];
      break;
    }
    if (sum < target) left += 1;
    else right -= 1;
  }
  emit('Two-pointer search is complete.', { target, pair, found: pair.length === 2 }, { left, right });
  return steps;
};

const minimumWindow = (input: SimulationInput): SimulationStep[] => {
  const source = parseStringInput(input.text);
  const target = requiredParameter(input, 'target', 'Target text');
  const steps: SimulationStep[] = [];
  const emit = variableEmitter(steps);
  const need: Record<string, number> = {};
  for (const character of target) need[character] = (need[character] ?? 0) + 1;
  const have: Record<string, number> = {};
  let formed = 0;
  let left = 0;
  let bestStart = 0;
  let bestLength = Number.POSITIVE_INFINITY;
  emit('Initialize the minimum-window counters.', { source, target, need, best: '' });
  for (let right = 0; right < source.length; right += 1) {
    const character = source[right];
    have[character] = (have[character] ?? 0) + 1;
    if (need[character] && have[character] === need[character]) formed += 1;
    while (formed === Object.keys(need).length) {
      if (right - left + 1 < bestLength) {
        bestStart = left;
        bestLength = right - left + 1;
      }
      const removed = source[left];
      have[removed] -= 1;
      if (need[removed] && have[removed] < need[removed]) formed -= 1;
      left += 1;
    }
    emit('Expand and contract the minimum window.', {
      source, target, left, right, formed,
      best: Number.isFinite(bestLength) ? source.slice(bestStart, bestStart + bestLength) : '',
    });
  }
  const window = Number.isFinite(bestLength) ? source.slice(bestStart, bestStart + bestLength) : '';
  emit('Minimum-window search is complete.', { source, target, window, start: window ? bestStart : -1 });
  return steps;
};

const mergeIntervals = (input: SimulationInput): SimulationStep[] => {
  const flat = parseArrayInput(input.text);
  if (flat.length % 2 !== 0) throw new Error('Intervals require an even number of start/end values.');
  const intervals: number[][] = [];
  for (let index = 0; index < flat.length; index += 2) {
    intervals.push([Math.min(flat[index], flat[index + 1]), Math.max(flat[index], flat[index + 1])]);
  }
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, flat);
  const merged: number[][] = [];
  emit('Sort intervals by their start value.', { intervals, merged });
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (!last || interval[0] > last[1]) merged.push([...interval]);
    else last[1] = Math.max(last[1], interval[1]);
    emit('Merge the current interval when ranges overlap.', { intervals, current: interval, merged: merged.map((item) => [...item]) });
  }
  emit('Interval merging is complete.', { intervals, merged });
  return steps;
};

const requireSorted = (source: number[]) => {
  if (source.some((value, index) => index > 0 && source[index - 1] > value)) {
    throw new Error('Search input must be sorted in non-decreasing order.');
  }
};

const binarySearch = (input: SimulationInput): SimulationStep[] => {
  const source = parseArrayInput(input.text);
  requireSorted(source);
  const target = numericParameter(input, 'target', 'Target');
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, source);
  let left = 0;
  let right = source.length - 1;
  let foundIndex = -1;
  emit('Initialize the binary-search range.', { target, foundIndex }, { left, right });
  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    emit('Inspect the binary-search midpoint.', { target, value: source[middle] }, { left, middle, right });
    if (source[middle] === target) {
      foundIndex = middle;
      break;
    }
    if (source[middle] < target) left = middle + 1;
    else right = middle - 1;
  }
  emit(
    'Binary search is complete.',
    { target, foundIndex, found: foundIndex >= 0 },
    foundIndex >= 0 ? { found: foundIndex } : {},
  );
  return steps;
};

const ternarySearch = (input: SimulationInput): SimulationStep[] => {
  const source = parseArrayInput(input.text);
  requireSorted(source);
  const target = numericParameter(input, 'target', 'Target');
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, source);
  let left = 0;
  let right = source.length - 1;
  let foundIndex = -1;
  emit('Initialize the ternary-search range.', { target, foundIndex }, { left, right });
  while (left <= right) {
    const third = Math.floor((right - left) / 3);
    const middle1 = left + third;
    const middle2 = right - third;
    emit('Inspect both ternary-search midpoints.', { target }, { left, middle1, middle2, right });
    if (source[middle1] === target) {
      foundIndex = middle1;
      break;
    }
    if (source[middle2] === target) {
      foundIndex = middle2;
      break;
    }
    if (target < source[middle1]) right = middle1 - 1;
    else if (target > source[middle2]) left = middle2 + 1;
    else {
      left = middle1 + 1;
      right = middle2 - 1;
    }
  }
  emit(
    'Ternary search is complete.',
    { target, foundIndex, found: foundIndex >= 0 },
    foundIndex >= 0 ? { found: foundIndex } : {},
  );
  return steps;
};

const knapsack = (input: SimulationInput): SimulationStep[] => {
  const weights = parseArrayInput(input.text);
  const values = parseArrayInput(requiredParameter(input, 'values', 'Item values'));
  const capacity = numericParameter(input, 'capacity', 'Capacity', { integer: true, min: 0 });
  if (weights.length !== values.length) throw new Error('Weights and values must have the same length.');
  if (weights.some((weight) => !Number.isInteger(weight) || weight < 0)) {
    throw new Error('Knapsack weights must be non-negative integers.');
  }
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, weights);
  const dp = Array(capacity + 1).fill(0) as number[];
  emit('Initialize the knapsack value table.', { weights, values, capacity, dp: [...dp] });
  for (let item = 0; item < weights.length; item += 1) {
    for (let current = capacity; current >= weights[item]; current -= 1) {
      dp[current] = Math.max(dp[current], dp[current - weights[item]] + values[item]);
    }
    emit('Process one knapsack item.', { weights, values, capacity, item, dp: [...dp] }, { item });
  }
  emit('Knapsack optimization is complete.', { weights, values, capacity, maxValue: dp[capacity], dp });
  return steps;
};

const longestCommonSubsequence = (input: SimulationInput): SimulationStep[] => {
  const first = parseStringInput(input.text);
  const second = requiredParameter(input, 'other', 'Second text');
  const steps: SimulationStep[] = [];
  const emit = variableEmitter(steps);
  const dp = Array.from({ length: first.length + 1 }, () => Array(second.length + 1).fill(0) as number[]);
  emit('Initialize the LCS table.', { first, second, row: dp[0] });
  for (let i = 1; i <= first.length; i += 1) {
    for (let j = 1; j <= second.length; j += 1) {
      dp[i][j] = first[i - 1] === second[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
    emit('Complete one LCS table row.', { first, second, rowIndex: i, row: [...dp[i]] });
  }
  let i = first.length;
  let j = second.length;
  const characters: string[] = [];
  while (i > 0 && j > 0) {
    if (first[i - 1] === second[j - 1]) {
      characters.unshift(first[i - 1]);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i -= 1;
    else j -= 1;
  }
  const subsequence = characters.join('');
  emit('LCS reconstruction is complete.', { first, second, subsequence, length: subsequence.length });
  return steps;
};

const editDistance = (input: SimulationInput): SimulationStep[] => {
  const first = parseStringInput(input.text);
  const second = requiredParameter(input, 'other', 'Second text');
  const steps: SimulationStep[] = [];
  const emit = variableEmitter(steps);
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  emit('Initialize the edit-distance table.', { first, second, row: previous });
  for (let i = 1; i <= first.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= second.length; j += 1) {
      current[j] = first[i - 1] === second[j - 1]
        ? previous[j - 1]
        : 1 + Math.min(previous[j], current[j - 1], previous[j - 1]);
    }
    previous = current;
    emit('Complete one edit-distance table row.', { first, second, rowIndex: i, row: [...current] });
  }
  emit('Edit-distance calculation is complete.', { first, second, distance: previous[second.length] });
  return steps;
};

const coinChange = (input: SimulationInput): SimulationStep[] => {
  const coins = parseArrayInput(input.text);
  const amount = numericParameter(input, 'amount', 'Amount', { integer: true, min: 0 });
  if (coins.some((coin) => !Number.isInteger(coin) || coin <= 0)) {
    throw new Error('Coin denominations must be positive integers.');
  }
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, coins);
  const dp = Array(amount + 1).fill(Number.POSITIVE_INFINITY) as number[];
  dp[0] = 0;
  emit('Initialize the coin-change table.', { coins, amount, reachable: [0] });
  for (const coin of coins) {
    for (let current = coin; current <= amount; current += 1) {
      dp[current] = Math.min(dp[current], dp[current - coin] + 1);
    }
    emit('Process one coin denomination.', {
      coins, amount, coin,
      table: dp.map((value) => Number.isFinite(value) ? value : null),
    });
  }
  const minCoins = Number.isFinite(dp[amount]) ? dp[amount] : -1;
  emit('Coin-change calculation is complete.', { coins, amount, minCoins, possible: minCoins >= 0 });
  return steps;
};

const detectCycle = (input: SimulationInput): SimulationStep[] => {
  const source = parseArrayInput(input.text);
  const cycleEntry = numericParameter(input, 'cycleEntry', 'Cycle entry', { integer: true, min: -1 });
  if (cycleEntry >= source.length) throw new Error('Cycle entry must be -1 or a valid node index.');
  const next = source.map((_, index) =>
    index + 1 < source.length ? index + 1 : cycleEntry >= 0 ? cycleEntry : -1);
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, source);
  let slow = 0;
  let fast = 0;
  let meeting = -1;
  emit('Initialize Floyd cycle-detection pointers.', { next, cycleEntry }, { slow, fast });
  while (fast >= 0 && next[fast] >= 0) {
    slow = next[slow];
    fast = next[next[fast]] ?? -1;
    emit('Advance the slow and fast pointers.', { next, cycleEntry }, { slow, fast });
    if (slow === fast && slow >= 0) {
      meeting = slow;
      break;
    }
  }
  let detectedEntry = -1;
  if (meeting >= 0) {
    slow = 0;
    while (slow !== meeting) {
      slow = next[slow];
      meeting = next[meeting];
      emit('Locate the linked-list cycle entry.', { next, cycleEntry }, { slow, meeting });
    }
    detectedEntry = slow;
  }
  emit('Linked-list cycle detection is complete.', {
    next, hasCycle: detectedEntry >= 0, cycleEntry: detectedEntry,
  }, { slow, fast });
  return steps;
};

export const compoundSimulators: Record<string, (input: SimulationInput) => SimulationStep[]> = {
  kmp,
  rabinKarp,
  boyerMoore,
  slidingWindowMaximum,
  trieInsertSearch,
  twoPointers,
  minimumWindow,
  mergeIntervals,
  binarySearch,
  ternarySearch,
  knapsack,
  lcs: longestCommonSubsequence,
  editDistance,
  coinChange,
  detectCycle,
};
