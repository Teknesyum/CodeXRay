import type {
  CustomSimulationPackageV1,
  InputContractV1,
  ProgramSpecV1,
  RenderedSourceV1,
  VisualizationContractV1,
  WorkspaceSnapshotV1,
} from '../types/godMode';
import type {
  Locale,
  SimulationInput,
  SimulationStep,
} from '../types/simulation';
import { reviewTrace } from './customSimulationCompiler';
import { createTeachingPlan } from './teachingPlan';

export type ArrayTemplateId =
  | 'two-pointers-array'
  | 'sliding-window-array'
  | 'prefix-sum-array'
  | 'binary-search-array'
  | 'palindrome-number';

interface ArrayArtifact {
  id: string;
  title: string;
  input: SimulationInput;
  inputDescription: string;
  constraints: string[];
  source: RenderedSourceV1;
  steps: SimulationStep[];
  visualization: VisualizationContractV1;
  analysis: string;
  invariants: string[];
}

const MAX_ITEMS = 20;

const requestArray = (request: string): number[] | null => {
  const raw = request.match(/\[[^\]]+\]/)?.[0];
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      && value.length > 0
      && value.length <= MAX_ITEMS
      && value.every((item) => Number.isSafeInteger(item))
      ? value as number[]
      : null;
  } catch {
    return null;
  }
};

const requestIntegerParameter = (request: string, name: string, fallback: number): number => {
  const match = request.match(new RegExp(`\\b${name}\\s*=\\s*(-?\\d+)`, 'i'));
  const value = match ? Number(match[1]) : fallback;
  return Number.isSafeInteger(value) ? value : fallback;
};

const arrayStep = (
  values: number[],
  pointers: Record<string, number>,
  vars: Record<string, any>,
  lineNumber: number | null,
  explanation: string,
): SimulationStep => ({
  lineNumber,
  explanation,
  visualData: {
    type: 'array',
    values,
    pointers,
    vars,
  },
});

const source = (lines: string[], mapping: Record<string, number>): RenderedSourceV1 => ({
  version: 1,
  language: 'cpp',
  code: lines.join('\n'),
  lineMap: mapping,
});

const programShell = (id: string, title: string, locale: Locale, inputKind: SimulationInput['kind']): ProgramSpecV1 => ({
  version: 1,
  id,
  title,
  locale,
  inputKind,
  entry: [],
  functions: [],
  budgets: { instructions: 2_000, traceSteps: 160, recursionDepth: 1, collectionSize: MAX_ITEMS },
});

