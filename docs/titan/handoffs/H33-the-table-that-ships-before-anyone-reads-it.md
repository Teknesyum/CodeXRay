# H33 — The Table That Ships Before Anyone Reads It

## Turn

- route: `docs/titan/routes/R33-the-table-that-ships-before-anyone-reads-it.md`
- base SHA: `f975c56`
- end SHA: `7efe377476770203acaf8858826bb4d67687f048`
- status: `closed`
- next holder: Claude (T0)

## Özet

750 satırlık `runtimeReplacements` tablosu kendi lazy parçasına taşındı; başlangıç JS
422.8 → 358.9 KiB, bütçe 425 → 376 KiB'ye **indirildi**. Şekil (a) seçildi: provider
`tr`'de tablo gelene kadar `children` tutuyor, İngilizce parlaması yok.
`translateRuntimeText` yüklenmemiş `tr` çağrısında sessizce İngilizce dönmek yerine throw
ediyor; `Insertion Sort` artık her yerde `Eklemeli Sıralama`.

## What changed

| path:line-range | intent | kind |
|---|---|---|
| `src/i18n/runtimeReplacements.ts:1-753` | the 750-entry table moved out of `translations.ts` into its own module; five `Ekleme Sıralaması` rows became `Eklemeli Sıralama` | added |
| `src/i18n/translations.ts:825-854` | `isRuntimeTextReady`, `loadRuntimeText` (single promise, reset on failure), `translateRuntimeText` throws for an unloaded `tr` | edited |
| `src/i18n/translations.ts:825-1577` | the table removed from the initial module | deleted |
| `src/context/TimelineContext.tsx:470-493` | `setLocale` loads the table before switching; an effect loads it for the persisted locale | edited |
| `src/context/TimelineContext.tsx:822` | provider withholds `children` until `runtimeTextReady` | edited |
| `src/test/setup.ts:5,8` | `await loadRuntimeText('tr')` preload so no unit test passes on an English-equals-English comparison | edited |
| `vite.config.ts:32` | `runtime-replacements` codeSplitting group | edited |
| `scripts/check-build-size.mjs:7` | `initialJavaScript` 425 → 376 KiB | edited |
| `src/i18n/runtimeText.test.ts:13,21,33` | three tests: English without the table, refusal before load, single import | added |
| `src/context/TimelineContext.runtimeText.test.tsx:20,42` | two tests: children withheld in `tr` until loaded; rendered immediately in `en` | added |
| `e2e/runtime-text-first-paint.spec.ts:11,31` | two tests: first Turkish hud with no step navigation; `en → tr` switch without rerunning | added |

## Commits

```
7efe377 route(R33): close
```

## Gate output

Re-run by T0 on `7efe377` (protocol requirement 4), not copied from the turn.

### `npm run lint`

```
> codexray@2.3.4 lint
> oxlint

lint exit 0
```

### `npm run test`

```
 Test Files  123 passed (123)
      Tests  923 passed (923)
   Start at  18:07:44
   Duration  21.53s (transform 20.62s, setup 29.05s, import 25.26s, tests 46.52s, environment 177.58s)

test exit 0
```

