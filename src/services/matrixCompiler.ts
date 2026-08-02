import type {
  CustomSimulationPackageV1,
  InputContractV1,
  ProgramSpecV1,
  RenderedSourceV1,
  VisualizationContractV1,
  WorkspaceSnapshotV1,
} from '../types/godMode';
import type { Locale, MatrixCellHighlight, SimulationInput, SimulationStep } from '../types/simulation';
import { reviewTrace } from './customSimulationCompiler';
import { createTeachingPlan } from './teachingPlan';

export type MatrixTemplateId = 'spiral-matrix';

const DEFAULT_MATRIX = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
export const MAX_MATRIX_SIDE = 15;
export const MAX_MATRIX_CELLS = 200;

export const matrixDimensionsFromRequest = (request: string): { rows: number; columns: number } | null => {
  const match = request.match(/\b(\d{1,2})\s*(?:x|×|\*)\s*(\d{1,2})\b/i);
  if (!match) return null;
  const rows = Number(match[1]);
  const columns = Number(match[2]);
  return Number.isInteger(rows)
    && Number.isInteger(columns)
    && rows >= 1
    && columns >= 1
    && rows <= MAX_MATRIX_SIDE
    && columns <= MAX_MATRIX_SIDE
    && rows * columns <= MAX_MATRIX_CELLS
    ? { rows, columns }
    : null;
};

export const createTeachingMatrix = (rows: number, columns: number, start = 1): number[][] => (
  Array.from({ length: rows }, (_, row) => (
    Array.from({ length: columns }, (_, column) => row * columns + column + start)
  ))
);

const requestMatrix = (request: string): number[][] | null => {
  const raw = request.match(/\[\s*\[[\s\S]*?\]\s*\]/)?.[0];
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MATRIX_SIDE) return null;
    const matrix = value as unknown[];
    const width = Array.isArray(matrix[0]) ? matrix[0].length : 0;
    return width > 0 && width <= MAX_MATRIX_SIDE && matrix.length * width <= MAX_MATRIX_CELLS && matrix.every((row) =>
      Array.isArray(row) && row.length === width && row.every(Number.isSafeInteger))
      ? matrix as number[][]
      : null;
  } catch {
    return null;
  }
};

const source: RenderedSourceV1 = {
  version: 1,
  language: 'cpp',
  code: [
    'class Solution {',
    'public:',
    '  vector<int> spiralOrder(vector<vector<int>>& matrix) {',
    '    vector<int> result;',
    '    int top = 0, bottom = matrix.size() - 1;',
    '    int left = 0, right = matrix[0].size() - 1;',
    '    while (top <= bottom && left <= right) {',
    '      for (int column = left; column <= right; ++column) result.push_back(matrix[top][column]);',
    '      ++top;',
    '      for (int row = top; row <= bottom; ++row) result.push_back(matrix[row][right]);',
    '      --right;',
    '      if (top <= bottom) {',
    '        for (int column = right; column >= left; --column) result.push_back(matrix[bottom][column]);',
    '        --bottom;',
    '      }',
    '      if (left <= right) {',
    '        for (int row = bottom; row >= top; --row) result.push_back(matrix[row][left]);',
    '        ++left;',
    '      }',
    '    }',
    '    return result;',
    '  }',
    '};',
  ].join('\n'),
  lineMap: { init: 5, top: 8, right: 10, bottom: 13, left: 17, result: 22 },
};

const matrixStep = (
  matrix: number[][],
  visited: Set<string>,
  active: [number, number] | null,
  vars: Record<string, any>,
  lineNumber: number,
  explanation: string,
): SimulationStep => {
  const highlights: MatrixCellHighlight[] = [];
  visited.forEach((entry) => {
    const [row, column] = entry.split(':').map(Number);
    highlights.push({ row, column, role: 'computed' });
  });
  if (active) highlights.push({ row: active[0], column: active[1], role: 'active' });
  return {
    lineNumber,
    explanation,
    visualData: {
      type: 'matrix',
      values: matrix.map((row) => [...row]),
      rowLabels: matrix.map((_, row) => String(row)),
      columnLabels: matrix[0].map((_, column) => String(column)),
      highlights,
      fillDirection: 'row',
      vars,
    },
  };
};