const twoPointersArtifact = (request: string, locale: Locale, _workspace: WorkspaceSnapshotV1): ArrayArtifact => {
  const explicit = requestArray(request);
  const arr = explicit ?? [2, 7, 11, 15]; // Two Sum II sorted array example
  const target = requestIntegerParameter(request, 'target', 9);
  if (arr.some((value, index) => index > 0 && arr[index - 1] > value)) {
    throw new Error('LeetCode 167 requires a non-decreasing input array.');
  }

  const steps: SimulationStep[] = [];
  let left = 0;
  let right = arr.length - 1;

  steps.push(arrayStep(arr, { left, right }, { target }, 5,
    locale === 'tr' ? `Dizinin zıt uçlarından iki işaretçi başlatılır: left=0, right=${right}` : `Initialize two pointers from opposite ends: left=0, right=${right}`
  ));

  while (left < right) {
    const sum = arr[left] + arr[right];
    steps.push(arrayStep(arr, { left, right }, { target, sum }, 7,
      locale === 'tr' ? `Toplam kontrol edilir: arr[${left}] + arr[${right}] = ${sum}` : `Check sum: arr[${left}] + arr[${right}] = ${sum}`
    ));
    if (sum === target) {
      steps.push(arrayStep(arr, { left, right }, { target, sum, result: [left + 1, right + 1] }, 9,
        locale === 'tr' ? `Hedef ${target} bulundu!` : `Target ${target} found!`
      ));
      break;
    } else if (sum < target) {
      left++;
      steps.push(arrayStep(arr, { left, right }, { target, sum }, 11,
        locale === 'tr' ? `Toplam çok küçük, left artırılıyor.` : `Sum is too small, incrementing left.`
      ));
    } else {
      right--;
      steps.push(arrayStep(arr, { left, right }, { target, sum }, 13,
        locale === 'tr' ? `Toplam çok büyük, right azaltılıyor.` : `Sum is too large, decrementing right.`
      ));
    }
  }

  if (steps.at(-1)?.visualData.vars.result === undefined) {
    steps.push(arrayStep(arr, {}, { target, result: [-1, -1] }, 16,
      locale === 'tr' ? `Hedef ${target} için bir çift bulunamadı.` : `No pair sums to target ${target}.`
    ));
  }

  return {
    id: 'two_sum_ii_two_pointers',
    title: locale === 'tr' ? 'LeetCode 167 — Two Sum II (Sıralı Dizi)' : 'LeetCode 167 — Two Sum II - Input Array Is Sorted',
    input: {
      kind: 'array',
      text: JSON.stringify(arr),
      parameters: { target: String(target) },
      origin: explicit ? 'user' : 'agent',
    },
    inputDescription: locale === 'tr' ? 'Sıralı dizi' : 'Sorted array',
    constraints: [`1 <= arr.length <= ${MAX_ITEMS}`, 'arr is sorted'],
    source: source([
      'class Solution {',
      'public:',
      '  vector<int> twoSum(vector<int>& numbers, int target) {',
      '    int left = 0;',
      '    int right = numbers.size() - 1;',
      '    while (left < right) {',
      '      int sum = numbers[left] + numbers[right];',
      '      if (sum == target) {',
      '        return {left + 1, right + 1};',
      '      } else if (sum < target) {',
      '        left++;',
      '      } else {',
      '        right--;',
      '      }',
      '    }',
      '    return {-1, -1};',
      '  }',
      '};',
    ], { 'init': 5, 'loop': 6, 'check': 7, 'found': 9, 'left-inc': 11, 'right-dec': 13, result: 16 }),
    steps,
    visualization: { version: 1, type: 'array', activeVariables: ['left', 'right'], queuedVariables: [], visitedVariables: [] },
    analysis: 'State: Two pointers representing candidate endpoints.\nTime Complexity: O(n)\nSpace Complexity: O(1)',
    invariants: ['Left pointer never passes right pointer.'],
  };
};

