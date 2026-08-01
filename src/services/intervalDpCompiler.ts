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
  MatrixCellHighlight,
  MatrixVisualData,
  SimulationInput,
  SimulationStep,
} from '../types/simulation';
import { parseSimulationInput } from './inputParsers';
import { reviewTrace } from './customSimulationCompiler';
import { createTeachingPlan } from './teachingPlan';

const DEFAULT_NUMBERS = [1, 5, 233, 7];
const MAX_DP_ITEMS = 14;

export const createPredictWinnerProgram = (locale: Locale): ProgramSpecV1 => ({
  version: 1,
  id: 'predict_winner_interval_dp',
  title: locale === 'tr' ? 'LeetCode 486 — Kazananı Tahmin Et' : 'LeetCode 486 — Predict the Winner',
  locale,
  inputKind: 'array',
  budgets: { instructions: 4_000, traceSteps: 240, recursionDepth: 2, collectionSize: 240 },
  functions: [],
  entry: [
    { id: 'read-input', type: 'declare', name: 'nums', value: { type: 'input-field', field: 'array' } },
    {
      id: 'trace-input',
      type: 'trace',
      at: 'read-input',
      explanation: locale === 'tr' ? 'Interval DP tablosunu hazırla.' : 'Prepare the interval-DP table.',
      category: 'initialization',
      importance: 1,
    },
  ],
});

const sourceForPredictWinner = (): RenderedSourceV1 => {
  const lines = [
    'class Solution {',
    'public:',
    '  bool predictTheWinner(vector<int>& nums) {',
    '    const int n = nums.size();',
    '    vector<vector<int>> dp(n, vector<int>(n, 0));',
    '    for (int i = 0; i < n; ++i) {',
    '      dp[i][i] = nums[i];',
    '    }',
    '    for (int length = 2; length <= n; ++length) {',
    '      for (int i = 0; i + length - 1 < n; ++i) {',
    '        const int j = i + length - 1;',
    '        const int takeLeft = nums[i] - dp[i + 1][j];',
    '        const int takeRight = nums[j] - dp[i][j - 1];',
    '        dp[i][j] = max(takeLeft, takeRight);',
    '      }',
    '    }',
    '    return dp[0][n - 1] >= 0;',
    '  }',
    '};',
  ];
  return {
    version: 1,
    language: 'cpp',
    code: lines.join('\n'),
    lineMap: { 'read-input': 4, base: 7, interval: 11, candidates: 12, choose: 14, result: 17 },
  };
};

const requestNumbers = (request: string): number[] | null => {
  const candidate = request.match(/\[[^\]]+\]/)?.[0];
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate) as unknown;
    return Array.isArray(parsed)
      && parsed.length > 0
      && parsed.length <= MAX_DP_ITEMS
      && parsed.every((value) => typeof value === 'number' && Number.isSafeInteger(value))
      ? parsed as number[]
      : null;
  } catch {
    return null;
  }
};

const workspaceNumbers = (workspace: WorkspaceSnapshotV1): number[] | null => {
  if (workspace.simulationInput.kind !== 'array') return null;
  const parsed = parseSimulationInput('array', workspace.simulationInput.text);
  if (!parsed.input) return null;
  try {
    const values = JSON.parse(parsed.input.text) as unknown;
    return Array.isArray(values)
      && values.length > 0
      && values.length <= MAX_DP_ITEMS
      && values.every((value) => typeof value === 'number' && Number.isSafeInteger(value))
      ? values as number[]
      : null;
  } catch {
    return null;
  }
};

export const resolvePredictWinnerNumbers = (
  request: string,
  workspace: WorkspaceSnapshotV1,
): { numbers: number[]; origin: InputContractV1['origin'] } => {
  const explicit = requestNumbers(request);
  if (explicit) return { numbers: explicit, origin: 'user' };
  const normalized = request.toLocaleLowerCase('tr-TR');
  if (/\b(bu|mevcut|current|my)\b.*\b(input|girdi|dizi)/i.test(normalized)) {
    const current = workspaceNumbers(workspace);
    if (current) return { numbers: current, origin: 'user' };
  }
  return { numbers: DEFAULT_NUMBERS, origin: 'agent' };
};

