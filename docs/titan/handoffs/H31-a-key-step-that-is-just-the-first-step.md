# H31 — A Key Step That Is Just The First Step

## Turn

- route: `docs/titan/routes/R31-a-key-step-that-is-just-the-first-step.md`
- base SHA: `614f163`
- end SHA: `665442a6806294b80d975d70d1a1dd9d0f172b25`
- status: `closed`
- next holder: Claude (T0)

## Özet

`scoreTrace` bir faz içinde ayrım yapabilen üç terim kazandı; kalıntı ölçüsü 57'den 0'a indi.
`mostSignificantIndex` artık 0'ı beraberlikle döndürmüyor: 19 algoritmadan 7'ye indi ve
yedisinin de 0'ı puanla kazanıyor. Faz `kind` alanı çoğunluk kuralına geçti, 4 faz `setup` oldu.

## What changed

| path:line-range | intent | action |
|---|---|---|
| `src/services/trace/significance.ts:43-64` | `decisionLabel`, `mutationBreadth`, `decisionBreadth` — within-phase terms | added |
| `src/services/trace/significance.ts:66-71` | `firstWriteBreadth` — first write to a variable | added |
| `src/services/trace/significance.ts:78-107` | `scoreTrace` builds the decision introduction map and the written-variable set, and sums the four new terms | edited |
| `src/services/trace/traceOutline.ts:24-42` | `stepKind`, `dominantKind` — majority phase kind | added |
| `src/services/trace/traceOutline.ts:58-61` | `buildTraceOutline` takes the phase kind from `dominantKind` instead of `group[0]` | edited |
| `src/services/trace/significance.test.ts:1-122` | 8 unit tests for within-phase discrimination, the weight ceiling, the tie in `mostSignificantIndex`, and the phase kind | added |
| `e2e/checkpoint-phases.spec.ts:33` | DFS guided-tour stops after the change | edited |
| `e2e/checkpoint-phases.spec.ts:47` | DFS guided-tour stops on the phase-stripped fallback after the change | edited |
| `e2e/checkpoint-phases.spec.ts:50-55` | new spec: the tour reaches steps the tie-keeping scorer never selected | added |

## Commits

```
665442a route(R31): close
f75e393 route(R31): open
```

## What the new terms are

All four are bounded and sit below every kind and event weight:

| term | maximum | varies with |
|---|---|---|
| `mutationBreadth` | 0.08 | `step.mutated.length`, through `n / (n + 1)` — injective in `n` |
| `decisionBreadth` novelty | 0.05 | this step is where the decision label first appears |
| `decisionBreadth` shift | 0.03 | the decision label differs from the previous step's |
| `decisionBreadth` rank | 0.01 | the order in which the label was introduced in the run |
| `firstWriteBreadth` | 0.02 | how many of `mutated` no earlier step had written |

The sum is at most 0.19. With the pre-existing `numericDelta` cap of 0.3 the total
non-structural contribution is at most 0.49, below the 0.5 that separates the smallest
non-zero kind weight from zero. `significance.test.ts:62` asserts that a `loop-exit` step with
nothing else going for it still outranks a `mutate` step with six novel variables and a novel
decision label.

`decision` needed no new field: `publicScopes` in `simulationTrace.ts` already keeps it, so it
arrives as `step.scopes.decision`. `RawTraceStep` and `simulationTrace.ts` were not touched.

## Acceptance

Criteria copied verbatim from the route, each with one evidence pointer.

1. **The per-algorithm table above is reproduced on the base commit**, all 60 rows, pasted
   verbatim, before any source change. If the implementer's numbers differ from T0's, that is
   the finding and the rest of the route is measured against the implementer's.
   — **met**. `## Criterion 1`, 60 rows and
   `ALGOS=60 totPhases=936 keyEqStart=882 algosAllKeyEqStart=33 algosAllZeroScore=0 sigZero=19`.
   Identical to T0's, including all twenty rows the route printed.

2. **Residual, and it must be empty: no multi-step phase whose within-phase signal varies may
   still have a constant score across the phase.** Report it as a count on the base and a count
   after — the after count is the gate.
   — **met**. `## Criterion 2`: `residualConstantScorePhases=57` on the base,
   `residualConstantScorePhases=0` after, both lists pasted.

3. **The 16 phases with no varying signal are reported by name and left alone.**
   — **met**. `## Criterion 3`, `noSignal=16`, all sixteen named.

4. **`mostSignificantIndex` no longer returns 0 by tie.** Report how many of the 60 still return
   0 and, for each, whether index 0 actually wins on score or merely survives the strict `>`.
   — **met**. `## Criterion 4`: 19 → 7, all 19 base cases `strictWin=false`, all 7 remaining
   `strictWin=true tiedAtMax=0`. `src/services/trace/significance.test.ts:90`.

5. **Single-step phases are untouched**: their `keyIndex` still equals `startIndex`, all 763.
   — **met**. `singleStepPhases=763 ... singleKeyEqStart=763` before and after;
   `src/services/trace/significance.test.ts:77`.

6. **`TracePhase.kind` is either fixed with a stated rule or explicitly left**, and the handoff
   says which and why.
   — **met**, fixed. Rule and measurement in `## Criterion 6`;
   `src/services/trace/traceOutline.ts:26` and `src/services/trace/significance.test.ts:105`.

7. **No simulator file is modified**, and no `Math.random` or wall-clock branching enters the
   trace path.
   — **met**. `## Criterion 7`; the `Select-String` over
   `src/services/(simulators|extended|compound)` prints nothing.

