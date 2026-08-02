import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(scriptRoot, '../src/data/algorithmCatalog.json');
const outputPath = path.join(scriptRoot, '../src/data/leetcodeCategoryValidation.json');

const intervalDpIds = new Set([
  '312', '375', '486', '516', '730', '877', '1039', '1130', '1140', '1246',
  '1278', '1312', '1547', '1563', '1690', '1770', '2019', '2312', '3040',
]);
const knapsackDpIds = new Set([
  '322', '416', '474', '494', '518', '879', '956', '1049', '1449', '1981',
  '2291', '2518', '2585', '2787', '2915', '3181',
]);
const oneDimensionalDpIds = new Set(['198', '213', '322', '518']);
const twoDimensionalDpIds = new Set(['64', '72', '97', '1143']);

const hasAny = (value, patterns) => patterns.some((pattern) => value.includes(pattern));

const categoriesFor = (problem) => {
  const tags = new Set(problem.tags ?? []);
  const title = String(problem.title ?? '').toLowerCase();
  const categories = new Set();

  if (tags.has('dynamic-programming')) {
    if (oneDimensionalDpIds.has(problem.id)) categories.add('1d-dp');
    if (twoDimensionalDpIds.has(problem.id)) categories.add('2d-dp');
    if (tags.has('bitmask')) categories.add('bitmask-dp');
    if (tags.has('game-theory')) categories.add('game-theory-dp');
    if (tags.has('tree') || tags.has('binary-tree')) categories.add('tree-dp');
    if (tags.has('graph')) categories.add('graph-dp');
    if (tags.has('matrix')) categories.add('2d-dp');
    if (intervalDpIds.has(problem.id)
      || hasAny(title, ['burst balloons', 'stone game', 'interval', 'strange printer', 'cut a stick', 'triangulation'])) {
      categories.add('interval-dp');
    }
    if (knapsackDpIds.has(problem.id)
      || hasAny(title, ['knapsack', 'coin change', 'target sum', 'partition equal subset', 'ones and zeroes'])) {
      categories.add('knapsack-dp');
    }
    if (![...categories].some((category) => category.endsWith('-dp'))) categories.add('1d-dp');
  }

  if (tags.has('backtracking')) {
    categories.add('backtracking');
    if (title.includes('permutation')) categories.add('permutations-backtracking');
    if (title.includes('combination')) categories.add('combinations-backtracking');
    if (title.includes('subset')) categories.add('subsets-backtracking');
  }

  if (tags.has('linked-list')) {
    categories.add('linked-list');
    if (tags.has('two-pointers')) categories.add('two-pointers-linked-list');
    if (title.includes('cycle')) categories.add('cycle-linked-list');
    if (title.includes('reverse linked list')) categories.add('reverse-linked-list');
  }

  if (tags.has('graph') || tags.has('breadth-first-search') || tags.has('depth-first-search')
    || tags.has('topological-sort') || tags.has('shortest-path') || tags.has('union-find')) {
    categories.add('graph');
    if (tags.has('breadth-first-search')) categories.add('bfs-graph');
    if (tags.has('depth-first-search')) categories.add('dfs-graph');
    if (tags.has('shortest-path')) categories.add('shortest-path-graph');
    if (tags.has('topological-sort')) categories.add('topological-sort-graph');
    if (tags.has('minimum-spanning-tree')) categories.add('mst-graph');
    if (tags.has('union-find')) categories.add('union-find-graph');
  }

  if (tags.has('tree') || tags.has('binary-tree')) categories.add('tree');
  if (tags.has('binary-search-tree')) categories.add('bst-tree');
  if (tags.has('segment-tree')) categories.add('segment-tree');
  if (tags.has('trie')) categories.add('trie-tree');

  if (tags.has('array')) {
    categories.add('array');
    if (tags.has('sliding-window')) categories.add('sliding-window-array');
    if (tags.has('two-pointers')) categories.add('two-pointers-array');
    if (tags.has('prefix-sum')) categories.add('prefix-sum-array');
    if (tags.has('binary-search')) categories.add('binary-search-array');
  }

  if (tags.has('string')) {
    categories.add('string');
    if (tags.has('sliding-window')) categories.add('sliding-window-string');
    if (tags.has('two-pointers')) categories.add('two-pointers-string');
  }
  if (tags.has('matrix') || tags.has('geometry')) categories.add('matrix');
  if (categories.size === 0) categories.add('other');
  return [...categories].sort();
};