const _legacySlidingWindowArtifact = (request: string, locale: Locale, _workspace: WorkspaceSnapshotV1): ArrayArtifact => {
  const explicit = requestArray(request);
  const arr = explicit ?? [2, 1, 5, 1, 3, 2];
  const k = 3; // Window size

  const steps: SimulationStep[] = [];
  let sum = 0;
  let maxSum = 0;

  steps.push(arrayStep(arr, { left: 0, right: 0 }, { k, sum, maxSum }, 4,
    locale === 'tr' ? `Pencere boyutu ${k} için Sliding Window başlıyor.` : `Sliding Window starts for size ${k}.`
  ));

  for (let right = 0; right < arr.length; right++) {
    sum += arr[right];
    const pointers: Record<string, number> = { right };
    if (right >= k) {
      const left = right - k;
      sum -= arr[left];
      pointers['left'] = left + 1;
    } else if (right === k - 1) {
      pointers['left'] = 0;
    }

    if (right >= k - 1) {
      maxSum = Math.max(maxSum, sum);
      steps.push(arrayStep(arr, pointers, { k, sum, maxSum }, 9,
        locale === 'tr' ? `Pencere ilerledi. max = max(${maxSum}, ${sum})` : `Window slid. max = max(${maxSum}, ${sum})`
      ));
    } else {
      steps.push(arrayStep(arr, pointers, { k, sum, maxSum }, 7,
        locale === 'tr' ? `Pencere doluyor... sum = ${sum}` : `Window filling... sum = ${sum}`
      ));
    }
  }

  return {
    id: 'sliding_window_array',
    title: locale === 'tr' ? 'Kayan Pencere (Sliding Window)' : 'Sliding Window',
    input: { kind: 'array', text: JSON.stringify(arr), origin: explicit ? 'user' : 'agent' },
    inputDescription: locale === 'tr' ? 'Dizi ve pencere boyutu' : 'Array and window size',
    constraints: [`1 <= arr.length <= ${MAX_ITEMS}`],
    source: source([
      'class Solution {',
      'public:',
      '  int maxSubArrayLen(vector<int>& nums, int k) {',
      '    int sum = 0, maxSum = 0;',
      '    for (int i = 0; i < nums.size(); ++i) {',
      '      sum += nums[i];',
      '      if (i >= k) sum -= nums[i - k];',
      '      if (i >= k - 1) maxSum = max(maxSum, sum);',
      '    }',
      '    return maxSum;',
      '  }',
      '};',
    ], { 'init': 4, 'loop': 5, 'add': 6, 'remove': 7, 'max': 8 }),
    steps,
    visualization: { version: 1, type: 'array', activeVariables: ['left', 'right'], queuedVariables: [], visitedVariables: [] },
    analysis: 'State: Window bounded by left and right indices.\nTime Complexity: O(n)\nSpace Complexity: O(1)',
    invariants: ['Window size never exceeds k.'],
  };
};

const _legacyPrefixSumArtifact = (request: string, locale: Locale, _workspace: WorkspaceSnapshotV1): ArrayArtifact => {
  const explicit = requestArray(request);
  const arr = explicit ?? [1, 2, 3, 4, 5];

  const steps: SimulationStep[] = [];
  const prefix = new Array(arr.length + 1).fill(0);

  steps.push(arrayStep(arr, { i: 0 }, { prefix: JSON.stringify(prefix) }, 4,
    locale === 'tr' ? `Prefix dizisi sıfırlarla başlatılır.` : `Prefix array initialized with zeros.`
  ));

  for (let i = 0; i < arr.length; i++) {
    prefix[i + 1] = prefix[i] + arr[i];
    steps.push(arrayStep(arr, { i }, { prefix: JSON.stringify(prefix) }, 6,
      locale === 'tr' ? `prefix[${i+1}] = prefix[${i}] + arr[${i}] = ${prefix[i+1]}` : `prefix[${i+1}] = prefix[${i}] + arr[${i}] = ${prefix[i+1]}`
    ));
  }

  return {
    id: 'prefix_sum_array',
    title: locale === 'tr' ? 'Ön Ek Toplamı (Prefix Sum)' : 'Prefix Sum',
    input: { kind: 'array', text: JSON.stringify(arr), origin: explicit ? 'user' : 'agent' },
    inputDescription: locale === 'tr' ? 'Sayı dizisi' : 'Number array',
    constraints: [`1 <= arr.length <= ${MAX_ITEMS}`],
    source: source([
      'class Solution {',
      'public:',
      '  vector<int> buildPrefix(vector<int>& nums) {',
      '    vector<int> prefix(nums.size() + 1, 0);',
      '    for (int i = 0; i < nums.size(); ++i) {',
      '      prefix[i + 1] = prefix[i] + nums[i];',
      '    }',
      '    return prefix;',
      '  }',
      '};',
    ], { 'init': 4, 'loop': 5, 'add': 6 }),
    steps,
    visualization: { version: 1, type: 'array', activeVariables: ['i'], queuedVariables: [], visitedVariables: [] },
    analysis: 'State: prefix[i] contains sum of first i elements.\nTime Complexity: O(n)\nSpace Complexity: O(n)',
    invariants: ['prefix[i] is correctly computed from prefix[i-1].'],
  };
};

