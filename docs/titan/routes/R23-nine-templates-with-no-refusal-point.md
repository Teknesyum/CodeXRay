# R23 — nine templates with no refusal point

## Özet

R20'den beri açık duran boşluk. Dokuz `create-algorithm` şablonu beş fazlı pipeline'a hiç
girmiyor; `AiAssistant.tsx:959` onları doğrudan `startTitanModeRun`'a veriyor ve motor kendi
iş grafiğinin içinde uyguluyor. Dışarıdan reddedebilecek bir çağıran yok.

Motor tarafı hazır: dört uygulama noktasının dördü de `applyPackageUnlessDeferred` üzerinden
geçiyor, yani `deferApply` bu dokuzun hepsinde onurlandırılıyor. Eksik olan tek şey çağıran.

`verify`'ın şekli ölçülerek belirlendi, tahmin edilerek değil. R16'nın `result` anahtarı
kontrolü dokuzun yedisinde çalışıyor; `predict-winner-interval-dp` ve `bidirectional-bfs`
`result` taşımıyor. Kontrolü olduğu gibi kopyalamak bu ikisini haksız yere reddederdi.

## Objective

Bring the nine non-pipelined `create-algorithm` templates behind the five-phase pipeline, so
that every creation intent has a point at which an external caller can refuse before the
workspace is touched.

### The nine

Measured at `c1528ee` from `src/types/titan.ts:550` and `src/services/dpTemplateCompiler.ts:20`:
the seven `DpTemplateId` values, plus `bidirectional-bfs` and `predict-winner-interval-dp`.
`jump-game-dp`, `jump-game-greedy`, `lis-quadratic-dp` and `lis-binary-search` went through the
pipeline at R16; `model-authored` at R18. Those five are not in scope.

`create-catalog-problem`, `clarify-algorithm`, `ui-control` and `deterministic` are also not in
scope: none of them compiles a package, so there is nothing for a package verify to check. If a
later route wants them pipelined it must first say what its `verify` would establish.

### The engine is already ready

Four apply sites, all through `applyPackageUnlessDeferred`:

```
titanEngine.ts:1146   predict-winner-interval-dp
titanEngine.ts:1228   array templates
titanEngine.ts:1315   dp templates
titanEngine.ts:1601   bidirectional-bfs and model-authored (shared tail)
```

R16 made `deferApply` a required option on the executor and counted 1 eager / 0 deferred for
all four branches, including the ones still unwired. So this route wires callers; it does not
have to touch the apply path. If that turns out to be false, say so with the measurement — that
would be a larger route than this one.

### What `verify` can honestly check, measured

Every one of the nine was compiled and its package inspected. Verbatim:

| template | tests.passed | steps.length | checkpoints.length | final `visualData.vars` keys | has `result` |
|---|---|---|---|---|---|
| house-robber-1d-dp | true | 7 | 7 | nums, dp, result | yes |
| lcs-2d-dp | true | 26 | 16 | first, second, result, filledCells | yes |
| lcs-space-optimized-1d-dp | true | 17 | 16 | text1, text2, rows, columns, result, memoryCells, filledStates | yes |
| longest-palindrome-interval-dp | true | 17 | 16 | text, result, filledCells | yes |
| coin-change-1d-dp | true | 13 | 13 | coins, amount, result, filledStates, possible | yes |
| edit-distance-2d-dp | true | 26 | 16 | first, second, result, filledCells | yes |
| knapsack-2d-dp | true | 42 | 16 | weights, values, capacity, result, filledCells | yes |
| predict-winner-interval-dp | true | 17 | 14 | nums, dp, scoreDifference, winner, filledCells | **no** |
| bidirectional-bfs | true | 17 | 10 | start, target, frontierStart, frontierTarget, visitedStart, visitedTarget, parentFromStart, parentFromTarget, currentStart, currentTarget, meeting, path | **no** |

Method: `compileDpTemplatePackage` and `compilePredictWinnerPackage` called directly;
`bidirectional-bfs` has no standalone compiler and was produced through `startTitanModeRun`
with the existing `successfulAgent` fixture from `titanEngine.test.ts`.