8. `lint`, `test`, `build` clean, with the unit test count stated against the base's 909 and the
   initial-JS figure against the 425.0 KiB budget.
   — **met**. `## Criterion 8`: lint exit 0, 909 → 917, `Initial JavaScript: 422.6 / 425.0 KiB`
   unchanged.

9. **A user-visible criterion cannot close on a unit test alone.** The guided tour is the
   consumer; show that a tour over an algorithm from the table above now visits steps it did not
   visit before, with both lists.
   — **met**. `e2e/checkpoint-phases.spec.ts:50` in the running product, against the production
   call site `src/services/aiTimelineControl.ts:103` → `:31`. DFS `1,2,4,7,11,14,23,24` →
   `1,2,5,9,13,14,23,24`; both lists and the other 15 changed algorithms in `## Criterion 9`.

## Criterion 1 — the base table, reproduced on `614f163`

Reproduced verbatim from the base commit before any source change. Every figure matches T0's,
including the twenty rows the route printed.

```
Depth First Search (DFS)           | steps=24  phases=17  keyEqStart=17  nonZeroScores=24  sig=0
Breadth First Search (BFS)         | steps=17  phases=13  keyEqStart=13  nonZeroScores=17  sig=0
Dijkstra's Shortest Path           | steps=17  phases=13  keyEqStart=10  nonZeroScores=17  sig=3
A* Search Algorithm                | steps=17  phases=13  keyEqStart=10  nonZeroScores=17  sig=3
Kruskal's MST                      | steps=7   phases=3   keyEqStart=3   nonZeroScores=7   sig=1
Prim's MST                         | steps=12  phases=12  keyEqStart=12  nonZeroScores=12  sig=2
Bellman-Ford Algorithm             | steps=17  phases=10  keyEqStart=8   nonZeroScores=17  sig=1
Floyd-Warshall Algorithm           | steps=15  phases=11  keyEqStart=10  nonZeroScores=15  sig=2
Topological Sort                   | steps=16  phases=15  keyEqStart=15  nonZeroScores=16  sig=4
Kosaraju's SCC                     | steps=32  phases=13  keyEqStart=13  nonZeroScores=29  sig=0
Tarjan's SCC                       | steps=29  phases=25  keyEqStart=25  nonZeroScores=29  sig=0
Edmonds-Karp Max Flow              | steps=22  phases=10  keyEqStart=10  nonZeroScores=22  sig=6
Dinic's Max Flow                   | steps=8   phases=7   keyEqStart=7   nonZeroScores=8   sig=2
Bipartite Matching (Hopcroft-Karp) | steps=11  phases=9   keyEqStart=8   nonZeroScores=11  sig=3
Graph Coloring                     | steps=14  phases=12  keyEqStart=11  nonZeroScores=14  sig=6
Eulerian Path/Circuit              | steps=15  phases=4   keyEqStart=4   nonZeroScores=15  sig=0
Hamiltonian Cycle                  | steps=144 phases=100 keyEqStart=100 nonZeroScores=144 sig=0
Articulation Points                | steps=35  phases=35  keyEqStart=35  nonZeroScores=35  sig=0
Bridges in Graph                   | steps=35  phases=35  keyEqStart=35  nonZeroScores=35  sig=0
Johnson's Algorithm                | steps=29  phases=16  keyEqStart=16  nonZeroScores=29  sig=0
Z-Algorithm                        | steps=26  phases=20  keyEqStart=20  nonZeroScores=26  sig=2
Knuth-Morris-Pratt (KMP)           | steps=35  phases=15  keyEqStart=11  nonZeroScores=35  sig=2
Rabin-Karp Algorithm               | steps=23  phases=23  keyEqStart=23  nonZeroScores=23  sig=3
Boyer-Moore Algorithm              | steps=19  phases=7   keyEqStart=5   nonZeroScores=19  sig=2
Kadane's Algorithm                 | steps=14  phases=11  keyEqStart=10  nonZeroScores=14  sig=1
Sliding Window Maximum             | steps=17  phases=12  keyEqStart=10  nonZeroScores=17  sig=0
Longest Palindromic Substring (Manacher's) | steps=67  phases=47  keyEqStart=38  nonZeroScores=67  sig=1
Trie Insert & Search               | steps=36  phases=13  keyEqStart=13  nonZeroScores=36  sig=0
Two Pointers Technique             | steps=5   phases=3   keyEqStart=2   nonZeroScores=5   sig=3
Prefix Sum Array                   | steps=8   phases=4   keyEqStart=3   nonZeroScores=8   sig=2
Dutch National Flag                | steps=8   phases=3   keyEqStart=2   nonZeroScores=8   sig=2
Moore's Voting Algorithm           | steps=15  phases=8   keyEqStart=7   nonZeroScores=12  sig=1
Minimum Window Substring           | steps=28  phases=13  keyEqStart=10  nonZeroScores=28  sig=2
Trapping Rain Water                | steps=14  phases=3   keyEqStart=2   nonZeroScores=13  sig=2
Merge Intervals                    | steps=6   phases=5   keyEqStart=5   nonZeroScores=6   sig=0
Quick Sort                         | steps=37  phases=31  keyEqStart=31  nonZeroScores=37  sig=1
Merge Sort                         | steps=40  phases=26  keyEqStart=22  nonZeroScores=40  sig=1
Binary Search                      | steps=5   phases=3   keyEqStart=2   nonZeroScores=5   sig=2
Heap Sort                          | steps=25  phases=23  keyEqStart=23  nonZeroScores=25  sig=1
Radix Sort                         | steps=29  phases=8   keyEqStart=5   nonZeroScores=29  sig=2
Counting Sort                      | steps=22  phases=4   keyEqStart=4   nonZeroScores=16  sig=14
Bubble Sort                        | steps=15  phases=11  keyEqStart=10  nonZeroScores=15  sig=1
Insertion Sort                     | steps=26  phases=26  keyEqStart=26  nonZeroScores=26  sig=2
Selection Sort                     | steps=20  phases=14  keyEqStart=14  nonZeroScores=20  sig=2
Ternary Search                     | steps=4   phases=3   keyEqStart=3   nonZeroScores=4   sig=0
0/1 Knapsack                       | steps=34  phases=3   keyEqStart=2   nonZeroScores=34  sig=2
Longest Common Subsequence         | steps=52  phases=4   keyEqStart=4   nonZeroScores=49  sig=0
Longest Increasing Subsequence     | steps=34  phases=4   keyEqStart=2   nonZeroScores=34  sig=3
Matrix Chain Multiplication        | steps=15  phases=4   keyEqStart=2   nonZeroScores=15  sig=2
Edit Distance                      | steps=51  phases=4   keyEqStart=4   nonZeroScores=47  sig=0
Coin Change                        | steps=30  phases=3   keyEqStart=2   nonZeroScores=30  sig=2
Unique Paths                       | steps=14  phases=3   keyEqStart=2   nonZeroScores=14  sig=2
Binary Tree Inorder Traversal      | steps=61  phases=54  keyEqStart=54  nonZeroScores=61  sig=0
Binary Tree Preorder Traversal     | steps=61  phases=54  keyEqStart=54  nonZeroScores=61  sig=0
Binary Tree Postorder Traversal    | steps=61  phases=61  keyEqStart=61  nonZeroScores=61  sig=0
Lowest Common Ancestor (LCA)       | steps=21  phases=5   keyEqStart=5   nonZeroScores=21  sig=0
Sieve of Eratosthenes              | steps=24  phases=8   keyEqStart=8   nonZeroScores=24  sig=2
Fast Exponentiation (Modular)      | steps=6   phases=3   keyEqStart=2   nonZeroScores=6   sig=2
Reverse Linked List                | steps=12  phases=12  keyEqStart=12  nonZeroScores=12  sig=3
Detect Cycle in Linked List        | steps=7   phases=5   keyEqStart=5   nonZeroScores=7   sig=1
```

