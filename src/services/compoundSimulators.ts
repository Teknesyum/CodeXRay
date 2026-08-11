import type {
  ArrayVisualData,
  GraphVisualData,
  IntervalVisualData,
  MatrixCellHighlight,
  MatrixVisualData,
  SimulationInput,
  SimulationStep,
  StringMatchVisualData,
  TracePrimitive,
  TraceValue,
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
    const phase = typeof vars.phase === 'string' ? vars.phase : '';
    const lineNumber = phase.startsWith('Sliding Window') ? (phase.includes('initialize') ? 2 : phase.includes('complete') ? 8 : 5)
      : phase.startsWith('Two Pointers') ? (phase.includes('initialize') ? 2 : phase.includes('complete') ? 8 : 5)
        : phase.startsWith('Binary Search') ? (phase.includes('initialize') ? 2 : phase.includes('complete') ? 9 : 5)
          : phase.startsWith('Ternary Search') ? (phase.includes('initialize') ? 2 : phase.includes('complete') ? 12 : 5)
            : null;
    steps.push({ lineNumber, visualData, explanation });
  };

const matrixStep = (
  steps: SimulationStep[], explanation: string, values: MatrixVisualData['values'],
  rowLabels: string[], columnLabels: string[], highlights: MatrixCellHighlight[],
  fillDirection: MatrixVisualData['fillDirection'], vars: Record<string, TraceValue>, lineNumber: number | null,
) => steps.push({
  lineNumber, explanation,
  visualData: { type: 'matrix', values: values.map((row) => [...row]), rowLabels, columnLabels, highlights, fillDirection, vars },
});

const stringStep = (
  steps: SimulationStep[],
  explanation: string,
  data: Omit<StringMatchVisualData, 'type'>,
  lineNumber: number,
) => steps.push({ lineNumber, explanation, visualData: { type: 'string-match', ...data } });

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
  const lps = Array(pattern.length).fill(0) as number[];
  stringStep(steps, 'Initialize the KMP prefix table.', {
    text: pattern, pattern, alignment: 0, vars: { phase: 'KMP · initialize LPS', text, pattern, lps: [...lps] },
  }, 2);
  for (let i = 1, length = 0; i < pattern.length;) {
    if (pattern[i] === pattern[length]) {
      length += 1;
      lps[i] = length;
      stringStep(steps, 'Extend the KMP prefix table.', {
        text: pattern, pattern, alignment: 0, activeText: [i], activePattern: [length - 1],
        matchedText: Array.from({ length }, (_, index) => index),
        vars: { phase: 'KMP · extend LPS match', text, pattern, lps: [...lps], i, length },
      }, 6);
      i += 1;
    } else if (length > 0) {
      const previous = length;
      length = lps[length - 1];
      stringStep(steps, 'Fall back inside the KMP prefix table without moving i.', {
        text: pattern, pattern, alignment: 0, activeText: [i], activePattern: [previous], mismatchText: i,
        vars: { phase: 'KMP · LPS fallback', text, pattern, lps: [...lps], i, previousLength: previous, length },
      }, 8);
    } else {
      lps[i] = 0;
      stringStep(steps, 'Record zero because no proper prefix matches this suffix.', {
        text: pattern, pattern, alignment: 0, activeText: [i], activePattern: [0], mismatchText: i,
        vars: { phase: 'KMP · LPS zero', text, pattern, lps: [...lps], i, length: 0 },
      }, 10);
      i += 1;
    }
  }
  const matches: number[] = [];
  for (let i = 0, j = 0; i < text.length;) {
    if (text[i] === pattern[j]) {
      stringStep(steps, 'Compare text and pattern with the KMP prefix table.', {
        text, pattern, alignment: i - j, activeText: [i], activePattern: [j],
        matchedText: Array.from({ length: j + 1 }, (_, offset) => i - j + offset),
        vars: { phase: 'KMP · match characters', lps, matches: [...matches], i, j },
      }, 15);
      i += 1;
      j += 1;
      if (j === pattern.length) {
        matches.push(i - j);
        stringStep(steps, 'Record a complete KMP match.', {
          text, pattern, alignment: i - j, matchedText: Array.from({ length: pattern.length }, (_, offset) => i - j + offset),
          vars: { phase: 'KMP · record match', lps, matches: [...matches], i, j },
        }, 18);
        j = lps[j - 1];
      }
    } else if (j > 0) {
      const previous = j;
      j = lps[j - 1];
      stringStep(steps, 'Use LPS fallback without rewinding the text pointer.', {
        text, pattern, alignment: i - previous, activeText: [i], activePattern: [previous], mismatchText: i,
        vars: { phase: 'KMP · search fallback', lps, matches: [...matches], i, previousJ: previous, j },
      }, 20);
    } else {
      stringStep(steps, 'Advance text because the pattern is at position zero.', {
        text, pattern, alignment: i, activeText: [i], activePattern: [0], mismatchText: i,
        vars: { phase: 'KMP · advance text', lps, matches: [...matches], i, j },
      }, 22);
      i += 1;
    }
  }
  stringStep(steps, 'KMP search is complete.', {
    text, pattern, alignment: matches[0] ?? 0,
    matchedText: matches.flatMap((start) => Array.from({ length: pattern.length }, (_, offset) => start + offset)),
    vars: { phase: 'KMP · complete', text, pattern, lps, matches },
  }, 25);
  return steps;
};

