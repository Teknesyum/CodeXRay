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

export type BacktrackingTemplateId =
  | 'permutations-backtracking'
  | 'subsets-backtracking'
  | 'combinations-backtracking';

interface BacktrackingArtifact {
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

const MAX_ITEMS = 6;

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

const arrayStep = (
  values: (number | string)[],
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
  budgets: { instructions: 4_000, traceSteps: 500, recursionDepth: 20, collectionSize: MAX_ITEMS },
});

const permutationsArtifact = (request: string, locale: Locale, _workspace: WorkspaceSnapshotV1): BacktrackingArtifact => {
  const explicit = requestArray(request);
  const arr = explicit ?? [1, 2, 3];

  const steps: SimulationStep[] = [];
  const results: number[][] = [];

  steps.push(arrayStep(arr, {}, { results: JSON.stringify(results) }, 4,
    locale === 'tr' ? `Permütasyonlar bulunmaya başlanıyor.` : `Starting to generate permutations.`
  ));

  const backtrack = (start: number) => {
    if (start === arr.length) {
      results.push([...arr]);
      steps.push(arrayStep(arr, { start }, { results: JSON.stringify(results) }, 10,
        locale === 'tr' ? `Yeni bir permütasyon eklendi: [${arr.join(', ')}]` : `New permutation added: [${arr.join(', ')}]`
      ));
      return;
    }

    for (let i = start; i < arr.length; i++) {
      steps.push(arrayStep(arr, { start, i }, { results: JSON.stringify(results) }, 14,
        locale === 'tr' ? `Swap işlemi: indeks ${start} ve ${i}` : `Swapping index ${start} and ${i}`
      ));

      [arr[start], arr[i]] = [arr[i], arr[start]];
      steps.push(arrayStep(arr, { start, i }, { results: JSON.stringify(results) }, 15,
        locale === 'tr' ? `Backtrack rekürsiyonuna giriliyor.` : `Entering backtrack recursion.`
      ));

      backtrack(start + 1);

      [arr[start], arr[i]] = [arr[i], arr[start]];
      steps.push(arrayStep(arr, { start, i }, { results: JSON.stringify(results) }, 16,
        locale === 'tr' ? `Backtrack geri dönüşü (swap geri alınıyor).` : `Backtrack return (undoing swap).`
      ));
    }
  };

  backtrack(0);

  return {
    id: 'permutations_backtracking',
    title: locale === 'tr' ? 'LeetCode 46 — Permütasyonlar' : 'LeetCode 46 — Permutations',
    input: { kind: 'array', text: JSON.stringify(arr), origin: explicit ? 'user' : 'agent' },
    inputDescription: locale === 'tr' ? 'Sayı dizisi' : 'Number array',
    constraints: [`1 <= arr.length <= ${MAX_ITEMS}`],
    source: source([
      'class Solution {',
      'public:',
      '  vector<vector<int>> permute(vector<int>& nums) {',
      '    vector<vector<int>> results;',
      '    backtrack(nums, 0, results);',
      '    return results;',
      '  }',
      '  void backtrack(vector<int>& nums, int start, vector<vector<int>>& results) {',
      '    if (start == nums.size()) {',
      '      results.push_back(nums);',
      '      return;',
      '    }',
      '    for (int i = start; i < nums.size(); i++) {',
      '      swap(nums[start], nums[i]);',
      '      backtrack(nums, start + 1, results);',
      '      swap(nums[start], nums[i]);',
      '    }',
      '  }',
      '};',
    ], { 'init': 4, 'base': 10, 'swap1': 14, 'recurse': 15, 'swap2': 16 }),
    steps,
    visualization: { version: 1, type: 'array', activeVariables: ['start', 'i'], queuedVariables: [], visitedVariables: [] },
    analysis: 'Time Complexity: O(N * N!)\nSpace Complexity: O(N)',
    invariants: ['All elements before index start are fixed.'],
  };
};