```
ALGOS=60 totPhases=936 keyEqStart=882 algosAllKeyEqStart=33 algosAllZeroScore=0 sigZero=19
singleStepPhases=763 multiStepPhases=173 withDecision=33 decisionVaries=32 mutatedVaries=152 either=157 noSignal=16 singleKeyEqStart=763 multiKeyEqStart=119
residualConstantScorePhases=57
```

`singleKeyEqStart` and `multiKeyEqStart` are this handoff's additions to the probe: 763 of the
882 `keyEqStart` phases are single-step phases where there is nothing to choose. The honest
figure is `multiKeyEqStart=119` of 173.

After the change, same probe:

```
Depth First Search (DFS)           | steps=24  phases=17  keyEqStart=16  nonZeroScores=24  sig=4
Breadth First Search (BFS)         | steps=17  phases=13  keyEqStart=13  nonZeroScores=17  sig=2
Dijkstra's Shortest Path           | steps=17  phases=13  keyEqStart=10  nonZeroScores=17  sig=3
A* Search Algorithm                | steps=17  phases=13  keyEqStart=10  nonZeroScores=17  sig=3
Kruskal's MST                      | steps=7   phases=3   keyEqStart=3   nonZeroScores=7   sig=1
Prim's MST                         | steps=12  phases=12  keyEqStart=12  nonZeroScores=12  sig=2
Bellman-Ford Algorithm             | steps=17  phases=10  keyEqStart=8   nonZeroScores=17  sig=1
Floyd-Warshall Algorithm           | steps=15  phases=11  keyEqStart=10  nonZeroScores=15  sig=2
Topological Sort                   | steps=16  phases=15  keyEqStart=15  nonZeroScores=16  sig=4
Kosaraju's SCC                     | steps=32  phases=13  keyEqStart=13  nonZeroScores=29  sig=17
Tarjan's SCC                       | steps=29  phases=25  keyEqStart=24  nonZeroScores=29  sig=27
Edmonds-Karp Max Flow              | steps=22  phases=10  keyEqStart=10  nonZeroScores=22  sig=6
Dinic's Max Flow                   | steps=8   phases=7   keyEqStart=7   nonZeroScores=8   sig=2
Bipartite Matching (Hopcroft-Karp) | steps=11  phases=9   keyEqStart=8   nonZeroScores=11  sig=3
Graph Coloring                     | steps=14  phases=12  keyEqStart=11  nonZeroScores=14  sig=6
Eulerian Path/Circuit              | steps=15  phases=4   keyEqStart=4   nonZeroScores=15  sig=14
Hamiltonian Cycle                  | steps=144 phases=100 keyEqStart=100 nonZeroScores=144 sig=143
Articulation Points                | steps=35  phases=35  keyEqStart=35  nonZeroScores=35  sig=16
Bridges in Graph                   | steps=35  phases=35  keyEqStart=35  nonZeroScores=35  sig=16
Johnson's Algorithm                | steps=29  phases=16  keyEqStart=16  nonZeroScores=29  sig=3
Z-Algorithm                        | steps=26  phases=20  keyEqStart=20  nonZeroScores=26  sig=4
Knuth-Morris-Pratt (KMP)           | steps=35  phases=15  keyEqStart=11  nonZeroScores=35  sig=10
Rabin-Karp Algorithm               | steps=23  phases=23  keyEqStart=23  nonZeroScores=23  sig=3
Boyer-Moore Algorithm              | steps=19  phases=7   keyEqStart=5   nonZeroScores=19  sig=2
Kadane's Algorithm                 | steps=14  phases=11  keyEqStart=10  nonZeroScores=14  sig=1
Sliding Window Maximum             | steps=17  phases=12  keyEqStart=10  nonZeroScores=17  sig=0
Longest Palindromic Substring (Manacher's) | steps=67  phases=47  keyEqStart=40  nonZeroScores=67  sig=1
Trie Insert & Search               | steps=36  phases=13  keyEqStart=13  nonZeroScores=36  sig=0
Two Pointers Technique             | steps=5   phases=3   keyEqStart=2   nonZeroScores=5   sig=3
Prefix Sum Array                   | steps=8   phases=4   keyEqStart=3   nonZeroScores=8   sig=2
Dutch National Flag                | steps=8   phases=3   keyEqStart=2   nonZeroScores=8   sig=2
Moore's Voting Algorithm           | steps=15  phases=8   keyEqStart=7   nonZeroScores=12  sig=2
Minimum Window Substring           | steps=28  phases=13  keyEqStart=10  nonZeroScores=28  sig=8
Trapping Rain Water                | steps=14  phases=3   keyEqStart=2   nonZeroScores=13  sig=2
Merge Intervals                    | steps=6   phases=5   keyEqStart=5   nonZeroScores=6   sig=0
Quick Sort                         | steps=37  phases=31  keyEqStart=31  nonZeroScores=37  sig=1
Merge Sort                         | steps=40  phases=26  keyEqStart=22  nonZeroScores=40  sig=6
Binary Search                      | steps=5   phases=3   keyEqStart=2   nonZeroScores=5   sig=2
Heap Sort                          | steps=25  phases=23  keyEqStart=23  nonZeroScores=25  sig=1
Radix Sort                         | steps=29  phases=8   keyEqStart=5   nonZeroScores=29  sig=2
Counting Sort                      | steps=22  phases=4   keyEqStart=4   nonZeroScores=16  sig=14
Bubble Sort                        | steps=15  phases=11  keyEqStart=10  nonZeroScores=15  sig=2
Insertion Sort                     | steps=26  phases=26  keyEqStart=26  nonZeroScores=26  sig=3
Selection Sort                     | steps=20  phases=14  keyEqStart=14  nonZeroScores=20  sig=6
Ternary Search                     | steps=4   phases=3   keyEqStart=3   nonZeroScores=4   sig=1
0/1 Knapsack                       | steps=34  phases=3   keyEqStart=2   nonZeroScores=34  sig=2
Longest Common Subsequence         | steps=52  phases=4   keyEqStart=4   nonZeroScores=49  sig=1
Longest Increasing Subsequence     | steps=34  phases=4   keyEqStart=2   nonZeroScores=34  sig=3
Matrix Chain Multiplication        | steps=15  phases=4   keyEqStart=2   nonZeroScores=15  sig=2
Edit Distance                      | steps=51  phases=4   keyEqStart=4   nonZeroScores=47  sig=0
Coin Change                        | steps=30  phases=3   keyEqStart=2   nonZeroScores=30  sig=2
Unique Paths                       | steps=14  phases=3   keyEqStart=2   nonZeroScores=14  sig=2
Binary Tree Inorder Traversal      | steps=61  phases=54  keyEqStart=54  nonZeroScores=61  sig=0
Binary Tree Preorder Traversal     | steps=61  phases=54  keyEqStart=54  nonZeroScores=61  sig=2
Binary Tree Postorder Traversal    | steps=61  phases=61  keyEqStart=61  nonZeroScores=61  sig=0
Lowest Common Ancestor (LCA)       | steps=21  phases=5   keyEqStart=5   nonZeroScores=21  sig=0
Sieve of Eratosthenes              | steps=24  phases=8   keyEqStart=8   nonZeroScores=24  sig=2
Fast Exponentiation (Modular)      | steps=6   phases=3   keyEqStart=2   nonZeroScores=6   sig=2
Reverse Linked List                | steps=12  phases=12  keyEqStart=12  nonZeroScores=12  sig=3
Detect Cycle in Linked List        | steps=7   phases=5   keyEqStart=5   nonZeroScores=7   sig=1
```

