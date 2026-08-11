# Algorithm Visualization Audit and Delivery Plan

Status: implementation complete for all 60 registry entries on 2026-08-11;
final verification evidence is recorded below. The authoritative execution
order is `algorithmRegistry` in `src/services/codeRegistry.ts`. A green generic
simulator test alone does not complete an item.

## Product definition of done

Every preset must teach the algorithm without AI. A completed item must have:

1. A domain-correct visual metaphor. Graph algorithms use graph structure;
   trie operations expose character nodes; sieve exposes the integer field;
   interval/DP algorithms expose their state table; pointer algorithms expose
   pointer movement rather than a text-only variable card.
2. A passive, deterministic timeline with visible initialization, inspection,
   accept/reject or update decisions, structural change, and final result.
3. No invented state. Every highlighted node, edge, cell, pointer, component,
   queue, stack, distance, or result must exist in the current trace step.
4. Source mapping: `SimulationStep.lineNumber` is 1-based or `null`, and the
   visible transition agrees with the highlighted source statement.
5. A branch-rich bounded default input plus exact parsing of user input.
6. A final-state oracle and tests that assert the mathematical result as well
   as the pedagogical phases—not merely that at least one step exists.
7. Bilingual explanations through the existing runtime translation system.
8. Typed AI modification. God Mode may edit validated input, source, program,
   visual roles, and timeline contracts, but raw model text is never executed.
9. Undo/rollback for every AI-authored workspace transaction.
10. Motion that respects `prefers-reduced-motion` and remains understandable
    when animation is disabled.

## Shared visual grammar

- `queued`: discovered/frontier but not processed.
- `active`: the node, edge, cell, or pointer inspected now.
- `visited`: processed and no longer pending.
- `path`: accepted structural result (shortest path, DFS tree, MST, match).
- `rejected`: inspected and explicitly discarded (cycle edge, failed relax,
  invalid candidate). It must remain visually distinct from idle.
- `phase`: short timeline stage displayed on the visual itself.
- `decision`: the reason for the current accept/reject/update.
- Node badges display trace-backed values such as distance, `f=g+h`, depth,
  low-link, component, indegree, or DP state.

## Required verification per algorithm

- Unit oracle on at least one representative and one edge-case input.
- Trace contract assertions for initialization, core transition, and result.
- Visual assertions for the algorithm-specific metaphor and semantic states.
- Input/parser rejection tests for invalid domain values.
- Registry/preset smoke test and bilingual runtime-text coverage.
- Browser test when layout, animation, scrolling, or interaction changes.

## Ordered audit queue

### Batch 01 — graph traversal and greedy foundations

1. **DFS** — recursion path must grow edge by edge and visibly unwind during
   backtracking; show recursion stack and DFS tree.
2. **BFS** — show FIFO queue, breadth/depth badges, discovery edges, dequeue,
   and completed level expansion.
3. **Dijkstra** — show tentative distances on nodes, inspected relaxation,
   accepted/rejected updates, settled set, predecessor tree, and final path.
4. **A\*** — show `g`, admissible `h`, `f=g+h`, open/closed sets, failed and
   successful relaxations, and the final path to the target.
5. **Kruskal** — show weight-sorted edge order, disjoint components on nodes,
   accepted MST edges, crossed-out cycle edges, and running/final weight.

### Batch 02 — weighted graph structure

6. **Prim** — frontier cut, minimum crossing edge, growing tree, key updates.
7. **Bellman-Ford** — complete edge-pass sweep, successful/failed relaxation,
   pass counter, early stop, and negative-cycle check.
8. **Floyd-Warshall** — distance matrix with active `(i,k,j)` dependencies and
   before/candidate/after values; a lone graph is insufficient.
9. **Topological Sort** — directed DAG plus indegree/outdegree removal; animate
   outer zero-indegree nodes being peeled and appended to the order.
10. **Kosaraju SCC** — first DFS finish stack, transposed graph transition,
    second DFS, and component coloring.