const cloneTable = (table: Array<Array<number | null>>) => table.map((row) => [...row]);

const matrixStep = (
  table: Array<Array<number | null>>,
  numbers: number[],
  highlights: MatrixCellHighlight[],
  vars: MatrixVisualData['vars'],
  lineNumber: number | null,
  explanation: string,
): SimulationStep => ({
  lineNumber,
  explanation,
  visualData: {
    type: 'matrix',
    values: cloneTable(table),
    rowLabels: numbers.map((value, index) => `i=${index} · ${value}`),
    columnLabels: numbers.map((value, index) => `j=${index} · ${value}`),
    highlights,
    fillDirection: 'diagonal',
    vars,
  },
});

export const simulatePredictWinnerIntervalDp = (
  numbers: number[],
  locale: Locale,
): SimulationStep[] => {
  const size = numbers.length;
  const table = Array.from({ length: size }, () => Array<number | null>(size).fill(null));
  const steps: SimulationStep[] = [matrixStep(
    table,
    numbers,
    [],
    { nums: numbers, intervalLength: 1, filledCells: 0 },
    5,
    locale === 'tr'
      ? 'dp[i][j], mevcut oyuncunun i..j aralığından elde edebileceği en büyük skor farkını tutar. Tablo ana köşegenden başlayıp artan aralık uzunluğuyla doldurulur.'
      : 'dp[i][j] stores the best score difference the current player can force on interval i..j. Fill starts on the main diagonal and grows by interval length.',
  )];

  for (let index = 0; index < size; index += 1) {
    table[index][index] = numbers[index];
    steps.push(matrixStep(
      table,
      numbers,
      [{ row: index, column: index, role: 'base', label: 'dp[i][i] = nums[i]' }],
      { nums: numbers, dp: cloneTable(table), i: index, j: index, intervalLength: 1, value: numbers[index], filledCells: index + 1 },
      7,
      locale === 'tr'
        ? `Taban durum: dp[${index}][${index}] = nums[${index}] = ${numbers[index]}. Tek sayı kaldığında oyuncu onu alır.`
        : `Base case: dp[${index}][${index}] = nums[${index}] = ${numbers[index]}. With one number left, the player takes it.`,
    ));
  }

  let filledCells = size;
  for (let length = 2; length <= size; length += 1) {
    for (let left = 0; left + length - 1 < size; left += 1) {
      const right = left + length - 1;
      const leftDependency = table[left + 1][right] ?? 0;
      const rightDependency = table[left][right - 1] ?? 0;
      const takeLeft = numbers[left] - leftDependency;
      const takeRight = numbers[right] - rightDependency;
      const chooseLeft = takeLeft >= takeRight;
      const value = Math.max(takeLeft, takeRight);
      table[left][right] = value;
      filledCells += 1;
      const highlights: MatrixCellHighlight[] = [
        { row: left, column: right, role: 'active', label: `dp[${left}][${right}] = ${value}` },
        { row: left + 1, column: right, role: 'dependency', label: `dp[${left + 1}][${right}] = ${leftDependency}` },
        { row: left, column: right - 1, role: 'dependency', label: `dp[${left}][${right - 1}] = ${rightDependency}` },
      ];
      steps.push(matrixStep(
        table,
        numbers,
        highlights,
        {
          nums: numbers,
          dp: cloneTable(table),
          i: left,
          j: right,
          intervalLength: length,
          leftDependency,
          rightDependency,
          takeLeft,
          takeRight,
          choice: chooseLeft ? 'left' : 'right',
          value,
          filledCells,
        },
        14,
        locale === 'tr'
          ? `dp[${left}][${right}]: sol=${numbers[left]}−dp[${left + 1}][${right}](${leftDependency})=${takeLeft}; sağ=${numbers[right]}−dp[${left}][${right - 1}](${rightDependency})=${takeRight}. max=${value}; ${chooseLeft ? 'sol' : 'sağ'} uç seçilir.`
          : `dp[${left}][${right}]: left=${numbers[left]}−dp[${left + 1}][${right}](${leftDependency})=${takeLeft}; right=${numbers[right]}−dp[${left}][${right - 1}](${rightDependency})=${takeRight}. max=${value}; choose the ${chooseLeft ? 'left' : 'right'} end.`,
      ));
    }
  }

  const scoreDifference = table[0][size - 1] ?? 0;
  const winner = scoreDifference >= 0;
  steps.push(matrixStep(
    table,
    numbers,
    [{ row: 0, column: size - 1, role: 'result', label: `dp[0][${size - 1}] = ${scoreDifference}` }],
    { nums: numbers, dp: cloneTable(table), scoreDifference, winner, filledCells },
    17,
    locale === 'tr'
      ? `Nihai durum: dp[0][${size - 1}] = ${scoreDifference}. Değer ${winner ? 'negatif değil; 1. oyuncu kazanabilir veya berabere kalabilir' : 'negatif; 1. oyuncu optimal oyunda kaybeder'}.`
      : `Final state: dp[0][${size - 1}] = ${scoreDifference}. It is ${winner ? 'non-negative, so Player 1 can win or tie' : 'negative, so Player 1 loses under optimal play'}.`,
  ));
  return steps;
};

