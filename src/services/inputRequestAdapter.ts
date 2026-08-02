import type { SimulationInput } from '../types/simulation';
import { createInputPreset } from './inputPresets';
import {
  createTeachingMatrix,
  matrixDimensionsFromRequest,
  MAX_MATRIX_CELLS,
  MAX_MATRIX_SIDE,
} from './matrixCompiler';

const normalized = (request: string): string => request
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('en-US');

const explicitArray = (request: string): number[] | null => {
  const source = request.match(/\[(?!\s*\[)[^\]]+\]/)?.[0];
  if (!source) return null;
  try {
    const value = JSON.parse(source) as unknown;
    return Array.isArray(value)
      && value.length > 0
      && value.length <= MAX_MATRIX_CELLS
      && value.every(Number.isSafeInteger)
      ? value as number[]
      : null;
  } catch {
    return null;
  }
};

const parseMatrix = (text: string): number[][] | null => {
  try {
    const value = JSON.parse(text) as unknown;
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MATRIX_SIDE) return null;
    const rows = value as unknown[];
    const columns = Array.isArray(rows[0]) ? rows[0].length : 0;
    return columns > 0
      && columns <= MAX_MATRIX_SIDE
      && rows.length * columns <= MAX_MATRIX_CELLS
      && rows.every((row) => Array.isArray(row) && row.length === columns && row.every(Number.isSafeInteger))
      ? rows as number[][]
      : null;
  } catch {
    return null;
  }
};

const requestedItemCount = (request: string): number | null => {
  const match = normalized(request).match(/\b(\d{1,3})\s*(?:elemanli|boyutlu|uzunlugunda|items?|values?)\b/);
  const count = Number(match?.[1]);
  return Number.isInteger(count) && count >= 1 && count <= 200 ? count : null;
};

const deterministicArray = (count: number): number[] => (
  Array.from({ length: count }, (_, index) => ((index * 7 + 3) % 23) - 5)
);

const arrayCompatibleWithProgram = (programId: string | undefined, values: number[]): number[] => {
  if (!programId) return values;
  const nonNegative = new Set(['jump_game_dp', 'jump_game_greedy', 'house_robber_1d_dp']);
  const positive = new Set(['coin_change_1d_dp', 'knapsack_2d_dp', 'minimum_size_subarray_sum']);
  let compatible = nonNegative.has(programId)
    ? values.map((value) => Math.abs(value) % 8)
    : positive.has(programId)
      ? values.map((value) => Math.abs(value) % 9 + 1)
      : [...values];
  if (programId === 'binary_search_array' || programId === 'two_sum_ii_two_pointers') {
    compatible = compatible.sort((left, right) => left - right);
  }
  return compatible;
};

export const adaptSimulationInputFromRequest = (options: {
  request: string;
  current: SimulationInput | null;
  kind: SimulationInput['kind'];
  algorithmName: string;
  activeProgramId?: string;
}): SimulationInput => {
  const text = normalized(options.request);
  const isExpand = /\b(genislet|buyut|uzat|expand|extend|grow)\w*\b/.test(text);
  const isEdit = /\b(duzenle|degistir|uyarla|edit|change|adapt)\w*\b/.test(text);

  // Graph edits are applied structurally by the graph request transaction. The
  // adapter must preserve the active document so a visual-only command cannot
  // replace it with an unrelated preset.
  if (options.kind === 'graph' && options.current) return { ...options.current, origin: 'user' };

  if (options.activeProgramId === 'spiral_matrix') {
    const explicitSource = options.request.match(/\[\s*\[[\s\S]*?\]\s*\]/)?.[0];
    const explicit = explicitSource ? parseMatrix(explicitSource) : null;
    if (explicit) return { kind: 'array', text: JSON.stringify(explicit), origin: 'user' };
    const dimensions = matrixDimensionsFromRequest(options.request);
    const currentMatrix = options.current ? parseMatrix(options.current.text) : null;
    const target = dimensions ?? (isExpand && currentMatrix
      ? {
        rows: Math.min(MAX_MATRIX_SIDE, currentMatrix.length + 2),
        columns: Math.min(MAX_MATRIX_SIDE, currentMatrix[0].length + 2),
      }
      : isEdit && currentMatrix
        ? { rows: currentMatrix.length, columns: currentMatrix[0].length }
        : null);
    if (target && target.rows * target.columns <= MAX_MATRIX_CELLS) {
      return {
        kind: 'array',
        text: JSON.stringify(createTeachingMatrix(target.rows, target.columns, isEdit && !dimensions ? 11 : 1)),
        origin: 'user',
      };
    }
    if (target) throw new Error(`Matrix inputs can contain at most ${MAX_MATRIX_CELLS} cells.`);
    if (options.current) return { ...options.current, origin: 'user' };
  }

  if (options.kind === 'array') {
    const explicit = explicitArray(options.request);
    if (explicit) {
      if (options.activeProgramId && explicit.length > 20) {
        throw new Error('Interactive exact-simulation inputs can contain at most 20 array values.');
      }
      return { kind: 'array', text: JSON.stringify(explicit), origin: 'user' };
    }
    const count = requestedItemCount(options.request);
    if (count) {
      if (options.activeProgramId && count > 20) {
        throw new Error('Interactive exact-simulation inputs can contain at most 20 array values.');
      }
      return { kind: 'array', text: JSON.stringify(arrayCompatibleWithProgram(options.activeProgramId, deterministicArray(count))), origin: 'agent' };
    }
    if (isExpand && options.current) {
      const current = explicitArray(options.current.text) ?? [];
      const targetCount = Math.min(options.activeProgramId ? 20 : 200, Math.max(current.length + 1, Math.ceil(current.length * 1.5)));
      return {
        ...options.current,
        text: JSON.stringify(arrayCompatibleWithProgram(
          options.activeProgramId,
          [...current, ...deterministicArray(targetCount - current.length)],
        )),
        origin: 'agent',
      };
    }
  }

  const quoted = options.request.match(/["“”']([^"“”']+)["“”']/)?.[1];
  if (options.kind === 'string' && quoted) {
    return { kind: 'string', text: quoted, origin: 'user' };
  }

  const preset = createInputPreset(options.kind, 2, options.algorithmName);
  if (preset.kind !== 'array') return preset;
  const values = explicitArray(preset.text);
  return values ? {
    ...preset,
    text: JSON.stringify(arrayCompatibleWithProgram(options.activeProgramId, values)),
    parameters: options.current?.parameters ?? preset.parameters,
  } : preset;
};