const rabinKarp = (input: SimulationInput): SimulationStep[] => {
  const { text, pattern } = stringSearchInput(input);
  const modulus = numericParameter(input, 'modulus', 'Modulus', { integer: true, min: 2 });
  const steps: SimulationStep[] = [];
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
  stringStep(steps, 'Initialize the Rabin-Karp rolling hashes.', {
    text, pattern, alignment: 0, window: [0, Math.max(0, pattern.length - 1)],
    vars: { phase: 'Rabin-Karp · initialize hashes', modulus, patternHash, windowHash, high },
  }, 6);
  if (pattern.length <= text.length) {
    for (let index = 0; index <= text.length - pattern.length; index += 1) {
      const hashMatches = patternHash === windowHash;
      const exactMatch = hashMatches && text.slice(index, index + pattern.length) === pattern;
      if (exactMatch) matches.push(index);
      stringStep(steps, 'Check the current Rabin-Karp window.', {
        text, pattern, alignment: index, window: [index, index + pattern.length - 1],
        activeText: Array.from({ length: pattern.length }, (_, offset) => index + offset),
        matchedText: exactMatch ? Array.from({ length: pattern.length }, (_, offset) => index + offset) : [],
        mismatchText: hashMatches && !exactMatch ? index : undefined,
        vars: { phase: exactMatch ? 'Rabin-Karp · verify exact match' : hashMatches ? 'Rabin-Karp · hash collision' : 'Rabin-Karp · compare hashes', index, patternHash, windowHash, hashMatches, exactMatch, matches: [...matches] },
      }, 12);
      if (index < text.length - pattern.length) {
        const outgoing = text[index];
        const incoming = text[index + pattern.length];
        windowHash = (
          base * (windowHash - text.charCodeAt(index) * high)
          + text.charCodeAt(index + pattern.length)
        ) % modulus;
        if (windowHash < 0) windowHash += modulus;
        stringStep(steps, 'Roll the hash by removing the outgoing character and adding the incoming character.', {
          text, pattern, alignment: index + 1, window: [index + 1, index + pattern.length],
          activeText: [index, index + pattern.length],
          vars: { phase: 'Rabin-Karp · roll window hash', index, outgoing, incoming, high, modulus, patternHash, windowHash, matches: [...matches] },
        }, 16);
      }
    }
  }
  stringStep(steps, 'Rabin-Karp search is complete.', {
    text, pattern, alignment: matches[0] ?? 0,
    matchedText: matches.flatMap((start) => Array.from({ length: pattern.length }, (_, offset) => start + offset)),
    vars: { phase: 'Rabin-Karp · complete', modulus, matches },
  }, 19);
  return steps;
};

