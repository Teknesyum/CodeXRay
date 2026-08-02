import type { CustomSimulationPackageV1, WorkspaceSnapshotV1 } from '../types/godMode';
import type { Locale } from '../i18n/translations';
import type { ExactCatalogTemplate } from './catalogSupportRegistry';
import { compilePredictWinnerPackage } from './intervalDpCompiler';
import type { DpTemplateId } from './dpTemplateCompiler';

interface ExactCatalogCompileOptions {
  template: ExactCatalogTemplate;
  id: string;
  request: string;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
}

export const compileExactCatalogProblem = async (
  options: ExactCatalogCompileOptions,
): Promise<CustomSimulationPackageV1> => {
  const { template, ...common } = options;
  if (template === 'predict-winner-interval-dp') return compilePredictWinnerPackage(common);
  if (['house-robber-1d-dp', 'lcs-2d-dp', 'lcs-space-optimized-1d-dp', 'longest-palindrome-interval-dp',
    'coin-change-1d-dp', 'edit-distance-2d-dp', 'knapsack-2d-dp'].includes(template)) {
    const { compileDpTemplatePackage } = await import('./dpTemplateCompiler');
    return compileDpTemplatePackage({ ...common, template: template as DpTemplateId });
  }
  if (['two-pointers-array', 'sliding-window-array', 'prefix-sum-array', 'binary-search-array', 'palindrome-number'].includes(template)) {
    const { compileArrayTemplatePackage } = await import('./arrayCompiler');
    return compileArrayTemplatePackage({ ...common, template: template as import('./arrayCompiler').ArrayTemplateId });
  }
  if (['permutations-backtracking', 'combinations-backtracking', 'subsets-backtracking'].includes(template)) {
    const { compileBacktrackingTemplatePackage } = await import('./backtrackingCompiler');
    return compileBacktrackingTemplatePackage({ ...common, template: template as import('./backtrackingCompiler').BacktrackingTemplateId });
  }
  if (template === 'bfs-graph') {
    const { compileGraphTemplatePackage } = await import('./graphCompiler');
    return compileGraphTemplatePackage({ ...common, template });
  }
  if (['reverse-linked-list', 'cycle-linked-list'].includes(template)) {
    const { compileLinkedListTemplatePackage } = await import('./linkedListCompiler');
    return compileLinkedListTemplatePackage({ ...common, template: template as import('./linkedListCompiler').LinkedListTemplateId });
  }
  if (template === 'spiral-matrix') {
    const { compileMatrixTemplatePackage } = await import('./matrixCompiler');
    return compileMatrixTemplatePackage({ ...common, template });
  }
  if (['sliding-window-string', 'two-pointers-string'].includes(template)) {
    const { compileStringTemplatePackage } = await import('./stringCompiler');
    return compileStringTemplatePackage({ ...common, template: template as import('./stringCompiler').StringTemplateId });
  }
  if (['keys-and-rooms-dfs', 'course-schedule-topological', 'network-delay-dijkstra', 'min-cost-connect-points-mst',
    'redundant-connection-union-find', 'shortest-path-all-nodes-bitmask'].includes(template)) {
    const { compileAdvancedGraphPackage } = await import('./advancedGraphCompiler');
    return compileAdvancedGraphPackage({ ...common, template: template as import('./advancedGraphCompiler').AdvancedGraphTemplateId });
  }
  if (['validate-bst', 'house-robber-tree-dp', 'implement-trie', 'range-sum-segment-tree'].includes(template)) {
    const { compileAdvancedStructurePackage } = await import('./advancedStructureCompiler');
    return compileAdvancedStructurePackage({ ...common, template: template as import('./advancedStructureCompiler').AdvancedStructureTemplateId });
  }
  throw new Error(`Exact catalog template is not executable: ${template}`);
};
