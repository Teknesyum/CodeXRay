# R32 — The Teaching Strip Four Views Never Got

## Turn.base

`007d732`

```powershell
git merge-base --is-ancestor 007d732 HEAD
git diff --name-only "007d732..HEAD"
```

The first must exit 0. The second must list only T0-owned paths.

## Why

Every one of the 60 supported simulators labels every step with `visualData.vars.phase` — that
is R27's measurement and `AGENTS.md` records it. R28 built `TeachingHud` in
`DynamicVisualizer.tsx:93` to render that label beside the step's `decision`, and wired it into
`GraphView` and `MatrixView`.

It was never wired into the rest. `ArrayView:112` and `RowsView:417` pass `phase={null}`
explicitly. `BarView:376` and `IntervalView:391` render no teaching strip at all.
`StringMatchView:361` renders the phase through its own bespoke `<strong className="string-phase">`
and has no decision line.

So a user watching Quick Sort, Kadane's Algorithm or Trapping Rain Water sees a visualization
whose simulator computed a phase label for every single step and displays none of it, while a
user watching Dijkstra sees the label on every step. The data is produced, carried through
`RawTrace`, grouped into phases, shown to the model — and dropped at the last component.

`AGENTS.md` has carried this as deferred since R28. It is the last of the R27/R28 phase work.

## The measurement

T0 ran every supported algorithm on preset 0 and counted, per visual type, how many steps carry
a `phase` and a `decision`:

```
view          algos  steps  stepsWithPhase  stepsWithDecision
array            15    170             170                 16
bars              1     14              14                  0
graph            27    783             783                191
intervals         1      6               6                  0
matrix            8    212             212                 77
rows              7    160             160                 32
string-match      6    198             198                  0
```

Cross-referenced against what each view actually renders today:

| view | phase rendered | decision rendered | steps whose phase is hidden |
|---|---|---|---|
| `graph` | yes (`TeachingHud`) | yes | 0 |
| `matrix` | yes (`TeachingHud`) | yes | 0 |
| `string-match` | yes (own element) | no — and none carry one | 0 |
| `array` | **no** | yes | **170** |
| `rows` | **no** | yes | **160** |
| `bars` | **no** | no — none carry one | **14** |
| `intervals` | **no** | no — none carry one | **6** |

**350 steps hide a phase label their simulator computed.** Some algorithms use more than one
view, so the unique count is 20 of the 60 algorithms with at least one hidden phase label —
verify that number yourself rather than taking it from here.

The decision side is already complete: every step that carries a `decision` is in a view that
renders one. This route is about `phase` only.

## Decision

Render the phase label in the four views that hide it.

`ArrayView` and `RowsView` are the easy half — both already wrap themselves in
`visual-matrix-shell` and already render `TeachingHud` with `className="matrix-teaching-hud"`.
Passing the phase through is the same two lines `MatrixView:291` already has. There is no known
reason for the `phase={null}`; R28 believed these views already rendered it, which was that
route's own defect, recorded in its reconciliation.

`BarView` and `IntervalView` have no shell and no hud. Give them one the same way R28 gave
`ArrayView` one, and reuse `TeachingHud` — **do not write a third teaching-strip
implementation.** `AutoFitVisual` wraps a single child, which is why a wrapper element rather
than a fragment is required; R28 hit exactly this.

`StringMatchView` is the judgement call. It renders the phase already, through its own element
and its own CSS class, and it works. Fold it into `TeachingHud` **only if** the rendered output
stays equivalent for a user — R28 held `GraphView` and `MatrixView` to byte-identical output
when it extracted the component, and that is the standard here. If folding it in changes what
the user sees, leave it alone and say so; a second implementation that is correct beats a
unified one that regresses.

**Do not invent spacing, colors or sizes.** `teknesyum-ui` is not installed in this repository;
reuse the existing `matrix-teaching-hud` / `visual-matrix-shell` rules. If a view genuinely
cannot fit the strip without pushing the visualization out of its panel, that is a finding —
report it with a screenshot or a measured height, do not shrink type to make it fit.