Unit count before the turn: **918 / 121 files** (R33's base figure). After: **923 / 123 files**.
Delta **+5** — 3 in `runtimeText.test.ts`, 2 in `TimelineContext.runtimeText.test.tsx`.

### `npm run build`

```
dist/assets/DynamicVisualizer-CBQmH5Yg.js             30.17 kB │ gzip:   8.96 kB
dist/assets/simulators-graph-CEaCKz4x.js              36.19 kB │ gzip:  10.77 kB
dist/assets/AiAssistant-obLjn6OA.js                   43.92 kB │ gzip:  14.49 kB
dist/assets/customSimulationCompiler-YI85GfrF.js      44.31 kB │ gzip:  13.94 kB
dist/assets/runtime-replacements-D5dbM4BF.js          66.21 kB │ gzip:  19.87 kB
dist/assets/recompileSimulationInput-rDSYxmwj.js      81.54 kB │ gzip:  23.50 kB
dist/assets/titanPipeline-C6AspXv4.js                 93.22 kB │ gzip:  25.85 kB
dist/assets/index-Cv6Mz1gx.js                        367.53 kB │ gzip: 114.46 kB

✓ built in 480ms
Initial JavaScript: 358.9 / 376.0 KiB
Lazy JavaScript: 34 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
build exit 0
```

### `npm run test:e2e`

External-server procedure from `AGENTS.md`; `CODEXRAY_E2E_WORKERS` unset, so 2 workers, and
`scripts/run-e2e.mjs` splits the run into 89 + 2.

```
  ok 89 [chromium] › e2e\web-problem-routing.spec.ts:3:1 › a fetched page cannot select the intent of a bound web solve (1.7s)

  89 passed (2.6m)

Running 2 tests using 1 worker

PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1602.203,"catalogMs":302.39350000000013,"simulationMs":81.57379999999966,"dpMs":2477.696100000001}
  ok 1 [chromium] › e2e\performance-budget.spec.ts:23:1 › keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets @performance (24.7s)
  ok 2 [chromium] › e2e\performance-budget.spec.ts:123:1 › survives repeated cross-subsystem use without stale state, overflow, or locked controls @performance (9.0s)

  2 passed (34.9s)
e2e exit 0
```

e2e count before the turn: **87 + 2**. After: **89 + 2**. Delta +2, both in
`runtime-text-first-paint.spec.ts`.

`desktop:check` not run: `src-tauri/**` unchanged in `f975c56..HEAD` (see `## Diff scope`).

## Acceptance

**1. Base measurement reproduced before any source change**: the `Initial JavaScript` line from
`npm run build`, the table's entry count and byte span, and the modules through which
`translations.ts` reaches the initial chunk.

Met. Base `Initial JavaScript: 422.8 / 425.0 KiB`; table 750 rows / 69 177 bytes at
`translations.ts:825-1577`; reaching the initial chunk through `src/App.tsx:7` (`ControlBar`)
and `src/App.tsx:8` (`VariablesPanel`).

**2. The table is not in the initial chunk.** Proven on `dist/`.

Met.

```
PS> Select-String -Path dist/assets/index-*.js -Pattern 'orta ve sağ üçte birler elenir' | Measure-Object | Select-Object -ExpandProperty Count
0
PS> (Select-String -Path dist/assets/*.js -Pattern 'orta ve sağ üçte birler elenir').Filename | Select-Object -Unique
runtime-replacements-D5dbM4BF.js
```

**3. Initial JS drops by at least 40 KiB** from the base figure, and the budget constant is
lowered to the new figure rounded up to 8 KiB plus 16 KiB.

Met. 422.8 → **358.9 KiB**, drop **63.9 KiB**. 358.9 → next 8 KiB is 360, plus 16 = **376 KiB**,
written at `scripts/check-build-size.mjs:7`. No other budget constant changed; that file's diff
in `7efe377` is one line.

**4. A `tr` session's first painted hud is Turkish**, before any step navigation.

Met. `e2e/runtime-text-first-paint.spec.ts:11` — positive assertion
(`/İkili Arama · (etkin aralığı başlat|orta noktayı incele|tamamlandı)/`) then the negative
(`not.toHaveText(/Binary Search|initialize|inspect|complete/)`), no step navigation between.
Production wait site: `src/context/TimelineContext.tsx:822`.

**5. Switching `en → tr` at runtime still updates existing steps without rerunning them**, and the
existing residual gates pass with no assertion loosened.

Met. The switch spec is `e2e/runtime-text-first-paint.spec.ts:31` — it captures `.visual-array`
text before the switch and asserts it is byte-identical after, while the hud goes
`Insertion Sort · …` → `Eklemeli Sıralama · …`. Production call site:
`src/context/TimelineContext.tsx:481` (`setLocale` loads, then switches).
`phase-teaching-strip.spec.ts` (4) and `decision-localization.spec.ts` (2) pass unchanged; the
`f975c56..HEAD` diff touches neither file.

**6. The wait has a measured cost.** `startupMs` on the base and after, spec still passes.

Met. Shape **(a)** from `## Yours to judge` was chosen: the provider withholds children until the
table is loaded. `e2e/performance-budget.spec.ts:23` `startupMs`: base **2769 ms**, after
**1602 ms** on this re-run. The turn's own run recorded 3909 / 2575 / 12495 on a noisy machine;
both are reported, and the spec's own budget is what gates. The `tr` first-paint measurement from
the new spec: `TR_STARTUP_MEASUREMENT {"startupMs":494.5066999999981}`.

**7. One loader.** Exactly one production `import()` of the table, not in a component that renders
trace text; `translateRuntimeText` production call-site count 29 before and 29 after.

Met.

```
PS> Get-ChildItem -Recurse src -Include *.ts,*.tsx | Select-String 'import\(' | Select-String 'runtimeReplacements'
src\i18n\translations.ts:835:  runtimeReplacementsLoad ??= import('./runtimeReplacements')
PS> (Get-ChildItem -Recurse src -Include *.ts,*.tsx | Select-String 'translateRuntimeText\(' | Where-Object { $_.Path -notmatch 'test' }).Count
29
```

**8. No unit test passes by accident.**

Met. `src/test/setup.ts:8` preloads the table for every unit test, so no test can compare an
English input against an English output by accident. `src/i18n/runtimeText.test.ts:13` asserts the
not-loaded behaviour directly: English is served without the table and Turkish **throws** rather
than silently returning English.

**9. `Insertion Sort` is `Eklemeli Sıralama` everywhere**, and the 275-string residual sweep still
reports 0.

Met.

```
PS> (Get-ChildItem -Recurse src | Select-String 'Ekleme Sıralaması').Count
0
```

Residual sweep, run the way H32 ran it (probe over all 60 supported algorithms, distinct
`visualData.vars.phase` strings, `translateRuntimeText(…, 'tr')`):

```
distinct phase strings across all 60 = 275
untouched by tr = 0
translated phase strings still containing an English token = 36
residual tokens = ["Bellman","Boyer","Dijkstra","Dinic","Edmonds","Euler","Floyd","Ford","Hamilton","Hopcroft","Johnson","KMP","Kadane","Karp","Kosaraju","Kruskal","LCA","LCS","LPS","Manacher","Minimum","Moore","Prim","Rabin","Tarjan","Trie","Warshall","hash","inorder","link","minimum","per","pivot","postorder","preorder","terminal"]
phase strings rendering "Ekleme Sıralaması" = 0
phase strings rendering "Eklemeli Sıralama" = 5
```

**Read this honestly.** The 36 are not English words left standing: 27 are proper names or
acronyms (`Dijkstra`, `KMP`, `LCS`, …), and the remaining 9 (`hash`, `inorder`, `link`,
`minimum`/`Minimum`, `per`, `pivot`, `postorder`, `preorder`, `terminal`) are the loanword and
traversal-name class `AGENTS.md` declares is not residue. H32's probe reported 0 for the same
corpus because its identifier whitelist enumerated these; this probe used the narrower whitelist
from `translations.test.ts:75`, so the difference is the whitelist, not the output. The
English-word residual is **0**. The probe was moved to `trash/probe-phase-residual.test.ts` and is
not in the source tree.

**10. No simulator, no trace, no i18n entry changed** except the five Insertion Sort rows and the
module split.

Met. The `src/services/(simulators|extended|compound|trace)` filter over the base range prints
nothing (see `## Untouched`). `translations.ts`'s authored `t()` keys are untouched: that file's
diff is the table deletion plus the loader.

**11.** `lint`, `test`, `build`, `test:e2e` clean; unit count against 918, e2e against 87 + 2.

Met. All four exit 0. Unit 918 → **923** (+5). e2e 87 + 2 → **89 + 2** (+2). See `## Gate output`.

**12. Close as two commits:** `route(R33): close`, then `handoff(H33): record`.

Met. `7efe377 route(R33): close`; this file is the second.

## Diff scope

```
 AGENTS.md                                          |  18 +-
 CHANGELOG.md                                       | 127 ++++
 README.md                                          |  64 +-
 README.tr.md                                       | 291 ++++++++
 assets/badge-lang.svg                              |  14 +
 assets/badge-lang.tr.svg                           |  14 +
 assets/badge-license.svg                           |  20 +
 assets/badge-sponsor.svg                           |  20 +
 docs/github-denetim-2026-09-08.md                  |   8 +
 ...-the-table-that-ships-before-anyone-reads-it.md | 238 +++++++
 e2e/runtime-text-first-paint.spec.ts               |  54 ++
 package.json                                       |   1 -
 scripts/check-build-size.mjs                       |   2 +-
 src/context/TimelineContext.runtimeText.test.tsx   |  71 ++
 src/context/TimelineContext.tsx                    |  26 +-
 src/i18n/runtimeReplacements.ts                    | 753 ++++++++++++++++++++
 src/i18n/runtimeText.test.ts                       |  38 +
 src/i18n/translations.ts                           | 776 +--------------------
 src/test/setup.ts                                  |   3 +
 {scripts => trash}/publish-to-site.mjs             |   0
 vite.config.ts                                     |   1 +
 21 files changed, 1739 insertions(+), 800 deletions(-)
```

The R33 close commit itself is 9 files:

```
 e2e/runtime-text-first-paint.spec.ts             |  54 ++
 scripts/check-build-size.mjs                     |   2 +-
 src/context/TimelineContext.runtimeText.test.tsx |  71 +++
 src/context/TimelineContext.tsx                  |  26 +-
 src/i18n/runtimeReplacements.ts                  | 753 ++++++++++++++++++++
 src/i18n/runtimeText.test.ts                     |  38 ++
 src/i18n/translations.ts                         | 776 +----------------------
 src/test/setup.ts                                |   3 +
 vite.config.ts                                   |   1 +
```

## Deviations

- **The base range carries a commit that is not R33's.** `f975c56..HEAD` contains
  `71b09b3 docs: point clone URLs at Teknesyum…`, a human commit (README / README.tr / CHANGELOG /
  badges / `AGENTS.md` / `package.json` / `scripts/publish-to-site.mjs → trash/`), landed between
  `d78f109 route(R33): open` and the close, and R33 was rebased onto it. Every file outside
  `## Expected Files` in the diff scope above belongs to that commit, not to R33. The route's own
  9 files are listed separately above and all 9 are inside the forecast.
- `AGENTS.md` therefore appears in the base-range diff even though it is a T0-owned path. It was
  written by the human in `71b09b3`, not by the turn; the R33 close commit does not touch it.
  Verified in `## Untouched`.
- `src/components/VariablesPanel.tsx`, `ControlBar.tsx`, `DynamicVisualizer.tsx` are in the
  forecast but were **not** written, because shape (a) was chosen — the wait lives in the provider,
  not at each surface. `src/i18n/translations.test.ts` was likewise not edited; the preload went to
  `src/test/setup.ts` instead, which covers every test file rather than one.
- Stop hook reported 1277 `teknesyum-ui` violations, all in files predating the turn; 0 in the
  files this turn touched. Out of scope.

## Discovered

- The `tr` first-paint cost is much smaller than the `@performance` `startupMs` suggests: 494 ms
  to a visible `main` in a persisted-`tr` session, against a 1602 ms `en` startup measurement that
  also covers catalog and simulation setup. The chunk fetch is not the dominant term.
- `translations.test.ts:75`'s `mathematicalIdentifiers` whitelist is narrower than the one H32's
  probe used, so a phase-string residual probe reports 36 tokens where H32 reported 0 on the same
  corpus. Neither number is wrong; the sweeps are not comparable unless the whitelist is stated.
  A future route that wants a committed phase-residual test must first pick one whitelist.
- `scripts/publish-to-site.mjs` was moved to `trash/` by `71b09b3` while `AGENTS.md`'s
  `## Deployment` section still described it as live. `package.json`'s script entry was removed in
  the same commit; the `AGENTS.md` prose was reconciled by T0 after this handoff.

## Untouched

```
PS> git diff --name-only "f975c56..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$|^docs/titan/ROADMAP\.md$'
AGENTS.md
PS> git show --name-only --format= 7efe377 | Select-String -Pattern '^\.claude/|^\.agents/|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$|^docs/titan/ROADMAP\.md$'
PS> git diff --name-only "f975c56..HEAD" | Select-String -Pattern 'src/services/(simulators|extended|compound|trace)'
PS> git status --porcelain | Select-String -Pattern 'test-results|dist/|coverage/|probe'
?? trash/probe-phase-residual.test.ts
```

The single `AGENTS.md` hit is the human commit `71b09b3`; the R33 close commit's own file list is
clean, which the second command shows by printing nothing. The `probe` hit is the retired probe in
`trash/`, outside the source tree; `test-results/` was deleted and `dist/` is ignored.

## Blockers

None. `## Discovered` item 2 (the residual whitelist) is a route-sizing question, not a gate.

## For the human

1. `git status` still shows `.claude/`, `CodeXray-readme-neon.svg` and
   `docs/TITAN_MODE_YOL_HARITASI.md` untracked; all three are frozen paths and stay untracked.
2. `trash/probe-phase-residual.test.ts` and `trash/v-*.txt` are this turn's retired evidence.
   Emptying `trash/` is your call.
