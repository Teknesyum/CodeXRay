import type {
  CustomSimulationPackageV1,
  InputContractV1,
  ProgramSpecV1,
  RenderedSourceV1,
  VisualizationContractV1,
  WorkspaceSnapshotV1,
} from '../types/godMode';
import type {
  ArrayVisualData,
  Locale,
  MatrixCellHighlight,
  MatrixVisualData,
  SimulationInput,
  SimulationStep,
} from '../types/simulation';
import { reviewTrace } from './customSimulationCompiler';
import { createTeachingPlan } from './teachingPlan';

export type DpTemplateId = 'house-robber-1d-dp' | 'lcs-2d-dp' | 'longest-palindrome-interval-dp';

interface DpArtifact {
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

const MAX_ITEMS = 18;

const normalized = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const resolveDpTemplateFromRequest = (request: string): DpTemplateId | null => {
  const text = normalized(request);
  if (/\b(house robber|ev soyguncusu|leetcode 198|lc 198)\b/.test(text)) return 'house-robber-1d-dp';
  if (/\b(lcs|longest common subsequence|en uzun ortak alt dizi|leetcode 1143|lc 1143)\b/.test(text)) return 'lcs-2d-dp';
  if (/\b(longest palindromic subsequence|en uzun palindromik alt dizi|leetcode 516|lc 516)\b/.test(text)) {
    return 'longest-palindrome-interval-dp';
  }
  return null;
};

const requestArray = (request: string): number[] | null => {
  const raw = request.match(/\[[^\]]+\]/)?.[0];
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      && value.length > 0
      && value.length <= MAX_ITEMS
      && value.every((item) => Number.isSafeInteger(item) && Number(item) >= 0)
      ? value as number[]
      : null;
  } catch {
    return null;
  }
};