```
ALGOS=60 totPhases=936 keyEqStart=882 algosAllKeyEqStart=31 algosAllZeroScore=0 sigZero=7
singleStepPhases=763 multiStepPhases=173 withDecision=33 decisionVaries=32 mutatedVaries=152 either=157 noSignal=16 singleKeyEqStart=763 multiKeyEqStart=119
residualConstantScorePhases=0
```

## Criterion 2 — residual, and it is empty

A multi-step phase counts as residual when a within-phase signal varies (`decision` across the
phase, or `mutated.length` across the phase) and yet every step of the phase carries the same
score.

Base: **57**. After: **0**.

Base residual list, verbatim:

```
residualConstantScorePhases=57
Breadth First Search (BFS) | p3 2-3 decVar=true mutVar=true score=1
Breadth First Search (BFS) | p12 13-15 decVar=true mutVar=true score=0.5
Floyd-Warshall Algorithm | p9 10-11 decVar=true mutVar=true score=0.7
Topological Sort | p3 2-3 decVar=true mutVar=true score=1
Kosaraju's SCC | p5 18-20 decVar=false mutVar=true score=1
Kosaraju's SCC | p8 23-24 decVar=false mutVar=true score=0.5
Kosaraju's SCC | p11 27-29 decVar=false mutVar=true score=0.5
Tarjan's SCC | p19 18-19 decVar=true mutVar=true score=1
Tarjan's SCC | p23 24-26 decVar=true mutVar=true score=0.5
Edmonds-Karp Max Flow | p4 7-10 decVar=false mutVar=true score=0.5
Edmonds-Karp Max Flow | p6 12-15 decVar=false mutVar=true score=0.5
Edmonds-Karp Max Flow | p8 17-19 decVar=false mutVar=true score=0.5
Graph Coloring | p9 9-10 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p15 14-15 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p21 23-25 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p22 26-27 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p29 34-35 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p35 42-46 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p36 47-49 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p48 61-62 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p49 63-64 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p53 69-70 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p57 75-81 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p58 82-84 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p60 86-87 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p67 94-95 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p68 96-98 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p73 103-104 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p74 105-106 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p87 120-122 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p88 123-125 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p89 126-128 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p90 129-130 decVar=false mutVar=true score=0.5
Hamiltonian Cycle | p94 134-135 decVar=false mutVar=true score=0.5
Johnson's Algorithm | p6 9-12 decVar=false mutVar=true score=0.5
Johnson's Algorithm | p8 14-16 decVar=false mutVar=true score=0.5
Johnson's Algorithm | p10 18-20 decVar=false mutVar=true score=0.5
Johnson's Algorithm | p12 22-24 decVar=false mutVar=true score=0.5
Kadane's Algorithm | p4 3-4 decVar=true mutVar=true score=1.3
Sliding Window Maximum | p7 9-10 decVar=false mutVar=true score=0.5
Longest Palindromic Substring (Manacher's) | p4 3-4 decVar=false mutVar=true score=1.3
Trie Insert & Search | p4 6-10 decVar=false mutVar=true score=0.5
Trie Insert & Search | p6 12-17 decVar=false mutVar=true score=0.5
Trie Insert & Search | p8 19-23 decVar=false mutVar=true score=0.5
Trie Insert & Search | p10 25-28 decVar=false mutVar=true score=0.5
Merge Sort | p2 3-4 decVar=false mutVar=true score=0.8
Merge Sort | p7 9-10 decVar=false mutVar=true score=0.6000000000000001
Ternary Search | p2 1-2 decVar=true mutVar=false score=1
Binary Tree Inorder Traversal | p15 14-15 decVar=false mutVar=true score=0.5
Binary Tree Inorder Traversal | p27 27-29 decVar=false mutVar=true score=0.5
Binary Tree Inorder Traversal | p41 43-44 decVar=false mutVar=true score=0.5
Binary Tree Inorder Traversal | p53 56-59 decVar=false mutVar=true score=0.5
Binary Tree Preorder Traversal | p17 16-17 decVar=false mutVar=true score=0.5
Binary Tree Preorder Traversal | p28 28-30 decVar=false mutVar=true score=0.5
Binary Tree Preorder Traversal | p42 44-45 decVar=false mutVar=true score=0.5
Binary Tree Preorder Traversal | p53 56-59 decVar=false mutVar=true score=0.5
Lowest Common Ancestor (LCA) | p3 16-18 decVar=false mutVar=true score=0.5
```

