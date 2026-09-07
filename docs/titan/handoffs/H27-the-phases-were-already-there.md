# H27 — the phases were already there

## Turn

- route: `docs/titan/routes/R27-the-phases-were-already-there.md`
- base SHA: `fc3a8fa`
- end SHA: `efbeff7eb0b5ff2e0774385a508516b8cd9d4186`
- status: `closed`
- next holder: Claude (T0)

## Özet

`vars.phase` artık adaptörden geçiyor ve outline bu etikete göre gruplanıyor; 60 desteklenen
algoritmanın 54'ünde tek fazlı olan outline sıfıra indi, `evenlySample` dolgusundan gelen
kontrol noktası toplamı 250'den 129'a düştü. Hiçbir simülatör dosyasına dokunulmadı.

`mostSignificantIndex` hâlâ 19 algoritmada 0 dönüyor — bu tur onu değiştirmedi, Option B
kendi rotasını bekliyor.

## What changed

| path:line-range | intent | action |
|---|---|---|
| `src/services/trace/types.ts:38` | optional `phase` on `RawTraceStep` | edited |
| `src/services/trace/simulationTrace.ts:34,44` | read `vars.phase` and carry it onto the raw step | edited |
| `src/services/trace/traceOutline.ts:23-38` | `groupKey` starts a new outline group when the phase label changes; kind grouping is the fallback | edited |
| `src/services/trace/traceIntelligence.test.ts:1-6,55-121` | four tests: carry, phase grouping, no-phase fallback, determinism + `resolvePhaseId` | edited |
| `src/services/aiTimelineControl.test.ts:3-11,92-121` | two tests: checkpoints drawn from a multi-phase outline, repeated-run determinism | edited |
| `e2e/checkpoint-phases.spec.ts:1-56` | three specs: tour stops after, tour stops before (module intercept), next-checkpoint walk | added |

## Commits

```
efbeff7eb0b5ff2e0774385a508516b8cd9d4186 route(R27): close
```

No corrective commit was needed.

## The change, exactly

`src/services/trace/simulationTrace.ts:34`

```ts
const phase = typeof vars.phase === 'string' && vars.phase.length ? vars.phase : undefined;
```

`src/services/trace/traceOutline.ts:23-26`

```ts
const groupKey = (step: RawTrace['steps'][number]): string => {
  if (typeof step.phase === 'string') return `phase:${step.phase}`;
  return `kind:${step.event?.t === 'result-write' ? 'result' : phaseKind(step.kind)}`;
};
```

`kind`, `label`, `keyIndex`, `score`, and `resolvePhaseId` are untouched; only the grouping
boundary moved.

## Before / after, all 60 supported algorithms

The probe was a throwaway root-level vitest file run twice — once with the working tree at
`fc3a8fa`, once at `efbeff7` — writing with `appendFileSync`. Each algorithm ran through the
real `await generateSimulationSteps(entry.name, entry.code,
createInputPreset(getInputKindForAlgorithm(entry.name), 0, entry.name))`. The probe file was
deleted after the second run; it appears in no commit.

`fromEvenly` counts only the **filler** sample — the second `evenlySample` call in
`aiTimelineControl.ts:46`, which draws from step indices that the outline did not offer. The
first `evenlySample` call samples the outline's own key indices and is therefore counted as
outline-derived, not as filler.