const requestStrings = (request: string): string[] => {
  const bracket = request.match(/\[[^\]]+\]/)?.[0];
  if (bracket) {
    try {
      const value = JSON.parse(bracket) as unknown;
      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
        return value.filter((item) => item.length > 0 && item.length <= MAX_ITEMS).slice(0, 2);
      }
    } catch {
      // Fall through to quoted-string extraction.
    }
  }
  return [...request.matchAll(/["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((item) => item.length <= MAX_ITEMS)
    .slice(0, 2);
};

const workspaceArray = (workspace: WorkspaceSnapshotV1): number[] | null => {
  if (workspace.simulationInput.kind !== 'array') return null;
  try {
    const value = JSON.parse(workspace.simulationInput.text) as unknown;
    return Array.isArray(value)
      && value.length > 0
      && value.length <= MAX_ITEMS
      && value.every((item) => Number.isSafeInteger(item) && Number(item) >= 0)
      ? value as number[]
      : null;
  } catch {
    return null;
  }
};

const wantsCurrentInput = (request: string) => /\b(bu|mevcut|benim|current|my)\b.*\b(input|girdi|dizi|metin)/i.test(request);

const programShell = (id: string, title: string, inputKind: ProgramSpecV1['inputKind'], locale: Locale): ProgramSpecV1 => ({
  version: 1,
  id,
  title,
  locale,
  inputKind,
  budgets: { instructions: 8_000, traceSteps: 600, recursionDepth: 2, collectionSize: 600 },
  functions: [],
  entry: [{
    id: 'read-input',
    type: 'trace',
    at: 'read-input',
    explanation: locale === 'tr' ? 'Doğrulanmış DP inputunu oku.' : 'Read the validated DP input.',
    category: 'initialization',
    importance: 1,
  }],
});

const source = (lines: string[], lineMap: Record<string, number>): RenderedSourceV1 => ({
  version: 1,
  language: 'cpp',
  code: lines.join('\n'),
  lineMap,
});

const arrayStep = (
  values: Array<number | null>,
  pointers: Record<string, number>,
  vars: ArrayVisualData['vars'],
  lineNumber: number | null,
  explanation: string,
): SimulationStep => ({
  lineNumber,
  explanation,
  visualData: {
    type: 'array',
    values,
    pointers,
    sortedIndices: values.flatMap((value, index) => value === null ? [] : [index]),
    vars,
  },
});

const matrixStep = (
  values: Array<Array<number | null>>,
  rowLabels: string[],
  columnLabels: string[],
  highlights: MatrixCellHighlight[],
  fillDirection: MatrixVisualData['fillDirection'],
  vars: MatrixVisualData['vars'],
  lineNumber: number | null,
  explanation: string,
): SimulationStep => ({
  lineNumber,
  explanation,
  visualData: {
    type: 'matrix',
    values: values.map((row) => [...row]),
    rowLabels,
    columnLabels,
    highlights,
    fillDirection,
    vars,
  },
});

const houseRobberArtifact = (request: string, locale: Locale, workspace: WorkspaceSnapshotV1): DpArtifact => {
  const explicit = requestArray(request);
  const nums = explicit ?? (wantsCurrentInput(request) ? workspaceArray(workspace) : null) ?? [2, 7, 9, 3, 1];
  const origin = explicit || (wantsCurrentInput(request) && workspaceArray(workspace)) ? 'user' : 'agent';
  const dp = Array<number | null>(nums.length).fill(null);
  const steps: SimulationStep[] = [arrayStep(dp, {}, { nums, filledStates: 0 }, 5,
    locale === 'tr' ? '1D DP dizisi soldan sağa doldurulur; dp[i], 0..i evlerinden alınabilen en yüksek miktardır.' : 'Fill the 1D DP array left to right; dp[i] is the best total available from houses 0..i.')];
  for (let index = 0; index < nums.length; index += 1) {
    const take = nums[index] + (index >= 2 ? dp[index - 2] ?? 0 : 0);
    const skip = index >= 1 ? dp[index - 1] ?? 0 : 0;
    dp[index] = Math.max(take, skip);
    const pointers: Record<string, number> = { active: index };
    if (index >= 1) pointers.skipDependency = index - 1;
    if (index >= 2) pointers.takeDependency = index - 2;
    steps.push(arrayStep([...dp], pointers, {
      nums, dp: [...dp], i: index, take, skip, choice: take >= skip ? 'take' : 'skip', filledStates: index + 1,
    }, 10, locale === 'tr'
      ? `dp[${index}] = max(al=${nums[index]} + ${index >= 2 ? `dp[${index - 2}]=${dp[index - 2]}` : '0'}, atla=${skip}) = ${dp[index]}.`
      : `dp[${index}] = max(take=${nums[index]} + ${index >= 2 ? `dp[${index - 2}]=${dp[index - 2]}` : '0'}, skip=${skip}) = ${dp[index]}.`));
  }
  const result = dp.at(-1) ?? 0;
  steps.push(arrayStep([...dp], { result: nums.length - 1 }, { nums, dp: [...dp], result }, 12,
    locale === 'tr' ? `Nihai 1D DP sonucu ${result}.` : `The final 1D DP result is ${result}.`));
  const title = locale === 'tr' ? 'LeetCode 198 — Ev Soyguncusu' : 'LeetCode 198 — House Robber';
  return {
    id: 'house_robber_1d_dp', title,
    input: { kind: 'array', text: JSON.stringify(nums), origin },
    inputDescription: locale === 'tr' ? 'Yan yana evlerdeki para miktarları' : 'Money in adjacent houses',
    constraints: [`1 <= nums.length <= ${MAX_ITEMS}`, 'nums[i] is a non-negative safe integer.'],
    source: source([
      'class Solution {', 'public:', '  int rob(vector<int>& nums) {',
      '    const int n = nums.size();', '    vector<int> dp(n, 0);',
      '    for (int i = 0; i < n; ++i) {',
      '      const int take = nums[i] + (i >= 2 ? dp[i - 2] : 0);',
      '      const int skip = i >= 1 ? dp[i - 1] : 0;',
      '      dp[i] = max(take, skip);', '    }', '    return dp[n - 1];', '  }', '};',
    ], { 'read-input': 4, transition: 9, result: 11 }),
    steps,
    visualization: { version: 1, type: 'array', activeVariables: ['i'], queuedVariables: ['takeDependency', 'skipDependency'], visitedVariables: ['filledStates'], pathVariable: 'choice' },
    analysis: 'State: dp[i] is the best amount from houses 0..i.\nTransition: dp[i] = max(nums[i] + dp[i-2], dp[i-1]).\nFill order: left to right.\nTime Complexity: O(n)\nSpace Complexity: O(n)',
    invariants: ['Before dp[i] is computed, dp[i-1] and dp[i-2] are final optimal values.'],
  };
};

const lcsArtifact = (request: string, locale: Locale, workspace: WorkspaceSnapshotV1): DpArtifact => {
  const explicit = requestStrings(request);
  const first = explicit[0] ?? (wantsCurrentInput(request) && workspace.simulationInput.kind === 'string' ? workspace.simulationInput.text : 'abcde');
  const second = explicit[1] ?? (wantsCurrentInput(request) && workspace.simulationInput.kind === 'string' ? workspace.simulationInput.parameters?.other : undefined) ?? 'ace';
  const rows = first.length + 1;
  const columns = second.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number | null>(columns).fill(null));
  const rowLabels = ['∅', ...first];
  const columnLabels = ['∅', ...second];
  const steps: SimulationStep[] = [matrixStep(dp, rowLabels, columnLabels, [], 'row', { first, second, filledCells: 0 }, 5,
    locale === 'tr' ? 'dp[i][j], ilk i ve ilk j karakterin LCS uzunluğunu tutar. Sıfırıncı satır ve sütun taban durumdur.' : 'dp[i][j] stores the LCS length for the first i and j characters. Row zero and column zero are base cases.')];
  let filledCells = 0;
  for (let row = 0; row < rows; row += 1) {
    dp[row][0] = 0;
    filledCells += 1;
    steps.push(matrixStep(dp, rowLabels, columnLabels, [{ row, column: 0, role: 'base', label: 'empty prefix = 0' }], 'row', { first, second, i: row, j: 0, value: 0, filledCells }, 7, `dp[${row}][0] = 0.`));
  }
  for (let column = 1; column < columns; column += 1) {
    dp[0][column] = 0;
    filledCells += 1;
    steps.push(matrixStep(dp, rowLabels, columnLabels, [{ row: 0, column, role: 'base', label: 'empty prefix = 0' }], 'row', { first, second, i: 0, j: column, value: 0, filledCells }, 7, `dp[0][${column}] = 0.`));
  }
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const match = first[row - 1] === second[column - 1];
      const diagonal = dp[row - 1][column - 1] ?? 0;
      const up = dp[row - 1][column] ?? 0;
      const left = dp[row][column - 1] ?? 0;
      dp[row][column] = match ? diagonal + 1 : Math.max(up, left);
      filledCells += 1;
      const dependencies: MatrixCellHighlight[] = match
        ? [{ row: row - 1, column: column - 1, role: 'dependency', label: `diagonal=${diagonal}` }]
        : [
          { row: row - 1, column, role: 'dependency', label: `up=${up}` },
          { row, column: column - 1, role: 'dependency', label: `left=${left}` },
        ];
      steps.push(matrixStep(dp, rowLabels, columnLabels, [
        { row, column, role: 'active', label: `dp[${row}][${column}]=${dp[row][column]}` }, ...dependencies,
      ], 'row', { first, second, i: row, j: column, match, diagonal, up, left, value: dp[row][column] ?? 0, filledCells }, match ? 11 : 13,
      locale === 'tr'
        ? match ? `'${first[row - 1]}' eşleşir: dp[${row}][${column}] = 1 + dp[${row - 1}][${column - 1}] = ${dp[row][column]}.` : `Karakterler farklı: dp[${row}][${column}] = max(${up}, ${left}) = ${dp[row][column]}.`
        : match ? `'${first[row - 1]}' matches: dp[${row}][${column}] = 1 + dp[${row - 1}][${column - 1}] = ${dp[row][column]}.` : `Characters differ: dp[${row}][${column}] = max(${up}, ${left}) = ${dp[row][column]}.`));
    }
  }
  const result = dp.at(-1)?.at(-1) ?? 0;
  steps.push(matrixStep(dp, rowLabels, columnLabels, [{ row: rows - 1, column: columns - 1, role: 'result', label: `LCS=${result}` }], 'row', { first, second, result, filledCells }, 16,
    locale === 'tr' ? `LCS uzunluğu ${result}.` : `The LCS length is ${result}.`));
  const title = locale === 'tr' ? 'LeetCode 1143 — En Uzun Ortak Alt Dizi' : 'LeetCode 1143 — Longest Common Subsequence';
  return {
    id: 'lcs_2d_dp', title,
    input: { kind: 'string', text: first, parameters: { other: second }, origin: explicit.length ? 'user' : 'agent' },
    inputDescription: locale === 'tr' ? 'Karşılaştırılacak iki metin' : 'Two strings to compare',
    constraints: [`1 <= text lengths <= ${MAX_ITEMS}`],
    source: source([
      'class Solution {', 'public:', '  int longestCommonSubsequence(string a, string b) {',
      '    const int m = a.size(), n = b.size();', '    vector<vector<int>> dp(m + 1, vector<int>(n + 1, 0));',
      '    for (int i = 1; i <= m; ++i) {', '      for (int j = 1; j <= n; ++j) {',
      '        if (a[i - 1] == b[j - 1])', '          dp[i][j] = 1 + dp[i - 1][j - 1];',
      '        else', '          dp[i][j] = max(dp[i - 1][j], dp[i][j - 1]);',
      '      }', '    }', '    return dp[m][n];', '  }', '};',
    ], { 'read-input': 4, base: 5, match: 9, mismatch: 11, result: 14 }),
    steps,
    visualization: { version: 1, type: 'matrix', activeVariables: ['i', 'j'], queuedVariables: ['diagonal', 'up', 'left'], visitedVariables: ['filledCells'] },
    analysis: 'State: dp[i][j] is the LCS length of prefixes a[0..i) and b[0..j).\nTransition: matching characters use the diagonal + 1; otherwise use max(up, left).\nFill order: row by row after zero-prefix bases.\nTime Complexity: O(mn)\nSpace Complexity: O(mn)',
    invariants: ['Before dp[i][j] is computed, its diagonal, upper, and left dependencies are final.'],
  };
};

