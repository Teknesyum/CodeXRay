import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEST_PATH = path.join(__dirname, '../src/data/algorithmCatalog.json');

const mapTitleAndTagsToCategory = (title, category, tags) => {
  const t = title.toLowerCase();

  // Backtracking fixes
  if (t.includes('permutation')) return 'permutations-backtracking';
  if (t.includes('combination') || t.includes('subset')) return 'combinations-backtracking';

  // Linked List fixes
  if (category === 'linked-list' || tags.includes('linked-list')) {
    if (t.includes('cycle')) return 'cycle-linked-list';
    if (t.includes('two pointers') || t.includes('merge') || t.includes('remove') || t.includes('middle')) return 'two-pointers-linked-list';
  }

  // DP fixes
  if (category === '1d-dp' || category === '2d-dp' || tags.includes('dynamic-programming')) {
    if (t.includes('interval') || t.includes('burst')) return 'interval-dp';
    if (t.includes('coin') || t.includes('knapsack') || t.includes('backpack') || t.includes('perfect squares')) return 'knapsack-dp';
    if (t.includes('game') || t.includes('stone')) return 'game-theory-dp';
    if (t.includes('bitmask')) return 'bitmask-dp';
    if (t.includes('matrix') || t.includes('grid') || t.includes('path')) return '2d-dp';
  }

  // Graph fixes
  if (category === 'graph' || tags.includes('graph')) {
    if (t.includes('shortest path') || t.includes('network delay')) return 'shortest-path-graph';
    if (t.includes('course schedule') || t.includes('topological')) return 'topological-sort-graph';
    if (t.includes('spanning tree') || t.includes('connect all points')) return 'mst-graph';
  }

  // Array/String fixes
  if (category === 'array' || category === 'string' || tags.includes('array') || tags.includes('string')) {
    if (t.includes('sliding window') || t.includes('subsegment') || t.includes('longest substring') || t.includes('minimum window')) return 'sliding-window-array';
    if (t.includes('two sum') || t.includes('two pointers') || t.includes('3sum') || t.includes('container with most water')) return 'two-pointers-array';
    if (t.includes('prefix sum') || t.includes('subarray sum') || t.includes('range sum')) return 'prefix-sum-array';
  }

  return category;
};

async function main() {
  console.log('Fixing LeetCode tags and sources in algorithmCatalog.json...');

  const rawData = fs.readFileSync(DEST_PATH, 'utf-8');
  const catalog = JSON.parse(rawData);

  let fixedSourceCount = 0;
  let fixedCategoryCount = 0;

  for (let i = 0; i < catalog.length; i++) {
    const prob = catalog[i];

    // Fix missing source for original LeetCode imports
    if (!prob.source) {
      prob.source = 'leetcode';
      fixedSourceCount++;
    }

    // Fix categorization using title inference (specifically for LeetCode)
    if (prob.source === 'leetcode') {
      const oldCat = prob.category;
      const newCat = mapTitleAndTagsToCategory(prob.title, prob.category, prob.tags);
      if (oldCat !== newCat) {
        prob.category = newCat;
        fixedCategoryCount++;
      }
    }
  }

  fs.writeFileSync(DEST_PATH, JSON.stringify(catalog, null, 2));
  console.log(`Successfully fixed ${fixedSourceCount} missing sources.`);
  console.log(`Successfully refined categories for ${fixedCategoryCount} problems.`);
}

main().catch(console.error);
