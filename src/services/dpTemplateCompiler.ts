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

export type DpTemplateId =
  | 'house-robber-1d-dp'
  | 'lcs-2d-dp'
  | 'lcs-space-optimized-1d-dp'
  | 'longest-palindrome-interval-dp'
  | 'coin-change-1d-dp'
  | 'edit-distance-2d-dp'
  | 'knapsack-2d-dp';

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
  if (/\b(lcs|longest common subsequence|en uzun ortak alt dizi|leetcode 1143|lc 1143)\b/.test(text)
    && /\b(space|memory|bellek)\b.*\b(optimi|min)|\bo min m n\b/.test(text)) {
    return 'lcs-space-optimized-1d-dp';
  }
  if (/\b(lcs|longest common subsequence|en uzun ortak alt dizi|leetcode 1143|lc 1143)\b/.test(text)) return 'lcs-2d-dp';
  if (/\b(coin change|bozuk para degisimi|leetcode 322|lc 322)\b/.test(text)) return 'coin-change-1d-dp';
  if (/\b(edit distance|duzenleme mesafesi|levenshtein|leetcode 72|lc 72)\b/.test(text)) return 'edit-distance-2d-dp';
  if (/\b(0 1 knapsack|01 knapsack|knapsack|sirt cantasi)\b/.test(text)) return 'knapsack-2d-dp';
  if (/\b(longest palindromic subsequence|longest palindrome sequence|en uzun palindromik (?:alt )?dizi|leetcode 516|lc 516)\b/.test(text)) {
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

const requestArrays = (request: string): number[][] => [...request.matchAll(/\[[^\]]*\]/g)]
  .flatMap((match) => {
    try {
      const value = JSON.parse(match[0]) as unknown;
      return Array.isArray(value)
        && value.length > 0
        && value.length <= MAX_ITEMS
        && value.every((item) => Number.isSafeInteger(item) && Number(item) >= 0)
        ? [value as number[]]
        : [];
    } catch {
      return [];
    }
  });

const requestInteger = (request: string, labels: RegExp): number | null => {
  const match = request.match(new RegExp(`(?:${labels.source})\\s*(?:=|:|is|olarak)?\\s*(\\d+)`, 'i'));
  const value = Number(match?.[1]);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
};

const requestStringsAllowEmpty = (request: string): string[] => {
  const bracket = request.match(/\[[^\]]*\]/)?.[0];
  if (bracket) {
    try {
      const value = JSON.parse(bracket) as unknown;
      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
        return value.filter((item) => item.length <= MAX_ITEMS).slice(0, 2);
      }
    } catch {
      // Fall through to quoted-string extraction.
    }
  }
  return [...request.matchAll(/["']([^"']*)["']/g)]
    .map((match) => match[1])
    .filter((item) => item.length <= MAX_ITEMS)
    .slice(0, 2);
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