After:

```
residualConstantScorePhases=0


TOUR Depth First Search (DFS) :: 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,17,23
KIND Depth First Search (DFS) :: update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Breadth First Search (BFS) :: 0,1,2,4,5,7,8,9,10,11,12,13,16
KIND Breadth First Search (BFS) :: update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Dijkstra's Shortest Path :: 0,1,3,4,5,7,9,10,12,13,14,15,16
KIND Dijkstra's Shortest Path :: update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR A* Search Algorithm :: 0,1,3,4,5,7,9,10,12,13,14,15,16
KIND A* Search Algorithm :: update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Kruskal's MST :: 0,1,6
KIND Kruskal's MST :: update,update,update
TOUR Prim's MST :: 0,1,2,3,4,5,6,7,8,9,10,11
KIND Prim's MST :: update,update,update,update,update,update,update,update,update,update,update,update
TOUR Bellman-Ford Algorithm :: 0,1,4,5,6,7,8,11,15,16
KIND Bellman-Ford Algorithm :: update,update,update,update,update,update,update,update,update,update
TOUR Floyd-Warshall Algorithm :: 0,1,2,3,4,5,6,9,10,13,14
KIND Floyd-Warshall Algorithm :: update,update,update,update,update,update,update,update,update,update,update
TOUR Topological Sort :: 0,1,2,4,5,6,7,8,9,10,11,12,13,14,15
KIND Topological Sort :: update,update,update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Kosaraju's SCC :: 0,8,16,17,18,21,22,23,25,26,27,30,31
KIND Kosaraju's SCC :: update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Tarjan's SCC :: 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,20,21,23,25,27,28
KIND Tarjan's SCC :: update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Edmonds-Karp Max Flow :: 0,1,6,7,11,12,16,17,20,21
KIND Edmonds-Karp Max Flow :: update,update,update,update,update,update,update,update,update,update
TOUR Dinic's Max Flow :: 0,1,2,4,5,6,7
KIND Dinic's Max Flow :: update,update,update,update,update,update,update
TOUR Bipartite Matching (Hopcroft-Karp) :: 0,1,3,5,6,7,8,9,10
KIND Bipartite Matching (Hopcroft-Karp) :: update,update,update,update,update,update,update,update,update
TOUR Graph Coloring :: 0,1,2,3,4,6,7,8,9,11,12,13
KIND Graph Coloring :: update,update,update,update,update,update,update,update,update,update,update,update
TOUR Eulerian Path/Circuit :: 0,1,7,14
KIND Eulerian Path/Circuit :: update,update,update,update
TOUR Hamiltonian Cycle :: 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,16,17,18,19,20,23,26,28,29,30,31,32,33,34,36,37,38,39,40,42,47,50,51,52,53,54,55,56,57,58,59,60,61,63,65,66,68,69,71,72,73,75,82,85,86,88,89,90,91,92,93,94,96,99,100,101,102,103,105,107,108,110,111,112,113,114,115,116,117,118,119,120,123,126,129,131,132,133,134,136,138,139,141,142,143
KIND Hamiltonian Cycle :: update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Articulation Points :: 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34
KIND Articulation Points :: update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Bridges in Graph :: 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34
KIND Bridges in Graph :: update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Johnson's Algorithm :: 0,1,2,3,8,9,13,14,17,18,21,22,25,26,27,28
KIND Johnson's Algorithm :: update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Z-Algorithm :: 0,1,2,4,5,6,7,8,14,15,16,17,18,19,20,21,22,23,24,25
KIND Z-Algorithm :: update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Knuth-Morris-Pratt (KMP) :: 0,1,2,4,5,6,10,15,16,18,20,23,25,33,34
KIND Knuth-Morris-Pratt (KMP) :: update,update,update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Rabin-Karp Algorithm :: 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22
KIND Rabin-Karp Algorithm :: update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update,update
TOUR Boyer-Moore Algorithm :: 0,2,3,7,16,17,18
KIND Boyer-Moore Algorithm :: update,update,update,update,update,update,update
TOUR Kadane's Algorithm :: 0,1,2,3,5,7,8,9,10,11,13
KIND Kadane's Algorithm :: update,update,update,update,update,update,update,update,update,update,update
```

