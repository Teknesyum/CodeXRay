# CodeXRay Algorithm Expansion Candidates

Date: 2026-08-11

## Scope and scoring

This file ranks 75 candidates for expanding the current 60 deterministic
CodeXRay presets. It deliberately uses plain bullet points instead of tables so
that every candidate can carry a short product judgment.

The local 22,027-problem catalog was used as demand evidence. Its largest
relevant tag groups include math (3,885), greedy (3,775), DP (2,392), data
structures (1,925), arrays (1,879), binary search (1,219), graphs (1,134), trees
(918), number theory (851), and strings (764). Category counts independently
show 2,340 1D-DP, 1,154 graph, 942 binary-search-array, 343 tree-DP, 317
bitmask-DP, 210 segment-tree, and 121 2D-DP records.

- Visualization suitability is scored from 1 to 100. A high score means the
  algorithm has visible state changes, a clear spatial metaphor, meaningful
  decisions, and a final result that can be understood without prose.
- Implementation complexity is scored from 1 to 100. A high score means harder
  simulator logic, new visual primitives, more invariants, larger rejection
  surface, or more demanding tests. This is not the algorithm's Big-O score.
- Priority P0 means implement soon, P1 means strong follow-up, and P2 means
  valuable after prerequisite visual primitives exist.
- “Suitable” means 80–100, “good with careful design” means 65–79, “specialist”
  means 50–64, and below 50 should normally remain a comparison/demo mode rather
  than a headline preset.

## Required acceptance contract

Every accepted candidate must provide all of the following:

- A distinct deterministic simulator; no prose-only or generic-variable fallback.
- Initialization, decision/transition, reconstruction where applicable, and a
  grounded final frame.
- A visual oracle, mathematical final-result oracle, rejection tests, and at
  least one independent boundary case.
- Complete English and Turkish phase/explanation coverage.
- A typed input contract and typed visual mapping shared by offline presets and
  validated God Mode compilation.
- Bounded trace size, stable visual IDs, reduced-motion behavior, accessible
  non-color semantics, undo, and rollback-safe AI modification.

## Ranked candidate evaluations

### Batch 13 — range and set data structures

- **61. Disjoint Set Union (Union-Find)** — Priority P0. Visualization: **96/100**. Complexity: **48/100**. Highly suitable. Show a parent forest beside set-colored members; animate find traversal, path compression, union-by-rank, redundant union, and final components. This is the strongest first addition because it unlocks a reusable forest/parent-pointer primitive.
- **62. Fenwick Tree (Binary Indexed Tree)** — Priority P0. Visualization: **94/100**. Complexity: **52/100**. Highly suitable. Synchronize the source array with a 1-indexed BIT row and illuminate the exact `lowbit` jumps for update and prefix/range query.
- **63. Segment Tree — Range Sum** — Priority P0. Visualization: **98/100**. Complexity: **61/100**. Exceptionally suitable. Display real interval nodes, full/partial/no-overlap query decisions, point updates, and upward recomputation while keeping the array synchronized.
- **64. Lazy Segment Tree — Range Add/Range Sum** — Priority P1. Visualization: **97/100**. Complexity: **81/100**. Exceptionally visual but difficult. Pending-lazy badges, full-cover updates, push propagation, split recursion, and pull recomputation must never drift from the actual tree state.
- **65. Sparse Table — Range Minimum** — Priority P0. Visualization: **89/100**. Complexity: **46/100**. Highly suitable. Show power-of-two interval rows during construction and the two overlapping blocks selected for an idempotent range-minimum query.

### Batch 14 — ordered and balanced search structures