const source = (
  lines: string[],
  lineMap: Record<string, number>,
  language: RenderedSourceV1['language'] = 'cpp',
): RenderedSourceV1 => ({
  version: 1,
  language,
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
  const steps: SimulationStep[] = [matrixStep(dp, rowLabels, columnLabels, [], 'row', { first, second, filledCells: 0 }, 4,
    locale === 'tr' ? 'dp[i][j], ilk i ve ilk j karakterin LCS uzunluğunu tutar. Sıfırıncı satır ve sütun taban durumdur.' : 'dp[i][j] stores the LCS length for the first i and j characters. Row zero and column zero are base cases.')];
  let filledCells = 0;
  for (let row = 0; row < rows; row += 1) {
    dp[row][0] = 0;
    filledCells += 1;
    steps.push(matrixStep(dp, rowLabels, columnLabels, [{ row, column: 0, role: 'base', label: 'empty prefix = 0' }], 'row', { first, second, i: row, j: 0, value: 0, filledCells }, 4, `dp[${row}][0] = 0.`));
  }
  for (let column = 1; column < columns; column += 1) {
    dp[0][column] = 0;
    filledCells += 1;
    steps.push(matrixStep(dp, rowLabels, columnLabels, [{ row: 0, column, role: 'base', label: 'empty prefix = 0' }], 'row', { first, second, i: 0, j: column, value: 0, filledCells }, 4, `dp[0][${column}] = 0.`));
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
      ], 'row', { first, second, i: row, j: column, match, diagonal, up, left, value: dp[row][column] ?? 0, filledCells }, match ? 8 : 10,
      locale === 'tr'
        ? match ? `'${first[row - 1]}' eşleşir: dp[${row}][${column}] = 1 + dp[${row - 1}][${column - 1}] = ${dp[row][column]}.` : `Karakterler farklı: dp[${row}][${column}] = max(${up}, ${left}) = ${dp[row][column]}.`
        : match ? `'${first[row - 1]}' matches: dp[${row}][${column}] = 1 + dp[${row - 1}][${column - 1}] = ${dp[row][column]}.` : `Characters differ: dp[${row}][${column}] = max(${up}, ${left}) = ${dp[row][column]}.`));
    }
  }
  const result = dp.at(-1)?.at(-1) ?? 0;
  steps.push(matrixStep(dp, rowLabels, columnLabels, [{ row: rows - 1, column: columns - 1, role: 'result', label: `LCS=${result}` }], 'row', { first, second, result, filledCells }, 13,
    locale === 'tr' ? `LCS uzunluğu ${result}.` : `The LCS length is ${result}.`));
  const title = locale === 'tr' ? 'LeetCode 1143 — En Uzun Ortak Alt Dizi' : 'LeetCode 1143 — Longest Common Subsequence';
  return {
    id: 'lcs_2d_dp', title,
    input: { kind: 'string', text: first, parameters: { other: second }, origin: explicit.length ? 'user' : 'agent' },
    inputDescription: locale === 'tr' ? 'Karşılaştırılacak iki metin' : 'Two strings to compare',
    constraints: ['1 <= text1.length, text2.length <= 1000', `Interactive visualization uses at most ${MAX_ITEMS} characters per text.`],
    source: source([
      'class Solution {',
      '  public int longestCommonSubsequence(String text1, String text2) {',
      '    int m = text1.length(), n = text2.length();',
      '    int[][] dp = new int[m + 1][n + 1];',
      '    for (int i = 1; i <= m; i++) {',
      '      for (int j = 1; j <= n; j++) {',
      '        if (text1.charAt(i - 1) == text2.charAt(j - 1))',
      '          dp[i][j] = 1 + dp[i - 1][j - 1];',
      '        else',
      '          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);',
      '      }',
      '    }',
      '    return dp[m][n];',
      '  }',
      '}',
    ], { 'read-input': 3, base: 4, match: 8, mismatch: 10, result: 13 }, 'java'),
    steps,
    visualization: { version: 1, type: 'matrix', activeVariables: ['i', 'j'], queuedVariables: ['diagonal', 'up', 'left'], visitedVariables: ['filledCells'] },
    analysis: 'State: dp[i][j] is the LCS length of prefixes a[0..i) and b[0..j).\nTransition: matching characters use the diagonal + 1; otherwise use max(up, left).\nFill order: row by row after zero-prefix bases.\nTime Complexity: O(mn)\nSpace Complexity: O(mn)',
    invariants: ['Before dp[i][j] is computed, its diagonal, upper, and left dependencies are final.'],
  };
};