The route's decision was carried out where it bites. `mutationBreadth` uses `n / (n + 1)`
rather than a capped ratio precisely so that two step counts above any cap still differ; the
decision `rank` term exists because novelty and shift alone left one phase constant
(`Ternary Search | p2 1-2 decVar=true mutVar=false`) where both steps introduced a label and
both differed from their predecessor. That phase was the last residual and is the reason the
rank term is in the code.

## Criterion 3 — the phases with no varying signal, by name, left alone

16 found, the same 16 the route predicted. They are untouched: none of them has a varying
signal, so none of them can be discriminated by anything in the trace, and their scores are
still constant across the phase.

```
NO-SIGNAL PHASES:
Hamiltonian Cycle | p34 update 12-12 40-41
Hamiltonian Cycle | p51 update 12-12 66-67
Hamiltonian Cycle | p56 update 12-12 73-74
Hamiltonian Cycle | p76 update 12-12 108-109
Hamiltonian Cycle | p95 update 12-12 136-137
Hamiltonian Cycle | p97 update 12-12 139-140
Z-Algorithm | p3 update 6-6 2-3
Z-Algorithm | p8 update 6-6 8-13
Knuth-Morris-Pratt (KMP) | p10 update 15-15 17-19
Knuth-Morris-Pratt (KMP) | p12 update 22-22 22-23
Knuth-Morris-Pratt (KMP) | p13 update 15-15 24-32
Sliding Window Maximum | p4 update 5-5 3-5
Longest Palindromic Substring (Manacher's) | p16 update 5-5 20-21
Longest Palindromic Substring (Manacher's) | p40 update 5-5 55-56
Minimum Window Substring | p7 update 4-4 19-20
Matrix Chain Multiplication | p3 update 11-11 11-13
```

## Criterion 4 — `mostSignificantIndex` no longer returns 0 by tie

Base: 19 of 60 return 0. For each, `strictWin` asks whether index 0's score is strictly greater
than every other step's; `tiedAtMax` counts the other steps sharing index 0's score. **All 19
survived by tie — not one of them won.**

```
SIGZERO Depth First Search (DFS) score0=1 strictWin=false tiedAtMax=8
SIGZERO Breadth First Search (BFS) score0=1 strictWin=false tiedAtMax=7
SIGZERO Kosaraju's SCC score0=1 strictWin=false tiedAtMax=14
SIGZERO Tarjan's SCC score0=1 strictWin=false tiedAtMax=15
SIGZERO Eulerian Path/Circuit score0=1 strictWin=false tiedAtMax=7
SIGZERO Hamiltonian Cycle score0=1 strictWin=false tiedAtMax=10
SIGZERO Articulation Points score0=1 strictWin=false tiedAtMax=15
SIGZERO Bridges in Graph score0=1 strictWin=false tiedAtMax=15
SIGZERO Johnson's Algorithm score0=1 strictWin=false tiedAtMax=8
SIGZERO Sliding Window Maximum score0=1 strictWin=false tiedAtMax=4
SIGZERO Trie Insert & Search score0=1 strictWin=false tiedAtMax=9
SIGZERO Merge Intervals score0=1 strictWin=false tiedAtMax=4
SIGZERO Ternary Search score0=1 strictWin=false tiedAtMax=3
SIGZERO Longest Common Subsequence score0=1 strictWin=false tiedAtMax=6
SIGZERO Edit Distance score0=1 strictWin=false tiedAtMax=7
SIGZERO Binary Tree Inorder Traversal score0=1 strictWin=false tiedAtMax=2
SIGZERO Binary Tree Preorder Traversal score0=1 strictWin=false tiedAtMax=2
SIGZERO Binary Tree Postorder Traversal score0=1 strictWin=false tiedAtMax=2
SIGZERO Lowest Common Ancestor (LCA) score0=1 strictWin=false tiedAtMax=2
```

After: 7 of 60 return 0, and every one of them wins on score with no other step at the same
maximum.