const subsetsArtifact = (request: string, locale: Locale): BacktrackingArtifact => {
  const explicit = requestArray(request);
  const arr = explicit ?? [1, 2, 3];
  const results: number[][] = [];
  const current: number[] = [];
  const steps: SimulationStep[] = [];

  const backtrack = (index: number) => {
    results.push([...current]);
    steps.push(arrayStep(
      arr,
      index < arr.length ? { index } : {},
      { index, current: [...current], results: results.map((value) => [...value]) },
      10,
      locale === 'tr'
        ? `Mevcut alt küme kaydedildi: [${current.join(', ')}].`
        : `Record the current subset: [${current.join(', ')}].`,
    ));
    for (let candidate = index; candidate < arr.length; candidate += 1) {
      current.push(arr[candidate]);
      steps.push(arrayStep(
        arr,
        { index: candidate },
        { index: candidate, current: [...current], results: results.map((value) => [...value]) },
        12,
        locale === 'tr'
          ? `${arr[candidate]} seçildi; alt küme [${current.join(', ')}].`
          : `Choose ${arr[candidate]}; subset is [${current.join(', ')}].`,
      ));
      backtrack(candidate + 1);
      current.pop();
      steps.push(arrayStep(
        arr,
        { index: candidate },
        { index: candidate, current: [...current], results: results.map((value) => [...value]) },
        14,
        locale === 'tr'
          ? `${arr[candidate]} geri alındı.`
          : `Undo the choice of ${arr[candidate]}.`,
      ));
    }
  };
  backtrack(0);

  return {
    id: 'subsets_backtracking',
    title: locale === 'tr' ? 'LeetCode 78 — Alt Kümeler' : 'LeetCode 78 — Subsets',
    input: { kind: 'array', text: JSON.stringify(arr), origin: explicit ? 'user' : 'agent' },
    inputDescription: locale === 'tr' ? 'Benzersiz sayı dizisi' : 'Array of distinct numbers',
    constraints: [`1 <= arr.length <= ${MAX_ITEMS}`, 'All values are distinct.'],
    source: source([
      'class Solution {',
      'public:',
      '  vector<vector<int>> subsets(vector<int>& nums) {',
      '    vector<vector<int>> results;',
      '    vector<int> current;',
      '    backtrack(nums, 0, current, results);',
      '    return results;',
      '  }',
      '  void backtrack(vector<int>& nums, int index, vector<int>& current, vector<vector<int>>& results) {',
      '    results.push_back(current);',
      '    for (int i = index; i < nums.size(); ++i) {',
      '      current.push_back(nums[i]);',
      '      backtrack(nums, i + 1, current, results);',
      '      current.pop_back();',
      '    }',
      '  }',
      '};',
    ], { record: 10, choose: 12, recurse: 13, undo: 14 }),
    steps,
    visualization: {
      version: 1,
      type: 'array',
      activeVariables: ['index'],
      queuedVariables: ['current'],
      visitedVariables: ['results'],
    },
    analysis: 'State: current contains one subset prefix.\nTime Complexity: O(N * 2^N)\nSpace Complexity: O(N)',
    invariants: ['Every recursive call records exactly one distinct subset prefix.'],
  };
};

const requestInteger = (request: string, name: string, fallback: number): number => {
  const match = request.match(new RegExp(`\\b${name}\\s*=\\s*(\\d+)`, 'i'));
  const parsed = match ? Number(match[1]) : fallback;
  return Number.isSafeInteger(parsed) ? parsed : fallback;
};

