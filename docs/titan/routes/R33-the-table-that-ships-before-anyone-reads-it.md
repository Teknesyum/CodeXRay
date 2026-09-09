# R33 — The Table That Ships Before Anyone Reads It

## Özet

750 satırlık `runtimeReplacements` tablosu başlangıç paketinde; `en` kullanıcısı için ölü yük,
`tr` kullanıcısı için ilk iz gelene kadar gereksiz. Pay 2.2 KiB kaldı ve bütçe yükseltilemez.
Tablo kendi parçasına taşınır, Türkçe çıktıda İngilizce kalıntı sıfır kalır, bütçe yeni değere kilitlenir.

## Turn

- route: R33
- base: `f975c56`
- expected size: ~8 files, 1 close commit
- holder: Sole

```powershell
git merge-base --is-ancestor f975c56 HEAD
git diff --name-only "f975c56..HEAD"
```

The first must exit 0. The second must list only T0-owned paths.

## Why

`src/i18n/translations.ts:825` declares `runtimeReplacements`, an `Array<[RegExp, string]>` of
750 entries spanning 69 177 bytes of source (`sed -n 825,1577p | wc -c`). `translateRuntimeText`
at `:1579` folds every runtime string through it, synchronously, during render.

The module is in the initial chunk because `App.tsx:7` and `:8` import `ControlBar` and
`VariablesPanel` statically, and both call `translateRuntimeText`. The three heavy consumers —
`DynamicVisualizer`, `AiAssistant`, `CodeEditor` — are already `lazy()` at `App.tsx:23-25`; they
pull nothing into the initial chunk. The table rides in on the two light ones.

What the initial consumers actually translate:

```
ControlBar.tsx:256   'WebGPU is unavailable. Simulations still work without AI.'
ControlBar.tsx:283   'Local model ready. No code or prompts leave this browser.'
ControlBar.tsx:295   error.message | 'Local model failed to load.'
ControlBar.tsx:439,462,691,766,770   model labels
ControlBar.tsx:502   question
VariablesPanel.tsx:50   every string-typed trace value
```

None of these is needed before the first trace exists or the first model status arrives. The
750-entry table is parsed on every page load — including every `en` load, where
`translateRuntimeText` returns at its first line and the table is never read — to serve strings
that arrive seconds later, if at all.

Two routes (R28, R32) have each spent a little of the headroom on this table, and the R32
reconciliation records the wall: **422.8 / 425.0 KiB, 2.2 KiB left**, and `AGENTS.md` forbids
answering the next sweep by raising the budget again. The sweeps are not done; DoD 1 and every
new simulator will add phase and decision strings.

The default locale is `tr` (`TimelineContext.tsx:470`: anything but a stored `en` is `tr`), so
"lazy" cannot mean "load when the user switches to Turkish". It means: load when a string that
needs it is about to render, and never render such a string in `tr` without it.

## Decision

Move `runtimeReplacements` out of the initial chunk into its own module and own its loading in
one place.

- **`translateRuntimeText` keeps its signature and stays synchronous.** 29 production call sites
  (`grep -rn "translateRuntimeText(" src --include=*.ts --include=*.tsx | grep -v test`) do not
  change. It reads a module-level table that is `null` until loaded.
- **One loader, one owner.** The locale lives in `TimelineContext.tsx:469`; the readiness of the
  table lives beside it. Exactly one `import()` of the table module exists in `src/`, and it is
  not inside a component that renders trace text.
- **A `tr` render of runtime text never silently falls back to English.** How the implementer
  guarantees that is theirs to judge (see below), but the guarantee is measured, not asserted:
  the first hud painted in a `tr` session is Turkish, with no step navigation before the check.
- **The budget is lowered to lock the gain**, not left at 425 so the headroom can silently
  erode: `scripts/check-build-size.mjs:7` becomes the measured initial figure rounded up to the
  next 8 KiB plus 16 KiB. That is the only budget constant that changes.
- **`Insertion Sort` gets one Turkish name.** H32 found `translations.ts:802` says
  `Eklemeli Sıralama` while five phase rows say `Ekleme Sıralaması`. The registry name is what
  the catalog shows, so it wins; the five phase rows change. The residual sweep over all 275
  phase strings must still report 0.

Do not "optimise" the table's contents in this route — no entry merging, no regex-to-string
conversion, no dropping entries that look unused. The table's job is measured by the residual
gate and nothing here touches that measurement except the five Insertion Sort rows.

## Yours to judge

- **Where the wait happens.** Two honest shapes: (a) the provider withholds children while
  `locale === 'tr'` and the table is not loaded — simplest, costs one chunk fetch on every `tr`
  cold start before first paint; (b) only the surfaces that render runtime text wait —
  `DynamicVisualizer`, `VariablesPanel`, and the `ControlBar` status line — while the shell paints
  immediately. (b) is better for the user and harder to prove. Pick one, say which, and put the
  measured `startupMs` from `e2e/performance-budget.spec.ts:23` before and after in the handoff.
  A flash of English followed by a re-render is **not** a third option.