- **66. Binary Search Tree Operations** — Priority P0. Visualization: **96/100**. Complexity: **57/100**. Highly suitable. Animate comparison paths, insertion, failed search, leaf/one-child/two-child deletion, successor selection, and subtree transplant.
- **67. AVL Tree** — Priority P0. Visualization: **99/100**. Complexity: **74/100**. One of the best visual candidates. Balance-factor and height badges make LL, RR, LR, and RL diagnosis plus rotations immediately teachable.
- **68. Red-Black Tree Insertion** — Priority P1. Visualization: **97/100**. Complexity: **83/100**. Highly suitable but invariant-heavy. Recolor, red-uncle, triangle, line, rotation, root-black, and black-height states require strict oracle coverage.
- **69. B-Tree Insertion** — Priority P1. Visualization: **95/100**. Complexity: **90/100**. Highly suitable once multi-key page nodes exist. Show page descent, full-child split, separator promotion, and leaf insertion without pretending a B-tree page is a binary node.
- **70. Treap Split/Merge** — Priority P1. Visualization: **90/100**. Complexity: **77/100**. Highly suitable. Key order and heap priority can be shown simultaneously, with recursive split boundaries and merge root choices.

### Batch 15 — stack, heap, hashing, and cache behavior

- **71. Monotonic Stack / Next Greater Element** — Priority P0. Visualization: **95/100**. Complexity: **35/100**. Excellent early addition. Place a live stack below the array and draw the resolved next-greater relation whenever dominated values pop.
- **72. Priority Queue Operations** — Priority P0. Visualization: **94/100**. Complexity: **49/100**. Highly suitable. Synchronize heap tree and storage array during push, peek, pop, sift-up, sift-down, and min/max mode changes.
- **73. Hash Table — Open Addressing** — Priority P0. Visualization: **97/100**. Complexity: **56/100**. Highly suitable. Show home hash, linear/quadratic/double-hash probe paths, collisions, tombstones, wraparound, full-table rejection, search, insert, and delete.
- **74. LRU Cache** — Priority P1. Visualization: **93/100**. Complexity: **62/100**. Highly suitable. Couple hash lookup to a doubly linked recency list and animate hit, miss, promotion, capacity pressure, and eviction.
- **75. Bloom Filter** — Priority P1. Visualization: **84/100**. Complexity: **55/100**. Suitable. A bit field with multiple hash arrows clearly teaches insert, definite-negative, probable-positive, and false-positive behavior, but deterministic hash functions must be fixed in the contract.

### Batch 16 — reachability and shortest-path variants

- **76. Bidirectional BFS** — Priority P0. Visualization: **98/100**. Complexity: **58/100**. Exceptionally suitable. Expand two colored frontiers from start and target, show balanced-side choice, meeting proof, and stitched shortest path. A deterministic God Mode implementation already provides useful groundwork.
- **77. Multi-Source BFS** — Priority P0. Visualization: **96/100**. Complexity: **51/100**. Highly suitable. Multiple source waves, owner/distance badges, queue order, and collision boundaries work for graphs and grids.
- **78. 0–1 BFS** — Priority P0. Visualization: **95/100**. Complexity: **57/100**. Highly suitable. A visible deque makes zero-weight push-front and one-weight push-back behavior more instructive than a generic shortest-path trace.
- **79. DAG Shortest Path** — Priority P1. Visualization: **83/100**. Complexity: **52/100**. Suitable. Combine topological order with a single relaxation sweep and predecessor reconstruction; it is distinct enough from Dijkstra when the DAG invariant is explicit.
- **80. Transitive Closure (Warshall)** — Priority P1. Visualization: **88/100**. Complexity: **45/100**. Highly suitable. Use a boolean matrix with active `(i,k,j)` dependencies and visually distinguish newly established reachability from old reachability.

### Batch 17 — graph decomposition and assignment

- **81. Biconnected Components / Block-Cut Tree** — Priority P1. Visualization: **94/100**. Complexity: **79/100**. Highly suitable. Start with discovery/low-link state and transform accepted blocks plus articulation points into a bipartite block-cut tree.
- **82. Dominator Tree** — Priority P2. Visualization: **76/100**. Complexity: **84/100**. Good with careful design. Iterative dominator sets and immediate-dominator selection are teachable, but dense set transitions can overwhelm the graph unless summarized progressively.
- **83. 2-SAT** — Priority P1. Visualization: **93/100**. Complexity: **72/100**. Highly suitable. Turn clauses into implication edges, color SCCs, expose a variable/negation contradiction, and reconstruct a truth assignment.
- **84. Min-Cost Max-Flow** — Priority P1. Visualization: **92/100**. Complexity: **92/100**. Highly visual but very difficult. Residual capacity and cost, shortest augmenting path, potentials, bottleneck, reverse edges, flow, and total cost all need synchronized state.
- **85. Hungarian Assignment** — Priority P1. Visualization: **90/100**. Complexity: **88/100**. Highly suitable. Cost matrix, row/column potentials, equality graph, augmenting matching, and final assignment form a strong teaching sequence.

