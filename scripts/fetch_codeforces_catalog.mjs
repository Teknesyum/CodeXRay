import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEST_PATH = path.join(__dirname, '../src/data/algorithmCatalog.json');

const normalizeTitle = (title) => {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const mapCodeforcesDifficulty = (rating) => {
  if (!rating) return 'Medium'; // default
  if (rating < 1300) return 'Easy';
  if (rating < 1900) return 'Medium';
  return 'Hard';
};

const mapCodeforcesTagsToCategory = (tags) => {
  if (!tags || tags.length === 0) return 'other';

  if (tags.includes('dp')) {
    if (tags.includes('bitmasks')) return 'bitmask-dp';
    if (tags.includes('games')) return 'game-theory-dp';
    if (tags.includes('trees')) return 'tree-dp';
    if (tags.includes('graphs')) return 'graph-dp';
    if (tags.includes('matrices')) return '2d-dp';
    return '1d-dp';
  }

  if (tags.includes('graphs')) {
    if (tags.includes('shortest paths')) return 'shortest-path-graph';
    if (tags.includes('dsu') || tags.includes('trees')) return 'mst-graph';
    if (tags.includes('dfs and similar')) return 'dfs-graph';
    return 'graph';
  }

  if (tags.includes('trees')) {
    if (tags.includes('data structures') || tags.includes('segment tree')) return 'segment-tree';
    if (tags.includes('string suffix structures')) return 'trie-tree';
    return 'tree';
  }

  if (tags.includes('binary search')) return 'binary-search-array';
  if (tags.includes('two pointers')) return 'two-pointers-array';
  if (tags.includes('strings')) return 'string';
  if (tags.includes('geometry')) return 'matrix';

  if (tags.includes('data structures') || tags.includes('constructive algorithms') || tags.includes('greedy')) {
    return 'array';
  }

  return 'other';
};

async function main() {
  console.log('Fetching Codeforces problem catalog...');
  const response = await fetch('https://codeforces.com/api/problemset.problems');

  if (!response.ok) {
    throw new Error(`Failed to fetch Codeforces API: ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'OK') {
    throw new Error('Codeforces API returned non-OK status');
  }

  let existingCatalog = [];
  try {
    const rawData = fs.readFileSync(DEST_PATH, 'utf-8');
    existingCatalog = JSON.parse(rawData);
  } catch {
    console.log('Existing algorithmCatalog.json not found, starting fresh.');
  }

  const existingNormalizedTitles = new Set(
    existingCatalog.map(p => normalizeTitle(p.title))
  );

  const cfProblems = [];
  let skippedCount = 0;

  for (const prob of data.result.problems) {
    const normTitle = normalizeTitle(prob.name);

    if (existingNormalizedTitles.has(normTitle)) {
      skippedCount++;
      continue;
    }

    cfProblems.push({
      id: `CF-${prob.contestId}${prob.index}`,
      source: 'codeforces',
      title: prob.name,
      slug: `cf-${prob.contestId}-${prob.index.toLowerCase()}`,
      difficulty: mapCodeforcesDifficulty(prob.rating),
      category: mapCodeforcesTagsToCategory(prob.tags),
      tags: ['codeforces', ...prob.tags]
    });

    // Add to set to prevent internal duplicates (e.g., div1 and div2 sharing problems)
    existingNormalizedTitles.add(normTitle);
  }

  console.log(`Successfully extracted ${cfProblems.length} new Codeforces problems. (Skipped ${skippedCount} duplicates)`);

  const combinedCatalog = [...existingCatalog, ...cfProblems];
  fs.writeFileSync(DEST_PATH, JSON.stringify(combinedCatalog, null, 2));
  console.log(`Saved combined catalog with ${combinedCatalog.length} total problems to ${DEST_PATH}`);
}

main().catch(console.error);