- **The chunk boundary.** A separate file under `src/i18n/` plus a `codeSplitting.groups` entry
  in `vite.config.ts:29` is the pattern the repository already uses for the simulators; whether
  the table also needs `modulepreload` is yours.
- **How unit tests preload.** Tests that call `translateRuntimeText(…, 'tr')` today rely on the
  table being present at import time. They must preload it explicitly; a test that passes because
  the English input equals the English output is the failure mode to design against.

## Read first

- `src/i18n/translations.ts:825-1585` — the table and `translateRuntimeText`.
- `src/context/TimelineContext.tsx:469-470,622` — where the locale is born and persisted.
- `src/App.tsx:7-8,23-26` — which consumers are initial and which are lazy.
- `scripts/check-build-size.mjs:41-47` — initial JS is exactly the `<script src>` set in
  `dist/index.html`; a preloaded chunk is not counted, which is why criterion 4 checks a `tr`
  first paint and criterion 6 reports `startupMs`, so the number cannot be gamed by moving parse
  time instead of removing it.
- `e2e/phase-teaching-strip.spec.ts`, `e2e/decision-localization.spec.ts` — the existing
  residual gates; six e2e specs start in `tr` via `localStorage.setItem('codexray.locale', 'tr')`.
- `AGENTS.md` — the `translations.ts` paragraph: a present entry proves nothing, only the
  residual does.

## Call path

- initial: `App.tsx:8 → VariablesPanel.tsx:50 → translateRuntimeText` (trace values)
- initial: `App.tsx:7 → ControlBar.tsx:691 → translateRuntimeText` (model labels)
- lazy: `App.tsx:24 → DynamicVisualizer.tsx:93 TeachingHud → translateRuntimeText`
- locale: `TimelineContext.tsx:469 → setLocale (:770) → every consumer above`
- traversing tests: `e2e/phase-teaching-strip.spec.ts`, `e2e/decision-localization.spec.ts`,
  `e2e/performance-budget.spec.ts:23`

No criterion that claims user-visible behavior may be closed by a unit test alone.

## Criteria

1. **Base measurement reproduced before any source change**: the `Initial JavaScript` line from
   `npm run build`, the table's entry count and byte span, and the list of modules through which
   `translations.ts` reaches the initial chunk. Paste them; the implementer's numbers govern.

2. **The table is not in the initial chunk.** Proven on `dist/`, not on source: pick one Turkish
   replacement that exists only in the table (`orta ve sağ üçte birler elenir` is one), and show
   `Select-String` over `dist/assets/index-*.js` returns 0 matches and over the lazy chunks returns
   exactly 1 file.

3. **Initial JS drops by at least 40 KiB** from the base figure, and the budget constant in
   `scripts/check-build-size.mjs` is lowered to the new figure rounded up to 8 KiB plus 16 KiB.
   Report both. No other budget changes.

4. **A `tr` session's first painted hud is Turkish.** New e2e: persisted `tr` locale, load,
   wait for the visualizer, assert the hud's first `<strong>` text matches the algorithm's Turkish
   phase and contains none of its English tokens — **before any step navigation**. Positive
   assertion first, then the negative, per the mount-race rule in `AGENTS.md`.

5. **Switching `en → tr` at runtime still updates existing steps without rerunning them**, and
   the existing residual gates pass with **no assertion loosened**: `phase-teaching-strip`,
   `decision-localization`, and every other `tr` spec. Name the spec that covers the switch.

6. **The wait has a measured cost.** `startupMs` from `e2e/performance-budget.spec.ts:23` on the
   base and after, and the spec still passes. Say which shape from `## Yours to judge` was chosen.

7. **One loader.** `grep -rn "import(" src --include=*.ts --include=*.tsx | Select-String
   runtimeReplacements` (or whatever the module is named) returns exactly one production site,
   and it is not in a component that renders trace text. `translateRuntimeText`'s production
   call-site count is 29 before and 29 after.

8. **No unit test passes by accident.** Every test that calls `translateRuntimeText(…, 'tr')`
   preloads the table explicitly, and at least one test asserts the not-loaded behaviour
   directly (whatever the implementer chose it to be — it must be observable, never a silent
   English string handed to a `tr` render).

9. **`Insertion Sort` is `Eklemeli Sıralama` everywhere.** `Select-String "Ekleme Sıralaması"
   src` returns nothing; the residual sweep over all 275 phase strings, run the way H32 ran it,
   still reports `translated phase strings still containing an English token = 0`.

10. **No simulator, no trace, no i18n entry changed** except the five Insertion Sort rows and
    whatever the module split itself requires. `translations.ts`'s authored `t()` keys are not
    touched.

11. `lint`, `test`, `build`, `test:e2e` clean; unit count stated against the base's 918, e2e
    against 87 + 2.

12. Close as two commits: `route(R33): close`, then `handoff(H33): record`.

## Expected Files

A forecast, not a gate.

- `src/i18n/translations.ts`
- `src/i18n/runtimeReplacements.ts` (or the name you choose)
- `src/context/TimelineContext.tsx`
- `src/components/VariablesPanel.tsx`, `src/components/ControlBar.tsx`,
  `src/components/DynamicVisualizer.tsx` — only if shape (b) is chosen