### Batch 18 — advanced string indexes

- **86. Aho-Corasick** — Priority P0. Visualization: **99/100**. Complexity: **75/100**. One of the strongest candidates. Build a real trie, construct failure links by BFS, animate fallback hops, and emit simultaneous pattern matches at text positions.
- **87. Suffix Array — Doubling** — Priority P0. Visualization: **94/100**. Complexity: **69/100**. Highly suitable. Sort suffix rows by rank pairs at each doubling length and show equivalence-class changes rather than displaying opaque final indices.
- **88. Kasai LCP** — Priority P0. Visualization: **88/100**. Complexity: **53/100**. Highly suitable as a companion to Suffix Array. Align neighboring suffixes, show rank lookup, character comparisons, LCP reuse, and decrement.
- **89. Suffix Automaton** — Priority P1. Visualization: **96/100**. Complexity: **91/100**. Exceptionally visual but difficult. State DAGs, length/link badges, clone creation, transition rewiring, and substring query paths need stable node identity.
- **90. Palindromic Tree (Eertree)** — Priority P1. Visualization: **94/100**. Complexity: **82/100**. Highly suitable. Odd/even roots, suffix-palindrome links, character extension, node creation, and distinct-palindrome counts make a strong graph metaphor.

### Batch 19 — classic DP gaps

- **91. Subset Sum** — Priority P0. Visualization: **95/100**. Complexity: **48/100**. Highly suitable. Use an item/sum boolean matrix, explicit take/skip dependencies, impossible cells, and reconstructed subset.
- **92. Coin Change — Number of Ways** — Priority P0. Visualization: **91/100**. Complexity: **44/100**. Highly suitable if clearly separated from the existing minimum-coins preset. Show how coin-order choice prevents counting permutations as distinct combinations.
- **93. Weighted Interval Scheduling** — Priority P0. Visualization: **97/100**. Complexity: **58/100**. Exceptionally suitable. Pair sorted interval lanes and predecessor links with take/skip DP and reconstruct the chosen non-overlapping schedule.
- **94. Traveling Salesperson — Bitmask DP** — Priority P1. Visualization: **89/100**. Complexity: **82/100**. Highly suitable for bounded inputs. Show mask membership, endpoint state, predecessor transition, and reconstructed minimum tour without rendering an unbounded subset lattice.
- **95. Digit DP** — Priority P1. Visualization: **78/100**. Complexity: **80/100**. Good with careful design. Digit position, tight, started, and predicate state can be displayed as a bounded memo-state grid, but the predicate must be typed rather than arbitrary code.

### Batch 20 — structural and optimized DP

- **96. Tree DP — Subtree Sizes/Values** — Priority P0. Visualization: **96/100**. Complexity: **56/100**. Highly suitable. Root the tree and animate postorder child messages, local aggregation, subtree result badges, and return to parent.
- **97. Rerooting DP** — Priority P1. Visualization: **95/100**. Complexity: **79/100**. Highly suitable. Show the downward pass, parent contribution, edge transfer equation, and answer change as every node becomes root.
- **98. Longest Path in a DAG** — Priority P1. Visualization: **86/100**. Complexity: **55/100**. Highly suitable. Topological order, incoming predecessor dependencies, accepted/rejected improvements, and path reconstruction are visually grounded.
- **99. Optimal Binary Search Tree** — Priority P1. Visualization: **90/100**. Complexity: **70/100**. Highly suitable. Use interval DP with candidate roots, frequency cost components, split selection, and a reconstructed search tree.
- **100. Divide-and-Conquer DP Optimization** — Priority P2. Visualization: **67/100**. Complexity: **94/100**. Good only with careful design. The narrowing optimum bounds and recursive solve intervals are visible, but the prerequisite cost function and proof conditions must be strongly constrained.