const palindromeArtifact = (request: string, locale: Locale, workspace: WorkspaceSnapshotV1): DpArtifact => {
  const explicit = requestStrings(request);
  const text = explicit[0] ?? (wantsCurrentInput(request) && workspace.simulationInput.kind === 'string' ? workspace.simulationInput.text : 'bbbab');
  const size = text.length;
  const dp = Array.from({ length: size }, () => Array<number | null>(size).fill(null));
  const labels = [...text].map((character, index) => `${index} · ${character}`);
  const steps: SimulationStep[] = [matrixStep(dp, labels, labels, [], 'diagonal', { text, intervalLength: 1, filledCells: 0 }, 5,
    locale === 'tr' ? 'dp[i][j], i..j aralığındaki en uzun palindromik alt dizinin uzunluğunu tutar.' : 'dp[i][j] stores the longest palindromic subsequence length inside interval i..j.')];
  for (let index = 0; index < size; index += 1) {
    dp[index][index] = 1;
    steps.push(matrixStep(dp, labels, labels, [{ row: index, column: index, role: 'base', label: 'single character = 1' }], 'diagonal', { text, i: index, j: index, intervalLength: 1, value: 1, filledCells: index + 1 }, 7, `dp[${index}][${index}] = 1.`));
  }
  let filledCells = size;
  for (let length = 2; length <= size; length += 1) {
    for (let left = 0; left + length - 1 < size; left += 1) {
      const right = left + length - 1;
      const match = text[left] === text[right];
      const inner = length === 2 ? 0 : dp[left + 1][right - 1] ?? 0;
      const dropLeft = dp[left + 1][right] ?? 0;
      const dropRight = dp[left][right - 1] ?? 0;
      dp[left][right] = match ? inner + 2 : Math.max(dropLeft, dropRight);
      filledCells += 1;
      const dependencies: MatrixCellHighlight[] = match && length > 2
        ? [{ row: left + 1, column: right - 1, role: 'dependency', label: `inner=${inner}` }]
        : !match ? [
          { row: left + 1, column: right, role: 'dependency', label: `dropLeft=${dropLeft}` },
          { row: left, column: right - 1, role: 'dependency', label: `dropRight=${dropRight}` },
        ] : [];
      steps.push(matrixStep(dp, labels, labels, [
        { row: left, column: right, role: 'active', label: `dp[${left}][${right}]=${dp[left][right]}` }, ...dependencies,
      ], 'diagonal', { text, i: left, j: right, intervalLength: length, match, inner, dropLeft, dropRight, value: dp[left][right] ?? 0, filledCells }, match ? 12 : 14,
      locale === 'tr'
        ? match ? `Uçlar '${text[left]}' ile eşleşir: dp[${left}][${right}] = 2 + ${inner} = ${dp[left][right]}.` : `Uçlar farklı: dp[${left}][${right}] = max(${dropLeft}, ${dropRight}) = ${dp[left][right]}.`
        : match ? `Ends match on '${text[left]}': dp[${left}][${right}] = 2 + ${inner} = ${dp[left][right]}.` : `Ends differ: dp[${left}][${right}] = max(${dropLeft}, ${dropRight}) = ${dp[left][right]}.`));
    }
  }
  const result = dp[0][size - 1] ?? 0;
  steps.push(matrixStep(dp, labels, labels, [{ row: 0, column: size - 1, role: 'result', label: `LPS=${result}` }], 'diagonal', { text, result, filledCells }, 17,
    locale === 'tr' ? `En uzun palindromik alt dizi uzunluğu ${result}.` : `The longest palindromic subsequence length is ${result}.`));
  const title = locale === 'tr' ? 'LeetCode 516 — En Uzun Palindromik Alt Dizi' : 'LeetCode 516 — Longest Palindromic Subsequence';
  return {
    id: 'longest_palindromic_subsequence_interval_dp', title,
    input: { kind: 'string', text, origin: explicit.length ? 'user' : 'agent' },
    inputDescription: locale === 'tr' ? 'Palindromik alt dizi aranacak metin' : 'Text searched for a palindromic subsequence',
    constraints: [`1 <= text.length <= ${MAX_ITEMS}`],
    source: source([
      'class Solution {', 'public:', '  int longestPalindromeSubseq(string s) {',
      '    const int n = s.size();', '    vector<vector<int>> dp(n, vector<int>(n, 0));',
      '    for (int i = 0; i < n; ++i) dp[i][i] = 1;',
      '    for (int len = 2; len <= n; ++len) {', '      for (int i = 0; i + len - 1 < n; ++i) {',
      '        const int j = i + len - 1;', '        if (s[i] == s[j])',
      '          dp[i][j] = 2 + (len == 2 ? 0 : dp[i + 1][j - 1]);',
      '        else', '          dp[i][j] = max(dp[i + 1][j], dp[i][j - 1]);',
      '      }', '    }', '    return dp[0][n - 1];', '  }', '};',
    ], { 'read-input': 4, base: 6, match: 11, mismatch: 13, result: 16 }),
    steps,
    visualization: { version: 1, type: 'matrix', activeVariables: ['i', 'j'], queuedVariables: ['inner', 'dropLeft', 'dropRight'], visitedVariables: ['filledCells'] },
    analysis: 'State: dp[i][j] is the LPS length inside s[i..j].\nTransition: equal endpoints add two to the inner interval; otherwise drop one endpoint.\nFill order: diagonal, then increasing interval length.\nTime Complexity: O(n^2)\nSpace Complexity: O(n^2)',
    invariants: ['Before an interval is computed, every shorter dependency interval is final.'],
  };
};

export const compileDpTemplatePackage = (options: {
  template: DpTemplateId;
  id: string;
  request: string;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
}): CustomSimulationPackageV1 => {
  const artifact = options.template === 'house-robber-1d-dp'
    ? houseRobberArtifact(options.request, options.locale, options.workspace)
    : options.template === 'lcs-2d-dp'
      ? lcsArtifact(options.request, options.locale, options.workspace)
      : palindromeArtifact(options.request, options.locale, options.workspace);
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
    program: programShell(artifact.id, artifact.title, artifact.input.kind, options.locale),
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
      results: [{ id: 'active-input', passed: true, message: `${artifact.steps.length} deterministic DP states generated.` }],
    },
  };
};
