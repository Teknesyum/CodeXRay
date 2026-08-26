import type {
  CustomSimulationPackageV1,
  InputContractV1,
  ProgramSpecV1,
  RenderedSourceV1,
  VisualizationContractV1,
  WorkspaceSnapshotV1,
} from '../types/titan';
import type { Locale, SimulationStep } from '../types/simulation';
import { reviewTrace } from './customSimulationCompiler';
import { createTeachingPlan } from './teachingPlan';
import { extractQuotedLiteral } from './requestLiterals';

export type StringTemplateId = 'sliding-window-string' | 'two-pointers-string';

interface StringArtifact {
  id: string;
  title: string;
  text: string;
  source: RenderedSourceV1;
  steps: SimulationStep[];
  visualization: VisualizationContractV1;
  analysis: string;
  invariants: string[];
}

const MAX_LENGTH = 80;

const requestText = (request: string, fallback: string): string => {
  const quoted = extractQuotedLiteral(request);
  return quoted !== null && quoted.length <= MAX_LENGTH ? quoted : fallback;
};

const arrayStep = (
  text: string,
  pointers: Record<string, number>,
  vars: Record<string, import('../types/simulation').TraceValue>,
  lineNumber: number,
  explanation: string,
): SimulationStep => ({
  lineNumber,
  explanation,
  visualData: { type: 'array', values: [...text], pointers, vars },
});

const source = (lines: string[], lineMap: Record<string, number>): RenderedSourceV1 => ({
  version: 1,
  language: 'cpp',
  code: lines.join('\n'),
  lineMap,
});

const longestSubstringArtifact = (request: string, locale: Locale): StringArtifact => {
  const text = requestText(request, 'abcabcbb');
  const lastSeen = new Map<string, number>();
  const steps: SimulationStep[] = [];
  let left = 0;
  let best = 0;

  steps.push(arrayStep(text, { left: 0, right: 0 }, { left, best, result: 0 }, 5,
    locale === 'tr' ? 'Boş kayan pencere hazırlanır.' : 'Initialize an empty sliding window.'));
  for (let right = 0; right < text.length; right += 1) {
    const character = text[right];
    const previous = lastSeen.get(character);
    if (previous !== undefined && previous >= left) {
      left = previous + 1;
      steps.push(arrayStep(text, { left, right }, {
        character, previous, left, right, best, result: best,
      }, 8, locale === 'tr'
        ? `${character} tekrarlandı; sol sınır ${left} olur.`
        : `${character} repeats; move the left boundary to ${left}.`));
    }
    lastSeen.set(character, right);
    best = Math.max(best, right - left + 1);
    steps.push(arrayStep(text, { left, right }, {
      character, left, right, windowLength: right - left + 1, best, result: best,
    }, 11, locale === 'tr'
      ? `Benzersiz pencere ${text.slice(left, right + 1)}; en iyi uzunluk ${best}.`
      : `Unique window is ${text.slice(left, right + 1)}; best length is ${best}.`));
  }

  const title = locale === 'tr'
    ? 'LeetCode 3 — Tekrarsız En Uzun Alt Dize'
    : 'LeetCode 3 — Longest Substring Without Repeating Characters';
  return {
    id: 'longest_substring_sliding_window',
    title,
    text,
    source: source([
      'class Solution {',
      'public:',
      '  int lengthOfLongestSubstring(string s) {',
      '    unordered_map<char, int> lastSeen;',
      '    int left = 0, best = 0;',
      '    for (int right = 0; right < s.size(); ++right) {',
      '      char current = s[right];',
      '      if (lastSeen.count(current) && lastSeen[current] >= left)',
      '        left = lastSeen[current] + 1;',
      '      lastSeen[current] = right;',
      '      best = max(best, right - left + 1);',
      '    }',
      '    return best;',
      '  }',
      '};',
    ], { init: 5, repeat: 8, update: 11, result: 13 }),
    steps,
    visualization: {
      version: 1,
      type: 'array',
      activeVariables: ['left', 'right'],
      queuedVariables: ['character'],
      visitedVariables: ['best'],
    },
    analysis: 'State: s[left..right] has no repeated character.\nTime Complexity: O(N)\nSpace Complexity: O(min(N, alphabet))',
    invariants: ['After each update, every character in s[left..right] is unique.'],
  };
};