export const compileMatrixTemplatePackage = (options: {
  template: MatrixTemplateId;
  id: string;
  request: string;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
}): CustomSimulationPackageV1 => {
  const explicit = requestMatrix(options.request);
  const requestedDimensions = matrixDimensionsFromRequest(options.request);
  const matrix = explicit
    ?? (requestedDimensions ? createTeachingMatrix(requestedDimensions.rows, requestedDimensions.columns) : DEFAULT_MATRIX);
  const result: number[] = [];
  const visited = new Set<string>();
  const steps: SimulationStep[] = [];
  let top = 0;
  let bottom = matrix.length - 1;
  let left = 0;
  let right = matrix[0].length - 1;
  steps.push(matrixStep(matrix, visited, null, { top, bottom, left, right, result: [] }, 5,
    options.locale === 'tr' ? 'Dört sınır matrisin dış çerçevesini gösterir.' : 'Four bounds describe the outer matrix layer.'));
  const visit = (row: number, column: number, lineNumber: number) => {
    result.push(matrix[row][column]);
    visited.add(`${row}:${column}`);
    steps.push(matrixStep(matrix, visited, [row, column], {
      top, bottom, left, right, result: [...result], visitedCells: visited.size,
    }, lineNumber, options.locale === 'tr'
      ? `matrix[${row}][${column}] = ${matrix[row][column]} sonuca eklendi.`
      : `Append matrix[${row}][${column}] = ${matrix[row][column]}.`));
  };
  while (top <= bottom && left <= right) {
    for (let column = left; column <= right; column += 1) visit(top, column, 8);
    top += 1;
    for (let row = top; row <= bottom; row += 1) visit(row, right, 10);
    right -= 1;
    if (top <= bottom) {
      for (let column = right; column >= left; column -= 1) visit(bottom, column, 13);
      bottom -= 1;
    }
    if (left <= right) {
      for (let row = bottom; row >= top; row -= 1) visit(row, left, 17);
      left += 1;
    }
  }
  steps.push(matrixStep(matrix, visited, null, {
    top, bottom, left, right, result: [...result], visitedCells: visited.size,
  }, 22, options.locale === 'tr' ? 'Spiral sıra tamamlandı.' : 'The spiral order is complete.'));

  const inputValue: SimulationInput = {
    kind: 'array', text: JSON.stringify(matrix), origin: explicit ? 'user' : 'agent',
  };
  const input: InputContractV1 = {
    version: 1, kind: 'array', description: 'Rectangular integer matrix',
    constraints: [`1 <= rows, columns <= ${MAX_MATRIX_SIDE}`, `rows * columns <= ${MAX_MATRIX_CELLS}`], value: inputValue,
    origin: explicit ? 'user' : 'agent',
  };
  const visualization: VisualizationContractV1 = {
    version: 1, type: 'matrix', activeVariables: ['row', 'column'],
    queuedVariables: ['top', 'bottom', 'left', 'right'], visitedVariables: ['result'],
  };
  const program: ProgramSpecV1 = {
    version: 1, id: 'spiral_matrix', title: 'LeetCode 54 — Spiral Matrix', locale: options.locale,
    inputKind: 'array', entry: [], functions: [],
    budgets: { instructions: 4_000, traceSteps: MAX_MATRIX_CELLS + 4, recursionDepth: 1, collectionSize: MAX_MATRIX_CELLS },
  };
  const checkpoints = reviewTrace(steps, Math.min(16, steps.length));
  return {
    version: 1,
    id: `spiral_matrix-${options.id}`,
    title: options.locale === 'tr' ? 'LeetCode 54 — Spiral Matris' : 'LeetCode 54 — Spiral Matrix',
    locale: options.locale,
    createdAt: Date.now(),
    program,
    source,
    input,
    visualization,
    steps,
    analysis: 'State: top, bottom, left, and right bound the unvisited rectangle.\nTime Complexity: O(rows * columns)\nSpace Complexity: O(1) excluding output.',
    checkpoints,
    teachingPlan: createTeachingPlan(steps, checkpoints, inputValue, options.locale, ['Every cell outside the current bounds was emitted exactly once.']),
    tests: {
      version: 1,
      passed: visited.size === matrix.length * matrix[0].length && result.length === visited.size,
      results: [{ id: 'visit-each-cell-once', passed: visited.size === result.length, message: `${visited.size} unique cells emitted.` }],
    },
  };
};