**Every string reaching the strip goes through `translateRuntimeText`.** `TeachingHud` already
does this. The Turkish coverage of the phase family is complete (`AGENTS.md`: phases
`total=275 untouched=0`), so no new entry in `runtimeReplacements` should be needed — if the
implementer finds one that is needed, that is a finding worth stating, and note that the
initial-JS budget has only 2.4 KiB of headroom.

## Criteria

1. **The per-view table above is reproduced on the base commit**, all seven rows, pasted
   verbatim, before any source change. The implementer's numbers govern the rest.

2. **Residual, and it must be empty: no step that carries a `phase` may render in a view that
   does not display one.** Report the count on the base (T0 measures 350) and after. Unlike
   R31's criterion 2, the mechanism and the observable are the same thing here — a label is on
   screen or it is not — so this residual is a claim about what a user sees.

3. **`decision` rendering is unchanged**, all 316 decision-carrying steps still showing exactly
   what they show today. This route adds a line; it does not touch the one that works.

4. **The Turkish output carries no English word in the new strips.** Same gate R28 used, which
   is stronger than "the string changed": exercise a Turkish-locale run over the affected views
   and report the residual English token set. Pure notation is exempt, as R28 established — do
   not "translate" notation.

5. **No new teaching-strip implementation.** `TeachingHud` is the only component rendering this
   strip after the route, except `StringMatchView` if criterion 6 leaves it alone.

6. **`StringMatchView` is either folded into `TeachingHud` with equivalent user-visible output,
   or explicitly left**, and the handoff says which and why. Both close this criterion; silence
   does not.

7. **No simulator, no trace, and no i18n table entry changed** unless criterion 4 forces one, in
   which case say so and report the initial-JS figure against the 425.0 KiB budget.

8. `lint`, `test`, `build` clean, with the unit test count stated against the base's 917 and the
   initial-JS figure against 425.0 KiB.

9. **This is a user-visible criterion and cannot close on a unit test.** Show the strip in the
   running application for at least one algorithm per newly-covered view — array, rows, bars,
   intervals — in both locales, and show that the visualization itself did not move or clip. An
   e2e assertion that something is *present* is fine; if you write an absence assertion,
   `AGENTS.md`'s mount-race warning applies and you must await a positive count first.

## Expected Files

A forecast, not a gate.

- `src/components/DynamicVisualizer.tsx`
- `src/index.css` or the stylesheet carrying `matrix-teaching-hud`
- `e2e/` — one spec for criterion 9

## Verification

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e
git diff --name-only "007d732..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$'
git diff --name-only "007d732..HEAD" | Select-String -Pattern 'src/services/(simulators|extended|compound|trace)'
git status --porcelain | Select-String -Pattern 'test-results|dist/|coverage/|probe'
```

The last three must print nothing. e2e defaults to 2 workers with no environment variable since
R30; use the external-server procedure in `AGENTS.md`, clean up only the PIDs this run created,
delete `test-results/` before finishing, and leave no probe file in the tree.

## Still deferred after this route

- `AiAssistant.tsx:857` persists before the dismissed guard, making `:1462`'s removal and
  `:1455`'s sanitize map unreachable.
- `eventWeight` contributes nothing to any of the 936 phases because no registry simulator emits
  a trace `event`. Deleting it requires first establishing whether `customSimulationCompiler.ts`
  can emit events.
- The three e2e specs at 3–4x the suite median: `accessibility-axe.spec.ts:37` 9.9 s,
  `ai-actions.spec.ts:112` 12.5 s, `radio-controller.spec.ts:3` 8.1 s.
- Initial-JS budget: 2.4 KiB of headroom, `translations.ts` the growth vector.
- `src/services/trace/traceQuery.ts` has no production consumer.
- `inputRequestAdapter.test.ts:31`'s name has described no production behaviour since R22.
- `titanEntry.ts:130` is the one engine caller outside `PipelineRunId`'s brand.