const boyerMoore = (input: SimulationInput): SimulationStep[] => {
  const { text, pattern } = stringSearchInput(input);
  const steps: SimulationStep[] = [];
  const last: Record<string, number> = {};
  [...pattern].forEach((character, index) => { last[character] = index; });
  const matches: number[] = [];
  stringStep(steps, 'Build the Boyer-Moore bad-character table.', {
    text, pattern, alignment: 0, vars: { phase: 'Boyer-Moore · build bad-character table', last },
  }, 3);
  let shift = 0;
  while (shift <= text.length - pattern.length) {
    let index = pattern.length - 1;
    while (index >= 0 && pattern[index] === text[shift + index]) {
      stringStep(steps, 'Compare Boyer-Moore characters from right to left.', {
        text, pattern, alignment: shift, activeText: [shift + index], activePattern: [index],
        matchedText: Array.from({ length: pattern.length - index }, (_, offset) => shift + index + offset),
        vars: { phase: 'Boyer-Moore · compare right-to-left', last, shift, index, matches: [...matches] },
      }, 8);
      index -= 1;
    }
    if (index < 0) {
      matches.push(shift);
      const jump = shift + pattern.length < text.length
        ? pattern.length - (last[text[shift + pattern.length]] ?? -1)
        : 1;
      stringStep(steps, 'Record a Boyer-Moore match and compute the next safe shift.', {
        text, pattern, alignment: shift,
        matchedText: Array.from({ length: pattern.length }, (_, offset) => shift + offset),
        vars: { phase: 'Boyer-Moore · record match', last, shift, jump, matches: [...matches] },
      }, 11);
      shift += jump;
    } else {
      const badCharacter = text[shift + index];
      const jump = Math.max(1, index - (last[badCharacter] ?? -1));
      stringStep(steps, 'Use the bad-character rule to skip impossible alignments.', {
        text, pattern, alignment: shift, activeText: [shift + index], activePattern: [index], mismatchText: shift + index,
        vars: { phase: 'Boyer-Moore · bad-character shift', last, shift, index, badCharacter, jump, matches: [...matches] },
      }, 14);
      shift += jump;
    }
  }
  stringStep(steps, 'Boyer-Moore search is complete.', {
    text, pattern, alignment: matches[0] ?? 0,
    matchedText: matches.flatMap((start) => Array.from({ length: pattern.length }, (_, offset) => start + offset)),
    vars: { phase: 'Boyer-Moore · complete', last, matches },
  }, 17);
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
  emit('Initialize the monotonic window deque.', { phase: 'Sliding Window · initialize deque', windowSize, deque, maxima });
  source.forEach((value, index) => {
    while (deque.length && deque[0] <= index - windowSize) {
      const expired = deque.shift() ?? null;
      emit('Remove the expired index from the deque front.', { phase: 'Sliding Window · expire front', windowSize, deque: [...deque], maxima: [...maxima], expired }, { left: Math.max(0, index - windowSize + 1), right: index });
    }
    while (deque.length && source[deque.at(-1)!] <= value) {
      const dominated = deque.pop() ?? null;
      emit('Remove a dominated value from the deque back.', { phase: 'Sliding Window · remove dominated back', windowSize, deque: [...deque], maxima: [...maxima], dominated }, { left: Math.max(0, index - windowSize + 1), right: index });
    }
    deque.push(index);
    if (index >= windowSize - 1) maxima.push(source[deque[0]]);
    emit('Advance the maximum window.', { phase: 'Sliding Window · emit maximum', windowSize, deque: [...deque], maxima: [...maxima] }, { left: Math.max(0, index - windowSize + 1), right: index, index, maximum: deque[0] });
  });
  emit('Sliding-window maxima are complete.', { phase: 'Sliding Window · complete', windowSize, deque: [...deque], maxima });
  return steps;
};

interface TrieNode { id: string; character: string; children: Record<string, TrieNode>; terminal: boolean; }

