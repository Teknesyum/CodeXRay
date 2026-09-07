# R27 — the phases were already there

## Özet

Modele "important steps" diye gönderilen indeksler, 60 desteklenen algoritmanın 50'sinde
çoğunlukla **eşit aralıklı aritmetik**. `structuralCheckpointIndices` sekiz indeks seçiyor:
ikisi (ilk ve son) sabit, biri `mostSignificantIndex`'ten, gerisi `buildTraceOutline`'dan —
ve outline 54/60 algoritmada **tek faz** döndüğü için kalan beş altı indeks `evenlySample`
dolgusundan geliyor.

Bunun sebebi verinin yokluğu değil. **Her algoritma zaten her adıma bir faz etiketi yazıyor** —
`visualData.vars.phase`, ortalama 4,7 farklı faz. DFS'te dördü: `DFS · descend`,
`DFS · inspect edge`, `DFS · backtrack`, `DFS · complete reachable component`.

`simulationStepsToRawTrace` bu alanı okumuyor. Adaptör yalnız alt çizgili protokol
anahtarlarını (`_traceKind`, `_traceEvent`, `_mutated`, `_callDepth`) tanıyor ve **hiçbir
simülatör bunların hiçbirini yazmıyor**. `phase` sıradan bir değişken sayılıyor, hatta her faz
değişimi bir "mutasyon" olarak sayıldığı için neredeyse her adım `mutate` oluyor — outline da
ardışık eşit `kind`'ları grupladığından tek dev grup çıkıyor.

`AGENTS.md` bu işi "60 simülatörden olay yaymak" diye fiyatlıyordu. **Ölçüm bunu çürütüyor:
simülatörlerin hiçbiri değişmek zorunda değil.** Eksik olan iki dosya arasındaki bir alan.

## Objective

Make the outline read the phase labels the simulators already write.

### The measurement

Sixty supported algorithms, each run from its own deterministic preset at `fc3a8fa`.

| what | measured |
|---|---|
| supported algorithms measured | 60 |
| `mostSignificantIndex === 0` | 19 |
| `mostSignificantIndex === null` | 0 |
| single-phase outline | 54 |
| distinct `TracePhase.kind` values ever produced | `update`, `setup` — only |
| `kind` values never produced | `loop`, `branch`, `recursion`, `result`, `error` |
| algorithms producing any trace `event` | 0 |
| algorithms where most checkpoints come from `evenlySample` | 50 |
| algorithms with **no** `evenlySample` contribution | 0 |

T0 reproduced four rows independently, through the real `generateSimulationSteps`:

```
Depth First Search (DFS)  steps=24 sig=0 phases=1 kinds=update       cps=[0,1,5,9,14,18,22,23]
Breadth First Search (BFS) steps=17 sig=0 phases=1 kinds=update      cps=[0,1,4,7,9,12,15,16]
Kosaraju's SCC            steps=32 sig=0 phases=3 kinds=update,setup cps=[0,1,2,8,12,21,30,31]
Trapping Rain Water       steps=14 sig=2 phases=3 kinds=update,setup cps=[0,1,2,5,8,11,12,13]
```

Read a row: DFS gets eight "important steps". `0` and `23` are hardcoded. `mostSignificantIndex`
returns `0`, which is **already in the set** — so for those 19 algorithms the significance
analysis contributes literally nothing. The outline has one phase, so it offers one index. The
other six come from dividing the range into equal parts.

### The data that is already there

Same sixty algorithms, asking only whether steps carry a phase label:

```
total=60 withAnyPhase=60 distinctSum=282
Depth First Search (DFS)  | steps=24 phaseSteps=24 distinctPhases=4
Breadth First Search (BFS)| steps=17 phaseSteps=17 distinctPhases=4
Bellman-Ford Algorithm    | steps=17 phaseSteps=17 distinctPhases=6
Kosaraju's SCC            | steps=32 phaseSteps=32 distinctPhases=7
Tarjan's SCC              | steps=29 phaseSteps=29 distinctPhases=6
```

**60 of 60, every step, 4.7 distinct phases on average.** The shape of one step:

```
stepKeys = lineNumber, visualData, explanation
varsKeys = phase, decision, current, neighbor, visited, recursionStack, treeEdges
vars.phase = "DFS · inspect edge"
distinct   = ["DFS · descend", "DFS · inspect edge", "DFS · backtrack",
              "DFS · complete reachable component"]
```

And the shape of what the adapter produces from it:

```
traceStep0Keys = index, line, column, kind, callDepth, scopes, mutated, event
```