- `vite.config.ts`
- `scripts/check-build-size.mjs`
- `src/i18n/translations.test.ts` and any test that preloads
- `e2e/` — one new spec for criterion 4

## Do not touch

- `src/services/simulators/**`, `src/services/extended*`, `src/services/compound*`,
  `src/services/trace/**`
- Any budget constant other than `initialJavaScript`
- The contents of the table beyond the five Insertion Sort rows

## Decided, do not relitigate

- The budget is lowered, never raised. Lowering is how the gain is locked.
- The registry name wins for Insertion Sort.
- A flash of English in a `tr` render is a defect, not a trade-off.
- The table's contents are not optimised in this route.

## Evidence required

- 1, 3, 6: numbers pasted verbatim from the commands named.
- 2, 7, 9: the grep and its output.
- 4, 5: e2e spec name plus the production `file:line` of the wait.
- 8: test names and the delta in the unit count.

## Rollback

Revert `route(R33): close`. The table returns to the initial chunk and the budget constant to
425; nothing else in the product depends on the split.

## Verification

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e
Select-String -Path dist/assets/index-*.js -Pattern 'orta ve sağ üçte birler elenir' | Measure-Object | Select-Object -ExpandProperty Count
git diff --name-only "f975c56..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$|^docs/titan/ROADMAP\.md$'
git diff --name-only "f975c56..HEAD" | Select-String -Pattern 'src/services/(simulators|extended|compound|trace)'
git status --porcelain | Select-String -Pattern 'test-results|dist/|coverage/|probe'
```

The `Select-String` count must print `0`; the last three must print nothing. e2e defaults to 2
workers; use the external-server procedure in `AGENTS.md`, clean up only the PIDs this run
created, delete `test-results/` before finishing, and leave no probe file in the tree.

## Out of Scope

- `AiAssistant.tsx:857` persisting before the dismissed guard — R34.
- `eventWeight`, `traceQuery.ts`, `inputRequestAdapter.test.ts:31`, `titanEntry.ts` — R35.
- The three slow e2e specs — R36.
- Anything in `docs/titan/ROADMAP.md` below R33.

## T0 reconciliation

Closed by `7efe377` (`route(R33): close`) and `07fabbc` (`handoff(H33): record`). Handoff:
`docs/titan/handoffs/H33-the-table-that-ships-before-anyone-reads-it.md`.

### Independent T0 verification

All four gates re-run on `7efe377`, exit 0 each: lint, `923 / 123` unit, build, `89 + 2` e2e.
The route's own numbers reproduce.

```
Initial JavaScript: 358.9 / 376.0 KiB
dist/assets/runtime-replacements-D5dbM4BF.js          66.21 kB │ gzip:  19.87 kB
```

```
PS> Select-String -Path dist/assets/index-*.js -Pattern 'orta ve sağ üçte birler elenir' | Measure-Object | Select-Object -ExpandProperty Count
0
PS> (Select-String -Path dist/assets/*.js -Pattern 'orta ve sağ üçte birler elenir').Filename | Select-Object -Unique
runtime-replacements-D5dbM4BF.js
```

422.8 → 358.9 KiB is a **63.9 KiB** drop against a 40 KiB floor; the budget went 425 → 376, the
direction the roadmap's standing rule requires. One `import()`, 29 unchanged call sites,
`Ekleme Sıralaması` gone from `src/`, 275 distinct phase strings with 0 untouched by `tr`.

### What the residual sweep actually says

The phase-string probe reports **36** residual tokens, not H32's 0, on the same corpus. The
output is unchanged; the whitelists differ. 27 of the 36 are proper names or acronyms
(`Dijkstra`, `KMP`, `LCS`), 9 are the loanword and traversal-name class `AGENTS.md` already
declares is not residue (`hash`, `inorder`, `link`, `minimum`, `per`, `pivot`, `postorder`,
`preorder`, `terminal`). The English-word residual is 0. **A route that wants this sweep as a
committed test must first choose one whitelist**; two probes with different whitelists cannot be
compared across turns, and this is the second time that has cost a reader a paragraph.

### Deviation accepted

`f975c56..HEAD` carries a human commit, `71b09b3`, which touches `AGENTS.md` — a T0-owned path —
along with README, CHANGELOG, badges, `package.json` and `scripts/publish-to-site.mjs → trash/`.
It is not a turn violation: the R33 close commit's own nine files contain no protected path, and
all nine are inside `## Expected Files`. Recorded rather than reverted.

### Carried forward

- Nothing from `71b09b3` was left dangling: it moved `scripts/publish-to-site.mjs` to `trash/`
  and reconciled both `package.json` and `AGENTS.md`'s `## Deployment` block itself.
- The residual-whitelist question above, unowned.
- Everything R32 deferred and R33 did not take: `AiAssistant.tsx:857` (R34), `eventWeight` /
  `traceQuery.ts` / `titanEntry.ts` (R35), the three slow e2e specs (R36).
