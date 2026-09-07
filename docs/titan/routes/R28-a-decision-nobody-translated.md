# R28 — A Decision Nobody Translated

## Turn.base

`07aa7f3`

Check before writing anything:

```powershell
git merge-base --is-ancestor 07aa7f3 HEAD
git diff --name-only "07aa7f3..HEAD"
```

The first must exit 0. The second must list only T0-owned paths.

## Why

R27 made `visualData.vars.phase` load-bearing: the outline, the guided tour, next/prev
checkpoint and the model's "important steps" all group on it now. While measuring that, T0 swept
the sibling field `visualData.vars.decision` and found two things wrong with it. Neither is a
regression from R27; both predate it and neither has ever been measured.

This is the same finding class as R15 through R27, for the eighth consecutive turn: **the call
site is right and the thing it calls does nothing.** `DynamicVisualizer.tsx:244` and `:283`
render the decision through `translateRuntimeText(decision, locale)`. The call is correct, the
locale is threaded, the code reads as localized — and the substitution table has no entry for
169 of the 175 strings that reach it, so a Turkish user reads
`8 nodes reachable from S were visited; the recursion stack is empty.` under a Turkish phase
label.

## The measurement

T0's own probe over all 60 `isSupported` entries, at preset index 0, comparing each distinct
runtime string against `translateRuntimeText(s, 'tr')`:

```
phases       total=275  untouched=0    (every phase label has Turkish)
explanations total=923  untouched=0    (every step explanation has Turkish)
decisions    total=175  untouched=169
```

**Phases and explanations are fully covered. Decisions were never swept.** `runtimeReplacements`
has 702 entries and not one of them matches a decision phrasing — the sentences the decision
field emits are different sentences from the ones `explanation` emits, and only the latter were
translated:

```
$ grep -n "unvisited|recursion stack|oldest queued|smallest tentative" src/i18n/translations.ts
1001:  [/Follow the edge from (.+) to unvisited node (.+)\./g, ...]          <- an explanation
1481:  [/top, bottom, left, and right bound the unvisited rectangle./g, ...] <- an explanation
```

25 of the 60 algorithms emit a decision. A representative slice of the 169:

```
Depth First Search (DFS)   A is unvisited, so this edge becomes part of the DFS tree.
Depth First Search (DFS)   G has no remaining unvisited neighbor; return to E.
Breadth First Search (BFS) A is first reached at level 1; enqueue it exactly once.
Dijkstra's Shortest Path   5 improves B from ∞; update its predecessor.
A* Search Algorithm        S now has the smallest f = g + h in the frontier.
Kruskal's MST              The lightest remaining edge will be inspected first.
Topological Sort           remove plan→design; indegree[design]=0
Tarjan's SCC               low[F]=disc[F] ⇒ SCC 1
Graph Coloring             B=1 conflicts with A
Articulation Points        low[E]=4 ≥ disc[D]=4
Bellman-Ford Algorithm     8≥2 ⇒ keep d[C]
Kadane's Algorithm         4>2 ⇒ restart
Binary Search              mid<target ⇒ discard left half
0/1 Knapsack               exclude current item
Binary Tree Inorder        emit n7
Fast Exponentiation        multiply accumulator
```

Two shapes are mixed together and the route does **not** ask you to translate them the same way.
Roughly 125 are prose sentences with interpolated identifiers; roughly 44 are mathematical
notation carrying one or two English words (`keep`, `emit`, `restart`, `extend`, `min`). The
44 must keep their notation — `low[F]=disc[F] ⇒ SCC 1` is not English and must not be
"translated" into anything — but the English words inside them must go. The exact split under
any particular word-count rule is not a criterion; see criterion 3 for what actually gates.

### The second finding

`decision` is rendered by exactly two of the visualizer's views:

```
DynamicVisualizer.tsx:159,244   GraphView
DynamicVisualizer.tsx:275,283   MatrixView
```

Six of the 25 emit a decision into a view that never reads it:

```
Kadane's Algorithm              kinds=array  decSteps=8/14
Two Pointers Technique          kinds=array  decSteps=3/5
Binary Search                   kinds=array  decSteps=3/5
Ternary Search                  kinds=array  decSteps=2/4
Longest Increasing Subsequence  kinds=rows   decSteps=28/34
Fast Exponentiation (Modular)   kinds=rows   decSteps=4/6
```