const trieInsertSearch = (input: SimulationInput): SimulationStep[] => {
  const words = parseStringInput(input.text).split(/[\s,]+/).filter(Boolean);
  if (!words.length) throw new Error('Provide at least one word for the trie.');
  const query = requiredParameter(input, 'query', 'Search query');
  const steps: SimulationStep[] = [];
  const root: TrieNode = { id: 'root', character: '∅', children: {}, terminal: false };
  const inserted: string[] = [];
  const allNodes = new Map<string, TrieNode>([[root.id, root]]);
  const emit = (explanation: string, phase: string, activePath: string[], activeId?: string, found?: boolean) => {
    const byDepth = new Map<number, TrieNode[]>();
    for (const trieNode of allNodes.values()) {
      const depth = trieNode.id === 'root' ? 0 : Array.from(trieNode.id.replace(/^prefix:/, '')).length;
      byDepth.set(depth, [...(byDepth.get(depth) ?? []), trieNode]);
    }
    const graphNodes = [...byDepth].flatMap(([depth, level]) => level.map((trieNode, index) => ({
      id: trieNode.id, label: trieNode.character,
      x: ((index + 1) * 100) / (level.length + 1),
      y: 10 + depth * (78 / Math.max(1, byDepth.size - 1)),
      state: trieNode.id === activeId ? 'active' as const : activePath.includes(trieNode.id) ? 'path' as const : trieNode.terminal ? 'visited' as const : 'idle' as const,
      semanticRoles: trieNode.terminal ? ['terminal word'] : ['prefix node'],
    })));
    const edges = [...allNodes.values()].flatMap((trieNode) => Object.values(trieNode.children).map((child) => ({
      id: trieNode.id + '->' + child.id, from: trieNode.id, to: child.id,
      state: activePath.includes(trieNode.id) && activePath.includes(child.id) ? 'path' as const : 'idle' as const,
      displayLabel: child.character,
    })));
    const visualData: GraphVisualData = {
      type: 'graph', directed: true, nodes: graphNodes, edges,
      vars: { phase, words, query, inserted: [...inserted], activePath: [...activePath], ...(found === undefined ? {} : { found }) },
    };
    steps.push({ lineNumber: phase.includes('initialize') ? 2 : phase.includes('insert') ? 6 : phase.includes('search') ? 12 : 16, visualData, explanation });
  };
  emit('Initialize an empty trie.', 'Trie · initialize root', ['root'], 'root');
  for (const word of words) {
    let node = root;
    const path = ['root'];
    let prefix = '';
    for (const character of word) {
      prefix += character;
      if (!node.children[character]) {
        const nodeId = prefix === 'root' ? 'prefix:root' : prefix;
        node.children[character] = { id: nodeId, character, children: {}, terminal: false };
        allNodes.set(nodeId, node.children[character]);
      }
      node = node.children[character];
      path.push(node.id);
      emit('Insert character "' + character + '" for word "' + word + '".', 'Trie · insert character node', path, node.id);
    }
    node.terminal = true;
    inserted.push(word);
    emit('Mark the completed word as terminal.', 'Trie · mark terminal word', path, node.id);
  }
  let node: TrieNode | undefined = root;
  const searchPath = ['root'];
  for (const character of Array.from(query)) {
    node = node?.children[character];
    if (node) searchPath.push(node.id);
    emit('Follow the trie search path.', 'Trie · search character edge', searchPath, node?.id, Boolean(node));
    if (!node) break;
  }
  const found = Boolean(node?.terminal);
  emit('Trie search is complete.', 'Trie · complete search', searchPath, node?.id, found);
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
  emit('Sort values and initialize two pointers.', { phase: 'Two Pointers · initialize sorted range', target, originalIndices: sorted.map((item) => item.index) }, { left, right });
  while (left < right) {
    const sum = sorted[left].value + sorted[right].value;
    emit('Compare the two-pointer sum with the target.', { phase: 'Two Pointers · compare sum', target, sum, decision: sum === target ? 'sum=target' : sum < target ? 'sum<target ⇒ left++' : 'sum>target ⇒ right--' }, { left, right });
    if (sum === target) {
      pair = [sorted[left].index, sorted[right].index];
      break;
    }
    if (sum < target) left += 1;
    else right -= 1;
  }
  emit('Two-pointer search is complete.', { phase: 'Two Pointers · complete', target, pair, found: pair.length === 2, originalIndices: sorted.map((item) => item.index) }, { left, right });
  return steps;
};