`phase` is gone. `simulationTrace.ts:22-46` recognizes `_traceKind`, `_mutated`, `_traceEvent`,
and `_callDepth`; nothing writes any of them, so `kind` falls to
`mutated.length ? 'mutate' : 'statement'` at `:38`. `buildTraceOutline` at `traceOutline.ts:24`
groups **consecutive steps of equal kind**, so a run of `mutate` steps is one phase no matter how
many named phases it spans. `scoreTrace` at `significance.ts:48` scores with
`eventWeight(step) || kindWeight(step)`, and `eventWeight` is 0 everywhere because there are no
events; ties resolve to the first maximum, which is how 19 algorithms land on index 0.

### Why this matters beyond the prompt

`structuralCheckpointIndices` has five production callers, and only the first is a prompt:

- `aiContext.ts:223` — labelled "important steps" in the model's context.
- `aiTimelineControl.ts:103` and `:169` — the guided tour's stops.
- `aiTimelineControl.ts:201` and `:205` — next-checkpoint and previous-checkpoint navigation.
- `titanModeRouting.ts:276` — the Titan-mode tour.

So a user pressing "next checkpoint" is being walked through equally spaced steps under a name
that promises structure. That is user-visible behaviour, and criterion 6 below cannot close on a
unit test.

## Turn

- `Turn.holder`: T0-delegated implementer
- `Turn.base`: `fc3a8fa`
- `Turn.branch`: `main`

`git merge-base --is-ancestor fc3a8fa HEAD` must exit 0, and `git diff --name-only fc3a8fa..HEAD`
must list only T0-owned paths before you write.

## Expected Files

A forecast, not a gate.

- `src/services/trace/simulationTrace.ts` — carry the phase across the adapter.
- `src/services/trace/types.ts` — the field it is carried in.
- `src/services/trace/traceOutline.ts` — group by phase when one is present.
- Their tests, and `aiTimelineControl.test.ts`.

## Invariants

- **The trace never comes from the model.** This turn moves data the deterministic simulators
  already produce; nothing here may accept a phase from model output.
- **The model never computes an index; it selects a phase id.** `resolvePhaseId` stays the only
  way a phase id becomes an index. Do not let a richer outline turn into model-chosen numbers.
- Determinism: no `Math.random`, no wall-clock branching. Same input, same phases, every run.
- Never truncate trace collections; keep `TraceValue` structure, not preformatted JSON.
- **Do not edit the 60 simulators.** If a phase label is wrong or missing somewhere, record it in
  the handoff for a later route; changing simulator output in the same turn as the reader makes
  the measurement uninterpretable.
- Phase labels are English strings written by simulators, and they are **already shown to
  users** untranslated: `DynamicVisualizer.tsx:158`, `:274`, and `:348` read `vars.phase` and
  render it, and `:160` even branches on `phase.startsWith('Topological Sort')`. So this turn
  inherits an existing EN-only surface rather than creating one. Do not translate them here and
  do not widen where they are displayed; if the outline needs a user-facing label, derive it the
  way `traceOutline.ts:39` already does. An EN/TR pass over phase labels is a separate route.
- No frozen or T0-owned path: `.claude/**`, `.agents/AGENTS.md`, `docs/tasks/**`,
  `docs/legacy/**`, `CodeXray-readme-neon.svg`, `docs/TITAN_MODE_YOL_HARITASI.md`,
  `docs/titan/routes/**`, `AGENTS.md`.

## The decision

**Option A — carry `vars.phase` through the adapter and group the outline by it.** Add an
optional `phase` to the raw trace step, populate it in `simulationStepsToRawTrace` from
`step.visualData.vars.phase` when it is a string, and in `buildTraceOutline` start a new group
when the phase label changes, falling back to today's kind-grouping when no step carries one.
Keep `phaseKind` for the `kind` field so the existing rendering still works.

Cost: three small files plus tests. The measurement above is the fixture, and the expected
outcome is stated and checkable: DFS should go from 1 phase to 4, Kosaraju from 3 to 7.

This is the option T0 measured for. It touches no simulator, invents no new data, and its
correctness is decidable by comparing against `distinctPhases`, which is already known for all
60.

**Option B — also make `scoreTrace` phase-aware, so `mostSignificantIndex` stops returning 0.**
Larger, and it is the half of the problem A does not solve: with A, `mostSignificantIndex` still
returns 0 for 19 algorithms and still contributes nothing. Worth doing, but scoring is a
judgement about what is *interesting*, and getting it wrong is invisible — the suite stays green
either way. It needs its own route with its own oracle, exactly like the `deterministicFiveLens`
sweep R17c had to build.

**Option C — emit real trace events from the 60 simulators.** What `AGENTS.md` estimated this
work at. The measurement above says it is not required for the outline, and it is a large
uninstrumented change across 60 files. Not this route. Reconsider only after A shows what is
still missing.