`ArrayView` and the rows view read `vars.phase` but not `vars.decision`. The strings are
produced deterministically, cost steps to compute, reach the Variables & Trace panel through
`VariablesPanel.tsx:50`, and never appear beside the visualization the way they do for the other
19. Binary Search's `mid<target ⇒ discard left half` is the single most explanatory string that
algorithm produces and the visualizer drops it.

## Decision

Do both halves in this turn. They are one surface, and translating strings that six algorithms
never display would be work with no user-visible effect.

**Half A — localize the decision field.** Add `runtimeReplacements` entries covering the
decision phrasings. Follow the conventions already in that file: an anchored `^...$` for a fixed
string, a capturing pattern for an interpolated one, and never a pattern so loose it also
rewrites an explanation or a phase label. Prefer one pattern per template over one per emitted
string — `(.+) is unvisited, so this edge becomes part of the DFS tree\.` is one entry, not
eight.

**Half B — render the decision in the array and rows views.** Use the markup and class names
those two views already use for `phase`; do not invent a new visual treatment, a new class, or a
new color. If the existing phase element cannot carry a second line without changing layout,
say so in `## Deviations` and render nothing rather than guessing at a design.

Do not touch the simulators. Do not change what any decision string says in English. Do not add
a `decision` emission to an algorithm that does not have one.

## Criteria

1. **All 60 supported algorithms are swept, not a sample.** The evidence is a before/after table
   over every `isSupported` entry, at the same preset the measurement above used.

2. **`decisions untouched` goes from 169 to 0.** Every distinct decision string differs from
   itself under `translateRuntimeText(s, 'tr')`. The before number is 169 and the total is 175;
   state both after numbers.

3. **No English word survives in the Turkish locale.** This, not criterion 2, is the real gate:
   a string can differ from its English self and still be half English. Collect every
   alphabetic token of three or more letters appearing in any Turkish-locale decision string
   across all 60, subtract a **declared allowlist committed in the test** — algorithm
   abbreviations and mathematical identifiers such as `DFS`, `BFS`, `MST`, `SCC`, `LIS`, `min`,
   `max`, `low`, `disc`, plus node and variable identifiers that come from the input — and
   assert the remainder is empty. Print the residual set in the handoff even when it is empty.
   If a token genuinely belongs in Turkish output, put it in the allowlist and say why in the
   handoff; do not put a token there to make the test pass.

4. **Nothing that already had Turkish loses it.** `phases untouched` stays 0 of 275 and
   `explanations untouched` stays 0 of 923. A new unanchored pattern can capture an explanation
   it was not written for; this criterion is what catches that. Also assert no explanation or
   phase label *changed* from what it rendered before this turn — equal counts are not enough.

5. **The six array/rows algorithms display their decision.** Shown in the running application,
   not in a unit test: an e2e that selects Binary Search, advances to a step whose decision is
   non-empty, and asserts the text is visible in both locales. Criterion 5 is a user-visible
   behaviour claim and cannot close on a unit test — this is the protocol rule, stated here so
   it is not read as optional.

6. **The other 19 are unchanged in layout.** The graph and matrix views render the decision
   exactly where they did before. If a shared element was refactored to serve four views, show
   that the graph and matrix output is byte-identical.

7. `lint`, `test`, `build` clean, with the test count stated against the base's 901.

8. **(T0)** The handoff states plainly whether any decision string was reworded in English to
   make it easier to translate. The expected answer is no. If one was, name it and say why.

## Expected Files

A forecast, not a gate.

- `src/i18n/translations.ts`
- `src/i18n/translations.test.ts`
- `src/components/DynamicVisualizer.tsx`
- `src/components/DynamicVisualizer.test.tsx`
- `e2e/decision-localization.spec.ts`

