# LeetCode Category Validation Report

Last updated: 2026-08-02

## Acceptance contract

`src/data/leetcodeCategoryValidation.json` retains all 3,236 LeetCode titles and
their 37 overlapping detailed categories. A category receives `+` only when one
representative passes all of these gates:

1. exact problem-specific source;
2. complete compatible input and parameters;
3. repeatable deterministic trace mapped to committed source lines;
4. semantic visual state and transitions;
5. a final result grounded in the last snapshot.

The recorder rejects partial passes. The remaining titles stay in the matrix so
later runs can validate more than one representative per category.

## Verified result

- Titles retained: **3,236 / 3,236**.
- Detailed categories with one complete representative: **37 / 37**.
- Representative acceptance suite: **26 / 26**.
- Focused catalog/orchestrator suites: **79 / 79**.
- Full unit suite: **60 files, 381 / 381 tests**.
- Deterministic browser E2E: **61 / 61 tests**.
- TypeScript and production build: passed.
- Build budgets: initial JS **555.9 / 620 KiB**; every lazy JS chunk
  **<= 100 KiB**; local worker **5,929.9 / 6,500 KiB**; styles
  **80 / 100 KiB**.
- Lint: passed with no warnings after removing two untracked scratch probes.

## Representative coverage

| Representative | Categories credited | Grounded result |
| --- | --- | --- |
| LC198 House Robber | `1d-dp` | `12` |
| LC1143 LCS | `2d-dp`, `string` | `3` |
| LC486 Predict the Winner | `array`, `game-theory-dp`, `interval-dp` | difference `222`, winner `true` |
| LC322 Coin Change | `knapsack-dp` | `3` |
| LC46 Permutations | `backtracking`, `permutations-backtracking` | 6 unique permutations |
| LC77 Combinations | `combinations-backtracking` | 6 combinations for `n=4,k=2` |
| LC78 Subsets | `subsets-backtracking` | 8 unique subsets |
| LC167 Two Sum II | `two-pointers-array` | `[1,2]` |
| LC209 Minimum Size Subarray Sum | `sliding-window-array` | `2` |
| LC560 Subarray Sum Equals K | `prefix-sum-array` | `2` |
| LC704 Binary Search | `binary-search-array` | index `4` |
| LC3 Longest Substring | `sliding-window-string` | `3` |
| LC125 Valid Palindrome | `two-pointers-string` | `true` |
| LC9 Palindrome Number | `other` | `true` |
| LC54 Spiral Matrix | `matrix` | `[1,2,3,6,9,8,7,4,5]` |
| LC206 Reverse Linked List | `linked-list`, `reverse-linked-list` | reversed edge chain |
| LC141 Linked List Cycle | `cycle-linked-list`, `two-pointers-linked-list` | `true` |
| LC1971 Valid Path | `graph`, `bfs-graph` | path exists |
| LC841 Keys and Rooms | `dfs-graph` | `true` |
| LC207 Course Schedule | `topological-sort-graph` | `true` |
| LC743 Network Delay Time | `shortest-path-graph` | `2` |
| LC1584 Connect Points | `mst-graph` | `20` |
| LC684 Redundant Connection | `union-find-graph` | `[2,3]` |
| LC847 Visit All Nodes | `bitmask-dp`, `graph-dp` | `4` |
| LC98 Validate BST | `bst-tree`, `tree` | `true` |
| LC337 House Robber III | `tree-dp` | `7` |
| LC208 Implement Trie | `trie-tree` | final search `true` |
| LC307 Mutable Range Sum | `segment-tree` | final sum `8` |

Some representatives credit multiple categories only when the same exact source
and trace genuinely demonstrate both semantics. No category is credited from a
catalog tag alone.

## Model audit

DeepSeek R1 was tested first on LC1 Two Sum. It exhausted the structured
Architect output budget with reasoning and did not produce the required JSON
contract, including a bounded retry. Qwen3.5 produced an Architect contract but
its first SimLang program failed validation and its repair request timed out.
Neither model attempt receives a category pass; both failures remain recorded in
the matrix.

The reliable architecture is therefore hybrid: the local model may manage,
review, or teach, while a strict `source:id` registry selects exact deterministic
compilers. Unknown catalog problems do not fall through to a generic demo: they
leave source, input, timeline, and workspace unchanged.

## Integration and defects fixed

- Drawer commands preserve `source/id` and route to `create-catalog-problem`.
- Exact support is keyed by `source:id`, preventing cross-platform ID collisions.
- Catalog selection now dispatches DP, array, string, matrix, backtracking,
  linked-list, graph, tree, trie, and segment-tree compilers correctly.
- Unsupported selections never preview or atomically apply a fake package.
- All exact traces are repeatable and mapped to displayed source lines.
- Graph families use their real algorithms and highlight traversed/selected
  edges; DFS is not relabeled BFS, and Dijkstra/MST/DSU have separate state.
- Large exact compilers lazy-load, keeping the existing build budgets unchanged.

## Remaining work

`37/37` means one proven representative per category, not all 3,236 problems.
Every untested title remains in the matrix. Future validation should test the
remaining titles category by category, record failures without removing the
category marker, and expand the exact `source:id` registry only after the same
five gates pass. Real-model tests should be rerun with cached weights, but model
prose must never count as deterministic acceptance evidence.
