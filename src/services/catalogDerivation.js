/**
 * PURE MODULE: deriveCategories
 * Shared between Node scripts and UI client.
 * Do not import Node.js specific or DOM specific modules here.
 *
 * @param {string} source - 'leetcode', 'codeforces', 'atcoder', 'cses'
 * @param {string} title - The problem title
 * @param {string} rawCategory - The initial category or contest type
 * @param {string[]} tags - Associated tags
 * @returns {string[]} An array of derived, deterministic categories
 */
export function deriveCategories(source, title, rawCategory, tags) {
  const t = title.toLowerCase();
  const c = rawCategory ? rawCategory.toLowerCase() : '';
  const ts = tags || [];

  const derived = new Set();

  // Baseline assignment
  derived.add(c || 'other');

  // Backtracking fixes
  if (t.includes('permutation')) derived.add('permutations-backtracking');
  if (t.includes('combination') || t.includes('subset')) derived.add('combinations-backtracking');
  if (t.includes('subset')) derived.add('subsets-backtracking');

  // Linked List fixes
  if (c === 'linked-list' || ts.includes('linked-list')) {
    if (t.includes('cycle')) derived.add('cycle-linked-list');
    if (t.includes('reverse linked list')) derived.add('reverse-linked-list');
    if (t.includes('two pointers') || t.includes('merge') || t.includes('remove') || t.includes('middle')) derived.add('two-pointers-linked-list');
  }

  // DP fixes
  if (c === '1d-dp' || c === '2d-dp' || ts.includes('dynamic-programming') || ts.includes('dp')) {
    if (t.includes('interval') || t.includes('burst')) derived.add('interval-dp');
    if (t.includes('coin') || t.includes('knapsack') || t.includes('backpack') || t.includes('perfect squares')) derived.add('knapsack-dp');
    if (t.includes('game') || t.includes('stone') || ts.includes('games')) derived.add('game-theory-dp');
    if (t.includes('bitmask') || ts.includes('bitmasks')) derived.add('bitmask-dp');
    if (t.includes('matrix') || t.includes('grid') || t.includes('path') || ts.includes('matrices')) derived.add('2d-dp');
    if (ts.includes('trees')) derived.add('tree-dp');
  }

  // Graph fixes
  if (c === 'graph' || ts.includes('graph') || ts.includes('graphs')) {
    if (t.includes('shortest path') || t.includes('network delay') || ts.includes('shortest paths')) derived.add('shortest-path-graph');
    if (t.includes('course schedule') || t.includes('topological')) derived.add('topological-sort-graph');
    if (t.includes('spanning tree') || t.includes('connect all points') || ts.includes('dsu')) derived.add('mst-graph');
    if (t.includes('union') || ts.includes('dsu')) derived.add('union-find-graph');
    if (ts.includes('dfs and similar')) derived.add('dfs-graph');
  }

  // Array/String fixes
  if (c === 'array' || c === 'string' || ts.includes('array') || ts.includes('string') || ts.includes('strings') || ts.includes('two pointers') || ts.includes('binary search')) {
    if (t.includes('sliding window') || t.includes('subsegment') || t.includes('longest substring') || t.includes('minimum window')) derived.add('sliding-window-array');
    if (t.includes('two sum') || t.includes('two pointers') || t.includes('3sum') || t.includes('container with most water') || ts.includes('two pointers')) derived.add('two-pointers-array');
    if (t.includes('prefix sum') || t.includes('subarray sum') || t.includes('range sum')) derived.add('prefix-sum-array');
    if (ts.includes('binary search')) derived.add('binary-search-array');
  }

  if (ts.includes('trees') && (ts.includes('data structures') || ts.includes('segment tree'))) {
    derived.add('segment-tree');
  }

  if (ts.includes('string suffix structures')) {
    derived.add('trie-tree');
  }

  if (c === 'other' && derived.size > 1) {
    derived.delete('other');
  }

  if (derived.size === 0) {
    derived.add('other');
  }

  return Array.from(derived);
}