// Retained temporarily for backward-compatible visual comparison while exact LC209/LC560
// packages use the implementations below. Remove after the catalog migration stabilizes.
void _legacySlidingWindowArtifact;
void _legacyPrefixSumArtifact;

const subarraySumArtifact = (request: string, locale: Locale): ArrayArtifact => {
  const explicit = requestArray(request);
  const values = explicit ?? [1, 1, 1];
  const k = requestIntegerParameter(request, 'k', 2);
  const frequencies = new Map<number, number>([[0, 1]]);
  const steps: SimulationStep[] = [];
  let prefix = 0;
  let result = 0;
  steps.push(arrayStep(values, { i: 0 }, { k, prefix, result, frequencies: { 0: 1 } }, 5,
    locale === 'tr' ? 'Boş ön ek bir kez görülmüş sayılır.' : 'Count the empty prefix once.'));
  for (let i = 0; i < values.length; i += 1) {
    prefix += values[i];
    const neededPrefix = prefix - k;
    const matches = frequencies.get(neededPrefix) ?? 0;
    result += matches;
    steps.push(arrayStep(values, { i }, {
      k, prefix, neededPrefix, matches, result, frequencies: Object.fromEntries(frequencies),
    }, 8, locale === 'tr'
      ? `prefix=${prefix}; ${neededPrefix} ön eki ${matches} kez görüldü.`
      : `prefix=${prefix}; prefix ${neededPrefix} appeared ${matches} time(s).`));
    frequencies.set(prefix, (frequencies.get(prefix) ?? 0) + 1);
    steps.push(arrayStep(values, { i }, {
      k, prefix, result, frequencies: Object.fromEntries(frequencies),
    }, 9, locale === 'tr' ? `prefix ${prefix} frekansı güncellendi.` : `Updated frequency for prefix ${prefix}.`));
  }
  steps.push(arrayStep(values, {}, { k, prefix, result, frequencies: Object.fromEntries(frequencies) }, 12,
    locale === 'tr' ? `Toplam ${result} alt dizi bulundu.` : `Found ${result} subarray(s).`));
  return {
    id: 'subarray_sum_equals_k',
    title: locale === 'tr' ? 'LeetCode 560 — Toplamı K Olan Alt Dizi' : 'LeetCode 560 — Subarray Sum Equals K',
    input: {
      kind: 'array', text: JSON.stringify(values), parameters: { k: String(k) },
      origin: explicit ? 'user' : 'agent',
    },
    inputDescription: locale === 'tr' ? 'Sayı dizisi ve k' : 'Number array and k',
    constraints: [`1 <= values.length <= ${MAX_ITEMS}`],
    source: source([
      'class Solution {',
      'public:',
      '  int subarraySum(vector<int>& nums, int k) {',
      '    unordered_map<int, int> frequency{{0, 1}};',
      '    int prefix = 0, result = 0;',
      '    for (int value : nums) {',
      '      prefix += value;',
      '      result += frequency[prefix - k];',
      '      frequency[prefix]++;',
      '    }',
      '    return result;',
      '  }',
      '};',
    ], { init: 5, inspect: 8, frequency: 9, result: 12 }),
    steps,
    visualization: { version: 1, type: 'array', activeVariables: ['i'], queuedVariables: ['neededPrefix'], visitedVariables: ['prefix', 'result'] },
    analysis: 'State: frequency stores counts of every prefix seen before the active index.\nTime Complexity: O(n)\nSpace Complexity: O(n)',
    invariants: ['A subarray ending here sums to k exactly when an earlier prefix equals prefix-k.'],
  };
};