```
SIGZERO Sliding Window Maximum score0=1.0833333333333333 strictWin=true tiedAtMax=0
SIGZERO Trie Insert & Search score0=1.0833333333333333 strictWin=true tiedAtMax=0
SIGZERO Merge Intervals score0=1.08 strictWin=true tiedAtMax=0
SIGZERO Edit Distance score0=1.075 strictWin=true tiedAtMax=0
SIGZERO Binary Tree Inorder Traversal score0=1.08 strictWin=true tiedAtMax=0
SIGZERO Binary Tree Postorder Traversal score0=1.08 strictWin=true tiedAtMax=0
SIGZERO Lowest Common Ancestor (LCA) score0=1.075 strictWin=true tiedAtMax=0
```

Gate met: none survives by tie. `significance.test.ts:90` fails on the base scorer.

## Criterion 5 — single-step phases untouched

`singleStepPhases=763 ... singleKeyEqStart=763` on the base and `singleStepPhases=763 ...
singleKeyEqStart=763` after. All 763 still have `keyIndex === startIndex`, which for a
one-step phase is the only possible answer. `significance.test.ts:77` asserts it structurally.

## Criterion 6 — `TracePhase.kind`: fixed, with the rule stated

**Fixed.** The rule: a phase's kind is `result` if **any** of its steps carries a `result-write`
event; otherwise it is the `phaseKind` that **most** of the phase's steps share, ties going to
the earliest such kind in the phase.

Why this rule and not another. `group[0]` was not a judgement at all — since R27 a group is a
run of one teaching label and the kind of whichever step happens to open that run carries no
information about the run. The majority is the weakest claim that is still a claim: it says
what the phase mostly does. I deliberately did not derive a kind from the label text, which is
the mapping the route warned against inventing.

What it changes, measured over the 60 algorithms at preset 0:

```
total=936 differing=4
firstStepRule=[["update",936]]
mostFrequentRule=[["update",932],["setup",4]]
```

4 of 936 phases change, and `setup` — which the route records as having been unreachable since
R27 — occurs again. The number is small and I am reporting it as small rather than dressing it
up. `renderOutlineForModel` is the only consumer, so this is a label the model reads, and 932
of the 936 still read `update` because that is genuinely what those phases do.

## Criterion 7 — no simulator file modified, no non-determinism

```
PS> git diff --name-only "614f163..HEAD" | Select-String -Pattern 'src/services/(simulators|extended|compound)'
PS>
```

Nothing printed. The change is in `significance.ts` and `traceOutline.ts` only; no field was
added to `RawTraceStep` and `simulationTrace.ts` was not touched. No `Math.random`, no
`Date`, no wall-clock branching entered the trace path — the new terms read `step.mutated`,
`step.scopes.decision`, and the position of a step in the trace, all of which are functions of
the trace itself.

## Criterion 8 — gates

`npm run lint` — exit 0

```
> codexray@2.3.4 lint
> oxlint

```

`npm run test` — exit 0. Base: **909**. After: **917** (+8, the eight tests in
`significance.test.ts`).

```
 Test Files  121 passed (121)
      Tests  917 passed (917)
   Start at  23:56:44
   Duration  22.56s (transform 10.76s, setup 28.52s, import 20.92s, tests 47.81s, environment 175.84s)
```

`npm run build` — exit 0. Initial JavaScript unchanged at **422.6 KiB** against the 425.0 KiB
budget; the 2.4 KiB of headroom the route protects were not spent.

```
dist/assets/index-DaYNMLSp.js                        432.69 kB │ gzip: 133.42 kB

✓ built in 1.50s
Initial JavaScript: 422.6 / 425.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
```

`npm run test:e2e` — exit 0, run through the external-server procedure at the default 2 workers.
Two summary lines, 83 + 2 = 85 (84 before this turn, plus the new spec).

```
  ok 83 [chromium] › e2e\web-problem-routing.spec.ts:3:1 › a fetched page cannot select the intent of a bound web solve (1.9s)

  83 passed (3.3m)

Running 2 tests using 1 worker

TIMELINE_MEASUREMENTS {"playwright":{"min":923.8580000000002,"median":1477.2906500000026,"max":1533.1861},"inPage":{"min":165.9000000357628,"median":202.5,"max":281.2999999523163},"handler":{"min":0.6999999284744263,"median":1.5,"max":1.9000000953674316},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1549.6317,"catalogMs":276.3218999999999,"simulationMs":74.6894000000002,"dpMs":3186.081299999998}
  ok 1 [chromium] › e2e\performance-budget.spec.ts:23:1 › keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets @performance (35.2s)
  ok 2 [chromium] › e2e\performance-budget.spec.ts:123:1 › survives repeated cross-subsystem use without stale state, overflow, or locked controls @performance (12.9s)

  2 passed (49.5s)
```

`npm run desktop:check` was not run: `src-tauri/**` did not change.

## Criterion 9 — the guided tour, in the product

The consumer is `structuralCheckpointIndices` (`src/services/aiTimelineControl.ts:31`), reached
from `src/services/aiTimelineControl.ts:103` when the user asks to be walked through the
algorithm, and from `src/services/titanModeRouting.ts:276`.

The DFS tour, measured through `structuralCheckpointIndices` itself (1-based, as the buttons
render):

```
before: 1,2,4,7,11,14,23,24
after:  1,2,5,9,13,14,23,24
```

Three stops the tour never reached before — steps 5, 9 and 13 — and three it no longer reaches:
4, 7 and 11. `e2e/checkpoint-phases.spec.ts:50` asserts exactly this in the running product, by
typing "walk me through the algorithm" into the assistant and reading the rendered tour buttons;
`e2e/checkpoint-phases.spec.ts:31` pins the whole new list.