const optimizedLcsArtifact = (request: string, locale: Locale, workspace: WorkspaceSnapshotV1): DpArtifact => {
  const explicit = requestStrings(request);
  const workspaceFirst = workspace.simulationInput.kind === 'string'
    ? workspace.simulationInput.text
    : undefined;
  const workspaceSecond = workspace.simulationInput.kind === 'string'
    ? workspace.simulationInput.parameters?.other
    : undefined;
  const first = explicit[0] ?? workspaceFirst ?? 'abcde';
  const second = explicit[1] ?? workspaceSecond ?? 'ace';
  const rows = first.length >= second.length ? first : second;
  const columns = first.length >= second.length ? second : first;
  const dp = Array<number>(columns.length + 1).fill(0);
  const steps: SimulationStep[] = [arrayStep([...dp], { base: 0 }, {
    text1: first,
    text2: second,
    rows,
    columns,
    row: 0,
    filledStates: 1,
  }, 7, locale === 'tr'
    ? `Kısa metin sütun seçildi; ${columns.length + 1} hücrelik tek DP satırı O(min(m,n)) bellek kullanır.`
    : `The shorter text is used for columns; one ${columns.length + 1}-cell DP row uses O(min(m,n)) memory.`)];

  let filledStates = 1;
  for (let row = 1; row <= rows.length; row += 1) {
    let diagonal = 0;
    for (let column = 1; column <= columns.length; column += 1) {
      const upper = dp[column];
      const left = dp[column - 1];
      const match = rows[row - 1] === columns[column - 1];
      dp[column] = match ? diagonal + 1 : Math.max(upper, left);
      filledStates += 1;
      steps.push(arrayStep([...dp], {
        active: column,
        left: column - 1,
        upper: column,
      }, {
        text1: first,
        text2: second,
        rows,
        columns,
        i: row,
        j: column,
        rowCharacter: rows[row - 1],
        columnCharacter: columns[column - 1],
        match,
        diagonal,
        upper,
        left,
        value: dp[column],
        filledStates,
      }, match ? 11 : 13, locale === 'tr'
        ? match
          ? `'${rows[row - 1]}' eşleşir: dp[${column}] = önceki diagonal ${diagonal} + 1 = ${dp[column]}.`
          : `Karakterler farklı: dp[${column}] = max(üst=${upper}, sol=${left}) = ${dp[column]}.`
        : match
          ? `'${rows[row - 1]}' matches: dp[${column}] = previous diagonal ${diagonal} + 1 = ${dp[column]}.`
          : `Characters differ: dp[${column}] = max(upper=${upper}, left=${left}) = ${dp[column]}.`));
      diagonal = upper;
    }
  }

  const result = dp[columns.length] ?? 0;
  steps.push(arrayStep([...dp], { result: columns.length }, {
    text1: first,
    text2: second,
    rows,
    columns,
    result,
    memoryCells: columns.length + 1,
    filledStates,
  }, 17, locale === 'tr'
    ? `LCS uzunluğu ${result}; yalnızca ${columns.length + 1} DP hücresi tutuldu.`
    : `The LCS length is ${result}; only ${columns.length + 1} DP cells were retained.`));

  const title = locale === 'tr'
    ? 'LeetCode 1143 — Bellek Optimize LCS'
    : 'LeetCode 1143 — Space-Optimized LCS';
  return {
    id: 'lcs_space_optimized_1d_dp',
    title,
    input: {
      kind: 'string',
      text: first,
      parameters: { other: second },
      origin: explicit.length ? 'user' : workspaceFirst && workspaceSecond ? 'user' : 'agent',
    },
    inputDescription: locale === 'tr' ? 'Karşılaştırılacak iki metin' : 'Two strings to compare',
    constraints: ['1 <= text1.length, text2.length <= 1000', `Interactive visualization uses at most ${MAX_ITEMS} characters per text.`],
    source: source([
      'class Solution {',
      '  public int longestCommonSubsequence(String text1, String text2) {',
      '    String rows = text1.length() >= text2.length() ? text1 : text2;',
      '    String columns = text1.length() >= text2.length() ? text2 : text1;',
      '    int[] dp = new int[columns.length() + 1];',
      '    for (int i = 1; i <= rows.length(); i++) {',
      '      int diagonal = 0;',
      '      for (int j = 1; j <= columns.length(); j++) {',
      '        int upper = dp[j];',
      '        if (rows.charAt(i - 1) == columns.charAt(j - 1))',
      '          dp[j] = diagonal + 1;',
      '        else',
      '          dp[j] = Math.max(dp[j], dp[j - 1]);',
      '        diagonal = upper;',
      '      }',
      '    }',
      '    return dp[columns.length()];',
      '  }',
      '}',
    ], { 'read-input': 3, base: 5, match: 11, mismatch: 13, result: 17 }, 'java'),
    steps,
    visualization: {
      version: 1,
      type: 'array',
      activeVariables: ['i', 'j'],
      queuedVariables: ['diagonal', 'upper', 'left'],
      visitedVariables: ['filledStates'],
    },
    analysis: 'State: dp[j] is the LCS length for the processed row prefix and columns[0..j).\nTransition: a match uses the saved previous-row diagonal + 1; otherwise use max(previous-row upper, current-row left).\nFill order: left to right for every row while preserving upper before overwrite.\nTime Complexity: O(mn)\nSpace Complexity: O(min(m,n))',
    invariants: ['Before dp[j] is overwritten, diagonal stores the old dp[j-1], upper stores the old dp[j], and dp[j-1] is final for the current row.'],
  };
};

