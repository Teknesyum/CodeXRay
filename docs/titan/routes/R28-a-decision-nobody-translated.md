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
