import { loadCatalog, type AlgorithmProblem } from './algorithmCatalog';
import type { Locale } from '../i18n/translations';

const SOURCES = ['leetcode', 'cses', 'codeforces', 'atcoder'] as const;

export interface TaxonomyProblemLink {
  id: string;
  source: string;
  title: string;
  difficulty: AlgorithmProblem['difficulty'];
}

export interface TaxonomyNode {
  id: string;
  label: string;
  count: number;
  problems: TaxonomyProblemLink[];
}

export interface TaxonomyGroup {
  id: string;
  label: string;
  nodes: TaxonomyNode[];
}

export interface TaxonomyResult {
  content: string;
  groups: TaxonomyGroup[];
  selectedNodeId: string | null;
}

const normalize = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ı/g, 'i');

const includesCategory = (problem: AlgorithmProblem, category: string) =>
  problem.category === category || problem.derivedCategories?.includes(category);

const titleMatches = (problem: AlgorithmProblem, terms: RegExp) =>
  terms.test(normalize(`${problem.title} ${problem.tags.join(' ')}`));

const links = (problems: AlgorithmProblem[]): TaxonomyProblemLink[] => problems
  .map(({ id, source, title, difficulty }) => ({ id, source, title, difficulty }))
  .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: 'base', numeric: true }));

const node = (id: string, label: string, problems: AlgorithmProblem[]): TaxonomyNode => ({
  id,
  label,
  count: problems.length,
  problems: links(problems),
});

const buildGroups = (problems: AlgorithmProblem[], locale: Locale): TaxonomyGroup[] => {
  const byCategory = (category: string) => problems.filter((problem) => includesCategory(problem, category));
  const dp2d = byCategory('2d-dp');
  return [
    {
      id: 'dp', label: 'Dynamic Programming', nodes: [
        node('1d-dp', '1D DP', byCategory('1d-dp')),
        node('2d-dp', '2D DP', dp2d),
        node('lcs', 'LCS', problems.filter((problem) => titleMatches(problem, /longest common subsequence|\blcs\b/))),
        node('edit-distance', 'Edit Distance', problems.filter((problem) => titleMatches(problem, /edit distance|delete operation|minimum ascii delete/))),
        node('grid-dp', locale === 'tr' ? 'Grid ve Matris DP' : 'Grid and Matrix DP', dp2d.filter((problem) => titleMatches(problem, /grid|matrix|path|square|rectangle|triangle|dungeon/))),
        node('interval-dp', 'Interval DP', byCategory('interval-dp')),
        node('knapsack-dp', 'Knapsack DP', byCategory('knapsack-dp')),
        node('tree-dp', 'Tree DP', byCategory('tree-dp')),
        node('bitmask-dp', 'Bitmask DP', byCategory('bitmask-dp')),
        node('game-dp', locale === 'tr' ? 'Oyun DP' : 'Game DP', byCategory('game-theory-dp')),
      ],
    },
    {
      id: 'graph', label: locale === 'tr' ? 'Graf' : 'Graph', nodes: [
        node('graph', locale === 'tr' ? 'Genel Graf' : 'General Graph', byCategory('graph')),
        node('dfs-graph', 'DFS', byCategory('dfs-graph')),
        node('shortest-path-graph', locale === 'tr' ? 'En Kısa Yol' : 'Shortest Path', byCategory('shortest-path-graph')),
        node('topological-sort-graph', 'Topological Sort', byCategory('topological-sort-graph')),
        node('mst-graph', 'Minimum Spanning Tree', byCategory('mst-graph')),
        node('union-find-graph', 'Union Find / DSU', byCategory('union-find-graph')),
      ],
    },
    {
      id: 'array-string', label: locale === 'tr' ? 'Dizi ve Metin' : 'Array and String', nodes: [
        node('array', 'Array', byCategory('array')),
        node('string', 'String', byCategory('string')),
        node('two-pointers-array', 'Two Pointers', byCategory('two-pointers-array')),
        node('sliding-window-array', 'Sliding Window', byCategory('sliding-window-array')),
        node('prefix-sum-array', 'Prefix Sum', byCategory('prefix-sum-array')),
        node('binary-search-array', 'Binary Search', byCategory('binary-search-array')),
      ],
    },
    {
      id: 'structures', label: locale === 'tr' ? 'Ağaç ve Yapılar' : 'Trees and Structures', nodes: [
        node('tree', 'Tree', byCategory('tree')),
        node('trie-tree', 'Trie', byCategory('trie-tree')),
        node('segment-tree', 'Segment Tree', byCategory('segment-tree')),
        node('linked-list', 'Linked List', byCategory('linked-list')),
      ],
    },
    {
      id: 'generation', label: locale === 'tr' ? 'Arama ve Üretim' : 'Search and Generation', nodes: [
        node('backtracking', 'Backtracking', byCategory('backtracking')),
        node('permutations-backtracking', 'Permutations', byCategory('permutations-backtracking')),
        node('combinations-backtracking', 'Combinations', byCategory('combinations-backtracking')),
        node('subsets-backtracking', 'Subsets', byCategory('subsets-backtracking')),
      ],
    },
  ];
};

