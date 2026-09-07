# R31 — A Key Step That Is Just The First Step

## Turn.base

`614f163`

```powershell
git merge-base --is-ancestor 614f163 HEAD
git diff --name-only "614f163..HEAD"
```

The first must exit 0. The second must list only T0-owned paths.

## Why

`TracePhase.keyIndex` is the step a phase is *about*. Three production paths depend on it:
`resolvePhaseId` turns a model-selected phase id into a timeline position,
`renderOutlineForModel` shows the model `key N` for every phase, and
`structuralCheckpointIndices` builds the guided tour out of `phase.keyIndex` values.

R27 made phases real — grouping moved from step kind to the simulators' own
`visualData.vars.phase` label, and single-phase outlines went from 54 of 60 to 0. What R27
explicitly did not touch is the scorer that picks the key step **inside** each phase, and
`AGENTS.md` has carried that as deferred ever since.

The reason it matters is not that the scorer is imprecise. It is that
**`scoreTrace` cannot discriminate inside a phase by construction.** Its two weight functions,
`eventWeight` and `kindWeight` (`significance.ts:3`, `:19`), read only `step.event?.t`,
`step.kind` and `step.callDepth`. A phase is now a contiguous run of one teaching label, and
within such a run those three are usually constant. `numericDelta` is the only term that can
vary, it is capped at 0.3, and it is zero unless a *numeric* variable in `mutated` changed. So
`scoreTrace` returns a constant across most phases, and
`group.reduce((w, i) => i.score > w.score ? i : w)` — a strict `>` — keeps the first element.

`keyIndex` therefore silently means `startIndex`.

## The measurement

T0 ran every supported algorithm on preset 0, built the outline, and compared `keyIndex` to
`startIndex`. Verbatim summary:

```
ALGOS=60 totPhases=936 keyEqStart=882 algosAllKeyEqStart=33 algosAllZeroScore=0 sigZero=19
```

`algosAllZeroScore=0` matters: the scores are **not** all zero. Every step scores something.
They are simply equal to each other inside a phase, which is the only place the value is used.

882 of 936 is the wrong headline, though, and the route says so before an implementer quotes it.
763 of those 936 phases are **one step long**, where `keyIndex === startIndex` is not a defect
but the only possible answer. The honest figure is the one restricted to phases that have a
choice to make:

```
multiStepPhases=173 withDecision=33 decisionVaries=32 mutatedVaries=152 either=157
```

**119 of the 173 multi-step phases pick their first step.** And a within-phase signal exists in
157 of those 173: `RawTraceStep.mutated.length` varies across the phase in 152, and
`visualData.vars.decision` varies in 32. Sixteen phases have neither and cannot be
discriminated by anything currently in the trace — that is a real floor, not a failure.

