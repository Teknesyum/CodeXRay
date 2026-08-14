import type { Locale } from '../i18n/translations';
import type { CustomSimulationPackageV1, WorkspaceSnapshotV1 } from '../types/titan';
import type { SimulationInput } from '../types/simulation';
import { compileArrayTemplatePackage, type ArrayTemplateId } from './arrayCompiler';
import { compileBacktrackingTemplatePackage, type BacktrackingTemplateId } from './backtrackingCompiler';
import { compileCustomSimulationPackage } from './customSimulationCompiler';
import { compileDpTemplatePackage, type DpTemplateId } from './dpTemplateCompiler';
import { compileGraphTemplatePackage } from './graphCompiler';
import { compilePredictWinnerPackage } from './intervalDpCompiler';
import { compileLinkedListTemplatePackage } from './linkedListCompiler';
import { compileStringTemplatePackage, type StringTemplateId } from './stringCompiler';
import { compileMatrixTemplatePackage } from './matrixCompiler';

const DP_TEMPLATES: Record<string, DpTemplateId> = {
  house_robber_1d_dp: 'house-robber-1d-dp',
  lcs_2d_dp: 'lcs-2d-dp',
  lcs_space_optimized_1d_dp: 'lcs-space-optimized-1d-dp',
  coin_change_1d_dp: 'coin-change-1d-dp',
  edit_distance_2d_dp: 'edit-distance-2d-dp',
  knapsack_2d_dp: 'knapsack-2d-dp',
  longest_palindromic_subsequence_interval_dp: 'longest-palindrome-interval-dp',
};

const ARRAY_TEMPLATES: Record<string, ArrayTemplateId> = {
  two_sum_ii_two_pointers: 'two-pointers-array',
  minimum_size_subarray_sum: 'sliding-window-array',
  subarray_sum_equals_k: 'prefix-sum-array',
  binary_search_array: 'binary-search-array',
  palindrome_number: 'palindrome-number',
  jump_game_dp: 'jump-game-dp',
  jump_game_greedy: 'jump-game-greedy',
  lis_quadratic_dp: 'lis-quadratic-dp',
  lis_binary_search: 'lis-binary-search',
};

const STRING_TEMPLATES: Record<string, StringTemplateId> = {
  longest_substring_sliding_window: 'sliding-window-string',
  valid_palindrome_two_pointers: 'two-pointers-string',
};

const BACKTRACKING_TEMPLATES: Record<string, BacktrackingTemplateId> = {
  permutations_backtracking: 'permutations-backtracking',
  subsets_backtracking: 'subsets-backtracking',
  combinations_backtracking: 'combinations-backtracking',
};

const requestForInput = (input: SimulationInput, programId: string): string => {
  const parameters = input.parameters ?? {};
  if (input.kind === 'string') {
    const values = [JSON.stringify(input.text)];
    if (parameters.other !== undefined) values.push(JSON.stringify(parameters.other));
    return values.join(' ');
  }
  if (programId === 'knapsack_2d_dp') {
    return `${input.text} value=${parameters.values ?? '[]'} capacity=${parameters.capacity ?? ''}`;
  }
  if (programId === 'palindrome_number') return `x=${parameters.x ?? input.text}`;
  return [input.text, ...Object.entries(parameters).map(([key, value]) => `${key}=${value}`)]
    .filter(Boolean)
    .join(' ');
};

export const recompileSimulationInput = (options: {
  activePackage: CustomSimulationPackageV1;
  input: SimulationInput;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
}): CustomSimulationPackageV1 => {
  const { activePackage, input, locale } = options;
  const programId = activePackage.program.id;
  const workspace: WorkspaceSnapshotV1 = {
    ...options.workspace,
    simulationInput: input,
    packageOutOfSync: false,
  };
  const common = {
    id: `manual-input-${Date.now().toString(36)}`,
    request: requestForInput(input, programId),
    locale,
    workspace,
    problemSpec: activePackage.problemSpec,
    algorithmPlan: activePackage.algorithmPlan,
    verification: activePackage.verification,
  };

  if (programId === 'predict_winner_interval_dp') return compilePredictWinnerPackage(common);
  if (programId === 'spiral_matrix') return compileMatrixTemplatePackage({ ...common, template: 'spiral-matrix' });
  if (DP_TEMPLATES[programId]) return compileDpTemplatePackage({ ...common, template: DP_TEMPLATES[programId] });
  if (ARRAY_TEMPLATES[programId]) return compileArrayTemplatePackage({ ...common, template: ARRAY_TEMPLATES[programId] });
  if (STRING_TEMPLATES[programId]) return compileStringTemplatePackage({ ...common, template: STRING_TEMPLATES[programId] });
  if (BACKTRACKING_TEMPLATES[programId]) {
    return compileBacktrackingTemplatePackage({ ...common, template: BACKTRACKING_TEMPLATES[programId] });
  }
  if (programId === 'find_path_exists_bfs' && input.kind === 'graph') {
    return compileGraphTemplatePackage({ ...common, template: 'bfs-graph' });
  }
  if (programId === 'reverse_linked_list' && input.kind === 'graph') {
    return compileLinkedListTemplatePackage({ ...common, template: 'reverse-linked-list' });
  }
  if (activePackage.program.entry.length > 0) {
    return compileCustomSimulationPackage({
      id: common.id,
      title: activePackage.title,
      locale,
      program: activePackage.program,
      input: {
        ...activePackage.input,
        kind: input.kind,
        value: { ...input, origin: 'user' },
        origin: 'user',
      },
      visualization: activePackage.visualization,
      analysis: activePackage.analysis,
    });
  }

  throw new Error(locale === 'tr'
    ? 'Bu simülasyon paketi henüz özel input ile yeniden derlenemiyor; mevcut simülasyon korunmuştur.'
    : 'This simulation package cannot yet be recompiled with custom input; the current simulation was preserved.');
};