const selectNode = (normalized: string, groups: TaxonomyGroup[]): string | null => {
  const aliases: Array<[RegExp, string]> = [
    [/\blcs\b|longest common subsequence/, 'lcs'],
    [/grid.*dp|dp.*grid|matris.*dp|matrix.*dp/, 'grid-dp'],
    [/edit distance|duzenleme mesafe/, 'edit-distance'],
    [/interval.*dp|aralik.*dp/, 'interval-dp'],
    [/knapsack|sirt.*canta/, 'knapsack-dp'],
    [/tree.*dp|agac.*dp/, 'tree-dp'],
    [/bitmask.*dp/, 'bitmask-dp'],
    [/game.*dp|oyun.*dp/, 'game-dp'],
    [/2\s*d\s*dp/, '2d-dp'],
    [/1\s*d\s*dp/, '1d-dp'],
    [/topologic|topological/, 'topological-sort-graph'],
    [/shortest path|en kisa yol/, 'shortest-path-graph'],
    [/union.find|\bdsu\b/, 'union-find-graph'],
    [/sliding window|kayan pencere/, 'sliding-window-array'],
    [/two pointer|iki isaretci/, 'two-pointers-array'],
    [/prefix sum|onek toplam/, 'prefix-sum-array'],
    [/binary search|ikili arama/, 'binary-search-array'],
    [/segment tree/, 'segment-tree'],
    [/\btrie\b/, 'trie-tree'],
    [/graf(?:ik)?|graph/, 'graph'],
    [/\b(?:dizi|array)\b/, 'array'],
    [/\b(?:metin|string)\b/, 'string'],
    [/\b(?:agac|tree)\b/, 'tree'],
    [/backtrack|geri izleme/, 'backtracking'],
  ];
  const alias = aliases.find(([pattern]) => pattern.test(normalized));
  if (alias) return alias[1];
  return groups.flatMap((group) => group.nodes).find((item) => {
    const words = normalize(item.label).split(/\W+/).filter((word) => word.length > 2);
    return words.length > 0 && words.every((word) => normalized.includes(word));
  })?.id ?? null;
};

const answer2dDp = (problems: AlgorithmProblem[], locale: Locale): string => {
  const all = problems.filter((problem) => includesCategory(problem, '2d-dp'));
  const title = locale === 'tr' ? `2D DP soru ağacı — ${all.length} doğrudan eşleşme` : `2D DP problem tree — ${all.length} direct matches`;
  return `**${title}**\n\n${locale === 'tr' ? 'Aşağıdaki etkileşimli ağaçtan bir dala tıklayın veya dal adını yazın.' : 'Click a branch in the interactive tree below or type its name.'}`;
};

const answerLcs = (problems: AlgorithmProblem[], locale: Locale): string => {
  const matches = problems.filter((problem) => titleMatches(problem, /longest common subsequence|\blcs\b/));
  return locale === 'tr'
    ? `**LCS:** Katalogda ${matches.length} doğrudan eşleşme biliyorum.${matches.length ? `\n\n${matches.map((problem) => `- ${problem.title} (${problem.source} ${problem.id})`).join('\n')}` : ''}`
    : `**LCS:** I know ${matches.length} direct catalog matches.${matches.length ? `\n\n${matches.map((problem) => `- ${problem.title} (${problem.source} ${problem.id})`).join('\n')}` : ''}`;
};

const answerRoot = (problems: AlgorithmProblem[], locale: Locale): string => {
  return `**${locale === 'tr' ? 'Soru ağacı' : 'Problem tree'} — ${problems.length} ${locale === 'tr' ? 'kayıt' : 'records'}**`;
};

const answerQuestionTaxonomy = async (
  question: string,
  locale: Locale,
): Promise<TaxonomyResult | null> => {
  const normalized = normalize(question);
  const asksLcs = /\blcs\b/.test(normalized) && /(kac|say|how many|neler|hangi|biliyor)/.test(normalized);
  const asks2dDp = /2\s*d\s*dp/.test(normalized) && /(ne|neler|hangi|var|liste|agac|kategori|tur)/.test(normalized);
  const asksRoot = /(soru|problem).*(agac|kategori|sinif|tur)|(agac|kategori).*(soru|problem)/.test(normalized);
  const asksPool = /^\s*(?:soru(?:lar)?|problem(?:ler)?)(?:\s+(?:havuz\w*|liste\w*|bank\w*|pool|ac|goster|show|open))*\s*[?!.]*\s*$/.test(normalized);
  const mentionsCategory = /(dp|lcs|grid|matris|matrix|graph|graf|dizi|array|metin|string|tree|agac|trie|window|pointer|search|arama|knapsack|interval|bitmask|dsu|backtrack)/.test(normalized);
  const asksCatalogQuestion = /(soru|problem)/.test(normalized)
    && /(var|mi\b|biliyor|bilgi|neler|hangi|kac|say|liste|goster|show|list|have|know)/.test(normalized);
  const asksBranch = mentionsCategory && (asksCatalogQuestion
    || /(goster|liste|kac|say|neler|hangi|devam|ac|git|show|list|continue)/.test(normalized));
  if (!asksLcs && !asks2dDp && !asksRoot && !asksPool && !asksBranch) return null;
  const problems = (await Promise.all(SOURCES.map((source) => loadCatalog({ source })))).flat();
  const groups = buildGroups(problems, locale);
  return {
    content: asksLcs ? answerLcs(problems, locale) : asks2dDp ? answer2dDp(problems, locale) : answerRoot(problems, locale),
    groups,
    selectedNodeId: selectNode(normalized, groups),
  };
};

export default answerQuestionTaxonomy;