const minimumSizeSubarrayArtifact = (request: string, locale: Locale): ArrayArtifact => {
  const explicit = requestArray(request);
  const values = explicit ?? [2, 3, 1, 2, 4, 3];
  const target = requestIntegerParameter(request, 'target', 7);
  if (values.some((value) => value <= 0) || target <= 0) {
    throw new Error('LeetCode 209 requires positive array values and a positive target.');
  }
  const steps: SimulationStep[] = [];
  let left = 0;
  let sum = 0;
  let best = Number.POSITIVE_INFINITY;
  steps.push(arrayStep(values, { left, right: 0 }, { target, sum, result: 0 }, 5,
    locale === 'tr' ? `Hedef ${target} için pencere boş başlatılır.` : `Start an empty window for target ${target}.`));
  for (let right = 0; right < values.length; right += 1) {
    sum += values[right];
    steps.push(arrayStep(values, { left, right }, { target, sum, result: Number.isFinite(best) ? best : 0 }, 7,
      locale === 'tr' ? `Sağ uç ${values[right]} değerini ekler; toplam ${sum}.` : `Right adds ${values[right]}; sum is ${sum}.`));
    while (sum >= target) {
      best = Math.min(best, right - left + 1);
      steps.push(arrayStep(values, { left, right }, { target, sum, result: best }, 9,
        locale === 'tr' ? `Geçerli pencere uzunluğu ${right - left + 1}; en iyi ${best}.` : `Valid window length is ${right - left + 1}; best is ${best}.`));
      sum -= values[left];
      left += 1;
      steps.push(arrayStep(values, left <= right ? { left, right } : {}, { target, sum, result: best }, 10,
        locale === 'tr' ? `Daha kısa pencere aranır; toplam ${sum}.` : `Shrink to search for a shorter window; sum is ${sum}.`));
    }
  }
  const result = Number.isFinite(best) ? best : 0;
  steps.push(arrayStep(values, {}, { target, sum, result }, 13,
    locale === 'tr' ? `Minimum uzunluk ${result}.` : `Minimum length is ${result}.`));
  return {
    id: 'minimum_size_subarray_sum',
    title: locale === 'tr' ? 'LeetCode 209 — Minimum Boyutlu Alt Dizi Toplamı' : 'LeetCode 209 — Minimum Size Subarray Sum',
    input: {
      kind: 'array', text: JSON.stringify(values), parameters: { target: String(target) },
      origin: explicit ? 'user' : 'agent',
    },
    inputDescription: locale === 'tr' ? 'Pozitif dizi ve hedef' : 'Positive array and target',
    constraints: [`1 <= values.length <= ${MAX_ITEMS}`, 'values and target are positive'],
    source: source([
      'class Solution {',
      'public:',
      '  int minSubArrayLen(int target, vector<int>& nums) {',
      '    int left = 0, sum = 0, result = INT_MAX;',
      '    for (int right = 0; right < nums.size(); ++right) {',
      '      sum += nums[right];',
      '      while (sum >= target) {',
      '        result = min(result, right - left + 1);',
      '        sum -= nums[left++];',
      '      }',
      '    }',
      '    return result == INT_MAX ? 0 : result;',
      '  }',
      '};',
    ], { init: 5, expand: 7, accept: 9, shrink: 10, result: 13 }),
    steps,
    visualization: { version: 1, type: 'array', activeVariables: ['left', 'right'], queuedVariables: ['target'], visitedVariables: ['result'] },
    analysis: 'State: [left,right] is the active positive-sum window.\nTime Complexity: O(n)\nSpace Complexity: O(1)',
    invariants: ['After shrinking, the next active window has sum below target.'],
  };
};