const coinChangeArtifact = (request: string, locale: Locale): DpArtifact => {
  const arrays = requestArrays(request);
  const requestedCoins = arrays[0]?.filter((coin) => coin > 0);
  const coins = requestedCoins?.length ? requestedCoins : [1, 2, 5];
  const requestedAmount = requestInteger(request, /target\s+amount|amount|hedef\s+miktar|miktar/);
  const amount = requestedAmount !== null && requestedAmount <= 80 ? requestedAmount : 11;
  const dp = Array<number | null>(amount + 1).fill(null);
  dp[0] = 0;
  const steps: SimulationStep[] = [arrayStep([...dp], { base: 0 }, {
    coins, amount, current: 0, value: 0, filledStates: 1,
  }, 4, locale === 'tr'
    ? 'dp[0] = 0 taban durumudur; sıfır miktar için bozuk para gerekmez.'
    : 'dp[0] = 0 is the base case; zero coins are needed for amount zero.')];
  for (let current = 1; current <= amount; current += 1) {
    let best = Number.POSITIVE_INFINITY;
    let chosenCoin: number | null = null;
    const reachableDependencies: number[] = [];
    for (const coin of coins) {
      if (coin > current || dp[current - coin] === null) continue;
      reachableDependencies.push(current - coin);
      const candidate = (dp[current - coin] ?? 0) + 1;
      if (candidate < best) {
        best = candidate;
        chosenCoin = coin;
      }
    }
    dp[current] = Number.isFinite(best) ? best : null;
    const pointers: Record<string, number> = { active: current };
    reachableDependencies.forEach((dependency, index) => {
      pointers[`dependency${index + 1}`] = dependency;
    });
    steps.push(arrayStep([...dp], pointers, {
      coins,
      amount,
      current,
      chosenCoin: chosenCoin ?? 'none',
      value: dp[current] ?? -1,
      reachableDependencies,
      filledStates: current + 1,
    }, 10, locale === 'tr'
      ? `dp[${current}] = ${dp[current] ?? 'ulaşılamaz'}${chosenCoin === null ? '' : `; son seçilen bozuk para ${chosenCoin}`}.`
      : `dp[${current}] = ${dp[current] ?? 'unreachable'}${chosenCoin === null ? '' : ` using coin ${chosenCoin} last`}.`));
  }
  const result = dp[amount] ?? -1;
  steps.push(arrayStep([...dp], { result: amount }, {
    coins, amount, result, possible: result >= 0, filledStates: amount + 1,
  }, 13, locale === 'tr'
    ? `Minimum bozuk para sayısı ${result}.`
    : `The minimum coin count is ${result}.`));
  const title = locale === 'tr' ? 'LeetCode 322 — Bozuk Para Değişimi' : 'LeetCode 322 — Coin Change';
  return {
    id: 'coin_change_1d_dp',
    title,
    input: { kind: 'array', text: JSON.stringify(coins), parameters: { amount: String(amount) }, origin: arrays.length || requestedAmount !== null ? 'user' : 'agent' },
    inputDescription: locale === 'tr' ? 'Bozuk para değerleri ve hedef miktar' : 'Coin denominations and target amount',
    constraints: ['1 <= coins.length <= 12', '1 <= coins[i] <= 2^31 - 1', '0 <= amount <= 10^4', 'Interactive visualization caps amount at 80.'],
    source: source([
      'import java.util.Arrays;',
      'class Solution {',
      '  public int coinChange(int[] coins, int amount) {',
      '    int[] dp = new int[amount + 1];',
      '    Arrays.fill(dp, amount + 1);',
      '    dp[0] = 0;',
      '    for (int current = 1; current <= amount; current++) {',
      '      for (int coin : coins) {',
      '        if (coin <= current)',
      '          dp[current] = Math.min(dp[current], dp[current - coin] + 1);',
      '      }',
      '    }',
      '    return dp[amount] > amount ? -1 : dp[amount];',
      '  }',
      '}',
    ], { 'read-input': 4, base: 6, transition: 10, result: 13 }, 'java'),
    steps,
    visualization: { version: 1, type: 'array', activeVariables: ['current'], queuedVariables: ['reachableDependencies'], visitedVariables: ['filledStates'], pathVariable: 'chosenCoin' },
    analysis: 'State: dp[x] is the minimum coins needed for amount x.\nTransition: dp[x] = min(dp[x], dp[x-coin] + 1).\nFill order: amounts 1 through target.\nTime Complexity: O(amount * coins.length)\nSpace Complexity: O(amount)',
    invariants: ['Before dp[current] is computed, every smaller reachable amount is final.'],
  };
};