Three facts fall out of this table:

1. `tests.passed` is true and `steps.length` and `checkpoints.length` are non-zero for all
   nine. Those three predicates are safe to assert generically.
2. `result` is **not** universal. Copying `startArrayTemplatePipeline`'s check verbatim would
   reject two of the nine on a correct package.
3. The two exceptions carry a different but equally specific answer key —
   `winner` / `scoreDifference` for predict-winner, `path` / `meeting` for bidirectional-bfs.
   So a per-template expected key is a real content check, not a weakening.

### Why the generic three are not enough on their own

`tests.passed` and non-empty checkpoints are exactly the two deterministic gates the engine
already runs at `titanEngine.ts:1549-1550` before the critic. A `verify` that asserts only those
re-asserts what already happened inside `produce` and adds no independent information — the same
criticism `AGENTS.md` already records against R16's check, and a fair one. The answer key is what
makes this check say something: it is the one property of a finished package that the engine's
own gates do not test, and it is the property a user would notice was wrong.

This is still not intent verification. It proves the package computed *an* answer under the key
that algorithm answers under. It cannot prove the answer is right, and no gate in this system
can. Do not describe it as more than that.

## Turn

- `Turn.holder`: T0-delegated implementer
- `Turn.base`: `c1528ee`
- `Turn.branch`: `main`

Before writing anything: `git merge-base --is-ancestor c1528ee HEAD` must exit 0, and
`git diff --name-only c1528ee..HEAD` must list only T0-owned paths.

## Expected Files

A forecast, not a gate.

- `src/services/titan/titanPipeline.ts` — the new entry point and its verify.
- `src/components/AiAssistant.tsx` — the dispatch.
- `src/i18n/translations.ts` — only if a new message is needed;
  `titanCreationVerificationFailed` already exists and is probably the right one.
- `src/services/titan/titanPipeline.test.ts`, `src/services/titanEngine.test.ts` — tests.
- Possibly one e2e spec.

## Invariants

- No `eval`, no `new Function`, no `Math.random`, no wall-clock branching.
- The trace never comes from the model; the model never computes an index.
- Every new user-facing string ships EN and TR.
- Phases are never reordered; `apply` runs only after `verify` returns ok.
- **The answer-key table is a declaration, not an inference.** Write the nine keys out. Never
  derive the expected key from the package being checked — a check that reads its expectation
  from its subject checks nothing.
- Do not touch `startArrayTemplatePipeline`, `startModelAuthoredPipeline`,
  `startAdaptInputPipeline`, `startDiscussCurrentStepPipeline`, or
  `startWebProblemFallbackPipeline`. Sharing code with them is fine; changing their behaviour
  is a different route.
- **Decide `previewSource` deliberately and say which you chose.** `AGENTS.md` records two
  deliberately different orderings: the deterministic templates preview during `produce` because
  their previewed source is byte-identical to what will be applied, and `model-authored` replays
  the preview inside `apply` because its source is model-written. These nine are deterministic
  compilations, so the template ordering is the expected choice — but state it in the handoff
  rather than inheriting it silently.
- No frozen or T0-owned path is written: `.claude/**`, `.agents/AGENTS.md`, `docs/tasks/**`,
  `docs/legacy/**`, `CodeXray-readme-neon.svg`, `docs/TITAN_MODE_YOL_HARITASI.md`,
  `docs/titan/routes/**`, `AGENTS.md`.

## The decision

**Option A — one entry point, nine templates, a declared answer-key table.** A new
`startDeterministicTemplatePipeline` (name it as you like) beside the existing four, whose
`verify` asserts: the package's tests passed, `steps` is non-empty, `teachingPlan.checkpoints`
is non-empty, and the final step's `visualData.vars` contains the key this route's table
declares for that template. `AiAssistant.tsx` routes all nine to it.

Cost: one entry point modelled on `startArrayTemplatePipeline`, one nine-row table, one dispatch
branch, roughly nine to twelve tests. The measurement above is the test fixture.