const binarySearchArtifact = (request: string, locale: Locale): ArrayArtifact => {
  const explicit = requestArray(request);
  const values = explicit ?? [-1, 0, 3, 5, 9, 12];
  const target = requestIntegerParameter(request, 'target', 9);
  if (values.some((value, index) => index > 0 && values[index - 1] > value)) {
    throw new Error('LeetCode 704 requires a non-decreasing input array.');
  }
  const steps: SimulationStep[] = [];
  let left = 0;
  let right = values.length - 1;
  let result = -1;
  while (left <= right) {
    const middle = left + Math.floor((right - left) / 2);
    steps.push(arrayStep(values, { left, middle, right }, {
      target, middleValue: values[middle], result,
    }, 7, locale === 'tr'
      ? `Orta indeks ${middle}; değer ${values[middle]}.`
      : `Middle index is ${middle}; value is ${values[middle]}.`));
    if (values[middle] === target) {
      result = middle;
      steps.push(arrayStep(values, { left, middle, right }, { target, result }, 8,
        locale === 'tr' ? `Hedef ${middle}. indekste bulundu.` : `Target found at index ${middle}.`));
      break;
    }
    if (values[middle] < target) left = middle + 1;
    else right = middle - 1;
    steps.push(arrayStep(values, left <= right ? { left, right } : {}, { target, result }, 10,
      locale === 'tr' ? `Arama aralığı [${left}, ${right}] olur.` : `Search interval becomes [${left}, ${right}].`));
  }
  if (result === -1) {
    steps.push(arrayStep(values, {}, { target, result }, 12,
      locale === 'tr' ? 'Hedef dizide yok.' : 'The target is absent.'));
  }

  return {
    id: 'binary_search_array',
    title: locale === 'tr' ? 'LeetCode 704 — İkili Arama' : 'LeetCode 704 — Binary Search',
    input: {
      kind: 'array', text: JSON.stringify(values), parameters: { target: String(target) },
      origin: explicit ? 'user' : 'agent',
    },
    inputDescription: locale === 'tr' ? 'Sıralı dizi ve hedef' : 'Sorted array and target',
    constraints: [`1 <= values.length <= ${MAX_ITEMS}`, 'values is sorted'],
    source: source([
      'class Solution {',
      'public:',
      '  int search(vector<int>& nums, int target) {',
      '    int left = 0;',
      '    int right = nums.size() - 1;',
      '    while (left <= right) {',
      '      int middle = left + (right - left) / 2;',
      '      if (nums[middle] == target) return middle;',
      '      if (nums[middle] < target) left = middle + 1;',
      '      else right = middle - 1;',
      '    }',
      '    return -1;',
      '  }',
      '};',
    ], { inspect: 7, found: 8, narrow: 10, result: 12 }),
    steps,
    visualization: {
      version: 1,
      type: 'array',
      activeVariables: ['left', 'middle', 'right'],
      queuedVariables: ['target'],
      visitedVariables: ['result'],
    },
    analysis: 'State: if target exists, it remains inside [left,right].\nTime Complexity: O(log N)\nSpace Complexity: O(1)',
    invariants: ['Every discarded half cannot contain the target.'],
  };
};