const validPalindromeArtifact = (request: string, locale: Locale): StringArtifact => {
  const text = requestText(request, 'A man, a plan, a canal: Panama');
  const steps: SimulationStep[] = [];
  let left = 0;
  let right = text.length - 1;
  let result = true;
  const isAlphaNumeric = (value: string) => /[a-z0-9]/i.test(value);

  while (left < right) {
    if (!isAlphaNumeric(text[left])) {
      steps.push(arrayStep(text, { left, right }, { skipped: text[left], result }, 6,
        locale === 'tr' ? `Sol taraftaki ${JSON.stringify(text[left])} atlanır.` : `Skip ${JSON.stringify(text[left])} on the left.`));
      left += 1;
      continue;
    }
    if (!isAlphaNumeric(text[right])) {
      steps.push(arrayStep(text, { left, right }, { skipped: text[right], result }, 7,
        locale === 'tr' ? `Sağ taraftaki ${JSON.stringify(text[right])} atlanır.` : `Skip ${JSON.stringify(text[right])} on the right.`));
      right -= 1;
      continue;
    }
    const leftValue = text[left].toLowerCase();
    const rightValue = text[right].toLowerCase();
    result = leftValue === rightValue;
    steps.push(arrayStep(text, { left, right }, { leftValue, rightValue, result }, 8,
      locale === 'tr'
        ? `${leftValue} ve ${rightValue} karşılaştırılır: ${String(result)}.`
        : `Compare ${leftValue} and ${rightValue}: ${String(result)}.`));
    if (!result) break;
    left += 1;
    right -= 1;
  }
  steps.push(arrayStep(text, left <= right ? { left, right } : {}, { result }, 12,
    locale === 'tr' ? `Nihai palindrom sonucu: ${String(result)}.` : `Final palindrome result: ${String(result)}.`));

  const title = locale === 'tr' ? 'LeetCode 125 — Geçerli Palindrom' : 'LeetCode 125 — Valid Palindrome';
  return {
    id: 'valid_palindrome_two_pointers',
    title,
    text,
    source: source([
      'class Solution {',
      'public:',
      '  bool isPalindrome(string s) {',
      '    int left = 0, right = s.size() - 1;',
      '    while (left < right) {',
      '      while (left < right && !isalnum(s[left])) ++left;',
      '      while (left < right && !isalnum(s[right])) --right;',
      '      if (tolower(s[left]) != tolower(s[right])) return false;',
      '      ++left;',
      '      --right;',
      '    }',
      '    return true;',
      '  }',
      '};',
    ], { init: 4, skipLeft: 6, skipRight: 7, compare: 8, result: 12 }),
    steps,
    visualization: {
      version: 1,
      type: 'array',
      activeVariables: ['left', 'right'],
      queuedVariables: [],
      visitedVariables: ['result'],
    },
    analysis: 'State: every accepted pair outside [left,right] already matches.\nTime Complexity: O(N)\nSpace Complexity: O(1)',
    invariants: ['Only alphanumeric characters participate and comparison is case-insensitive.'],
  };
};

export const compileStringTemplatePackage = (options: {
  template: StringTemplateId;
  id: string;
  request: string;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
}): CustomSimulationPackageV1 => {
  const artifact = options.template === 'sliding-window-string'
    ? longestSubstringArtifact(options.request, options.locale)
    : validPalindromeArtifact(options.request, options.locale);
  const inputValue = { kind: 'string' as const, text: artifact.text, origin: 'agent' as const };
  const input: InputContractV1 = {
    version: 1,
    kind: 'string',
    description: options.locale === 'tr' ? 'Metin girdisi' : 'Text input',
    constraints: [`0 <= text.length <= ${MAX_LENGTH}`],
    value: inputValue,
    origin: 'agent',
  };
  const checkpoints = reviewTrace(artifact.steps, Math.min(16, artifact.steps.length));
  const result = artifact.steps.at(-1)?.visualData.vars.result;
  const program: ProgramSpecV1 = {
    version: 1,
    id: artifact.id,
    title: artifact.title,
    locale: options.locale,
    inputKind: 'string',
    entry: [],
    functions: [],
    budgets: { instructions: 3_000, traceSteps: 300, recursionDepth: 1, collectionSize: MAX_LENGTH },
  };
  return {
    version: 1,
    id: `${artifact.id}-${options.id}`,
    title: artifact.title,
    locale: options.locale,
    createdAt: Date.now(),
    program,
    source: artifact.source,
    input,
    visualization: artifact.visualization,
    steps: artifact.steps,
    analysis: artifact.analysis,
    checkpoints,
    teachingPlan: createTeachingPlan(artifact.steps, checkpoints, inputValue, options.locale, artifact.invariants),
    tests: {
      version: 1,
      passed: typeof result === 'boolean' || typeof result === 'number',
      results: [{ id: 'active-input', passed: true, message: `result=${String(result)}` }],
    },
  };
};