### Batch 21 — backtracking and constraint solving

- **101. N-Queens** — Priority P0. Visualization: **100/100**. Complexity: **55/100**. Ideal for visualization. Use a chessboard with attack rays, place, conflict, prune, backtrack, and completed arrangement frames.
- **102. Sudoku Solver** — Priority P0. Visualization: **99/100**. Complexity: **73/100**. Ideal for visualization. Candidate sets, minimum-remaining-value choice, placement, propagation, contradiction, and rollback should all be explicit.
- **103. Permutation Generation** — Priority P1. Visualization: **91/100**. Complexity: **45/100**. Highly suitable. Pair a decision tree with used-set, current prefix, choose/unchoose transitions, duplicate handling, and output collection.
- **104. Combination Sum** — Priority P1. Visualization: **90/100**. Complexity: **49/100**. Highly suitable. Show remaining target, reuse/advance branches, accepted combination, overshoot pruning, and undo.
- **105. Exact Cover / Dancing Links** — Priority P2. Visualization: **93/100**. Complexity: **98/100**. Exceptionally visual but among the hardest additions. Sparse linked matrix structure, smallest-column choice, cover/uncover, and recursive rollback require a new specialist renderer.

### Batch 22 — number theory and geometry

- **106. Extended Euclidean Algorithm** — Priority P0. Visualization: **91/100**. Complexity: **34/100**. Highly suitable. A remainder/quotient table plus Bézout coefficient back-substitution gives a concise and rigorous trace.
- **107. Chinese Remainder Theorem** — Priority P1. Visualization: **84/100**. Complexity: **61/100**. Suitable. Merge congruence rows one at a time, show gcd compatibility, inverse contribution, contradiction, and normalized solution.
- **108. Miller-Rabin Primality Test** — Priority P1. Visualization: **82/100**. Complexity: **64/100**. Suitable. Display `n-1=d·2^s`, modular exponentiation, witness ladder, early acceptance, and composite witness. Bases must be deterministic for the supported integer range.
- **109. FFT Polynomial Multiplication** — Priority P2. Visualization: **97/100**. Complexity: **96/100**. Exceptionally visual and difficult. Even/odd recursion, roots-of-unity wheel, butterfly network, pointwise multiplication, inverse pass, and rounding need a dedicated complex-plane primitive.
- **110. Convex Hull — Monotonic Chain** — Priority P0. Visualization: **100/100**. Complexity: **62/100**. Ideal for visualization. Sort points, sweep lower/upper hulls, animate orientation turns and popped edges, then close the final polygon.

### Batch 23 — selection, sampling, and coding

- **111. Quickselect** — Priority P0. Visualization: **94/100**. Complexity: **43/100**. Highly suitable. Reuse the partition surface but retain only the target side, show rank comparison, discarded ranges, and selected order statistic.
- **112. Median of Medians Selection** — Priority P1. Visualization: **91/100**. Complexity: **72/100**. Highly suitable. Group values by five, compute group medians, recursively select a pivot, partition, and prove the remaining bound.
- **113. Fisher-Yates Shuffle** — Priority P1. Visualization: **82/100**. Complexity: **28/100**. Suitable as a seeded comparison/demo. Animate shrinking unshuffled range, deterministic seeded random index, and swap; never expose it without a stored seed.
- **114. Reservoir Sampling** — Priority P1. Visualization: **80/100**. Complexity: **39/100**. Suitable as a seeded stream simulation. Show reservoir slots, current stream index, replacement probability, seeded draw, keep/replace decision, and final sample.
- **115. Huffman Coding** — Priority P0. Visualization: **99/100**. Complexity: **59/100**. One of the strongest added candidates. Combine a frequency table, min-heap merges, growing prefix tree, code assignment, and encoded bitstream.

### Batch 24 — spatial data structures and geometry