## Verification

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e
git diff --name-only "07aa7f3..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$'
git diff --name-only "07aa7f3..HEAD" | Select-String -Pattern 'imulators\.ts$'
```

The last two must print nothing; the second is the no-simulator-edit rule.

For criteria 1 through 4, write a throwaway probe at the repository root that walks every
`isSupported` entry of `algorithmRegistry`, run it with `npx vitest run`, write its output with
`appendFileSync` because vitest swallows `console.log`, paste the whole table into the handoff,
and delete the probe. Run it against `07aa7f3` as well — a before/after table is the evidence,
not an after-only one.

e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run created.

## A note on this route's own criteria

Three of the last four routes specified a number the design could not produce. Criterion 3 is
written as a residual-set assertion rather than a count for exactly that reason: T0 does not
know how many patterns the 169 strings collapse into, and a route that guessed at that number
would be guessing again. If a criterion here turns out to be unsatisfiable as written, say so in
the handoff and satisfy what it was reaching for; that is a route defect and will be recorded as
one.

## Still deferred after this route

- Option B: `scoreTrace` is phase-blind; `mostSignificantIndex` returns 0 for 19 of 60. Needs an
  oracle before it needs code. `TracePhase.kind`'s lost `setup` value belongs to this route.
- Option C: no simulator emits a trace `event`; `eventWeight` is dead weight in every score.
- `src/services/trace/traceQuery.ts` has no production consumer.
- `inputRequestAdapter.test.ts:31`'s name has described no production behaviour since R22.
- `titanEntry.ts:130` is the one engine caller outside `PipelineRunId`'s brand.

## T0 reconciliation

Closed, and **criterion 2 is withdrawn as a T0 defect rather than left open**. `6eaba20`
(close) and `f2060b8` (handoff) over base `07aa7f3`. Verified on T0's own evidence.

### What was written

Eight files, none of them guarded, no simulator touched — both `Select-String` guards printed
nothing for T0 as well. 46 new `runtimeReplacements` patterns, all anchored `^…$`; a `TeachingHud`
component extracted in `DynamicVisualizer.tsx`; three unit tests in each of two files; a new
`e2e/decision-localization.spec.ts`; and a build-budget line.

Gates re-run by T0 on `f2060b8` with a clean tree: `lint` clean, `test` **907 passed / 120
files** (base 901), `build` clean at `Initial JavaScript: 422.6 / 425.0 KiB`.

### Independent measurement

T0's own probe, unrelated to the handoff's:

```
decisions    total=175  untouched=47
phases       total=275  untouched=0
explanations total=923  untouched=0
```

169 to 47, and the 47 reproduce exactly the set the handoff names. T0 read all 47: every one is
`min=B–C:2`, `4+-2<∞ ⇒ 2`, `low[F]=disc[F] ⇒ SCC 1`, `low[E]=4 ≥ disc[D]=4` — symbols,
bracketed identifiers and node names. **There is no English word in any of them.**

Criterion 3's residual token set, recomputed by T0 over every Turkish-locale decision string
across all 60, contains no English word: the only ASCII-alphabetic tokens are `DFS`, `SCC`,
`low`, `min`, `disc`, `Leaf`, and `code`, `data`, `design`, `plan`, `review`, `ship`, `test` —
the last seven being node names from the Topological Sort preset input, not vocabulary. The rest
are Turkish fragments split by the ASCII-only token pattern. Criterion 3 passes on T0's
measurement, and no word was added to the allowlist to make it pass.

Criterion 5 was re-run by T0 directly, not accepted from the handoff:

```
Running 2 tests using 2 workers
[1/2] [chromium] › e2e\decision-localization.spec.ts:49:1 › shows the Longest Increasing Subsequence decision in the rows view in both locales
[2/2] [chromium] › e2e\decision-localization.spec.ts:37:1 › shows the Binary Search decision in the array view in both locales
  2 passed (3.0s)