const editDistanceArtifact = (request: string, locale: Locale, workspace: WorkspaceSnapshotV1): DpArtifact => {
  const explicit = requestStringsAllowEmpty(request);
  const first = explicit[0] ?? (wantsCurrentInput(request) && workspace.simulationInput.kind === 'string' ? workspace.simulationInput.text : 'horse');
  const second = explicit[1] ?? (wantsCurrentInput(request) && workspace.simulationInput.kind === 'string' ? workspace.simulationInput.parameters?.other : undefined) ?? 'ros';
  const rows = first.length + 1;
  const columns = second.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number | null>(columns).fill(null));
  const rowLabels = ['∅', ...first];
  const columnLabels = ['∅', ...second];
  const steps: SimulationStep[] = [matrixStep(dp, rowLabels, columnLabels, [], 'row', {
    first, second, filledCells: 0,
  }, 4, locale === 'tr'
    ? 'dp[i][j], ilk i karakteri ilk j karaktere dönüştürmenin minimum maliyetidir.'
    : 'dp[i][j] is the minimum cost to convert the first i characters into the first j characters.')];
  let filledCells = 0;
  for (let row = 0; row < rows; row += 1) {
    dp[row][0] = row;
    filledCells += 1;
    steps.push(matrixStep(dp, rowLabels, columnLabels, [{ row, column: 0, role: 'base', label: `${row} deletes` }], 'row', {
      first, second, i: row, j: 0, value: row, operation: 'delete', filledCells,
    }, 5, `dp[${row}][0] = ${row}.`));
  }
  for (let column = 1; column < columns; column += 1) {
    dp[0][column] = column;
    filledCells += 1;
    steps.push(matrixStep(dp, rowLabels, columnLabels, [{ row: 0, column, role: 'base', label: `${column} inserts` }], 'row', {
      first, second, i: 0, j: column, value: column, operation: 'insert', filledCells,
    }, 6, `dp[0][${column}] = ${column}.`));
  }
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const match = first[row - 1] === second[column - 1];
      const deletion = dp[row - 1][column] ?? 0;
      const insertion = dp[row][column - 1] ?? 0;
      const replacement = dp[row - 1][column - 1] ?? 0;
      const minimum = Math.min(deletion, insertion, replacement);
      dp[row][column] = match ? replacement : 1 + minimum;
      const operation = match ? 'match' : minimum === replacement ? 'replace' : minimum === deletion ? 'delete' : 'insert';
      filledCells += 1;
      steps.push(matrixStep(dp, rowLabels, columnLabels, [
        { row, column, role: 'active', label: `dp[${row}][${column}]=${dp[row][column]}` },
        { row: row - 1, column, role: 'dependency', label: `delete=${deletion}` },
        { row, column: column - 1, role: 'dependency', label: `insert=${insertion}` },
        { row: row - 1, column: column - 1, role: 'dependency', label: `${match ? 'match' : 'replace'}=${replacement}` },
      ], 'row', {
        first, second, i: row, j: column, match, deletion, insertion, replacement, operation, value: dp[row][column] ?? 0, filledCells,
      }, match ? 10 : 12, locale === 'tr'
        ? `dp[${row}][${column}] = ${dp[row][column]}; işlem: ${operation}.`
        : `dp[${row}][${column}] = ${dp[row][column]}; operation: ${operation}.`));
    }
  }
  const result = dp[rows - 1][columns - 1] ?? 0;
  steps.push(matrixStep(dp, rowLabels, columnLabels, [{ row: rows - 1, column: columns - 1, role: 'result', label: `distance=${result}` }], 'row', {
    first, second, result, filledCells,
  }, 15, locale === 'tr' ? `Düzenleme mesafesi ${result}.` : `The edit distance is ${result}.`));
  const title = locale === 'tr' ? 'LeetCode 72 — Düzenleme Mesafesi' : 'LeetCode 72 — Edit Distance';
  return {
    id: 'edit_distance_2d_dp', title,
    input: { kind: 'string', text: first, parameters: { other: second }, origin: explicit.length ? 'user' : 'agent' },
    inputDescription: locale === 'tr' ? 'Dönüştürülecek iki metin' : 'The two strings to transform',
    constraints: ['0 <= word1.length, word2.length <= 500', 'Lowercase English letters.', `Interactive visualization uses at most ${MAX_ITEMS} characters per word.`],
    source: source([
      'class Solution {',
      '  public int minDistance(String word1, String word2) {',
      '    int m = word1.length(), n = word2.length();',
      '    int[][] dp = new int[m + 1][n + 1];',
      '    for (int i = 0; i <= m; i++) dp[i][0] = i;',
      '    for (int j = 0; j <= n; j++) dp[0][j] = j;',
      '    for (int i = 1; i <= m; i++) {',
      '      for (int j = 1; j <= n; j++) {',
      '        if (word1.charAt(i - 1) == word2.charAt(j - 1))',
      '          dp[i][j] = dp[i - 1][j - 1];',
      '        else',
      '          dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], Math.min(dp[i - 1][j], dp[i][j - 1]));',
      '      }',
      '    }',
      '    return dp[m][n];',
      '  }',
      '}',
    ], { 'read-input': 3, base: 5, transition: 12, result: 15 }, 'java'),
    steps,
    visualization: { version: 1, type: 'matrix', activeVariables: ['i', 'j'], queuedVariables: ['deletion', 'insertion', 'replacement'], visitedVariables: ['filledCells'], pathVariable: 'operation' },
    analysis: 'State: dp[i][j] is the minimum edits between prefixes word1[0..i) and word2[0..j).\nTransition: equal characters use the diagonal; otherwise add one to min(replace, delete, insert).\nFill order: base row/column, then row by row.\nTime Complexity: O(mn)\nSpace Complexity: O(mn)',
    invariants: ['Before dp[i][j] is computed, its upper, left, and diagonal dependencies are final.'],
  };
};