### Batch 03 — SCC and flow

11. **Tarjan SCC** — discovery/low badges, live stack, back edges, SCC pop.
12. **Edmonds-Karp** — residual capacities, BFS augmenting path, bottleneck,
    forward/backward residual update, accumulated flow.
13. **Dinic** — level graph construction, blocking-flow DFS, residual update.
14. **Hopcroft-Karp** — bipartite columns, alternating BFS layers, augmenting
    paths, matching edges, free vertices.
15. **Graph Coloring** — palette, current vertex, tried/rejected colors,
    conflict edge, backtracking.

### Batch 04 — paths, cuts, and all-pairs graph work

16. **Eulerian Path/Circuit** — unused-edge traversal and circuit splicing.
17. **Hamiltonian Cycle** — candidate path, adjacency constraint, rejection,
    backtrack, final closing edge.
18. **Articulation Points** — DFS tree, discovery/low badges, child separation.
19. **Bridges** — DFS tree/back edges and `low[v] > disc[u]` bridge decision.
20. **Johnson** — super-source, Bellman-Ford potentials, reweighted edges,
    per-source Dijkstra results, final distance matrix.

### Batch 05 — exact string matching

21. **Z Algorithm** — character strip, `[L,R]` box, mirror reuse, extension.
22. **KMP** — separate pattern/text strips, LPS construction, mismatch fallback
    without rewinding text, matches.
23. **Rabin-Karp** — aligned window, pattern/window hash, rolling-hash removal
    and addition, collision verification.
24. **Boyer-Moore** — right-to-left comparisons, bad-character table and jump.
25. **Kadane** — current segment versus best segment, extend/restart decision.

### Batch 06 — windows, trie, and pointer structures

26. **Sliding Window Maximum** — window frame and monotonic deque membership.
27. **Manacher** — transformed string, mirror, center/right boundary, radius.
28. **Trie Insert & Search** — real prefix tree with one character per edge;
    insert creates/highlights character nodes and search follows the exact path.
29. **Two Pointers** — sorted array, left/right pointers, sum and move reason.
30. **Prefix Sum** — source and prefix rows, dependency arrow and range result.

### Batch 07 — partitions and interval/window reasoning

31. **Dutch National Flag** — low/mid/high regions and swap animation.
32. **Moore Voting** — candidate badge, cancellation pairs, verification pass.
33. **Minimum Window Substring** — expand/contract boundaries, requirement
    counts, valid window, best window.
34. **Trapping Rain Water** — height bars, left/right maxima and filled water.
35. **Merge Intervals** — intervals on a number line, overlap and merged span.

### Batch 08 — divide/search and heap/radix foundations

36. **Quick Sort** — pivot, scan partitions, swaps, recursive ranges.
37. **Merge Sort** — split tree plus left/right buffers and merge output.
38. **Binary Search** — active range, midpoint, discarded half, final result.
39. **Heap Sort** — heap tree synchronized with array, heapify and extraction.
40. **Radix Sort** — current digit, ten buckets, stable collection pass.

### Batch 09 — elementary sorting and ternary search

41. **Counting Sort** — value domain, frequency row, prefix row, stable output.
42. **Bubble Sort** — comparison pair, swap, settled suffix.
43. **Insertion Sort** — key lifted out, shifts, sorted prefix, insertion slot.
44. **Selection Sort** — scan cursor, current minimum, final placement.
45. **Ternary Search** — two pivots and discarded thirds on a sorted array.

### Batch 10 — core dynamic programming

46. **0/1 Knapsack** — item/capacity matrix, take/skip dependencies and choice.
47. **LCS** — character-labelled matrix, diagonal match versus max(up,left),
    traceback of the subsequence.
48. **LIS** — per-index DP, predecessor comparisons and reconstructed sequence.
49. **Matrix Chain Multiplication** — interval DP by increasing length, split
    candidate `k`, cost components, best parenthesization.