**T0 reading, not binding: A, and report what B would still be worth.** Do not take C.

## Acceptance Criteria

1. `buildTraceOutline` returns more than one phase for the algorithms whose steps carry more than
   one distinct `vars.phase`. Measured across **all 60 supported algorithms**, with the count of
   single-phase outlines before and after.
2. For each of the 60, the number of phases equals the number of distinct phase labels in its
   steps, or the handoff names the algorithm and explains the difference. `distinctSum=282` is
   the total to compare against.
3. A trace whose steps carry no phase label still produces today's kind-grouped outline. Assert
   it — the SimLang/model-authored path has no `vars.phase`.
4. `structuralCheckpointIndices` draws more of its eight indices from the outline and fewer from
   `evenlySample`. Report the per-algorithm `fromEvenly` count before and after; 50 algorithms
   were majority-filler at base.
5. Phase ids stay resolvable: `resolvePhaseId` still maps an id to an index, and no code path
   lets a model supply an index.
6. The user-visible effect is shown, not inferred: an e2e that walks next-checkpoint or the
   guided tour and demonstrates the stops changed. A unit test does not close this.
7. Determinism: the same algorithm and preset produce identical outlines across runs. Assert it.
8. No simulator file is modified. `git diff --name-only fc3a8fa..HEAD` proves it.
9. (T0) The handoff states whether `mostSignificantIndex` still returns 0 for 19 algorithms after
   this turn. It is expected to; say so plainly rather than letting criterion 1 imply otherwise.
10. `npm run lint`, `npm run test:coverage`, `npm run build` pass. `desktop:check` if
    `src-tauri/**` changed.
11. e2e passes.
12. No frozen or T0-owned path written.
13. Every commit DCO-signed as `Mustafa Özel <iyott131@gmail.com>`.

## Verification

PowerShell 5.1. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git config user.email

git diff --name-only "fc3a8fa..HEAD"

git diff --stat "fc3a8fa..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'structuralCheckpointIndices'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'vars\.phase|\.phase ='

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

git diff --name-only "fc3a8fa..HEAD" | Select-String -Pattern 'imulator'

npm run lint

npm run test:coverage