Per-algorithm rows, verbatim, first twenty of sixty:

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
```

Reproduce the whole table before changing anything; the implementer's own numbers, not these,
are what the criteria are measured against.

`mostSignificantIndex` returning 0 for 19 of 60 (`sigZero=19`) is the same defect at global
scope: a strict `>` over a constant. It is not a separate route.

## Decision

Give `scoreTrace` a term that varies **within** a phase.

The obvious candidates are already in the data: `step.mutated.length` (varies in 152 of 173) and
the presence or change of `visualData.vars.decision` (32 of 173). `decision` is not on
`RawTraceStep` today — check before assuming it can be read there; if carrying it costs a field
on the raw step, that is the same one-field move R27 made for `phase` and is acceptable.

**Weight it below the existing kind and event terms.** The current weights encode real teaching
judgement — a `result-write` is worth 4, a shallow `call` 1.5 — and this route is not a licence
to re-tune them. The new term breaks ties; it does not outrank `throw`.

**Do not change the grouping.** Phases are contiguous runs of a label and must stay contiguous;
`AGENTS.md` records why the 936-vs-282 gap is correct.

**Do not make the first step ineligible.** For many phases the first step genuinely is the
point. The defect is that it wins by default, not that it wins.

### The oracle problem, stated plainly

Nothing in this repository can prove that step *k* teaches a phase better than step *j*. This
route therefore does **not** ask for a "better" key step and no criterion below claims one. It
asks for a scorer that is *capable* of distinguishing, and it measures exactly that. If the
implementer wants to argue a particular rule is pedagogically right, that argument belongs in
the handoff as prose, clearly separated from the evidence.

### `TracePhase.kind`, which has read `update` for all 60 since R27

`traceOutline.ts:40` takes the group's kind from `group[0].step.kind`. Since the group is a run
of a label, its first step's kind is arbitrary, and the `setup` value no longer occurs anywhere.
Nothing branches on `kind`, but `renderOutlineForModel` shows it to the model, so it is a label
the model reads and it is currently noise.

Fix it **only if you can state a rule you would defend** — the most frequent kind in the group,
or a kind derived from the label. If you cannot, leave it exactly as it is and say so in the
handoff. Do not invent a mapping to close a criterion; R30 shipped a different number than its
route asked for and that was the correct outcome.

## Criteria

1. **The per-algorithm table above is reproduced on the base commit**, all 60 rows, pasted
   verbatim, before any source change. If the implementer's numbers differ from T0's, that is
   the finding and the rest of the route is measured against the implementer's.

2. **Residual, and it must be empty: no multi-step phase whose within-phase signal varies may
   still have a constant score across the phase.** Report it as a count on the base and a count
   after — the after count is the gate. This is a property of the scorer, not a claim about
   which step wins, and it is deliberately shaped like R28's criterion 3 rather than as a
   predicted number.

3. **The 16 phases with no varying signal are reported by name and left alone.** A route that
   drives this number to zero has invented a signal. The handoff states the count it found.

4. **`mostSignificantIndex` no longer returns 0 by tie.** Report how many of the 60 still return
   0 and, for each, whether index 0 actually wins on score or merely survives the strict `>`.
   The gate is that none survives by tie; index 0 legitimately winning is fine.

5. **Single-step phases are untouched**: their `keyIndex` still equals `startIndex`, all 763.

6. **`TracePhase.kind` is either fixed with a stated rule or explicitly left**, and the handoff
   says which and why. Both outcomes close this criterion; silence does not.

7. **No simulator file is modified**, and no `Math.random` or wall-clock branching enters the
   trace path. The change belongs in `significance.ts`, possibly `traceOutline.ts`, possibly one
   field on `RawTraceStep` and its producer in `simulationTrace.ts`.

8. `lint`, `test`, `build` clean, with the unit test count stated against the base's 909 and the
   initial-JS figure against the 425.0 KiB budget — **there are 2.4 KiB of headroom and this
   route must not spend them on a scorer.**

9. **A user-visible criterion cannot close on a unit test alone.** The guided tour is the
   consumer; show that a tour over an algorithm from the table above now visits steps it did not
   visit before, with both lists.

## Expected Files

A forecast, not a gate.

- `src/services/trace/significance.ts`
- `src/services/trace/significance.test.ts`
- `src/services/trace/traceOutline.ts`
- `src/services/trace/types.ts`
- `src/services/trace/simulationTrace.ts`

## Verification

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e
git diff --name-only "614f163..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$'
git diff --name-only "614f163..HEAD" | Select-String -Pattern 'src/services/(simulators|extended|compound)'
git status --porcelain | Select-String -Pattern 'test-results|dist/|coverage/|probe'
```

The last three must print nothing. e2e now defaults to 2 workers with no environment variable —
see `AGENTS.md`, and use the external-server procedure. Delete `test-results/` before finishing
and leave no probe file in the tree.

## Still deferred after this route

- `AiAssistant.tsx:857` persists before the dismissed guard, making `:1462`'s removal and
  `:1455`'s sanitize map unreachable.
- Option C: no simulator emits a trace `event`, so `eventWeight` contributes nothing to any
  score. This route does not change that — it adds a term beside it. If R31's new term makes
  `eventWeight` provably dead, say so; do not delete it here.
- `ArrayView` and `RowsView` display `decision` but not `phase`.
- The three e2e specs at 3–4x the suite median: `accessibility-axe.spec.ts:37` 9.9 s,
  `ai-actions.spec.ts:112` 12.5 s, `radio-controller.spec.ts:3` 8.1 s.
- Initial-JS budget: 2.4 KiB of headroom, `translations.ts` the growth vector.
- `src/services/trace/traceQuery.ts` has no production consumer.
- `inputRequestAdapter.test.ts:31`'s name has described no production behaviour since R22.
- `titanEntry.ts:130` is the one engine caller outside `PipelineRunId`'s brand.