const preferredRepresentatives = {
  '1d-dp': '198',
  '2d-dp': '64',
  'interval-dp': '486',
  'knapsack-dp': '416',
  'bitmask-dp': '464',
  'game-theory-dp': '877',
  'tree-dp': '124',
  'graph-dp': '847',
  array: '1',
  'sliding-window-array': '209',
  'two-pointers-array': '11',
  'prefix-sum-array': '560',
  'binary-search-array': '704',
  backtracking: '17',
  'permutations-backtracking': '46',
  'combinations-backtracking': '39',
  'subsets-backtracking': '78',
  'linked-list': '206',
  'two-pointers-linked-list': '19',
  'cycle-linked-list': '141',
  'reverse-linked-list': '206',
  graph: '133',
  'bfs-graph': '994',
  'dfs-graph': '200',
  'shortest-path-graph': '743',
  'topological-sort-graph': '207',
  'mst-graph': '1584',
  'union-find-graph': '684',
  tree: '104',
  'bst-tree': '98',
  'segment-tree': '307',
  'trie-tree': '208',
  string: '20',
  'sliding-window-string': '3',
  'two-pointers-string': '125',
  matrix: '54',
  other: '9',
};

const combinedCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const previous = fs.existsSync(outputPath)
  ? JSON.parse(fs.readFileSync(outputPath, 'utf8'))
  : { categories: [], problems: [] };
const previousCategories = new Map(previous.categories.map((category) => [category.id, category]));
const previousProblems = new Map(previous.problems.map((problem) => [problem.id, problem]));
const leetcodeProblems = combinedCatalog
  .filter((problem) => problem.source === 'leetcode')
  .map((problem) => ({
    id: String(problem.id),
    source: 'leetcode',
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    tags: problem.tags ?? [],
    categories: categoriesFor(problem),
    validations: previousProblems.get(String(problem.id))?.validations ?? [],
  }));

const categoryIds = [...new Set(leetcodeProblems.flatMap((problem) => problem.categories))].sort();
const categories = categoryIds.map((id) => {
  const problemIds = leetcodeProblems
    .filter((problem) => problem.categories.includes(id))
    .map((problem) => problem.id);
  const preferred = preferredRepresentatives[id];
  const prior = previousCategories.get(id);
  const testedProblemIds = (prior?.testedProblemIds ?? []).filter((problemId) => problemIds.includes(problemId));
  const passedProblemIds = (prior?.passedProblemIds ?? []).filter((problemId) => problemIds.includes(problemId));
  const failedProblemIds = (prior?.failedProblemIds ?? []).filter((problemId) => problemIds.includes(problemId));
  return {
    id,
    status: passedProblemIds.length > 0 ? 'passed' : failedProblemIds.length > 0 ? 'failed' : 'untested',
    marker: passedProblemIds.length > 0 ? '+' : '',
    representativeProblemId: problemIds.includes(preferred) ? preferred : problemIds[0],
    testedProblemIds,
    passedProblemIds,
    failedProblemIds,
    modelAttempts: (prior?.modelAttempts ?? []).filter((attempt) => problemIds.includes(attempt.problemId)),
    problemIds,
  };
});

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  sourceCatalog: 'src/data/algorithmCatalog.json',
  problemCount: leetcodeProblems.length,
  categoryCount: categories.length,
  markerRule: 'A category receives + only after one representative passes source, input, deterministic trace, visual, and final-result validation.',
  categories,
  problems: leetcodeProblems,
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${output.problemCount} LeetCode titles across ${output.categoryCount} categories to ${outputPath}`);