16 of the 60 algorithms' tours change. Full list, `-` base and `+` after, 0-based indices as
`structuralCheckpointIndices` returns them:

```
- Depth First Search (DFS) :: 0,1,3,6,10,13,22,23
+ Depth First Search (DFS) :: 0,1,4,8,12,13,22,23
- Breadth First Search (BFS) :: 0,1,2,7,9,12,15,16
+ Breadth First Search (BFS) :: 0,1,2,4,8,11,15,16
- Bellman-Ford Algorithm :: 0,1,2,4,7,12,15,16
+ Bellman-Ford Algorithm :: 0,1,2,4,7,11,15,16
- Kosaraju's SCC :: 0,1,16,21,23,27,30,31
+ Kosaraju's SCC :: 0,1,14,17,22,26,30,31
- Tarjan's SCC :: 0,1,5,10,14,20,27,28
+ Tarjan's SCC :: 0,1,6,12,18,26,27,28
- Articulation Points :: 0,1,7,14,20,27,33,34
+ Articulation Points :: 0,1,9,16,17,26,33,34
- Bridges in Graph :: 0,1,7,14,20,27,33,34
+ Bridges in Graph :: 0,1,9,16,17,26,33,34
- Johnson's Algorithm :: 0,1,3,13,18,25,27,28
+ Johnson's Algorithm :: 0,1,3,8,17,22,27,28
- Z-Algorithm :: 0,1,2,6,16,20,24,25
+ Z-Algorithm :: 0,1,4,6,16,20,24,25
- Knuth-Morris-Pratt (KMP) :: 0,1,2,5,15,23,33,34
+ Knuth-Morris-Pratt (KMP) :: 0,1,5,10,15,23,33,34
- Moore's Voting Algorithm :: 0,1,2,3,5,6,13,14
+ Moore's Voting Algorithm :: 0,1,2,5,6,9,13,14
- Minimum Window Substring :: 0,1,2,8,20,24,26,27
+ Minimum Window Substring :: 0,1,8,13,20,24,26,27
- Merge Sort :: 0,1,2,9,20,27,38,39
+ Merge Sort :: 0,1,2,6,9,20,27,39
- Insertion Sort :: 0,1,2,6,13,19,24,25
+ Insertion Sort :: 0,1,3,6,13,19,24,25
- Selection Sort :: 0,1,2,6,12,16,18,19
+ Selection Sort :: 0,1,6,9,12,16,18,19
- Binary Tree Preorder Traversal :: 0,1,11,22,35,46,59,60
+ Binary Tree Preorder Traversal :: 0,1,2,13,28,43,59,60
```

## Diff scope

```
 .../R31-a-key-step-that-is-just-the-first-step.md  | 207 +++++++++++++++++++++
 e2e/checkpoint-phases.spec.ts                      |  11 +-
 src/services/trace/significance.test.ts            | 122 ++++++++++++
 src/services/trace/significance.ts                 |  50 ++++-
 src/services/trace/traceOutline.ts                 |  22 ++-
 5 files changed, 407 insertions(+), 5 deletions(-)
```

## Deviations

| file | why |
|---|---|
| `src/services/trace/significance.test.ts` | The route forecast `significance.test.ts`; it did not exist, so this is an add rather than an edit. Criteria 2, 4, 5 and 6. |
| `e2e/checkpoint-phases.spec.ts` | Not in `## Expected Files`. Criterion 9 requires a user-visible demonstration, and this spec is the only one that renders the guided tour; its two pinned DFS lists are exactly what criterion 9 changes, so leaving it alone was not an option — it would have failed. |
| `src/services/trace/types.ts` (forecast, not written) | The route allowed one field on `RawTraceStep` for `decision`. Not needed: `publicScopes` already carries `decision` into `step.scopes`. |
| `src/services/trace/simulationTrace.ts` (forecast, not written) | Same reason. |

## Discovered

- **`decision` was already on the raw step.** The route said to check before assuming it could
  be read there. It can: `publicScopes` filters only `_trace*`, `_callDepth` and `_mutated`, so
  every `visualData.vars` key including `decision` and `phase` reaches `step.scopes`. The
  one-field move R27 made for `phase` was not needed again.
- **`keyEqStart` is a poor gauge of this change and moved almost not at all**: 882 before, 882
  after; `multiKeyEqStart` is 119 in both. Only 4 phases changed their `keyIndex`. The new terms
  are tie-breakers, and where a phase was tied the first step still usually wins the tie-break —
  first steps tend to mutate more variables and to introduce them. This is the route's own
  instruction ("do not make the first step ineligible") showing up in the numbers. The scorer is
  now *capable* of discriminating, which is what criterion 2 measures; it does not follow that it
  *chooses differently* often, and I am not claiming it does.
- **The guided tour nevertheless changed for 16 of 60**, and almost all of that comes from
  `mostSignificantIndex`, not from `keyIndex`: `structuralCheckpointIndices` seeds its set with
  the single most significant step, and that was index 0 for 19 algorithms by tie.
- **`eventWeight` is still dead.** No simulator emits a trace `event`, so on the 60 supported
  algorithms `eventWeight` returned 0 for every step before this route and still does. The new
  terms did not make it dead; they did not resurrect it either. Not deleted here, as instructed.
- Two probes were written to the repository root, run, and deleted; the tree is clean.

## Untouched

```
PS> git diff --name-only "614f163..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$'
PS>
```

Nothing printed.

```
PS> git status --porcelain | Select-String -Pattern 'test-results|dist/|coverage/|probe'
PS>
```

Nothing printed.

## Blockers

None.

## For the human

None.