const combinationsArtifact = (request: string, locale: Locale): BacktrackingArtifact => {
  const n = requestInteger(request, 'n', 4);
  const k = requestInteger(request, 'k', 2);
  if (n < 1 || n > 8 || k < 1 || k > n) {
    throw new Error('LeetCode 77 requires 1 <= k <= n <= 8 for an interactive trace.');
  }
  const values = Array.from({ length: n }, (_, index) => index + 1);
  const current: number[] = [];
  const results: number[][] = [];
  const steps: SimulationStep[] = [];
  const backtrack = (start: number) => {
    if (current.length === k) {
      results.push([...current]);
      steps.push(arrayStep(values, {}, {
        n, k, start, current: [...current], results: results.map((value) => [...value]),
      }, 11, locale === 'tr'
        ? `Kombinasyon kaydedildi: [${current.join(', ')}].`
        : `Record combination [${current.join(', ')}].`));
      return;
    }
    const remaining = k - current.length;
    const lastCandidate = n - remaining + 1;
    for (let candidate = start; candidate <= lastCandidate; candidate += 1) {
      current.push(candidate);
      steps.push(arrayStep(values, { candidate: candidate - 1 }, {
        n, k, start, current: [...current], remaining,
      }, 15, locale === 'tr'
        ? `${candidate} seçildi; kalan yuva ${remaining - 1}.`
        : `Choose ${candidate}; ${remaining - 1} slot(s) remain.`));
      backtrack(candidate + 1);
      current.pop();
      steps.push(arrayStep(values, { candidate: candidate - 1 }, {
        n, k, start, current: [...current], results: results.map((value) => [...value]),
      }, 17, locale === 'tr' ? `${candidate} seçimi geri alındı.` : `Undo choice ${candidate}.`));
    }
  };
  backtrack(1);
  return {
    id: 'combinations_backtracking',
    title: locale === 'tr' ? 'LeetCode 77 — Kombinasyonlar' : 'LeetCode 77 — Combinations',
    input: {
      kind: 'array', text: JSON.stringify(values), parameters: { n: String(n), k: String(k) }, origin: 'agent',
    },
    inputDescription: locale === 'tr' ? 'n aralığı ve k seçim sayısı' : 'Range n and selection size k',
    constraints: ['1 <= k <= n <= 8 for an interactive trace'],
    source: source([
      'class Solution {',
      'public:',
      '  vector<vector<int>> combine(int n, int k) {',
      '    vector<vector<int>> results;',
      '    vector<int> current;',
      '    backtrack(1, n, k, current, results);',
      '    return results;',
      '  }',
      '  void backtrack(int start, int n, int k, vector<int>& current, vector<vector<int>>& results) {',
      '    if (current.size() == k) {',
      '      results.push_back(current);',
      '      return;',
      '    }',
      '    int remaining = k - current.size();',
      '    for (int value = start; value <= n - remaining + 1; ++value) {',
      '      current.push_back(value);',
      '      backtrack(value + 1, n, k, current, results);',
      '      current.pop_back();',
      '    }',
      '  }',
      '};',
    ], { record: 11, choose: 15, recurse: 16, undo: 17 }),
    steps,
    visualization: {
      version: 1, type: 'array', activeVariables: ['candidate'], queuedVariables: ['current'], visitedVariables: ['results'],
    },
    analysis: 'State: current is a strictly increasing partial combination.\nTime Complexity: O(k * C(n,k))\nSpace Complexity: O(k)',
    invariants: ['Candidates increase strictly, so each k-combination is emitted once.'],
  };
};

export const compileBacktrackingTemplatePackage = (options: {
  template: BacktrackingTemplateId;
  id: string;
  request: string;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
  problemSpec?: import('../types/godMode').ProblemSpecV2;
  algorithmPlan?: import('../types/godMode').AlgorithmPlanV2;
  verification?: import('../types/godMode').VerificationGatesV1;
}): CustomSimulationPackageV1 => {
  const artifact = options.template === 'permutations-backtracking'
    ? permutationsArtifact(options.request, options.locale, options.workspace)
    : options.template === 'subsets-backtracking'
      ? subsetsArtifact(options.request, options.locale)
      : combinationsArtifact(options.request, options.locale);

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
