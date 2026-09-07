# H32 — The Teaching Strip Four Views Never Got

## Turn

- route: `docs/titan/routes/R32-the-teaching-strip-four-views-never-got.md`
- base SHA: `007d732`
- end SHA: `a17fd5b60490538eba9b365ebcb43d811bcce098`
- status: `closed`
- next holder: Claude (T0)

## Özet

Dört görünüm — array, rows, bars, intervals — simülatörün hesapladığı faz etiketini
gizliyordu; artık dördü de mevcut `TeachingHud` üzerinden gösteriyor, kalıntı 350 → 0.
`StringMatchView` kendi elemanıyla bırakıldı, çünkü `TeachingHud`'a katmak kullanıcının
gördüğü çıktıyı (kenarlıklı kutu, 0.72rem → 0.68rem) değiştiriyordu.
Kriter 4 beş i18n satırını zorladı: Türkçe çıktıda İngilizce algoritma adı ve "heap" kalmıştı.

## What changed

| path:line-range | intent | kind |
|---|---|---|
| `src/components/DynamicVisualizer.tsx:112` | `ArrayView` passes the step's `phase` instead of `null` | edited |
| `src/components/DynamicVisualizer.tsx:379-386,395-396` | `BarView` wrapped in `visual-matrix-shell` with `TeachingHud` | edited |
| `src/components/DynamicVisualizer.tsx:400-410,425-432` | `IntervalView` wrapped in `visual-matrix-shell` with `TeachingHud`, both the empty-domain and populated returns | edited |
| `src/components/DynamicVisualizer.tsx:441` | `RowsView` passes the step's `phase` instead of `null` | edited |
| `src/i18n/translations.ts:1025-1030` | five phase replacements no longer leave an English algorithm name in Turkish output; `Selection/Bubble/Insertion Sort · initialize …` split from one `$1` capture into three explicit entries | edited |
| `src/i18n/translations.ts:1218` | `Heap Sort · restore heap property` → `yığın özelliğini geri kur` (was `heap özelliğini`) | edited |
| `src/components/DynamicVisualizer.test.tsx:132-155` | `PopulateBarIntervalPhaseTrace` fixture for the bar and interval phase strips | added |
| `src/components/DynamicVisualizer.test.tsx:281` | array hud assertion inverted: the phase is now expected, not forbidden | edited |
| `src/components/DynamicVisualizer.test.tsx:284` | rows hud asserts the phase label as well as the decision | added |
| `src/components/DynamicVisualizer.test.tsx:294-315` | new unit test: phase in the bar and interval views, both locales, including the empty-interval branch | added |
| `e2e/phase-teaching-strip.spec.ts:1-104` | four e2e tests, one per newly covered view, both locales, with a fit check against the auto-fit viewport | added |
| `e2e/decision-localization.spec.ts:24-36,44-46,56-58` | `advanceUntilVisible` → `advanceUntilDecision`: the hud is now visible from step 0 because it carries a phase, so "visible" no longer means "has a decision" | edited |

## Commits

```
a17fd5b route(R32): close
```

## Gate output

### `npm run lint`

```
> codexray@2.3.4 lint
> oxlint

LINT_EXIT=0
```

oxlint prints nothing on a clean run in this version; exit code 0.

### `npm run test`

```
> codexray@2.3.4 test
> vitest run


 RUN  v4.1.10 C:/Users/Administrator/Desktop/Projeler/CodeXray


 Test Files  121 passed (121)
      Tests  918 passed (918)
   Start at  00:15:18
   Duration  21.86s (transform 12.37s, setup 24.74s, import 20.16s, tests 47.46s, environment 163.73s)

TEST_EXIT=0
```