| algorithm | steps | distinct phases | outline before | outline after | sig | fromEvenly before | fromEvenly after | checkpoints before | checkpoints after |
|---|---|---|---|---|---|---|---|---|---|
| Depth First Search (DFS) | 24 | 4 | 1 | 17 | 0 | 6 | 2 | `[0,1,5,9,14,18,22,23]` | `[0,1,3,6,10,13,22,23]` |
| Breadth First Search (BFS) | 17 | 4 | 1 | 13 | 0 | 6 | 2 | `[0,1,4,7,9,12,15,16]` | `[0,1,2,7,9,12,15,16]` |
| Dijkstra's Shortest Path | 17 | 4 | 1 | 13 | 3 | 5 | 2 | `[0,1,3,5,9,12,15,16]` | `[0,1,3,4,9,13,15,16]` |
| A* Search Algorithm | 17 | 4 | 1 | 13 | 3 | 5 | 2 | `[0,1,3,5,9,12,15,16]` | `[0,1,3,4,9,13,15,16]` |
| Kruskal's MST | 7 | 3 | 1 | 3 | 1 | 0 | 0 | `[0,1,2,3,4,5,6]` | `[0,1,2,3,4,5,6]` |
| Prim's MST | 12 | 4 | 1 | 12 | 2 | 5 | 2 | `[0,1,2,4,6,8,10,11]` | `[0,1,2,3,6,8,10,11]` |
| Bellman-Ford Algorithm | 17 | 6 | 1 | 10 | 1 | 5 | 2 | `[0,1,2,5,9,12,15,16]` | `[0,1,2,4,7,12,15,16]` |
| Floyd-Warshall Algorithm | 15 | 4 | 1 | 11 | 2 | 5 | 2 | `[0,1,2,5,8,10,13,14]` | `[0,1,2,3,5,10,13,14]` |
| Topological Sort | 16 | 4 | 1 | 15 | 4 | 5 | 2 | `[0,1,4,5,8,11,14,15]` | `[0,1,4,5,8,12,14,15]` |
| Kosaraju's SCC | 32 | 7 | 3 | 13 | 0 | 4 | 2 | `[0,1,2,8,12,21,30,31]` | `[0,1,16,21,23,27,30,31]` |
| Tarjan's SCC | 29 | 6 | 1 | 25 | 0 | 6 | 2 | `[0,1,6,11,17,22,27,28]` | `[0,1,5,10,14,20,27,28]` |
| Edmonds-Karp Max Flow | 22 | 5 | 1 | 10 | 6 | 5 | 3 | `[0,1,6,7,11,16,20,21]` | `[0,1,6,10,12,17,20,21]` |
| Dinic's Max Flow | 8 | 4 | 1 | 7 | 2 | 0 | 0 | `[0,1,2,3,4,5,6,7]` | `[0,1,2,3,4,5,6,7]` |
| Bipartite Matching (Hopcroft-Karp) | 11 | 5 | 1 | 9 | 3 | 5 | 3 | `[0,1,3,4,6,7,9,10]` | `[0,1,3,5,6,8,9,10]` |
| Graph Coloring | 14 | 5 | 1 | 12 | 6 | 5 | 2 | `[0,1,4,6,7,10,12,13]` | `[0,1,3,6,7,9,12,13]` |
| Eulerian Path/Circuit | 15 | 4 | 1 | 4 | 0 | 6 | 4 | `[0,1,3,6,8,11,13,14]` | `[0,1,2,5,7,10,13,14]` |
| Hamiltonian Cycle | 144 | 5 | 1 | 100 | 0 | 6 | 2 | `[0,1,29,57,86,114,142,143]` | `[0,1,23,54,86,113,142,143]` |
| Articulation Points | 35 | 6 | 1 | 35 | 0 | 6 | 2 | `[0,1,7,14,20,27,33,34]` | `[0,1,7,14,20,27,33,34]` |
| Bridges in Graph | 35 | 6 | 1 | 35 | 0 | 6 | 2 | `[0,1,7,14,20,27,33,34]` | `[0,1,7,14,20,27,33,34]` |
| Johnson's Algorithm | 29 | 6 | 1 | 16 | 0 | 6 | 2 | `[0,1,6,11,17,22,27,28]` | `[0,1,3,13,18,25,27,28]` |
| Z-Algorithm | 26 | 6 | 1 | 20 | 2 | 5 | 2 | `[0,1,2,8,13,19,24,25]` | `[0,1,2,6,16,20,24,25]` |
| Knuth-Morris-Pratt (KMP) | 35 | 9 | 1 | 15 | 2 | 5 | 2 | `[0,1,2,10,18,25,33,34]` | `[0,1,2,5,15,23,33,34]` |
| Rabin-Karp Algorithm | 23 | 6 | 1 | 23 | 3 | 5 | 2 | `[0,1,3,7,12,16,21,22]` | `[0,1,3,6,11,17,21,22]` |
| Boyer-Moore Algorithm | 19 | 5 | 1 | 7 | 2 | 5 | 2 | `[0,1,2,6,10,13,17,18]` | `[0,1,2,3,7,16,17,18]` |
| Kadane's Algorithm | 14 | 4 | 1 | 11 | 1 | 5 | 2 | `[0,1,2,5,7,10,12,13]` | `[0,1,2,3,7,10,12,13]` |
| Sliding Window Maximum | 17 | 5 | 1 | 12 | 0 | 6 | 2 | `[0,1,4,7,9,12,15,16]` | `[0,1,2,6,12,14,15,16]` |
| Longest Palindromic Substring (Manacher's) | 67 | 5 | 1 | 47 | 1 | 5 | 2 | `[0,1,2,18,34,49,65,66]` | `[0,1,2,16,39,51,65,66]` |
| Trie Insert & Search | 36 | 5 | 1 | 13 | 0 | 6 | 2 | `[0,1,8,14,21,27,34,35]` | `[0,1,5,12,19,29,34,35]` |
| Two Pointers Technique | 5 | 3 | 1 | 3 | 3 | 0 | 0 | `[0,1,2,3,4]` | `[0,1,2,3,4]` |
| Prefix Sum Array | 8 | 4 | 1 | 4 | 2 | 0 | 0 | `[0,1,2,3,4,5,6,7]` | `[0,1,2,3,4,5,6,7]` |
| Dutch National Flag | 8 | 3 | 1 | 3 | 2 | 0 | 0 | `[0,1,2,3,4,5,6,7]` | `[0,1,2,3,4,5,6,7]` |
| Moore's Voting Algorithm | 15 | 5 | 3 | 8 | 1 | 3 | 2 | `[0,1,2,7,9,12,13,14]` | `[0,1,2,3,5,6,13,14]` |
| Minimum Window Substring | 28 | 5 | 1 | 13 | 2 | 5 | 2 | `[0,1,2,8,14,20,26,27]` | `[0,1,2,8,20,24,26,27]` |
| Trapping Rain Water | 14 | 3 | 3 | 3 | 2 | 4 | 5 | `[0,1,2,5,8,11,12,13]` | `[0,1,2,5,7,10,12,13]` |
| Merge Intervals | 6 | 4 | 1 | 5 | 0 | 0 | 0 | `[0,1,2,3,4,5]` | `[0,1,2,3,4,5]` |
| Quick Sort | 37 | 6 | 1 | 31 | 1 | 5 | 2 | `[0,1,2,10,19,27,35,36]` | `[0,1,2,11,20,28,35,36]` |
| Merge Sort | 40 | 7 | 1 | 26 | 1 | 5 | 2 | `[0,1,2,11,20,29,38,39]` | `[0,1,2,9,20,27,38,39]` |
| Binary Search | 5 | 3 | 1 | 3 | 2 | 0 | 0 | `[0,1,2,3,4]` | `[0,1,2,3,4]` |
| Heap Sort | 25 | 5 | 1 | 23 | 1 | 5 | 2 | `[0,1,2,7,13,18,23,24]` | `[0,1,2,8,13,19,23,24]` |
| Radix Sort | 29 | 4 | 1 | 8 | 2 | 5 | 2 | `[0,1,2,8,15,21,27,28]` | `[0,1,2,9,18,20,27,28]` |
| Counting Sort | 22 | 4 | 5 | 4 | 14 | 2 | 4 | `[0,1,2,7,8,14,20,21]` | `[0,1,7,8,13,14,20,21]` |
| Bubble Sort | 15 | 4 | 1 | 11 | 1 | 5 | 2 | `[0,1,2,5,8,10,13,14]` | `[0,1,2,3,5,10,13,14]` |
| Insertion Sort | 26 | 6 | 1 | 26 | 2 | 5 | 2 | `[0,1,2,8,13,19,24,25]` | `[0,1,2,6,13,19,24,25]` |
| Selection Sort | 20 | 5 | 1 | 14 | 2 | 5 | 2 | `[0,1,2,6,10,14,18,19]` | `[0,1,2,6,12,16,18,19]` |
| Ternary Search | 4 | 3 | 1 | 3 | 0 | 0 | 0 | `[0,1,2,3]` | `[0,1,2,3]` |
| 0/1 Knapsack | 34 | 3 | 1 | 3 | 2 | 5 | 5 | `[0,1,2,10,17,25,32,33]` | `[0,1,2,10,17,25,32,33]` |
| Longest Common Subsequence | 52 | 4 | 7 | 4 | 0 | 1 | 4 | `[0,1,45,46,48,49,50,51]` | `[0,1,2,18,33,43,50,51]` |
| Longest Increasing Subsequence | 34 | 4 | 1 | 4 | 3 | 5 | 4 | `[0,1,3,10,17,25,32,33]` | `[0,1,3,12,21,31,32,33]` |
| Matrix Chain Multiplication | 15 | 4 | 1 | 4 | 2 | 5 | 4 | `[0,1,2,5,8,10,13,14]` | `[0,1,2,5,9,12,13,14]` |
| Edit Distance | 51 | 4 | 27 | 4 | 0 | 2 | 4 | `[0,1,14,19,26,35,49,50]` | `[0,1,2,17,33,43,49,50]` |
| Coin Change | 30 | 3 | 1 | 3 | 2 | 5 | 5 | `[0,1,2,9,15,22,28,29]` | `[0,1,2,9,15,22,28,29]` |
| Unique Paths | 14 | 3 | 1 | 3 | 2 | 5 | 5 | `[0,1,2,5,7,10,12,13]` | `[0,1,2,5,7,10,12,13]` |
| Binary Tree Inorder Traversal | 61 | 7 | 1 | 54 | 0 | 6 | 2 | `[0,1,13,24,36,47,59,60]` | `[0,1,11,22,35,46,59,60]` |
| Binary Tree Preorder Traversal | 61 | 7 | 1 | 54 | 0 | 6 | 2 | `[0,1,13,24,36,47,59,60]` | `[0,1,11,22,35,46,59,60]` |
| Binary Tree Postorder Traversal | 61 | 7 | 1 | 61 | 0 | 6 | 2 | `[0,1,13,24,36,47,59,60]` | `[0,1,12,24,36,48,59,60]` |
| Lowest Common Ancestor (LCA) | 21 | 5 | 1 | 5 | 0 | 6 | 3 | `[0,1,5,8,12,15,19,20]` | `[0,1,2,10,16,18,19,20]` |
| Sieve of Eratosthenes | 24 | 4 | 1 | 8 | 2 | 5 | 3 | `[0,1,2,7,12,17,22,23]` | `[0,1,2,11,17,21,22,23]` |
| Fast Exponentiation (Modular) | 6 | 3 | 1 | 3 | 2 | 0 | 0 | `[0,1,2,3,4,5]` | `[0,1,2,3,4,5]` |
| Reverse Linked List | 12 | 4 | 1 | 12 | 3 | 5 | 3 | `[0,1,3,4,6,8,10,11]` | `[0,1,3,5,6,8,10,11]` |
| Detect Cycle in Linked List | 7 | 5 | 1 | 5 | 1 | 0 | 0 | `[0,1,2,3,4,5,6]` | `[0,1,2,3,4,5,6]` |

BEFORE TOTAL supported=60 singlePhaseOutlines=54 sigZero=19 sigNull=0 distinctSum=282 outlinePhaseSum=102 fromEvenlySum=250 phaseCountMismatches=59 outlineKinds=setup,update
AFTER  TOTAL supported=60 singlePhaseOutlines=0 sigZero=19 sigNull=0 distinctSum=282 outlinePhaseSum=936 fromEvenlySum=129 phaseCountMismatches=41 outlineKinds=update

### Criterion 1 — single-phase outlines

`singlePhaseOutlines`: **54 before, 0 after**. Every one of the 60 carries more than one
distinct `vars.phase` (the minimum is 3), and every one of the 60 now produces more than one
outline phase. No algorithm has exactly one distinct label, so there is no case where a
single-phase outline would still be correct.

### Criterion 2 — phase count against `distinctSum=282`

`distinctSum` is unchanged at 282 (the probe reads the same simulator output before and
after). `outlinePhaseSum` went 102 to 936. **19 of 60 match their distinct-label count
exactly**; 41 exceed it. None is below it — the probe checked this directly and found zero
cases of `outlinePhases < distinctPhases`.

The 19 exact matches: Kruskal's MST, Eulerian Path/Circuit, Two Pointers Technique, Prefix
Sum Array, Dutch National Flag, Trapping Rain Water, Binary Search, Counting Sort, Ternary
Search, 0/1 Knapsack, Longest Common Subsequence, Longest Increasing Subsequence, Matrix
Chain Multiplication, Edit Distance, Coin Change, Unique Paths, Lowest Common Ancestor (LCA),
Fast Exponentiation (Modular), Detect Cycle in Linked List.

**The explanation for the other 41 is structural, not a defect.** The route's decision was
"start a new group when the phase label changes", which groups **consecutive runs**. A
simulator that alternates between labels — DFS writing `descend`, `inspect edge`, `descend`,
`inspect edge` and so on — produces one group per run, not one per label. So the outline count
equals the number of label *runs*, and it equals the distinct count only for simulators whose
phases are monotone (setup, then a loop body, then a result). The 41 are exactly the
non-monotone ones. Worst cases: Hamiltonian Cycle 5 labels / 100 runs over 144 steps,
Binary Tree Postorder Traversal 7 / 61 over 61 steps (every step changes phase), Articulation
Points and Bridges in Graph 6 / 35 over 35 steps.

Contiguous grouping is required, not preferred: `TracePhase` carries `startIndex`/`endIndex`
and the guided tour walks them in order, so a non-contiguous grouping keyed on the label alone
would emit overlapping phases and break checkpoint ordering. That is why the route's own
wording was taken literally.

### Criterion 4 — checkpoints from the `evenlySample` filler

`fromEvenlySum`: **250 before, 129 after**, across the same 480 checkpoint slots (60 x 8).
Per-algorithm counts are in the table above. 50 algorithms were majority-filler at base (6, 5
or 4 of 8); after the change no algorithm draws more than 5 from the filler and 35 of 60 draw
2 or fewer.

The residue is not the grouping. `structuralCheckpointIndices` seeds `{0, last, significant}`
first; when `mostSignificantIndex` returns an index already in that set — 19 algorithms return
`0` — and when the outline's sampled key indices collide with what is already selected, the set
stays under 8 and the filler tops it up. Removing the rest of the filler needs Option B, not
more outline phases.

## Acceptance

Criteria copied verbatim from `docs/titan/routes/R27-the-phases-were-already-there.md`.

1. **`buildTraceOutline` returns more than one phase for the algorithms whose steps carry more
   than one distinct `vars.phase`. Measured across all 60 supported algorithms, with the count
   of single-phase outlines before and after.** — **met**. Before/after table above;
   `singlePhaseOutlines=54` becomes `singlePhaseOutlines=0`.
   Unit pointer: `src/services/trace/traceIntelligence.test.ts:76` "starts a new outline phase
   when the phase label changes". Production site: `src/services/trace/traceOutline.ts:23`.

2. **For each of the 60, the number of phases equals the number of distinct phase labels in its
   steps, or the handoff names the algorithm and explains the difference. `distinctSum=282` is
   the total to compare against.** — **met**. 19 named as exact matches; the 41 that differ are
   named in the table with both numbers, and the reason (label runs, not label identity) is
   given above. `distinctSum` is 282 before and after.

3. **A trace whose steps carry no phase label still produces today's kind-grouped outline.
   Assert it — the SimLang/model-authored path has no `vars.phase`.** — **met**.
   `src/services/trace/traceIntelligence.test.ts:87` "falls back to kind grouping when no step
   carries a phase label" recomputes the kind-run boundaries from the trace itself and compares
   them to `buildTraceOutline`'s output, after asserting every step's `phase` is `undefined`.
   The model-authored path is unaffected in production: `e2e/model-authored-titan-mode.spec.ts`
   and `e2e/array-template-source-preview.spec.ts` still pass.

4. **`structuralCheckpointIndices` draws more of its eight indices from the outline and fewer
   from `evenlySample`. Report the per-algorithm `fromEvenly` count before and after; 50
   algorithms were majority-filler at base.** — **met**. `fromEvenlySum` 250 to 129,
   per-algorithm in the table. Unit pointer: `src/services/aiTimelineControl.test.ts:101`
   "draws checkpoints from a multi-phase outline instead of a single filled phase".

5. **Phase ids stay resolvable: `resolvePhaseId` still maps an id to an index, and no code path
   lets a model supply an index.** — **met**. `resolvePhaseId` is unchanged
   (`src/services/trace/traceOutline.ts:57-65`) and asserted over every phase of a real outline
   plus a miss at `src/services/trace/traceIntelligence.test.ts:110`. The turn added no new
   parser and no new model-reachable field: `phase` is written only by
   `simulationStepsToRawTrace` from deterministic simulator output, and verification command 6
   (`vars\.phase|\.phase =`) shows the only non-test writer is
   `src/services/trace/simulationTrace.ts:34`.

6. **The user-visible effect is shown, not inferred: an e2e that walks next-checkpoint or the
   guided tour and demonstrates the stops changed. A unit test does not close this.** — **met**.
   `e2e/checkpoint-phases.spec.ts` proves the change in the browser, both directions, on the
   same page:
   - `:31` "the guided tour stops on the phases the simulator writes" — DFS tour buttons are
     `1, 2, 4, 7, 11, 14, 23, 24`.
   - `:36` "the same tour was evenly spaced filler before the phase label was carried" — the
     spec intercepts `/src/services/trace/simulationTrace.ts` and rewrites the phase capture to
     `const phase = undefined;`, restoring base behaviour, and the same tour becomes
     `1, 2, 6, 10, 15, 19, 23, 24` — exactly the base probe's DFS row `[0,1,5,9,14,18,22,23]`.
   - `:50` "walking next-checkpoint lands on a phase boundary rather than a sampled index".

   Production call sites: `src/services/aiTimelineControl.ts:103` (tour),
   `src/services/aiTimelineControl.ts:201` (next-checkpoint),
   `src/components/AiAssistant.tsx:397` (renders the stops).

7. **Determinism: the same algorithm and preset produce identical outlines across runs. Assert
   it.** — **met**. `src/services/aiTimelineControl.test.ts:112` "produces identical checkpoints
   for repeated runs of the same preset" runs Kosaraju's SCC twice from its preset and compares
   both the checkpoints and the whole outline;
   `src/services/trace/traceIntelligence.test.ts:104` does the same over `structuredClone`d
   steps. Verification command 7 shows no `Math.random` in any file this turn touched.

8. **No simulator file is modified. `git diff --name-only fc3a8fa..HEAD` proves it.** — **met**.
   `git diff --name-only "fc3a8fa..HEAD" | Select-String -Pattern 'imulator'` printed nothing.

9. **(T0) The handoff states whether `mostSignificantIndex` still returns 0 for 19 algorithms
   after this turn. It is expected to; say so plainly rather than letting criterion 1 imply
   otherwise.** — **met, and the answer is yes.** `sigZero=19` before and `sigZero=19` after;
   `sigNull=0` both times. The same 19 algorithms return index 0, which is already in the seeded
   set, so `mostSignificantIndex` still contributes literally nothing on those runs. `scoreTrace`
   was not touched and remains phase-blind: `eventWeight` is 0 for every step because no
   simulator emits an event, `kindWeight` is 1 for the mutate steps and 0 elsewhere, and ties
   still resolve to the first maximum. Criterion 1 improved the outline; it did not improve
   significance, and nothing in this turn should be read as having done so.

10. **`npm run lint`, `npm run test:coverage`, `npm run build` pass. `desktop:check` if
    `src-tauri/**` changed.** — **met**. Output below. `src-tauri/**` did not change, so
    `desktop:check` was not run.

11. **e2e passes.** — **met**. `80 passed` plus `2 passed` (@performance). Output below.

12. **No frozen or T0-owned path written.** — **met**. See `## Untouched`.

13. **Every commit DCO-signed as `Mustafa Özel <iyott131@gmail.com>`.** — **met**.
    `git config user.email` returned `iyott131@gmail.com`; the close commit carries
    `Signed-off-by: Mustafa Özel <iyott131@gmail.com>`.

## Gate output

### `git log -1 --format=%H`

```
efbeff7eb0b5ff2e0774385a508516b8cd9d4186
```

### `git config user.email`

```
iyott131@gmail.com
```

### `git diff --name-only "fc3a8fa..HEAD"`

```
docs/titan/routes/R27-the-phases-were-already-there.md
e2e/checkpoint-phases.spec.ts
src/services/aiTimelineControl.test.ts
src/services/trace/simulationTrace.ts
src/services/trace/traceIntelligence.test.ts
src/services/trace/traceOutline.ts
src/services/trace/types.ts
```

### `git diff --name-only "fc3a8fa..HEAD" | Select-String -Pattern 'imulator'`

```
```

Empty. That is criterion 8.

### `npm run lint`

```
> codexray@2.3.4 lint
> oxlint
```

exit 0.

### `npm run test:coverage`

```
 Test Files  120 passed (120)
      Tests  901 passed (901)
   Start at  21:22:51
   Duration  24.73s (transform 7.55s, setup 27.77s, import 20.82s, tests 59.91s, environment 163.24s)
```

```
=============================== Coverage summary ===============================
Statements   : 82.24% ( 11110/13508 )
Branches     : 72.02% ( 7913/10986 )
Functions    : 82.66% ( 2132/2579 )
Lines        : 84.78% ( 9618/11344 )
================================================================================
```

Trace-layer rows:

```
 ...services/trace |   85.97 |     74.2 |    91.3 |   90.98 |
  significance.ts  |      74 |    61.22 |     100 |   80.48 | 6-15
  ...ationTrace.ts |   96.55 |    78.57 |   88.88 |   96.15 | 61
  traceOutline.ts  |      92 |    83.72 |     100 |     100 | ...44-47,57-58,69
```

exit 0.

**Test counts, before and after the turn.** Base (`git stash push -- src e2e`, then
`npm run test`, then `git stash pop`):

```
 Test Files  120 passed (120)
      Tests  895 passed (895)
```

After: `901 passed`. Delta **+6** — four in `traceIntelligence.test.ts`, two in
`aiTimelineControl.test.ts`. No file-count change; both files already existed.

### `npm run build`

```
✓ built in 436ms
Initial JavaScript: 418.3 / 420.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
```

exit 0.

### `npm run test:e2e`

```
Running 80 tests using 8 workers
  ok 10 [chromium] › e2e\checkpoint-phases.spec.ts:31:1 › the guided tour stops on the phases the simulator writes (4.0s)
  ok 11 [chromium] › e2e\checkpoint-phases.spec.ts:36:1 › the same tour was evenly spaced filler before the phase label was carried (4.0s)
  ok 12 [chromium] › e2e\checkpoint-phases.spec.ts:50:1 › walking next-checkpoint lands on a phase boundary rather than a sampled index (4.2s)

  80 passed (1.2m)

Running 2 tests using 1 worker
TIMELINE_MEASUREMENTS {"playwright":{"min":845.4764000000014,"median":884.8099499999994,"max":944.9224000000004},"inPage":{"min":165.4000000357628,"median":165.90000000596046,"max":167.30000001192093},"handler":{"min":0.6000000238418579,"median":0.7499999701976776,"max":1.0999999642372131},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1840.1482,"catalogMs":260.8762999999999,"simulationMs":76.30439999999999,"dpMs":2472.9329}
  ok 1 [chromium] › e2e\performance-budget.spec.ts:23:1 › keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets @performance (25.2s)
  ok 2 [chromium] › e2e\performance-budget.spec.ts:123:1 › survives repeated cross-subsystem use without stale state, overflow, or locked controls @performance (8.7s)

  2 passed (35.0s)
```

exit 0.

### `Math.random` grep

Nine matches, all pre-existing, none in a file this turn touched:

```
src\components\AiAssistant.tsx:1181
src\components\AiAssistant.tsx:1184
src\services\trace\interpreter.ts:163
src\services\trace\jsTracer.test.ts:114
src\services\algorithmCatalog.ts:90
src\services\titanEngine.ts:105
src\services\titanEntry.ts:67
src\services\webProblemOrchestrator.ts:196
```

`interpreter.ts:163` is the seeded shim (`native('Math.random', () => this.nextRandom())`),
not a call.

## Diff scope

`git diff --stat "fc3a8fa..HEAD"`:

```
 .../routes/R27-the-phases-were-already-there.md    | 248 +++++++++++++++++++++
 e2e/checkpoint-phases.spec.ts                      |  56 +++++
 src/services/aiTimelineControl.test.ts             |  33 +++
 src/services/trace/simulationTrace.ts              |   2 +
 src/services/trace/traceIntelligence.test.ts       |  67 ++++++
 src/services/trace/traceOutline.ts                 |  13 +-
 src/services/trace/types.ts                        |   1 +
 7 files changed, 415 insertions(+), 5 deletions(-)
```

The route file is T0's own `route(R27): open` commit, inside the `base..HEAD` range and not
written by this turn.

## Deviations

1. **`e2e/checkpoint-phases.spec.ts` is outside `## Expected Files`.** The forecast listed only
   the three source files, their tests, and `aiTimelineControl.test.ts`. Criterion 6 explicitly
   forbids closing on a unit test, so an e2e file was required; the file is inside Sole's
   ownership (`e2e/**`).

2. **`aiTimelineControl.ts` was *not* edited, though the forecast implied its test would need it
   to be.** Nothing in `structuralCheckpointIndices` had to change — it already read the outline;
   only what the outline returned changed. The two added tests exercise it unchanged.

3. **The e2e's "before" test rewrites a served module rather than checking out the base.** The
   spec intercepts `/src/services/trace/simulationTrace.ts` in dev and replaces the phase capture
   with `const phase = undefined;`. This is the same technique
   `e2e/titan-pipeline-verification.spec.ts:5-11` already uses. It was chosen because criterion 6
   asks for the stops to be shown *changed*, and a spec that can only see the current build
   cannot show a change. The interception is a regex, because Vite normalizes quotes and
   indentation before serving, so a literal source substring does not match.

4. **The probe files were written at the repository root and deleted, per the route.** They were
   never staged.

5. **`npm run test:e2e` failed once before the recorded run.**
   `titan-mode-failures.spec.ts:3` "cancels the visible Titan Mode queue and ignores a late
   specialist response" timed out waiting for `.titan-mode-progress` to reach count 0 after a
   `page.reload()`. It passed on the run before it and on the run after it, on the same commit,
   and it touches no code this turn changed. Recorded as a flake, not silently retried away —
   see `## Discovered`.

## Discovered

1. **`TracePhase.kind` lost its `setup` value across all 60.** Before the change the outline
   emitted `update` and `setup`; after it, `update` only. The cause is that `kind` is still
   taken from `group[0].step.kind`, and under phase grouping the first step of every group
   happens to be a `mutate` step. Nothing reads `TracePhase.kind` for a user-visible decision
   today — it appears in `label` and in `renderOutlineForModel`'s row text — so this is a
   fidelity loss in a field the model reads, not a regression in behaviour. Deriving `kind` from
   the group's majority, or from the phase label's own suffix, is a candidate for the Option B
   route.

2. **Zero of the 60 supported algorithms produce a single distinct phase label.** The minimum is
   3 (Kruskal's MST, Two Pointers Technique, Dutch National Flag, Trapping Rain Water, Binary
   Search, Ternary Search, 0/1 Knapsack, Coin Change, Unique Paths, Fast Exponentiation). So the
   "fall back to kind grouping" branch is unreachable from any supported algorithm preset in
   production; it exists for the SimLang and model-authored paths, and is covered by
   `traceIntelligence.test.ts:87` and by the model-authored e2e.

3. **Seven algorithms now emit one outline phase per step.** Binary Tree Postorder Traversal
   (61/61), Articulation Points (35/35), Bridges in Graph (35/35), Insertion Sort (26/26),
   Rabin-Karp (23/23), Prim's MST (12/12), Reverse Linked List (12/12). Their phase labels
   change on every step, so the outline degenerates to the step list. `renderOutlineForModel`
   caps at 40 rows so the prompt is still bounded, but for these the outline offers the model no
   compression at all. Hamiltonian Cycle is the opposite kind of outlier: 100 phases over 144
   steps.

4. **The `evenlySample` filler is now bounded by significance, not by the outline.** After the
   change, 25 of 60 still draw 3 or more indices from the filler, and in every one of those the
   seeded `{0, last, mostSignificantIndex}` set collapses to two or three distinct values. This
   is the concrete shape of what Option B would buy.

## Untouched

```powershell
git diff --name-only "fc3a8fa..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$'
```

Printed nothing. `AGENTS.md`, `docs/titan/PROTOCOL.md`, `docs/titan/routes/**`,
`docs/DEVIRALAN.md` and every `*/AGENTS.md` are absent from the diff; the only T0-owned path in
the range is T0's own route file from `route(R27): open`.

## Blockers

None. Two decisions are T0's to make, neither blocking:

1. Option B needs its own route and its own oracle. `sigZero` is unchanged at 19; the concrete
   symptom is documented in `## Discovered` item 4.
2. `TracePhase.kind` collapsing to `update` (item 1) — whether that is worth a fix, and whether
   it belongs to the Option B route.

## For the human

none.