npm run build
```

The eighth command must print nothing; that is criterion 8.

For criteria 1, 2 and 4, write a throwaway probe at the repository root that walks every
`isSupported` entry of `algorithmRegistry`, run it with `npx vitest run`, write its output with
`appendFileSync` because vitest swallows `console.log`, paste the whole table into the handoff,
and delete the probe. Run it against the base as well — a before/after table is the evidence, not
an after-only one.

e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run created.

## Still deferred after this route

- Option B: `scoreTrace` is phase-blind and `mostSignificantIndex` returns 0 for 19 of 60.
  Needs an oracle before it needs code.
- Option C: no simulator emits a trace `event`; `eventWeight` is dead weight in every score.
- `src/services/trace/traceQuery.ts` has no production consumer.
- `inputRequestAdapter.test.ts:31`'s name has described no production behaviour since R22.
- `titanEntry.ts:130` is the one engine caller outside `PipelineRunId`'s brand.

## T0 reconciliation

Closed. `efbeff7` (close) and `0cad778` (handoff) over base `fc3a8fa`. Verified on T0's own
evidence, not on the handoff's.

### What was actually written

Eight files. Production is three files and sixteen lines: `phase?: string` on `RawTraceStep`,
a two-line capture in `simulationTrace.ts`, and the `groupKey` swap in `traceOutline.ts`.
Exactly Option A as routed, with kind-grouping preserved as the no-phase fallback.

**No simulator file was touched.** Criterion 8's grep printed nothing for me too. This is the
point of the route: `AGENTS.md` and every prior estimate priced this work as "emit events from
60 simulators", and the measurement disproved that before a line was written. All 60 already
labelled every step; the adapter was throwing the label away.

### Independent measurement

T0 wrote its own probe over all 60 `isSupported` entries, unrelated to the handoff's:

```
total=60 single=0 sigZero=19 evenlySum=91 phaseSum=936 distinctSum=282
Depth First Search (DFS)   steps=24 sig=0 phases=17 distinct=4 cps=[0,1,3,6,10,13,22,23]
Breadth First Search (BFS) steps=17 sig=0 phases=13 distinct=4 cps=[0,1,2,7,9,12,15,16]
Kosaraju's SCC             steps=32 sig=0 phases=13 distinct=7 cps=[0,1,16,21,23,27,30,31]
Trapping Rain Water        steps=14 sig=2 phases=3  distinct=3 cps=[0,1,2,5,7,10,12,13]
```

`single=0`, `sigZero=19`, `phaseSum=936`, `distinctSum=282` reproduce the handoff exactly. The
DFS checkpoint set matches the e2e's after-state `1,2,4,7,11,14,23,24` under 1-based display.
Against the pre-turn baseline recorded in the route, `single` went 54 to 0 and DFS moved off
`[0,1,5,9,14,18,22,23]`.

`evenlySum` differs from the handoff's 129: T0 counted a checkpoint as filler-sourced only when
it is absent from `{0, last, mostSignificantIndex} ∪ keyIndices`, and seeded `mostSignificantIndex`
only when non-null. Both are large drops from 250 and both are measured; the disagreement is in
the definition, not in the code, and neither number gates a criterion.

Gates re-run by T0 on `0cad778` with a clean tree: `lint` clean, `test` **901 passed / 120
files** (base 895), `build` within every budget (tracer 141.0/150.0 KiB, styles 91.3/100.0 KiB).

### Criterion 2 was mine to get wrong

**The route's criterion 2 was mis-specified.** It asked that the outline phase count equal the
distinct-label count, or that the difference be explained. `outlinePhaseSum` is 936 against
`distinctSum` 282 — 41 of 60 exceed, 19 match, none is below. The handoff's explanation is
correct and the code is not: grouping is on **consecutive runs**, so a simulator that alternates
`descend`/`inspect edge` emits one group per run. Contiguity is forced, not chosen —
`TracePhase` carries `startIndex`/`endIndex` and the guided tour walks them in order, so a
grouping keyed on the label alone would emit overlapping phases.

I wrote a criterion that would have been satisfied only by a broken implementation. The
implementer took the route's decision literally, measured the consequence, named the 19 exact
matches and the worst outliers, and said so. That is the right resolution.

This is the **fourth consecutive route with a defect in the route rather than the
implementation** (R25 rejected a signature it meant to keep, R26 named a vitest flag that does
not exist, R27 specified a count the design cannot produce). The finding recorded at R26 stands
and hardens: the routes are the weaker half of this relay. A criterion that asserts a number is
code, and an unmeasured number in a route is an unrun command.

### Criterion 9

Answered plainly, as required: `sigZero` is **19 before and 19 after**. This turn did not touch
`scoreTrace`, and criterion 1's improvement must not be read as having moved significance.

### Deviations — all five accepted

1. `e2e/checkpoint-phases.spec.ts` outside the forecast: required by criterion 6, inside Sole's
   ownership. The forecast is a forecast.
2. `aiTimelineControl.ts` never edited: correct. `structuralCheckpointIndices` already read the
   outline; only what the outline returned changed. The route implied an edit that was not needed.
3. The e2e's "before" state produced by intercepting the served module rather than checking out
   the base: the same technique `e2e/titan-pipeline-verification.spec.ts:5-11` already uses, and
   the only way one spec can show a change. Accepted.
4. Root probe files written and deleted, per the route's own instruction.
5. A one-time `titan-mode-failures.spec.ts:3` flake disclosed instead of retried away. See below.

### Discovered, and what T0 does with it

**`TracePhase.kind` lost its `setup` value across all 60.** Under phase grouping, `kind` is still
taken from `group[0].step.kind`, and the first step of every group is now a `mutate` step. Nothing
reads `TracePhase.kind` for a user-visible decision; it reaches the model through `label` and
`renderOutlineForModel`'s row text. This is a fidelity loss in a field the model reads, not a
behavioural regression — accepted for this turn and added to the deferred list, to be fixed with
`kind` derived from the group's majority or the label's own suffix.

### Flake watch

`titan-mode-failures.spec.ts:3` has now been seen once at R24 and once at R27; `radio-controller.spec.ts`
once at R26. The standing rule is that a spec earns a route when it fails twice in a row on one
commit, which neither has. Both stay on watch.

### Still deferred

- Option B: `scoreTrace` is phase-blind; `mostSignificantIndex` returns 0 for 19 of 60. Needs an
  oracle before it needs code. `TracePhase.kind`'s lost `setup` belongs to this route.
- Option C: no simulator emits a trace `event`; `eventWeight` is dead weight in every score.
- `src/services/trace/traceQuery.ts` has no production consumer.
- `inputRequestAdapter.test.ts:31`'s name has described no production behaviour since R22.
- `titanEntry.ts:130` is the one engine caller outside `PipelineRunId`'s brand.
- Phase labels render untranslated at `DynamicVisualizer.tsx:158`, `:274`, `:348`. This route made
  them load-bearing for the guided tour, which raises the cost of leaving them EN-only.