```

Criterion 6 holds by inspection of the diff: `TeachingHud` emits the same `<div className>` with
the same `role="status"`, the same `<strong>` and `<span>`, and its `if (!phase && !decision)
return null` is the old `(phase || decision) &&` guard moved inside. Graph and matrix output is
unchanged.

### Criterion 2 was self-contradictory, and the handoff was right to refuse it

**The route contradicted itself in writing.** Criterion 2 demanded `169 → 0`. The Decision
section, four paragraphs above it, said of the notation family: *"`low[F]=disc[F] ⇒ SCC 1` is
not English and must not be 'translated' into anything."* Both cannot hold. Satisfying criterion
2 literally would have required inventing a Turkish rendering of `4+-2<∞ ⇒ 2`, which is the
outcome the Decision section exists to forbid.

The route's own closing note anticipated this — *"if a criterion here turns out to be
unsatisfiable as written, say so in the handoff and satisfy what it was reaching for; that is a
route defect and will be recorded as one"* — and the implementer did exactly that: refused it,
named the contradiction, satisfied criterion 3 instead, and marked the handoff `status:
partial` rather than claiming a pass.

**Criterion 2 is hereby withdrawn and replaced by what it was reaching for:** every decision
string containing an English word is localized; a string that is pure notation is exempt.
Criterion 3 is the gate, as the route itself said. No `R28b`; there is no work left to do.

This is the **fifth consecutive turn whose defect is in the route, not the implementation**
(R25 rejected a signature it meant to keep, R26 named a vitest flag that does not exist, R27
specified a count the design cannot produce, R28 specified a count its own Decision section
forbids). The pattern is now specific enough to name: **T0 keeps writing a criterion as a number
when what it means is a property.** A number is checkable and therefore tempting; it is also a
prediction, and T0 has now been wrong about that prediction four times running. Criterion 3 of
this route — a residual set that must be empty — is the shape that worked. Prefer it.

### The route's other error

Half B told the implementer to *"use the markup and class names those two views already use for
`phase`"*. **`ArrayView` and `RowsView` do not render `phase` and never did.** T0 asserted a
render site it had not read; the sites it had actually measured were `GraphView` (:244),
`MatrixView` (:283) and `StringMatchView` (:351). The implementer reused the matrix HUD instead,
which is the right resolution, and disclosed the mismatch as deviation 3.

A consequence T0 accepts and defers rather than smuggling in: **the array and rows views still do
not display `phase`.** They now display `decision` and pass `phase={null}`. Widening them to show
the phase label is a behaviour change beyond this route's scope and belongs to its own turn.

### Deviations — all three accepted

1. **`scripts/check-build-size.mjs` initial-JS budget 420 → 425 KiB.** Accepted. The measured
   figure is 422.6 KiB and the 46 patterns are ~4.3 KiB of unavoidable string data; the base had
   1.7 KiB of headroom. Raising a budget to accommodate real growth is not the same as
   suppressing it, and the number is stated rather than hidden. **But the headroom is now 2.4
   KiB**, and `translations.ts` is the fastest-growing thing in the initial bundle. The next
   route that adds a comparable number of patterns will hit this wall and must not answer it by
   raising the budget again. Deferred below.
2. **Criterion 2**, resolved above.
3. **The route's false claim about `phase` in array/rows**, resolved above.

### Discovered, and what T0 does with it

1. **`titan-mode-failures.spec.ts:3` is not a flake.** It fails in roughly three of four
   full-suite runs and passes in isolation, and the implementer attributed it by *measurement* —
   a worktree at base `07aa7f3` with `node_modules` copied in, where the same test failed — then
   pruned the worktree. That is the right way to establish "pre-existing" and T0 accepts it
   without re-running. The standing rule was that a spec earns a route after failing twice in a
   row on one commit; three of four runs on two different commits clears that comfortably. **This
   becomes R29** and is no longer on flake watch.
2. **Two different string counts are both correct.** Globally distinct across the registry gives
   275 / 923 / 175; per-algorithm distinct, summed, gives 282 / 1063 / 220. R27 quoted 282 and
   R28 quoted 275 and neither said which it meant. `AGENTS.md` is corrected to say so. A route
   quoting a string count must name the counting rule.
3. **`AutoFitVisual` wraps a single child**, which is why the two views gained
   `visual-matrix-shell` rather than a bare sibling. Recorded as the reason, not as a preference.
4. **The six array/rows algorithms already leaked English into the Variables & Trace panel**
   through `VariablesPanel.tsx:50`, in the Turkish locale, before this turn. Half A fixed that as
   a side effect. Worth stating because it means the defect was larger than the visualizer.

### Still deferred

- Option B: `scoreTrace` is phase-blind; `mostSignificantIndex` returns 0 for 19 of 60. Needs an
  oracle before it needs code. `TracePhase.kind`'s lost `setup` value belongs to this route.
- Option C: no simulator emits a trace `event`; `eventWeight` is dead weight in every score.
- `ArrayView` and `RowsView` display `decision` but not `phase`.
- The initial-JS budget has 2.4 KiB of headroom and `translations.ts` is the growth vector.
  Whether the Turkish table can leave the initial bundle at all is an open question —
  `translateRuntimeText` is called synchronously during render, so lazy loading is not a
  drop-in. Answer that before the next translation sweep, not during one.
- `src/services/trace/traceQuery.ts` has no production consumer.
- `inputRequestAdapter.test.ts:31`'s name has described no production behaviour since R22.
- `titanEntry.ts:130` is the one engine caller outside `PipelineRunId`'s brand.
