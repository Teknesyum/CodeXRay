import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEST_PATH = path.join(__dirname, '../src/data/algorithmCatalog.json');

const GRAPHQL_URL = 'https://leetcode.com/graphql';
const QUERY = `
  query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
    problemsetQuestionList: questionList(
      categorySlug: $categorySlug
      limit: $limit
      skip: $skip
      filters: $filters
    ) {
      total: totalNum
      questions: data {
        difficulty
        frontendQuestionId: questionFrontendId
        paidOnly: isPaidOnly
        title
        titleSlug
        topicTags {
          name
          slug
        }
      }
    }
  }
`;

async function fetchQuestions(skip = 0, limit = 100) {
  const variables = {
    categorySlug: "",
    skip,
    limit,
    filters: {}
  };

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(JSON.stringify(result.errors));
  }

  return result.data.problemsetQuestionList;
}

const mapTagsToCategory = (tags) => {
  const tagSlugs = tags.map(t => t.slug);

  if (tagSlugs.includes('dynamic-programming')) {
    if (tagSlugs.includes('bitmask')) return 'bitmask-dp';
    if (tagSlugs.includes('game-theory')) return 'game-theory-dp';
    if (tagSlugs.includes('tree')) return 'tree-dp';
    if (tagSlugs.includes('graph')) return 'graph-dp';
    if (tagSlugs.includes('matrix') || tagSlugs.includes('grid-illumination')) return '2d-dp';
    if (tagSlugs.includes('interval') || tagSlugs.includes('intervals')) return 'interval-dp';
    if (tagSlugs.includes('knapsack') || tagSlugs.includes('backpack')) return 'knapsack-dp';
    return '1d-dp';
  }

  if (tagSlugs.includes('backtracking')) {
    if (tagSlugs.includes('permutation') || tagSlugs.includes('permutations')) return 'permutations-backtracking';
    if (tagSlugs.includes('combination') || tagSlugs.includes('combinations')) return 'combinations-backtracking';
    return 'backtracking';
  }

  if (tagSlugs.includes('linked-list')) {
    if (tagSlugs.includes('two-pointers')) return 'two-pointers-linked-list';
    if (tagSlugs.includes('cycle')) return 'cycle-linked-list';
    return 'linked-list';
  }

  if (tagSlugs.includes('graph') || tagSlugs.includes('breadth-first-search') || tagSlugs.includes('depth-first-search') || tagSlugs.includes('topological-sort')) {
    if (tagSlugs.includes('shortest-path') || tagSlugs.includes('dijkstra')) return 'shortest-path-graph';
    if (tagSlugs.includes('topological-sort')) return 'topological-sort-graph';
    if (tagSlugs.includes('minimum-spanning-tree') || tagSlugs.includes('union-find')) return 'mst-graph';
    if (tagSlugs.includes('breadth-first-search')) return 'bfs-graph';
    if (tagSlugs.includes('depth-first-search')) return 'dfs-graph';
    return 'graph';
  }

  if (tagSlugs.includes('tree')) {
    if (tagSlugs.includes('binary-search-tree')) return 'bst-tree';
    if (tagSlugs.includes('segment-tree')) return 'segment-tree';
    if (tagSlugs.includes('trie')) return 'trie-tree';
    return 'tree';
  }

  if (tagSlugs.includes('array')) {
    if (tagSlugs.includes('sliding-window')) return 'sliding-window-array';
    if (tagSlugs.includes('two-pointers')) return 'two-pointers-array';
    if (tagSlugs.includes('prefix-sum')) return 'prefix-sum-array';
    if (tagSlugs.includes('binary-search')) return 'binary-search-array';
    return 'array';
  }

  if (tagSlugs.includes('string')) {
    if (tagSlugs.includes('sliding-window')) return 'sliding-window-string';
    if (tagSlugs.includes('two-pointers')) return 'two-pointers-string';
    return 'string';
  }

  if (tagSlugs.includes('matrix') || tagSlugs.includes('geometry')) return 'matrix';

  return 'other';
};

async function main() {
  console.log('Fetching LeetCode problem catalog...');
  const allProblems = [];
  let skip = 0;
  const limit = 100;
  let total = Infinity;

  while (skip < total) {
    console.log(`Fetching ${skip} to ${skip + limit}...`);
    const data = await fetchQuestions(skip, limit);
    total = data.total;

    for (const q of data.questions) {
      if (q.paidOnly) continue;

      allProblems.push({
        id: q.frontendQuestionId,
        source: 'leetcode',
        title: q.title,
        slug: q.titleSlug,
        difficulty: q.difficulty,
        category: mapTagsToCategory(q.topicTags),
        tags: q.topicTags.map(t => t.slug)
      });
    }

    skip += limit;
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`Successfully fetched ${allProblems.length} non-premium problems.`);

  fs.mkdirSync(path.dirname(DEST_PATH), { recursive: true });
  fs.writeFileSync(DEST_PATH, JSON.stringify(allProblems, null, 2));
  console.log(`Saved to ${DEST_PATH}`);
}

main().catch(console.error);