**Option B — extend `startArrayTemplatePipeline` to take the expected key as a parameter and
route all thirteen templates through it.** Fewer entry points and one fewer near-duplicate
function. But it changes a function four shipped templates already depend on, and its current
hardcoded `result` becomes a default that a future template could silently inherit wrongly.
Cheaper by maybe a fifth; the risk is concentrated on paths that work today.

**Option C — pipeline only the seven that already satisfy R16's check, defer the two.**
Cheapest, and it leaves the route's own name unearned: `bidirectional-bfs` and
`predict-winner-interval-dp` are two of the three templates R20's `AGENTS.md` paragraph names by
hand as the open gap. Closing seven of nine and calling the gap closed is exactly the kind of
description-wider-than-effect this line of routes exists to stop.

**T0 reading, not binding: A.** B's saving is real but it puts a default on a shared path, and
this repository has spent five routes on defaults that meant less than their names. If while
implementing you find A and B are within a test or two of each other, take A.

## Acceptance Criteria

1. All nine templates enter `executeTitanPipeline`. A test asserts, per template, that the
   phases ran in order `route → produce → semantics → verify → apply` (or with `semantics`
   skipped through its declared optional slot).
2. For each of the nine, the workspace is **not** mutated when `verify` rejects. Assert it for
   at least `bidirectional-bfs` and one DP template, by counting applies as
   `titanEngine.test.ts` already does — 1 eager / 0 deferred.
3. The expected answer key per template is written out literally, and a test asserts the table
   has exactly nine entries matching the nine template ids. If a tenth template is added later
   without a key, that test must fail.
4. A package missing its declared key is rejected. Assert with a hand-mutated package, not by
   breaking a compiler.
5. The verify does **not** reject any of the nine on their real compiled packages. Assert all
   nine pass — this is the criterion the measurement table exists to protect.
6. `previewSource` ordering is stated in the handoff, with the reason.
7. The four existing pipeline entry points are behaviourally unchanged. Show their tests pass
   unmodified.
8. `npm run lint`, `npm run test`, `npm run build` pass. `npm run desktop:check` if
   `src-tauri/**` changed.
9. e2e passes. A criterion claiming user-visible behavior cannot close on a unit test alone:
   at least one of the nine must be exercised end to end, showing the run completes and applies.
10. (T0) The handoff states, as a count, how many `create-algorithm` templates enter the
    pipeline before and after this turn, out of how many total.
11. No frozen or T0-owned path is written. `git diff --name-only c1528ee..HEAD` proves it.
12. Every commit is DCO-signed as `Mustafa Özel <iyott131@gmail.com>`.

## Verification

PowerShell 5.1. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git config user.email

git diff --name-only "c1528ee..HEAD"

git diff --stat "c1528ee..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'startTitanModeRun\('

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'executeTitanPipeline'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'new Function|eval\('

npm run lint

npm run test

npm run build
```

Run the fifth and sixth against the base as well and report the delta — that pair is criterion
1's and criterion 10's evidence. Grep for assertion text, never for a line range: a diff of this
size moves line numbers inside its own turn, which is how R21's verification block went stale.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## Still deferred after this route

- `webSource.ts:298` — the trailing `\b` after an alternative ending in `]` means
  `int solve(int[][] nums)` is declared SimLang-compatible while `int solve(int[][]nums)` is
  not. Needs a signature parser.
- Structural trace intelligence inert across all 50 catalog algorithms: `sigIsZero=17`,
  `singlePhase=44`, kinds only `mutate`/`statement`, events `none`. Those indices reach the
  model prompt through `aiContext.ts:223` labelled as important steps. Fixing it means emitting
  events from 60 simulators.
- `src/services/trace/traceQuery.ts` has no production consumer.
- E2E timeouts: five local sightings across four specs (`titan-mode.spec.ts:22`,
  `ai-actions.spec.ts:112`, `radio-controller.spec.ts` at H12 and H15,
  `translation-provenance.spec.ts` at H22), zero on CI. The next one is a route wherever it
  lands.

---

## T0 reconciliation

Closed at `aacbcb6`, handoff `ada17bd`. Option A. I verified the diff and the gates myself:
lint clean, `882 passed` against `867` at the base, build inside every budget, no frozen or
T0-owned path in the file list. **5/14 → 14/14** `create-algorithm` templates now enter the
pipeline; `create-catalog-problem`, `clarify-algorithm`, `ui-control` and `deterministic` still
do not, deliberately and for the reason the route gave.

**Criterion 3 came out better than it was written.** The route asked for a runtime test that the
table has nine entries. The implementation derives `DeterministicTemplateId` by `Exclude`ing the
five already-pipelined templates from the intent union and types the table as a `Record` over it,
so a tenth template added to `TitanModeIntent` without an answer key is a compile error, not a
test failure. That is the stronger form of the same guarantee and I am recording it as the
standard for this kind of table.

The answer keys shipped as declared: `result` for the seven DP templates, `winner` for
`predict-winner-interval-dp`, `path` for `bidirectional-bfs`. Nothing inferred from the package.

### The turn found a live production defect, and it is not this turn's

`## Discovered` item 1. I verified it independently rather than taking the report:

- `titanEngine.ts:104-105` — the engine's own run id is `` `gm-${...}` ``.
- `titanPipeline.ts` — a pipeline run id is `` `titan-pipeline-${crypto.randomUUID()}` ``.
- `AiAssistant.tsx:958` sets `sourcePreviewRunRef.current = run.runId`, the **pipeline's** id.
- `AiAssistant.tsx:870` guards with `if (!mountedRef.current || sourcePreviewRunRef.current !== runId) return;`
- `startArrayTemplatePipeline`'s `produce` spreads `...options` and passes `previewSource`
  through untouched, so the engine invokes it with `gm-…`.

The two ids never match. **The source-typing animation for the four array templates —
`jump-game-dp`, `jump-game-greedy`, `lis-quadratic-dp`, `lis-binary-search` — has silently not
played since R16.** `e2e/usage-scenarios.spec.ts:24,34,39` asserts only the final
`.code-display` content, which is written by `apply`, so nothing caught it.

`AGENTS.md` says `dp-family-titan-mode.spec.ts` asserts the typing element visible during
`produce`. That was true, and it stayed true through this turn — but only because the DP family
was *not* pipelined until now, and because this turn's new entry point remaps the id at
`titanPipeline.ts:723-724`. Had the implementer wired the nine the obvious way, that spec would
have gone red and the cause would have been three levels away. It did not, because the route
required `previewSource` ordering to be decided out loud rather than inherited. The instruction
that caught this was about writing down a reason, not about run ids.

This is the third consecutive turn to surface the same shape: **a mechanism whose description is
broader than its effect.** R21's fallback that read as a verdict, R22's inert program-id
exclusion, and now a rollback-protected preview that never fires. In every case the code was
defensible line by line and the sentence describing it was not.

The array-template fix is deliberately not in this turn — the route froze
`startArrayTemplatePipeline`, correctly, because changing a shipped path while wiring nine new
ones would have made a red test ambiguous. It is R24.

### What this route did not buy

The new `verify` is not independent recomputation in R15's or R18's sense. It proves the package
produced *an* answer under the key that algorithm answers under; it cannot prove the answer is
right. `## Discovered` item 4 says this in the implementer's own words, unprompted. Do not let a
later document promote it.

### Standing

- **R24 (next):** the `previewSource` run-id mismatch in `startArrayTemplatePipeline`.
- `webSource.ts:298` — the trailing `\b` that cannot reject `int[][] nums`.
- Structural trace intelligence inert across all 50 catalog algorithms; `traceQuery.ts` with no
  production consumer.
- E2E flakes: six local sightings across four specs now, `translation-provenance.spec.ts:155`
  twice under full-suite parallelism (H22 and H23), green in isolation both times. Zero on CI.
  Two sightings of the same locator in consecutive turns is no longer noise — it goes in the
  R24 route as a second, cheap criterion.
- `.code-display` does not exist before the first run; a cold-start spec must read
  `.code-textarea`.