const palindromeNumberArtifact = (request: string, locale: Locale): ArrayArtifact => {
  const explicitMatch = request.match(/(?:\bx\s*=\s*|\bnumber\s*=\s*)(-?\d+)/i);
  const value = explicitMatch ? Number(explicitMatch[1]) : 121;
  if (!Number.isSafeInteger(value) || Math.abs(value) > 2_147_483_647) {
    throw new Error('LeetCode 9 requires a signed 32-bit integer.');
  }
  const digits = String(Math.abs(value)).split('').map(Number);
  const steps: SimulationStep[] = [];
  let left = 0;
  let right = digits.length - 1;
  let result = value >= 0;
  if (value < 0) {
    steps.push(arrayStep(digits, {}, { x: value, result: false }, 4,
      locale === 'tr' ? 'Negatif sayı palindrom olamaz.' : 'A negative number cannot be a palindrome.'));
  } else {
    while (left < right) {
      steps.push(arrayStep(digits, { left, right }, {
        x: value, leftDigit: digits[left], rightDigit: digits[right], result,
      }, 8, locale === 'tr'
        ? `${digits[left]} ve ${digits[right]} karşılaştırılır.`
        : `Compare ${digits[left]} and ${digits[right]}.`));
      if (digits[left] !== digits[right]) {
        result = false;
        steps.push(arrayStep(digits, { left, right }, { x: value, result }, 9,
          locale === 'tr' ? 'Rakamlar farklı; sonuç false.' : 'Digits differ; result is false.'));
        break;
      }
      left += 1;
      right -= 1;
    }
  }
  steps.push(arrayStep(digits, result && left <= right ? { left, right } : {}, { x: value, result }, 13,
    locale === 'tr' ? `Palindrom sonucu ${result}.` : `Palindrome result is ${result}.`));
  return {
    id: 'palindrome_number',
    title: locale === 'tr' ? 'LeetCode 9 — Palindrom Sayı' : 'LeetCode 9 — Palindrome Number',
    input: {
      kind: 'array', text: JSON.stringify(digits), parameters: { x: String(value) },
      origin: explicitMatch ? 'user' : 'agent',
    },
    inputDescription: locale === 'tr' ? '32 bit işaretli tam sayı' : 'Signed 32-bit integer',
    constraints: ['-2^31 <= x <= 2^31 - 1'],
    source: source([
      'class Solution {',
      'public:',
      '  bool isPalindrome(int x) {',
      '    if (x < 0) return false;',
      '    string digits = to_string(x);',
      '    int left = 0, right = digits.size() - 1;',
      '    while (left < right) {',
      '      if (digits[left] != digits[right]) return false;',
      '      ++left; --right;',
      '    }',
      '    return true;',
      '  }',
      '};',
    ], { negative: 4, compare: 8, mismatch: 9, result: 13 }),
    steps,
    visualization: { version: 1, type: 'array', activeVariables: ['left', 'right'], queuedVariables: [], visitedVariables: ['result'] },
    analysis: 'State: every digit outside [left,right] already matches its mirror.\nTime Complexity: O(log10 x)\nSpace Complexity: O(log10 x) for the displayed digit string.',
    invariants: ['All compared mirrored digit pairs are equal while result remains true.'],
  };
};

export const compileArrayTemplatePackage = (options: {
  template: ArrayTemplateId;
  id: string;
  request: string;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
  problemSpec?: import('../types/godMode').ProblemSpecV2;
  algorithmPlan?: import('../types/godMode').AlgorithmPlanV2;
  verification?: import('../types/godMode').VerificationGatesV1;
}): CustomSimulationPackageV1 => {
  const artifact = options.template === 'two-pointers-array'
    ? twoPointersArtifact(options.request, options.locale, options.workspace)
    : options.template === 'sliding-window-array'
      ? minimumSizeSubarrayArtifact(options.request, options.locale)
      : options.template === 'prefix-sum-array'
        ? subarraySumArtifact(options.request, options.locale)
        : options.template === 'binary-search-array'
          ? binarySearchArtifact(options.request, options.locale)
          : palindromeNumberArtifact(options.request, options.locale);

  const input: InputContractV1 = {
    version: 1,
    kind: artifact.input.kind,
    description: artifact.inputDescription,
    constraints: artifact.constraints,
    value: artifact.input,
    origin: artifact.input.origin === 'user' ? 'user' : 'agent',
  };
  const checkpoints = reviewTrace(artifact.steps, Math.min(16, artifact.steps.length));

  return {
    version: 1,
    id: `${artifact.id}-${options.id}`,
    title: artifact.title,
    locale: options.locale,
    createdAt: Date.now(),
    program: programShell(artifact.id, artifact.title, options.locale, artifact.input.kind),
    source: artifact.source,
    input,
    visualization: artifact.visualization,
    steps: artifact.steps,
    analysis: artifact.analysis,
    checkpoints,
    teachingPlan: createTeachingPlan(artifact.steps, checkpoints, artifact.input, options.locale, artifact.invariants),
    tests: {
      version: 1,
      passed: true,
      results: [{ id: 'active-input', passed: true, message: `${artifact.steps.length} deterministic states generated.` }],
    },
    problemSpec: options.problemSpec,
    algorithmPlan: options.algorithmPlan,
    verification: options.verification,
  };
};