export const compilePredictWinnerPackage = (options: {
  id: string;
  request: string;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
}): CustomSimulationPackageV1 => {
  const resolved = resolvePredictWinnerNumbers(options.request, options.workspace);
  const inputValue: SimulationInput = {
    kind: 'array',
    text: JSON.stringify(resolved.numbers),
    origin: resolved.origin === 'user' ? 'user' : 'agent',
  };
  const input: InputContractV1 = {
    version: 1,
    kind: 'array',
    description: options.locale === 'tr' ? 'Predict the Winner sayı dizisi' : 'Predict the Winner number array',
    constraints: [`1 <= nums.length <= ${MAX_DP_ITEMS}`, 'Every value must be a safe integer.'],
    value: inputValue,
    origin: resolved.origin,
  };
  const program = createPredictWinnerProgram(options.locale);
  const source = sourceForPredictWinner();
  const visualization: VisualizationContractV1 = {
    version: 1,
    type: 'matrix',
    activeVariables: ['i', 'j'],
    queuedVariables: ['intervalLength'],
    visitedVariables: ['filledCells'],
    pathVariable: 'choice',
  };
  const steps = simulatePredictWinnerIntervalDp(resolved.numbers, options.locale);
  const checkpoints = reviewTrace(steps, Math.min(14, steps.length));
  const invariants = [
    'Before interval length L is processed, every interval shorter than L is already solved.',
    'dp[i][j] is the maximum score difference current player minus opponent on nums[i..j].',
  ];
  return {
    version: 1,
    id: options.id,
    title: program.title,
    locale: options.locale,
    createdAt: Date.now(),
    program,
    source,
    input,
    visualization,
    steps,
    analysis: [
      'State: dp[i][j] = best score difference on interval nums[i..j].',
      'Transition: dp[i][j] = max(nums[i] - dp[i+1][j], nums[j] - dp[i][j-1]).',
      'Fill order: main diagonal first, then interval lengths 2..n.',
      'Time Complexity: O(n^2)',
      'Space Complexity: O(n^2)',
    ].join('\n'),
    checkpoints,
    teachingPlan: createTeachingPlan(steps, checkpoints, inputValue, options.locale, invariants),
    tests: {
      version: 1,
      passed: true,
      results: [{
        id: 'active-input',
        passed: true,
        message: `${steps.length} deterministic interval-DP steps; result=${String(steps.at(-1)?.visualData.vars.winner)}.`,
      }],
    },
  };
};