50. **Edit Distance** — labelled matrix, match/insert/delete/replace dependency
    and reconstructed edit script.

### Batch 11 — DP grid and tree traversal

51. **Coin Change** — amount states, coin pass, contributing dependency and
    clarified objective (ways versus minimum coins) matching source.
52. **Unique Paths** — grid DP, top/left dependencies and path-count growth.
53. **Inorder Traversal** — binary tree, call stack, left/node/right phase.
54. **Preorder Traversal** — node/left/right phase and emitted order.
55. **Postorder Traversal** — left/right/node phase and unwind animation.

### Batch 12 — tree query, number field, and linked list

56. **LCA** — two query nodes, ancestor paths, split/lowest common node.
57. **Sieve of Eratosthenes** — numbers `2..n` as a grid; select each prime and
    cross out its multiples from `p²` step by step; show remaining primes.
58. **Fast Modular Exponentiation** — exponent bits, square/multiply decision,
    running base/result modulo `p`.
59. **Reverse Linked List** — explicit nodes and arrows; detach and reverse one
    `next` edge at a time with prev/current/next pointers.
60. **Linked-list Cycle Detection** — list/cycle graph, slow/fast pointer hops,
    meeting or termination.

## Completion evidence

### Independent edge-case audit progress

- **Entries 1–5:** disconnected traversal, unreachable shortest-path nodes,
  cheaper indirect paths, negative-edge rejection, malformed graph rejection,
  directed-MST rejection, and disconnected Kruskal forest behavior have fixed
  independent assertions. DFS and BFS now end with explicit reachable-component
  completion frames; Dijkstra and A* end with an explicit reconstructed or
  unreachable result. Kruskal no longer calls a disconnected forest an MST.
- **Entries 6–10:** disconnected Prim, reachable Bellman-Ford negative cycles,
  Floyd-Warshall unreachable pairs, residual cycles in topological sorting, and
  isolated Kosaraju components have independent assertions. Directionality and
  visual-budget rejection paths are covered. Prim no longer describes a partial
  disconnected tree as a complete MST.
- **Entries 11–15:** singleton Tarjan SCCs, unreachable-sink zero flow for both
  Edmonds-Karp and Dinic, free/isolated bipartite vertices, K4 coloring, and
  incompatible direction/capacity/bipartition/self-loop domains have independent
  assertions. The audit fixed Hopcroft-Karp's final frame so accepted matching
  edges remain visible and made Graph Coloring reject inherently uncolorable
  self-loop input before emitting a false successful coloring.
- **Entries 16–20:** invalid Euler trails, no-cycle Hamiltonian exhaustion,
  articulation roots, parallel-edge bridge semantics, disconnected Johnson
  matrices, and negative-cycle/direction/size rejection have fixed assertions.
  Euler now validates the emitted trail edge-by-edge, failed Hamilton searches
  clear result highlighting, and undirected low-link traversal skips only the
  exact parent edge rather than every parallel edge to the parent.
- **Entries 21–25:** singleton Z input, overlapping KMP matches, an actual
  Rabin-Karp collision, pattern-longer-than-text Boyer-Moore, all-negative
  singleton Kadane, and invalid parameter/input rejection are covered.
- **Entries 26–30:** width-one sliding windows, Unicode Manacher and Trie paths,
  reserved trie-root identity, two-pointer no-result, singleton prefix sums, and
  parameter bounds are covered. Manacher now operates on Unicode code-point
  tokens throughout; Trie search uses the same character model as insertion.
- **Entries 31–35:** one-color Dutch partitions, no-majority Moore verification,
  missing and Unicode minimum windows, monotone rain fields, reversed/touching
  intervals, and invalid domains are covered. Minimum Window now uses Unicode
  code-point indices consistently from counting through final slicing.
- **Entries 36–40:** duplicate Quick Sort partitions, singleton Merge/Heap cases,
  found/missing binary search, all-zero Radix Sort, and rejection paths are fixed
  assertions. Quick Sort exposes base ranges; Heap and Radix emit meaningful
  initial heap/bucket views even when no ordinary iteration is required.