Unit test count before the turn: 917 (the route's figure). After: 918. Delta +1 — the new
`renders the phase in the bar and interval views in both locales`.

### `npm run build`

```
dist/assets/ExternalAiRoleSettings-qOHF5aMp.js         3.05 kB │ gzip:   1.16 kB
dist/assets/customSimulation-IVbKN6cg.js               3.34 kB │ gzip:   1.63 kB
dist/assets/trace-intelligence-DrV7YggB.js             3.76 kB │ gzip:   1.61 kB
dist/assets/questionTaxonomy-C6uQ6HHV.js               5.56 kB │ gzip:   2.39 kB
dist/assets/advancedStructureCompiler-ClK2p8X_.js      7.18 kB │ gzip:   2.99 kB
dist/assets/react-Biaal4sZ.js                          7.53 kB │ gzip:   2.88 kB
dist/assets/CodeEditor-0gpq3oi8.js                     8.20 kB │ gzip:   3.44 kB
dist/assets/TitanModeProgress-Dv6RIWaP.js              8.78 kB │ gzip:   2.98 kB
dist/assets/advancedGraphCompiler-Dz7FgaDp.js          9.62 kB │ gzip:   3.96 kB
dist/assets/webSource-ai9z2qhX.js                     10.71 kB │ gzip:   4.30 kB
dist/assets/algorithmInputs-BaWvEGyf.js               12.11 kB │ gzip:   4.05 kB
dist/assets/simulators-array-CSzOjdKb.js              13.39 kB │ gzip:   4.97 kB
dist/assets/PlaylistRadio-CH0Wwzxe.js                 14.92 kB │ gzip:   5.82 kB
dist/assets/webProblemOrchestrator-DrkeWceb.js        18.08 kB │ gzip:   6.56 kB
dist/assets/titanModeRouting-DRRmQoXy.js              21.29 kB │ gzip:   7.06 kB
dist/assets/simulators-compound-CVa0FkLT.js           26.68 kB │ gzip:   8.68 kB
dist/assets/DynamicVisualizer-B3dorMYk.js             30.17 kB │ gzip:   8.96 kB
dist/assets/simulators-graph-CEaCKz4x.js              36.19 kB │ gzip:  10.77 kB
dist/assets/AiAssistant-DEuluBt8.js                   43.93 kB │ gzip:  14.50 kB
dist/assets/customSimulationCompiler-YI85GfrF.js      44.31 kB │ gzip:  13.94 kB
dist/assets/recompileSimulationInput-rDSYxmwj.js      81.54 kB │ gzip:  23.50 kB
dist/assets/titanPipeline-Bea8oJCD.js                 93.22 kB │ gzip:  25.84 kB
dist/assets/index-Cl51QCF7.js                        432.96 kB │ gzip: 133.41 kB

✓ built in 413ms
Initial JavaScript: 422.8 / 425.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
BUILD_EXIT=0
```

Initial JS 422.6 → **422.8 / 425.0 KiB**. Headroom 2.4 → **2.2 KiB**. The +0.2 KiB is the
two net extra `runtimeReplacements` entries that criterion 4 forced (one `$1` capture split
into three explicit ones).

### `npm run test:e2e`

External-server procedure from `AGENTS.md`; `CODEXRAY_E2E_WORKERS` unset, so 2 workers.

```
  ok 87 [chromium] › e2e\web-problem-routing.spec.ts:3:1 › a fetched page cannot select the intent of a bound web solve (1.7s)

  87 passed (2.5m)

Running 2 tests using 1 worker

(node:34528) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
TIMELINE_MEASUREMENTS {"playwright":{"min":895.6441000000013,"median":940.03105,"max":1010.5626000000011},"inPage":{"min":165.30000001192093,"median":166.34999999403954,"max":168},"handler":{"min":0.40000003576278687,"median":0.8499999940395355,"max":1.300000011920929},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1465.1912000000002,"catalogMs":305.8096999999998,"simulationMs":80.63119999999981,"dpMs":2532.116000000002}
  ok 1 [chromium] › e2e\performance-budget.spec.ts:23:1 › keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets @performance (25.7s)
  ok 2 [chromium] › e2e\performance-budget.spec.ts:123:1 › survives repeated cross-subsystem use without stale state, overflow, or locked controls @performance (10.5s)

  2 passed (48.7s)
E2E_EXIT=0
```

e2e count before the turn: 82 + 2 = 84. After: 87 + 2 = 89 (+4 in
`phase-teaching-strip.spec.ts`; `scripts/run-e2e.mjs` splits `@performance` off, hence two
summary lines).

`npm run desktop:check` not run: `src-tauri/**` did not change (see `## Diff scope`).

### Verification greps

```
git diff --name-only "007d732..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$'
---1---
git diff --name-only "007d732..HEAD" | Select-String -Pattern 'src/services/(simulators|extended|compound|trace)'
---2---
git status --porcelain | Select-String -Pattern 'test-results|dist/|coverage/|probe'
---3---
```

All three printed nothing.

## Acceptance

**1. The per-view table above is reproduced on the base commit, all seven rows, pasted
verbatim, before any source change. The implementer's numbers govern the rest.**

Met. Measured on `d417263` (base plus the route commit only, no source change) with a
throwaway probe at the repository root, driving
`generateSimulationSteps(name, code, createInputPreset(getInputKindForAlgorithm(name), 0, name))`
over `algorithmRegistry.filter(a => a.isSupported)` and writing with `appendFileSync`:

```
view          algos  steps  stepsWithPhase  stepsWithDecision
array           15    170             170                 16
bars             1     14              14                  0
graph           27    783             783                191
intervals        1      6               6                  0
matrix           8    212             212                 77
rows             7    160             160                 32
string-match     6    198             198                  0

residual(hidden-phase steps in array|rows|bars|intervals) = 350
algorithms with at least one hidden phase label = 20
Binary Search
Bubble Sort
Counting Sort
Dutch National Flag
Fast Exponentiation (Modular)
Heap Sort
Insertion Sort
Kadane's Algorithm
Longest Increasing Subsequence
Merge Intervals
Merge Sort
Moore's Voting Algorithm
Prefix Sum Array
Quick Sort
Radix Sort
Selection Sort
Sliding Window Maximum
Ternary Search
Trapping Rain Water
Two Pointers Technique
```

Identical to the route's table row for row. The 20-algorithm figure the route asked to be
re-derived is confirmed, and the names are listed above.

**2. Residual, and it must be empty: no step that carries a `phase` may render in a view that
does not display one. Report the count on the base (T0 measures 350) and after.**

Met. Base 350, after **0**. The after-probe derives the "renders a phase" set from
`DynamicVisualizer.tsx` itself rather than from a hand-written list, then multiplies it against
the same 60-algorithm sweep:

```
views rendering a phase label = array, bars, graph, intervals, matrix, rows, string-match

view          algos  steps  stepsWithPhase  stepsWithDecision  phaseRendered
array           15    170             170                 16  yes
bars             1     14              14                  0  yes
graph           27    783             783                191  yes
intervals        1      6               6                  0  yes
matrix           8    212             212                 77  yes
rows             7    160             160                 32  yes
string-match     6    198             198                  0  yes

residual(steps carrying a phase in a view that does not display one) = 0
distinct phase strings across all 60 = 275, untouched by tr = 0

translated phase strings still containing an English token = 0
```

On screen: `e2e/phase-teaching-strip.spec.ts:89` asserts the strip for array, rows, bars and
intervals in the running application, production call sites
`src/components/DynamicVisualizer.tsx:112` (array), `:441` (rows), `:379` (bars), `:400`
(intervals).

**3. `decision` rendering is unchanged, all 316 decision-carrying steps still showing exactly
what they show today.**

Met. The `decision` prop expression is byte-identical in all four edited views and
`TeachingHud` was not touched. The after-probe's `stepsWithDecision` column is identical to the
base's in every row (16 / 0 / 191 / 0 / 77 / 32 / 0, total 316).
`e2e/decision-localization.spec.ts:39` and `:52` still assert the same decision strings in both
locales and pass.

One test-side change, not a rendering change: `advanceUntilVisible` stepped until the hud became
*visible*, which used to imply "has a decision" because array and rows huds rendered nothing
without one. With a phase present the hud is visible from step 0, so the helper is now
`advanceUntilDecision` and steps until the decision text appears. This restates the helper's
original intent; the assertions it feeds are unchanged.

**4. The Turkish output carries no English word in the new strips. Report the residual English
token set.**

Met, but only after five i18n corrections — this criterion did force entries, and criterion 7's
escape clause is exercised below.

Residual on the base, over the 78 distinct phase strings reaching the four newly-covered views,
after `translateRuntimeText(…, 'tr')` — 0 strings were left untouched, but **7 still carried an
English token**:

```
Bubble Sort · başlangıç
Heap Sort · heap görünümünü başlat
Insertion Sort · başlangıç
Quick Sort · temel durum aralığı
Radix Sort · basamak kovalarını başlat
Selection Sort · başlangıç
Yığın Sıralaması · heap özelliğini geri kur
```

Residual English token set on the base: `{Bubble Sort, Heap Sort, Insertion Sort, Quick Sort,
Radix Sort, Selection Sort, heap}`. Five `runtimeReplacements` rows produced these — four that
hard-coded the English algorithm name in their Turkish replacement, and one `$1` capture that
carried the English name through by construction.

After the fix, the token scan over **all 275** distinct phase strings in the registry (not just
the 78) reports `translated phase strings still containing an English token = 0`.

Residual token set after the turn: `{}` — with two deliberate exemptions under R28's notation
rule, both loanwords standard in Turkish technical writing and neither touched by this turn:
`pivot` (`Hızlı Sıralama · pivot aralığını seç`, `Üçlü Arama · iki pivotu incele`) and `bit`
(`Modüler Üs · üs bitini tüket`).

`e2e/phase-teaching-strip.spec.ts:100` asserts the negative in the browser: after switching to
Turkish, the hud must not contain `Rain Water|Start|fill|boundary|complete` and the equivalent
for the other three views.

**5. No new teaching-strip implementation. `TeachingHud` is the only component rendering this
strip after the route, except `StringMatchView` if criterion 6 leaves it alone.**

Met. No component was added. `grep -n "TeachingHud" src/components/DynamicVisualizer.tsx` yields
one definition at `:93` and six call sites (`:110` array, `:263` graph, `:297` matrix, `:379`
bars, `:400` intervals, `:441` rows). `string-phase` remains the only other phase-rendering
element, at `:363`, per criterion 6.

**6. `StringMatchView` is either folded into `TeachingHud` with equivalent user-visible output,
or explicitly left, and the handoff says which and why.**

Met — **explicitly left**, and here is why.

The route set R28's standard: byte-identical rendered output. `TeachingHud` renders
`<div class="…" role="status"><strong>…</strong></div>`; `StringMatchView` renders a bare
`<strong class="string-phase" role="status">`. The two CSS rules are not equivalent:

```
.string-phase        { align-self: center; color: var(--neon-cyan); font: 0.72rem var(--font-mono); text-transform: uppercase; }
.matrix-teaching-hud { display: flex; max-width: 680px; flex-direction: column; gap: 2px; padding: 5px 10px;
                       text-align: center; background: rgba(4, 8, 19, 0.88);
                       border: 1px solid rgba(0, 243, 255, 0.34); border-radius: 7px; }
.matrix-teaching-hud strong { color: var(--neon-cyan); font: 0.68rem var(--font-mono); text-transform: uppercase; }
```

Folding it in would add a bordered, filled box and shrink the type from 0.72rem to 0.68rem — a
visible change for the 198 string-match steps, on six algorithms, none of which carries a
`decision` and so none of which gains anything from the second slot. Writing a third CSS variant
to keep the old look would be inventing spacing the route forbids. A second implementation that
is correct beats a unified one that regresses, so it stays.

**7. No simulator, no trace, and no i18n table entry changed unless criterion 4 forces one, in
which case say so and report the initial-JS figure against the 425.0 KiB budget.**

Met, with the i18n escape clause exercised and declared.

No simulator and no trace file changed:

```
git diff --name-only "007d732..HEAD" | Select-String -Pattern 'src/services/(simulators|extended|compound|trace)'
---2---
```

printed nothing.

`src/i18n/translations.ts` **did** change, forced by criterion 4: six replacement rows
(`:1025`, `:1026`, `:1027`, the `$1` row at `:1028` split into three, and `:1218`). Net +2 rows.
Initial JS **422.8 / 425.0 KiB**, up from the recorded 422.6; headroom 2.4 → 2.2 KiB.

**8. `lint`, `test`, `build` clean, with the unit test count stated against the base's 917 and
the initial-JS figure against 425.0 KiB.**

Met. All three exit 0, output pasted verbatim in `## Gate output`. Unit tests 917 → **918**.
Initial JS **422.8 / 425.0 KiB**.

**9. This is a user-visible criterion and cannot close on a unit test. Show the strip in the
running application for at least one algorithm per newly-covered view — array, rows, bars,
intervals — in both locales, and show that the visualization itself did not move or clip.**

Met by `e2e/phase-teaching-strip.spec.ts`, four tests, all passing in the full-suite run above:

- array — Binary Search, `.visual-array`
- rows — Longest Increasing Subsequence, `.rows-view`
- bars — Trapping Rain Water, `.bar-view`
- intervals — Merge Intervals, `.interval-view`

Each test steps the timeline until the hud shows this algorithm's English phase, asserts exactly
one `<strong>` in the hud, then switches the UI to Turkish and asserts the Turkish phase and the
absence of the English tokens. Every assertion is a **presence** assertion on a locator the test
has already awaited into a positive state, so `AGENTS.md`'s mount-race warning does not apply;
the one negative (`not.toHaveText`) runs only after a positive `toHaveText` on the same locator
has resolved.

Clip check: `expectFits` reads the `boundingBox()` of the visualization element and of its
enclosing `.visual-auto-fit-viewport`, and asserts the visual's width, height, x and y stay
inside the viewport's (1 px tolerance), in both locales, after the strip was added. No view
needed the strip shrunk and none pushed the visualization out of its panel.

Production call sites: `src/components/DynamicVisualizer.tsx:112`, `:441`, `:379`, `:400`.

## Diff scope

```
 .../R32-the-teaching-strip-four-views-never-got.md | 174 +++++++++++++++++++++
 e2e/decision-localization.spec.ts                  |  18 ++-
 e2e/phase-teaching-strip.spec.ts                   | 104 ++++++++++++
 src/components/DynamicVisualizer.test.tsx          |  52 +++++-
 src/components/DynamicVisualizer.tsx               |  32 +++-
 src/i18n/translations.ts                           |  12 +-
 6 files changed, 372 insertions(+), 20 deletions(-)
```

(The route file is T0's own `route(R32): open` commit, inside the range.)

## Deviations

Three files outside `## Expected Files`. The forecast named
`src/components/DynamicVisualizer.tsx`, a stylesheet, and one e2e spec.

| path | why |
|---|---|
| `src/i18n/translations.ts` | Criterion 4. Seven of the 78 phase strings newly reaching the strip still carried an English algorithm name or `heap` after `translateRuntimeText`. The route names this case explicitly and requires the initial-JS figure, reported under criterion 7. |
| `src/components/DynamicVisualizer.test.tsx` | Criterion 2 broke an existing assertion that encoded the defect — `expect(arrayHud).not.toHaveTextContent('Binary Search · inspect midpoint')` at `:258`. Left alone, `npm run test` would fail on the very behaviour the route requires. The new unit test for the bar and interval strips lives in the same file. |
| `e2e/decision-localization.spec.ts` | Criterion 3. Its `advanceUntilVisible` helper stepped until the hud became visible, which was only equivalent to "has a decision" while array and rows rendered nothing without one. Two of its tests failed in the first full e2e run for this reason; the helper now steps until the decision text is present. No assertion changed. |

No stylesheet change was needed: `BarView` and `IntervalView` reuse the existing
`visual-matrix-shell` / `matrix-teaching-hud` rules verbatim, which is what the route asked for.

## Discovered

1. **The English residual was in `runtimeReplacements`, not missing from it.** All 275 phase
   strings already had an entry — `untouched by tr = 0` on the base. Five entries were simply
   written with the English algorithm name kept in the Turkish replacement, one of them through a
   `$1` capture that made it structural. `AGENTS.md`'s "phases `total=275 untouched=0`" is true
   and was not sufficient: *changed* and *Turkish* are different measurements, which is the same
   distinction R28 recorded for `decision` and the route restated for this turn. A future sweep
   should measure the residual token set, never the untouched count.

2. **275 confirmed as the globally-distinct phase count.** The independent sweep in this turn
   reproduces `AGENTS.md`'s figure exactly, on the global rule (not the per-algorithm sum of 282).

3. **`IntervalView` has two returns.** Its empty-domain early return at `:407` would have kept
   hiding the phase if only the populated return were wrapped. Both are wrapped, and the unit
   test at `DynamicVisualizer.test.tsx:308` covers the empty branch specifically.

4. **`Insertion Sort` has two Turkish names in the table.** The name registry at
   `translations.ts:802` says `Eklemeli Sıralama`; every phase row says `Ekleme Sıralaması`. The
   new entry follows the phase family for consistency inside the strip. Not reconciled — out of
   scope for this route, and worth a decision.

## Untouched

```
git diff --name-only "007d732..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$'
```

printed nothing. The three untracked frozen paths reported by `git status` (`.claude/`,
`CodeXray-readme-neon.svg`, `docs/TITAN_MODE_YOL_HARITASI.md`) were present before the turn and
were neither staged nor modified.

The working tree carries no `test-results/`, `dist/`, `coverage/` or probe file: the throwaway
measurement file was written to the repository root only because vitest rejects test files
outside the project root, and both it and its output file were deleted before the close commit.

## Blockers

None.

## For the human

1. `AGENTS.md:325` says array and rows "display the decision and still do not display the phase
   label". That is now false for all four views; T0 owns the file. Suggested replacement fact:
   `TeachingHud` renders the phase and decision for graph, matrix, array, rows, bars and
   intervals; `StringMatchView` keeps its own `string-phase` element deliberately, because
   folding it in would change 0.72rem uppercase text into a 0.68rem bordered box.
2. Initial-JS headroom is now **2.2 KiB**, not 2.4.
3. `Insertion Sort` translates as `Eklemeli Sıralama` in the name registry and
   `Ekleme Sıralaması` in every phase string. One of the two should win.