- **116. K-D Tree Construction and Nearest Neighbor** — Priority P1. Visualization: **97/100**. Complexity: **82/100**. Exceptionally suitable. Alternate split axes on a point plane, build the tree, search near/far branches, and show bounding-distance pruning.
- **117. Quadtree Subdivision** — Priority P1. Visualization: **98/100**. Complexity: **72/100**. Exceptionally suitable. Subdivide a plane into four regions, move points into children, query intersecting cells, and collapse/expand regions.
- **118. Closest Pair of Points** — Priority P0. Visualization: **99/100**. Complexity: **69/100**. Ideal for visualization. Show recursive x-splits, best distances, central strip, y-ordered comparisons, and final closest segment.
- **119. Sweep Line Segment Intersections** — Priority P1. Visualization: **98/100**. Complexity: **91/100**. Exceptionally visual but difficult. Event queue, moving sweep line, active-set ordering, neighbor checks, and intersection events require a geometry primitive with stable ordering.
- **120. Point in Polygon / Ray Casting** — Priority P1. Visualization: **92/100**. Complexity: **50/100**. Highly suitable. Draw the query ray, inspect polygon edges, handle boundary points, count crossings, and show inside/outside parity.

### Batch 25 — tree path decomposition and offline queries

- **121. Binary Lifting for Ancestors/LCA** — Priority P0. Visualization: **92/100**. Complexity: **58/100**. Highly suitable. Display the `2^k` ancestor table, depth equalization, simultaneous jumps, and final ancestor; this complements rather than duplicates the existing parent-walk LCA.
- **122. Heavy-Light Decomposition** — Priority P1. Visualization: **98/100**. Complexity: **90/100**. Exceptionally visual but difficult. Mark subtree sizes/heavy edges, assign chain heads/positions, split a path into intervals, and delegate queries to a segment tree.
- **123. Centroid Decomposition** — Priority P1. Visualization: **97/100**. Complexity: **86/100**. Exceptionally suitable. Compute subtree sizes, choose centroid, detach components, recurse, and build the centroid tree level by level.
- **124. Euler Tour Tree Flattening** — Priority P0. Visualization: **96/100**. Complexity: **54/100**. Highly suitable. Synchronize DFS entry/exit on the tree with a flattened interval row so subtree queries become contiguous ranges.
- **125. Mo's Algorithm** — Priority P1. Visualization: **91/100**. Complexity: **73/100**. Highly suitable. Sort queries into blocks, move left/right pointers, add/remove contributions, and compare pointer travel with naive ordering.

### Batch 26 — matching, games, and decision search

- **126. Stable Marriage (Gale-Shapley)** — Priority P0. Visualization: **96/100**. Complexity: **50/100**. Highly suitable. Use two preference columns, free proposer queue, proposals, tentative engagements, rejection, partner replacement, and final stable matching.
- **127. Minimax with Alpha-Beta Pruning** — Priority P0. Visualization: **99/100**. Complexity: **66/100**. Ideal for visualization. Expand a game tree with MAX/MIN layers, propagate values, update alpha/beta bounds, and visibly prune unreachable branches.
- **128. Nim and Sprague-Grundy** — Priority P1. Visualization: **89/100**. Complexity: **57/100**. Highly suitable. Show heap XOR for Nim and a state graph with mex computation for bounded impartial games.
- **129. Dinic Capacity Scaling Variant** — Priority P2. Visualization: **65/100**. Complexity: **76/100**. Good only as a variant mode inside the existing Dinic preset. The threshold phases are useful, but a separate headline preset would duplicate too much behavior.
- **130. Push-Relabel Max Flow** — Priority P1. Visualization: **97/100**. Complexity: **88/100**. Exceptionally suitable. Height and excess badges, admissible pushes, relabels, active queue, and residual edges provide a distinct alternative to augmenting-path flow.

### Batch 27 — compression, sequences, and systems algorithms