- **Entries 41–45:** singleton negative Counting Sort, singleton elementary sorts,
  single-element Ternary Search, and invalid ranges/order/contracts are covered.
  Bubble, Insertion, and Selection now expose explicit boundary initialization.
- **Entries 46–50:** zero-capacity Knapsack, Unicode LCS/Edit Distance, decreasing
  LIS, single-matrix Matrix Chain, and malformed DP contracts are covered. LCS
  and Edit Distance use one Unicode code point per labelled table cell.
- **Entries 51–55:** zero/impossible Coin Change, one-cell Unique Paths, singleton
  traversals, and invalid numeric/tree contracts are covered. Binary traversals
  now reject a third child instead of silently omitting it.
- **Entries 56–60:** ancestor-query LCA, lower-bound and non-repeating Sieve,
  negative-base modular power, singleton reversal, linear/self-loop cycle cases,
  and invalid query/number/list contracts are covered. Modular residues are
  normalized to `[0,m)` and each sieve composite is crossed out once.
- All twelve independent edge-case suites cover all sixty registry entries and
  deliberately assert final mathematics, final phase semantics, Unicode/index
  behavior, and fail-fast input contracts; generic smoke checks are not used as
  substitutes for independent outcomes.

- Batches 01–04 use graph-native traces for traversal, shortest paths, MST,
  SCC, flow, matching, coloring, paths/cuts, and all-pairs algorithms.
- Batches 05–07 add string alignment, trie nodes, window/deque, pointer,
  partition, bar-water, and number-line interval visuals.
- Batches 08–09 add heap levels, radix buckets, merge buffers, counting rows,
  sorted-region decisions, and binary/ternary range elimination.
- Batches 10–11 add labelled DP matrices with dependency highlights,
  traceback, diagonal fill, grid fill, and explicit tree call-stack phases.
- Batch 12 adds ancestor-path tracing, the complete `2..n` sieve number field,
  exponent-bit rows, directed linked-list arrows, and Floyd pointer movement.
- Twelve focused pedagogical suites cover five algorithms apiece. The shared
  60-entry registry test checks three presets per algorithm, valid source-line
  mapping, non-empty deterministic traces, and Turkish runtime translation.
  `catalogFinalOracle.test.ts` independently checks every final result.
- `pedagogicalCoverage.test.ts` centrally maps all 60 registry names to their
  required visual metaphor and verifies at least initialization, core, and
  result phases plus a grounded final phase. Its first run exposed missing
  shortest-path boundary frames and a phase-less sorting completion step; both
  are now explicit, localized timeline states.
- The visual contracts remain typed (`array`, `graph`, `matrix`,
  `string-match`, `bars`, `intervals`, and `rows`); AI-authored changes still
  pass through the existing validated command bus, compile/interpreter gates,
  transaction audit, undo, and rollback boundaries.
- Model-authored algorithms can now select those specialized metaphors in the
  Architect contract instead of being reduced to `array | graph | variables`.
  Matrix, string-match, bars, intervals, and rows selections require complete
  trace-variable mappings; the mapping is forwarded to Code Author, preserved
  by the V2 visual designer, and rejected before workspace commit if incomplete.
  An end-to-end orchestrator test proves an authored heap-row mapping becomes
  real `RowsVisualData` in every compiled trace step.
- In-app visual acceptance was attempted against `http://127.0.0.1:4173/`.
  Vite responded locally, but the in-app browser blocked localhost navigation
  under its URL security policy. No alternate browser workaround was used;
  component/DOM rendering remains covered by automated visualizer tests.
- Final automated acceptance on 2026-08-11 passes lint, 100 Vitest files / 632
  tests, the production size gates (619.9/620 KiB initial JavaScript), and all
  67 Chromium Playwright scenarios using the documented external Vite server.