const knapsackArtifact = (request: string, locale: Locale): DpArtifact => {
  const arrays = requestArrays(request);
  const validPair = arrays.length >= 2 && arrays[0].length === arrays[1].length;
  const weights = validPair ? arrays[0] : [1, 3, 4, 5];
  const values = validPair ? arrays[1] : [1, 4, 5, 7];
  const requestedCapacity = requestInteger(request, /capacity|\bW\b|kapasite/);
  const capacity = requestedCapacity !== null && requestedCapacity <= 40 ? requestedCapacity : 7;
  const rows = weights.length + 1;
  const columns = capacity + 1;
  const dp = Array.from({ length: rows }, () => Array<number | null>(columns).fill(null));
  const rowLabels = ['∅', ...weights.map((weight, index) => `${index}:w${weight}/v${values[index]}`)];
  const columnLabels = Array.from({ length: columns }, (_, index) => String(index));
  const steps: SimulationStep[] = [matrixStep(dp, rowLabels, columnLabels, [], 'row', {
    weights, values, capacity, filledCells: 0,
  }, 4, locale === 'tr'
    ? 'dp[i][w], ilk i öğeyle w kapasitesinde elde edilen maksimum değerdir.'
    : 'dp[i][w] is the maximum value using the first i items with capacity w.')];
  let filledCells = 0;
  for (let row = 0; row < rows; row += 1) {
    dp[row][0] = 0;
    filledCells += 1;
    steps.push(matrixStep(dp, rowLabels, columnLabels, [{ row, column: 0, role: 'base', label: 'capacity 0' }], 'row', {
      weights, values, capacity, item: row - 1, currentCapacity: 0, value: 0, filledCells,
    }, 4, `dp[${row}][0] = 0.`));
  }
  for (let column = 1; column < columns; column += 1) {
    dp[0][column] = 0;
    filledCells += 1;
    steps.push(matrixStep(dp, rowLabels, columnLabels, [{ row: 0, column, role: 'base', label: 'no items' }], 'row', {
      weights, values, capacity, item: -1, currentCapacity: column, value: 0, filledCells,
    }, 4, `dp[0][${column}] = 0.`));
  }
  for (let row = 1; row < rows; row += 1) {
    const item = row - 1;
    for (let currentCapacity = 1; currentCapacity < columns; currentCapacity += 1) {
      const skip = dp[row - 1][currentCapacity] ?? 0;
      const canTake = weights[item] <= currentCapacity;
      const takeDependency = canTake ? dp[row - 1][currentCapacity - weights[item]] ?? 0 : 0;
      const take = canTake ? values[item] + takeDependency : Number.NEGATIVE_INFINITY;
      dp[row][currentCapacity] = Math.max(skip, take);
      const choice = canTake && take > skip ? 'take' : 'skip';
      filledCells += 1;
      const dependencies: MatrixCellHighlight[] = [{ row: row - 1, column: currentCapacity, role: 'dependency', label: `skip=${skip}` }];
      if (canTake) dependencies.push({ row: row - 1, column: currentCapacity - weights[item], role: 'dependency', label: `take base=${takeDependency}` });
      steps.push(matrixStep(dp, rowLabels, columnLabels, [
        { row, column: currentCapacity, role: 'active', label: `dp[${row}][${currentCapacity}]=${dp[row][currentCapacity]}` },
        ...dependencies,
      ], 'row', {
        weights, values, capacity, item, currentCapacity, canTake, take: canTake ? take : 'not-fit', skip, choice, value: dp[row][currentCapacity] ?? 0, filledCells,
      }, canTake ? 10 : 8, locale === 'tr'
        ? `dp[${row}][${currentCapacity}] = ${dp[row][currentCapacity]}; seçim: ${choice}.`
        : `dp[${row}][${currentCapacity}] = ${dp[row][currentCapacity]}; choice: ${choice}.`));
    }
  }
  const result = dp[rows - 1][capacity] ?? 0;
  steps.push(matrixStep(dp, rowLabels, columnLabels, [{ row: rows - 1, column: capacity, role: 'result', label: `maxValue=${result}` }], 'row', {
    weights, values, capacity, result, filledCells,
  }, 13, locale === 'tr' ? `Maksimum sırt çantası değeri ${result}.` : `The maximum knapsack value is ${result}.`));
  const title = locale === 'tr' ? '0/1 Sırt Çantası' : '0/1 Knapsack';
  return {
    id: 'knapsack_2d_dp', title,
    input: { kind: 'array', text: JSON.stringify(weights), parameters: { values: JSON.stringify(values), capacity: String(capacity) }, origin: validPair || requestedCapacity !== null ? 'user' : 'agent' },
    inputDescription: locale === 'tr' ? 'Ağırlıklar, değerler ve kapasite' : 'Weights, values, and capacity',
    constraints: ['1 <= n <= 1000', '1 <= W <= 1000', '1 <= weight[i], value[i] <= 1000', `Interactive visualization uses at most ${MAX_ITEMS} items and capacity 40.`],
    source: source([
      'class Solution {',
      '  public int knapsack(int[] weight, int[] value, int W) {',
      '    int n = weight.length;',
      '    int[][] dp = new int[n + 1][W + 1];',
      '    for (int i = 1; i <= n; i++) {',
      '      for (int w = 0; w <= W; w++) {',
      '        dp[i][w] = dp[i - 1][w];',
      '        if (weight[i - 1] <= w) {',
      '          int take = value[i - 1] + dp[i - 1][w - weight[i - 1]];',
      '          dp[i][w] = Math.max(dp[i][w], take);',
      '        }',
      '      }',
      '    }',
      '    return dp[n][W];',
      '  }',
      '}',
    ], { 'read-input': 3, base: 4, transition: 10, result: 14 }, 'java'),
    steps,
    visualization: { version: 1, type: 'matrix', activeVariables: ['item', 'currentCapacity'], queuedVariables: ['take', 'skip'], visitedVariables: ['filledCells'], pathVariable: 'choice' },
    analysis: 'State: dp[i][w] is the best value from the first i items within capacity w.\nTransition: skip the item or take it once from the previous row.\nFill order: item rows from top to bottom.\nTime Complexity: O(nW)\nSpace Complexity: O(nW)',
    invariants: ['Every transition reads only the previous item row, so each item is used at most once.'],
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
  problemSpec?: import('../types/godMode').ProblemSpecV2;
  algorithmPlan?: import('../types/godMode').AlgorithmPlanV2;
  verification?: import('../types/godMode').VerificationGatesV1;
}): CustomSimulationPackageV1 => {
  const artifact = options.template === 'house-robber-1d-dp'
    ? houseRobberArtifact(options.request, options.locale, options.workspace)
    : options.template === 'lcs-2d-dp'
      ? lcsArtifact(options.request, options.locale, options.workspace)
      : options.template === 'lcs-space-optimized-1d-dp'
        ? optimizedLcsArtifact(options.request, options.locale, options.workspace)
      : options.template === 'coin-change-1d-dp'
        ? coinChangeArtifact(options.request, options.locale)
        : options.template === 'edit-distance-2d-dp'
          ? editDistanceArtifact(options.request, options.locale, options.workspace)
          : options.template === 'knapsack-2d-dp'
            ? knapsackArtifact(options.request, options.locale)
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
    problemSpec: options.problemSpec,
    algorithmPlan: options.algorithmPlan,
    verification: options.verification,
  };
};