- **131. LZW Compression** — Priority P1. Visualization: **93/100**. Complexity: **63/100**. Highly suitable. Grow a phrase dictionary while scanning input, emit codes, and replay dictionary reconstruction during decompression.
- **132. Run-Length Encoding** — Priority P2. Visualization: **72/100**. Complexity: **22/100**. Good as a small comparison/demo rather than a flagship preset. A character strip and run counter are clear but conceptually shallow.
- **133. Longest Common Increasing Subsequence** — Priority P1. Visualization: **87/100**. Complexity: **68/100**. Highly suitable. Combine two-string alignment with per-value increasing DP, predecessor updates, and sequence reconstruction.
- **134. Banker's Safety Algorithm** — Priority P1. Visualization: **91/100**. Complexity: **55/100**. Highly suitable. Resource matrices, available/work vectors, satisfiable-process selection, release, blocked pass, and safe sequence form a clear deterministic simulation.
- **135. Round-Robin CPU Scheduling** — Priority P1. Visualization: **94/100**. Complexity: **46/100**. Highly suitable. Use a time axis, ready queue, quantum slices, arrivals, preemption, completion, waiting time, and turnaround time.

## Strongest implementation waves

- **Wave A — reusable foundations:** 61 DSU, 62 Fenwick, 63 Segment Tree, 71 Monotonic Stack, 76 Bidirectional BFS.
- **Wave B — core structures and graph variants:** 66 BST Operations, 67 AVL, 73 Open-Address Hash Table, 77 Multi-Source BFS, 78 0–1 BFS.
- **Wave C — string/DP/backtracking:** 86 Aho-Corasick, 87 Suffix Array, 91 Subset Sum, 93 Weighted Interval Scheduling, 101 N-Queens.
- **Wave D — strongest newly added candidates:** 115 Huffman Coding, 118 Closest Pair of Points, 124 Euler Tour Flattening, 126 Stable Marriage, 127 Minimax with Alpha-Beta Pruning.
- **Wave E — advanced showcase:** 109 FFT, 116 K-D Tree, 119 Sweep Line Intersections, 122 Heavy-Light Decomposition, 130 Push-Relabel.

Wave order favors reusable visual primitives before specialist renderers. Array/tree
synchronization, interval trees, rotation animation, deque/frontier semantics,
failure links, geometry planes, decision trees, and matrix dependency arrows
should be generalized rather than copied into one-off components.

## Candidates best suited to visualization

The highest-value visual shortlist, all scoring at least 98, is:

- N-Queens: 100.
- Convex Hull — Monotonic Chain: 100.
- AVL Tree: 99.
- Aho-Corasick: 99.
- Sudoku Solver: 99.
- Huffman Coding: 99.
- Closest Pair of Points: 99.
- Minimax with Alpha-Beta Pruning: 99.
- Segment Tree: 98.
- Bidirectional BFS: 98.
- Quadtree Subdivision: 98.
- Sweep Line Segment Intersections: 98.
- Heavy-Light Decomposition: 98.

High visualization score alone does not determine implementation order. Segment
Tree and Bidirectional BFS should precede Sweep Line and Heavy-Light Decomposition
because their complexity scores and prerequisite costs are much lower.

## Deliberately deferred or merged candidates

- Kahn Topological Sort is not a new preset because the current Topological Sort
  already teaches indegree peeling. It should become a selectable variant.
- Shell, Comb, Cocktail, and Gnome Sort add little conceptual value after the
  existing sorting foundations. They belong in a future comparison laboratory.
- Prim/Dijkstra heap variants should be implementation modes inside existing
  presets rather than duplicate algorithm identities.
- Floyd linked-list cycle detection, Manacher, KMP, Z, and Rabin-Karp already
  exist; prioritize editable inputs and side-by-side comparison mode.
- Dinic Capacity Scaling is scored above but must remain a Dinic variant, not a
  separate registry entry.
- Blossom Matching, Link-Cut Tree, Pollard Rho, General Simplex, and arbitrary
  Monte Carlo Tree Search remain deferred until graph contraction, dynamic-tree,
  factorization, polytope, and deterministic seeded-search visual contracts exist.
- Any randomized algorithm without a stored deterministic seed is rejected.

## Acceptance gate for candidate 61

Before marking DSU supported:

- Its typed operation parser must reject missing nodes and malformed operations.
- Union-by-rank/size and path compression must be different visible transitions.
- Repeated union, self-union, singleton find, and disconnected components need
  independent result oracles.
- Component colors must be supplemented by parent/rank labels for accessibility.
- AI-authored operation lists must compile through the same typed visual contract
  and rollback without partially mutating the workspace.
- The central pedagogical manifest must change from 60 to 61 in the same commit.