const minimumWindow = (input: SimulationInput): SimulationStep[] => {
  const source = parseStringInput(input.text);
  const target = requiredParameter(input, 'target', 'Target text');
  const sourceCharacters = Array.from(source);
  const targetCharacters = Array.from(target);
  const steps: SimulationStep[] = [];
  const need: Record<string, number> = {};
  for (const character of targetCharacters) need[character] = (need[character] ?? 0) + 1;
  const have: Record<string, number> = {};
  let formed = 0;
  let left = 0;
  let bestStart = 0;
  let bestLength = Number.POSITIVE_INFINITY;
  stringStep(steps, 'Initialize the minimum-window counters.', {
    text: source, pattern: target, alignment: 0,
    vars: { phase: 'Minimum Window · initialize requirements', source, target, need, have, best: '' },
  }, 2);
  for (let right = 0; right < sourceCharacters.length; right += 1) {
    const character = sourceCharacters[right];
    have[character] = (have[character] ?? 0) + 1;
    if (need[character] && have[character] === need[character]) formed += 1;
    stringStep(steps, 'Expand the right boundary of the minimum window.', {
      text: source, pattern: target, alignment: left, activeText: [right], window: [left, right],
      vars: { phase: 'Minimum Window · expand right', source, target, need, have: { ...have }, left, right, formed },
    }, 4);
    while (formed === Object.keys(need).length) {
      if (right - left + 1 < bestLength) {
        bestStart = left;
        bestLength = right - left + 1;
        stringStep(steps, 'Record a shorter valid minimum window.', {
          text: source, pattern: target, alignment: left, window: [left, right],
          matchedText: Array.from({ length: bestLength }, (_, offset) => left + offset),
          vars: { phase: 'Minimum Window · update best valid window', source, target, need, have: { ...have }, left, right, formed, best: sourceCharacters.slice(bestStart, bestStart + bestLength).join('') },
        }, 6);
      }
      const removed = sourceCharacters[left];
      have[removed] -= 1;
      if (need[removed] && have[removed] < need[removed]) formed -= 1;
      left += 1;
      stringStep(steps, 'Contract the left boundary while the window remains valid.', {
        text: source, pattern: target, alignment: left, activeText: [left - 1], window: [left, right],
        vars: { phase: 'Minimum Window · contract left', source, target, need, have: { ...have }, left, right, formed },
      }, 8);
    }
  }
  const windowCharacters = Number.isFinite(bestLength)
    ? sourceCharacters.slice(bestStart, bestStart + bestLength) : [];
  const window = windowCharacters.join('');
  stringStep(steps, 'Minimum-window search is complete.', {
    text: source, pattern: target, alignment: window ? bestStart : 0,
    matchedText: window ? Array.from({ length: windowCharacters.length }, (_, offset) => bestStart + offset) : [],
    vars: { phase: 'Minimum Window · complete', source, target, window, start: window ? bestStart : -1 },
  }, 10);
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
  const merged: number[][] = [];
  const emit = (explanation: string, phase: string, current?: number[]) => {
    const visualData: IntervalVisualData = {
      type: 'intervals', intervals: intervals.map((value) => [value[0], value[1]]),
      merged: merged.map((value) => [value[0], value[1]]),
      current: current ? [current[0], current[1]] : undefined,
      vars: { phase, intervals, current: current ?? [], merged: merged.map((item) => [...item]) },
    };
    steps.push({ lineNumber: phase.includes('sort') ? 2 : phase.includes('complete') ? 9 : 6, visualData, explanation });
  };
  emit('Sort intervals by their start value.', 'Merge Intervals · sort on number line');
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (!last || interval[0] > last[1]) {
      merged.push([...interval]);
      emit('Start a new disjoint merged interval.', 'Merge Intervals · start disjoint span', interval);
    } else {
      last[1] = Math.max(last[1], interval[1]);
      emit('Merge the current interval when ranges overlap.', 'Merge Intervals · merge overlap', interval);
    }
  }
  emit('Interval merging is complete.', 'Merge Intervals · complete');
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
  emit('Initialize the binary-search range.', { phase: 'Binary Search · initialize active range', target, foundIndex, activeRange: [left, right] }, { left, right });
  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    emit('Inspect the binary-search midpoint.', {
      phase: 'Binary Search · inspect midpoint', target, value: source[middle], activeRange: [left, right],
      decision: source[middle] === target ? 'equal ⇒ found' : source[middle] < target ? 'mid<target ⇒ discard left half' : 'mid>target ⇒ discard right half',
    }, { left, middle, right });
    if (source[middle] === target) {
      foundIndex = middle;
      break;
    }
    if (source[middle] < target) left = middle + 1;
    else right = middle - 1;
  }
  emit(
    'Binary search is complete.',
    { phase: 'Binary Search · complete', target, foundIndex, found: foundIndex >= 0, activeRange: [left, right] },
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
  emit('Initialize the ternary-search range.', {
    phase: 'Ternary Search · initialize active range', target, foundIndex, activeRange: [left, right],
  }, { left, right });
  while (left <= right) {
    const third = Math.floor((right - left) / 3);
    const middle1 = left + third;
    const middle2 = right - third;
    const decision = source[middle1] === target || source[middle2] === target ? 'pivot equals target ⇒ found'
      : target < source[middle1] ? 'target<m1 ⇒ discard middle and right thirds'
        : target > source[middle2] ? 'target>m2 ⇒ discard left and middle thirds'
          : 'm1<target<m2 ⇒ discard outer thirds';
    emit('Inspect both ternary-search midpoints.', {
      phase: 'Ternary Search · inspect two pivots', target, activeRange: [left, right], decision,
    }, { left, middle1, middle2, right });
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
    { phase: 'Ternary Search · complete', target, foundIndex, found: foundIndex >= 0, activeRange: [left, right] },
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
  const dp = Array.from({ length: weights.length + 1 }, () => Array(capacity + 1).fill(0) as number[]);
  const rowLabels = ['∅', ...weights.map((weight, index) => `#${index + 1} w${weight}/v${values[index]}`)];
  const columnLabels = Array.from({ length: capacity + 1 }, (_, index) => String(index));
  matrixStep(steps, 'Initialize the knapsack value table.', dp, rowLabels, columnLabels,
    dp[0].map((_, column) => ({ row: 0, column, role: 'base' })), 'row',
    { phase: 'Knapsack · initialize base row', weights, values, capacity }, 2);
  for (let item = 1; item <= weights.length; item += 1) {
    for (let current = 0; current <= capacity; current += 1) {
      const excluded = dp[item - 1][current];
      const fits = weights[item - 1] <= current;
      const included = fits ? dp[item - 1][current - weights[item - 1]] + values[item - 1] : null;
      dp[item][current] = included === null ? excluded : Math.max(excluded, included);
      const highlights: MatrixCellHighlight[] = [
        { row: item - 1, column: current, role: 'dependency', label: 'exclude' },
        ...(fits ? [{ row: item - 1, column: current - weights[item - 1], role: 'dependency' as const, label: 'include source' }] : []),
        { row: item, column: current, role: 'active', label: included !== null && included > excluded ? 'include' : 'exclude' },
      ];
      matrixStep(steps, fits ? 'Compare excluding and including the current item.' : 'The current item does not fit this capacity.',
        dp, rowLabels, columnLabels, highlights, 'row', {
          phase: 'Knapsack · choose include or exclude', item: item - 1, current, excluded, included,
          decision: included !== null && included > excluded ? 'include current item' : 'exclude current item',
        }, 7);
    }
  }
  matrixStep(steps, 'Knapsack optimization is complete.', dp, rowLabels, columnLabels,
    [{ row: weights.length, column: capacity, role: 'result' }], 'row',
    { phase: 'Knapsack · complete', weights, values, capacity, maxValue: dp[weights.length][capacity] }, 11);
  return steps;
};

const longestCommonSubsequence = (input: SimulationInput): SimulationStep[] => {
  const first = parseStringInput(input.text);
  const second = requiredParameter(input, 'other', 'Second text');
  const firstCharacters = Array.from(first);
  const secondCharacters = Array.from(second);
  const steps: SimulationStep[] = [];
  const dp = Array.from({ length: firstCharacters.length + 1 }, () => Array(secondCharacters.length + 1).fill(0) as number[]);
  const rowLabels = ['∅', ...firstCharacters];
  const columnLabels = ['∅', ...secondCharacters];
  matrixStep(steps, 'Initialize the LCS table.', dp, rowLabels, columnLabels,
    [...dp.map((_, row) => ({ row, column: 0, role: 'base' as const })), ...dp[0].slice(1).map((_, column) => ({ row: 0, column: column + 1, role: 'base' as const }))],
    'row', { phase: 'LCS · initialize empty-prefix borders', first, second }, 2);
  for (let i = 1; i <= firstCharacters.length; i += 1) {
    for (let j = 1; j <= secondCharacters.length; j += 1) {
      const matches = firstCharacters[i - 1] === secondCharacters[j - 1];
      dp[i][j] = matches
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
      matrixStep(steps, matches ? 'Matching characters extend the diagonal subsequence.' : 'Different characters keep the better neighboring subsequence.',
        dp, rowLabels, columnLabels, matches
          ? [{ row: i - 1, column: j - 1, role: 'dependency' }, { row: i, column: j, role: 'active' }]
          : [{ row: i - 1, column: j, role: 'dependency' }, { row: i, column: j - 1, role: 'dependency' }, { row: i, column: j, role: 'active' }],
        'row', { phase: 'LCS · fill recurrence cell', firstCharacter: firstCharacters[i - 1], secondCharacter: secondCharacters[j - 1], matches }, 6);
    }
  }
  let i = firstCharacters.length;
  let j = secondCharacters.length;
  const characters: string[] = [];
  while (i > 0 && j > 0) {
    const currentI = i;
    const currentJ = j;
    if (firstCharacters[i - 1] === secondCharacters[j - 1]) {
      characters.unshift(firstCharacters[i - 1]);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i -= 1;
    else j -= 1;
    matrixStep(steps, 'Trace backward through the LCS table.', dp, rowLabels, columnLabels,
      [{ row: currentI, column: currentJ, role: 'active' }, { row: i, column: j, role: 'result' }],
      'row', { phase: 'LCS · traceback subsequence', subsequence: characters.join('') }, 10);
  }
  const subsequence = characters.join('');
  matrixStep(steps, 'LCS reconstruction is complete.', dp, rowLabels, columnLabels,
    [{ row: firstCharacters.length, column: secondCharacters.length, role: 'result' }], 'row',
    { phase: 'LCS · complete', first, second, subsequence, length: characters.length }, 10);
  return steps;
};

const editDistance = (input: SimulationInput): SimulationStep[] => {
  const first = parseStringInput(input.text);
  const second = requiredParameter(input, 'other', 'Second text');
  const firstCharacters = Array.from(first);
  const secondCharacters = Array.from(second);
  const steps: SimulationStep[] = [];
  const dp = Array.from({ length: firstCharacters.length + 1 }, (_, row) => Array.from({ length: secondCharacters.length + 1 }, (_, column) => row === 0 ? column : column === 0 ? row : 0));
  const rowLabels = ['∅', ...firstCharacters];
  const columnLabels = ['∅', ...secondCharacters];
  matrixStep(steps, 'Initialize the edit-distance table.', dp, rowLabels, columnLabels,
    [...dp.map((_, row) => ({ row, column: 0, role: 'base' as const })), ...dp[0].slice(1).map((_, column) => ({ row: 0, column: column + 1, role: 'base' as const }))],
    'row', { phase: 'Edit Distance · initialize empty-prefix borders', first, second }, 2);
  for (let i = 1; i <= firstCharacters.length; i += 1) {
    for (let j = 1; j <= secondCharacters.length; j += 1) {
      const matches = firstCharacters[i - 1] === secondCharacters[j - 1];
      dp[i][j] = matches ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      const operation = matches ? 'keep' : dp[i][j] === dp[i - 1][j] + 1 ? 'delete' : dp[i][j] === dp[i][j - 1] + 1 ? 'insert' : 'replace';
      matrixStep(steps, matches ? 'Equal characters carry the diagonal cost.' : 'Choose the cheapest insert, delete, or replace dependency.',
        dp, rowLabels, columnLabels, [
          { row: i - 1, column: j - 1, role: 'dependency', label: 'keep/replace' },
          ...(!matches ? [{ row: i - 1, column: j, role: 'dependency' as const, label: 'delete' }, { row: i, column: j - 1, role: 'dependency' as const, label: 'insert' }] : []),
          { row: i, column: j, role: 'active', label: operation },
        ], 'row', { phase: 'Edit Distance · choose edit operation', operation, matches }, 7);
    }
  }
  let traceRow = firstCharacters.length;
  let traceColumn = secondCharacters.length;
  const editScript: string[] = [];
  while (traceRow > 0 || traceColumn > 0) {
    const fromRow = traceRow;
    const fromColumn = traceColumn;
    let operation: string;
    if (traceRow > 0 && traceColumn > 0 && firstCharacters[traceRow - 1] === secondCharacters[traceColumn - 1]) {
      operation = `keep ${firstCharacters[traceRow - 1]}`;
      traceRow -= 1;
      traceColumn -= 1;
    } else if (traceRow > 0 && traceColumn > 0 && dp[traceRow][traceColumn] === dp[traceRow - 1][traceColumn - 1] + 1) {
      operation = `replace ${firstCharacters[traceRow - 1]}→${secondCharacters[traceColumn - 1]}`;
      editScript.unshift(operation);
      traceRow -= 1;
      traceColumn -= 1;
    } else if (traceColumn > 0 && dp[traceRow][traceColumn] === dp[traceRow][traceColumn - 1] + 1) {
      operation = `insert ${secondCharacters[traceColumn - 1]}`;
      editScript.unshift(operation);
      traceColumn -= 1;
    } else {
      operation = `delete ${firstCharacters[traceRow - 1]}`;
      editScript.unshift(operation);
      traceRow -= 1;
    }
    matrixStep(steps, `Trace the edit script using operation: ${operation}.`, dp, rowLabels, columnLabels,
      [{ row: fromRow, column: fromColumn, role: 'active' }, { row: traceRow, column: traceColumn, role: 'result', label: operation }],
      'row', { phase: 'Edit Distance · traceback edit script', operation, editScript: [...editScript] }, 10);
  }
  matrixStep(steps, 'Edit-distance calculation is complete.', dp, rowLabels, columnLabels,
    [{ row: firstCharacters.length, column: secondCharacters.length, role: 'result' }], 'row',
    { phase: 'Edit Distance · complete', first, second, distance: dp[firstCharacters.length][secondCharacters.length], editScript }, 11);
  return steps;
};

const coinChange = (input: SimulationInput): SimulationStep[] => {
  const coins = parseArrayInput(input.text);
  const amount = numericParameter(input, 'amount', 'Amount', { integer: true, min: 0 });
  if (coins.some((coin) => !Number.isInteger(coin) || coin <= 0)) {
    throw new Error('Coin denominations must be positive integers.');
  }
  const steps: SimulationStep[] = [];
  const dp = Array(amount + 1).fill(Number.POSITIVE_INFINITY) as number[];
  dp[0] = 0;
  const display = () => [dp.map((value) => Number.isFinite(value) ? value : '∞')];
  const columns = Array.from({ length: amount + 1 }, (_, index) => String(index));
  matrixStep(steps, 'Initialize the coin-change table.', display(), ['minimum coins'], columns,
    [{ row: 0, column: 0, role: 'base' }], 'row', { phase: 'Coin Change · initialize amount zero', coins, amount }, 2);
  for (const coin of coins) {
    for (let current = coin; current <= amount; current += 1) {
      const previous = dp[current];
      const candidate = dp[current - coin] + 1;
      dp[current] = Math.min(previous, candidate);
      matrixStep(steps, `Try coin ${coin} for amount ${current}.`, display(), ['minimum coins'], columns, [
        { row: 0, column: current - coin, role: 'dependency', label: `amount-${coin}` },
        { row: 0, column: current, role: 'active', label: candidate < previous ? 'improved' : 'unchanged' },
      ], 'row', {
        phase: 'Coin Change · relax amount with coin', coin, current,
        candidate: Number.isFinite(candidate) ? candidate : '∞',
        decision: candidate < previous ? 'accept fewer coins' : 'keep current minimum',
      }, 6);
    }
  }
  const minCoins = Number.isFinite(dp[amount]) ? dp[amount] : -1;
  matrixStep(steps, 'Coin-change calculation is complete.', display(), ['minimum coins'], columns,
    [{ row: 0, column: amount, role: 'result' }], 'row',
    { phase: 'Coin Change · complete', coins, amount, minCoins, possible: minCoins >= 0 }, 8);
  return steps;
};

const detectCycle = (input: SimulationInput): SimulationStep[] => {
  const source = parseArrayInput(input.text);
  const cycleEntry = numericParameter(input, 'cycleEntry', 'Cycle entry', { integer: true, min: -1 });
  if (cycleEntry >= source.length) throw new Error('Cycle entry must be -1 or a valid node index.');
  const next = source.map((_, index) =>
    index + 1 < source.length ? index + 1 : cycleEntry >= 0 ? cycleEntry : -1);
  const steps: SimulationStep[] = [];
  const emit = (explanation: string, phase: string, slow: number, fast: number, meeting: number, extra: Record<string, TraceValue> = {}) => {
    const visualData: GraphVisualData = {
      type: 'graph', directed: true,
      nodes: source.map((value, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(1, source.length);
        return {
          id: String(index), label: String(value),
          x: cycleEntry >= 0 ? 50 + Math.cos(angle) * 36 : 10 + index * (80 / Math.max(1, source.length - 1)),
          y: cycleEntry >= 0 ? 50 + Math.sin(angle) * 36 : 50,
          state: index === meeting && meeting >= 0 ? 'path' as const : index === slow || index === fast ? 'active' as const : 'idle' as const,
          semanticRoles: [index === slow ? 'slow' : '', index === fast ? 'fast' : ''].filter(Boolean),
        };
      }),
      edges: next.flatMap((target, index) => target >= 0 ? [{ id: `${index}->${target}`, from: String(index), to: String(target), state: 'visited' as const }] : []),
      vars: { phase, next, slow: slow >= 0 ? slow : null, fast: fast >= 0 ? fast : null, meeting: meeting >= 0 ? meeting : null, ...extra },
    };
    steps.push({ lineNumber: phase.includes('initialize') ? 2 : phase.includes('complete') ? 8 : 6, visualData, explanation });
  };
  let slow = 0;
  let fast = 0;
  let meeting = -1;
  emit('Initialize Floyd cycle-detection pointers.', 'Cycle Detection · initialize slow and fast', slow, fast, meeting, { cycleEntry });
  while (fast >= 0 && next[fast] >= 0) {
    slow = next[slow];
    fast = next[next[fast]] ?? -1;
    emit('Advance slow by one edge and fast by two edges.', 'Cycle Detection · advance one and two hops', slow, fast, meeting, { cycleEntry });
    if (slow === fast && slow >= 0) {
      meeting = slow;
      emit('The slow and fast pointers meet inside the cycle.', 'Cycle Detection · pointers meet', slow, fast, meeting, { cycleEntry });
      break;
    }
  }
  let detectedEntry = -1;
  if (meeting >= 0) {
    slow = 0;
    while (slow !== meeting) {
      slow = next[slow];
      meeting = next[meeting];
      emit('Move head and meeting pointers one edge to locate the cycle entry.', 'Cycle Detection · locate cycle entry', slow, fast, meeting, { cycleEntry });
    }
    detectedEntry = slow;
  }
  emit('Linked-list cycle detection is complete.', 'Cycle Detection · complete', slow, fast, detectedEntry, {
    hasCycle: detectedEntry >= 0, cycleEntry: detectedEntry,
  });
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
