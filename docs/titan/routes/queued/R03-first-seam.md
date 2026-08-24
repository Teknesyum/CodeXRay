# R03 — Wire the first seam of the second-generation pipeline

> **Queued, not open.** This file is planning material. The active route is the
> highest-numbered file directly in `docs/titan/routes/`. Nothing here is an instruction
> to write code until it moves there.

## Özet

Projede iki Titan uygulaması var: sevk edilen birinci nesil (`titanEngine.ts`, 1498 satır) ve
hiç bağlanmamış, testli ikinci nesil (`titan/` + `input/inputPatch.ts` + `ai/roleBudgets.ts`).
AGENTS.md'nin anlattığı beş fazlı sözleşme yalnızca ikinci nesilde var — yani belge çalışmayan
kodu tarif ediyor. Bu rota tek bir niyeti (`discuss-current-step`) ikinci neslin omurgasından
geçirir ve `godStatus_` artıklarını temizler.

## Objective

Make `executeTitanPipeline` carry live user traffic for exactly one intent, so that the
five-phase contract in `AGENTS.md` describes something that runs. The engine is not
rewritten and no other intent changes. Second, retire the last `god*` identifiers that
survive in shipping source.

### What the audit found

Every export below has **zero production callers**. Verified by grep over `src/**` excluding
`*.test.ts`:

| Module | Lines | Live callers |
|---|---|---|
| `src/services/titan/titanRouter.ts` | 149 | 0 |
| `src/services/titan/titanPipeline.ts` — `executeTitanPipeline`, `collapseTitanPlan` | 135 | 0 |
| `src/services/titan/translate.ts` | 102 | 0 |
| `src/services/input/inputPatch.ts` | 259 | 0 |
| `src/services/ai/roleBudgets.ts` | 21 | 0 |

`titanPipeline.ts` is reached at runtime, but only as a re-export shim: `AiAssistant.tsx:785`
imports `startTitanModeRun` from it, which `titanPipeline.ts:2` forwards to `titanEntry.ts`,
which forwards to `titanEngine.ts:611`. The five-phase executor in the same file is never
entered.

Three consequences, all of which make `AGENTS.md` false today:

1. **The closed intent set is not the shipped one.** `AGENTS.md` names
   `navigate | edit-input | explain | trace-code | translate-code | load-preset | ui-control | unclear`,
   which is `TitanIntent` in the dead router. The shipped union is `TitanModeIntent`
   (`src/types/titan.ts:545`): `create-algorithm`, `create-catalog-problem`,
   `clarify-algorithm`, `adapt-input`, `discuss-current-step`, `ui-control`, `deterministic`.
   Neither is a subset of the other.
2. **The five phases do not exist at runtime.** `stageOrder` in `titanPipeline.ts:29` is the
   only `route → produce → semantics → verify → apply` sequence in the repository. The
   engine's `stage` values (`titanEngine.ts:354`) are contract-validation failure states —
   `empty`, `truncated`, `json_parse`, `schema`, `semantic` — a different concept with the
   same word.
3. **Cross-language translation does not ship at all.** `translate.ts` is the only translation
   module, nothing calls it, and no prompt anywhere asks a model for SimLang-Lite fragments —
   a recursive grep for `simlang-lite` over `src/services` returns that file alone.
   `AGENTS.md` describes the tracer as accepting "the shapes the translation layer emits from
   Java and C++"; no such layer runs. `roleBudgets.ts` reserves 900 output tokens for a
   `translate` role that is never requested.

This route fixes (2) for one intent. (1) and (3) are named here so the record is complete and
are routed to R04 and R05.

## Turn

- Route id: `R03`
- Base: **not yet stamped.** Queued, not open. The base SHA is written when this
  file moves into `docs/titan/routes/` as `route(R03): open`.
- Holder: `sole`
- Expected size: 6–9 files, 2 commits (`route(R03): close`, `handoff(H03): record`)

## Owned Files

| Path | Why |
|---|---|
| `src/components/AiAssistant.tsx` | The seam: the explain branch runs through the pipeline |
| `src/components/TitanModeProgress.tsx` | Renders the five stage states; holds `godStatus_` |
| `src/services/titan/titanPipeline.ts` | May gain a narrow typed helper; the executor itself is not rewritten |
| `src/i18n/translations.ts` | `godStatus_*` becomes `titanStatus_*`, both locales |
| `src/i18n/translations.test.ts` | Parity test follows the rename |
| `src/services/titan/titanPipeline.test.ts` | Covers the new helper if one is added |
| `e2e/titan-mode.spec.ts` | The user-visible proof |
| `docs/titan/handoffs/H03-first-seam.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

Nothing else. `titanEngine.ts` and `titanEntry.ts` are **read-only this turn**.

## Invariants

- The trace never comes from the model. The pipeline's `produce` phase may call the existing
  explain path; it may not synthesize steps.
- The model never computes an index; it selects a phase id.
- No `eval`, no `new Function`, no `Math.random`, no wall-clock branching.
- Phase order is fixed. `semantics` is the only skippable slot, and only through its declared
  optional field. `apply` runs only after `verify` returns ok.
- Every new user-facing string ships EN and TR.
- Behaviour for every intent other than `discuss-current-step` is bit-identical to the stamped base.

## Call path

Fill this table in the handoff with real `file:line` values after the change. Each hop must
be a line that exists in the committed tree.

| # | Hop | Path |
|---|---|---|
| 1 | User sends a question about the current step | `e2e/titan-mode.spec.ts:<line>` |
| 2 | Router classifies it | `src/services/titanModeRouting.ts:233` |
| 3 | Component branches on the intent | `src/components/AiAssistant.tsx:772` |
| 4 | Pipeline is entered | `src/services/titan/titanPipeline.ts:31` |
| 5 | `produce` delegates to the existing explain path | `<file>:<line>` |
| 6 | `apply` renders the answer | `<file>:<line>` |
| 7 | Stage states reach the UI | `src/components/TitanModeProgress.tsx:<line>` |

A route whose call path cannot be filled in with real line numbers has not been wired.

## Approach

The seam goes at the component boundary, **not** inside the engine. In `AiAssistant.tsx`,
where `discuss-current-step` is handled today (line 772 pauses playback, line 785 dynamically
imports `startTitanModeRun`), that one branch instead calls `executeTitanPipeline` with:

- `route` — returns the already-computed `TitanModeIntent`; it does not re-classify.
- `produce` — calls the existing explain path unchanged and returns its artifact.
- `semantics` — omitted. Its absence must show as `skipped`, not `completed`.
- `verify` — asserts the artifact is non-empty and that the referenced step index exists in
  the current trace. A failed verify must leave the workspace untouched.
- `apply` — renders the answer into the assistant transcript.
- `onStage` — feeds `TitanModeProgress`.

Every other intent keeps calling `startTitanModeRun` exactly as it does now. If the explain
path cannot be reached without touching `titanEngine.ts`, **stop and report it in
`## Blockers`** rather than widening the route.

### Secondary objective — retire the surviving `god*` identifiers

Sixteen keys still ship: `godStatus_waiting` through `godStatus_rolled-back` at
`src/i18n/translations.ts:240-247` (EN) and `:594-601` (TR), consumed at
`src/components/TitanModeProgress.tsx:248`, `:253`, `:260`. Rename the prefix to
`titanStatus_`. Key count on each side must not change and the R01 parity test must stay
green.

Two occurrences are **deliberately kept**:

| Path | What it builds |
|---|---|
| `src/context/TimelineContext.tsx:128` | the pre-rename `localStorage` key `codexray.ai.godMode` |
| `src/services/titanModeRunStore.ts:5` | the pre-rename run-store name `god-mode` |

They read pre-rename storage so returning users do not lose state, which is a real
requirement. But both are assembled with a `join()` call over split fragments, which makes
the identifier invisible to every grep the DoD relies on — including R01's criterion 8, which
is why DoD row 6 reads as satisfied. Keep the behaviour, remove the evasion: write each key
as a plain string literal in a named constant, and add both paths to the enumerated exception
list in the verification block below. A migration constant should be findable.

## Acceptance Criteria

1. `executeTitanPipeline` has at least one production caller. Prove it with a grep over
   `src/**` excluding `*.test.ts` that returns a non-test line.
2. Asking a question about the current step produces an answer, and the five stage states are
   observable in that order, with `semantics` reported as `skipped`. Proven by
   `e2e/titan-mode.spec.ts`, not by a unit test.
3. A forced `verify` failure leaves the workspace unchanged — same selected step, same input,
   same code — and surfaces an EN/TR message. Covered by a test that fails if `apply` runs
   before `verify` returns ok.
4. Every intent other than `discuss-current-step` still reaches `startTitanModeRun`. Prove it
   by showing the untouched branch and a green full e2e run.
5. `godStatus_` has zero matches in `src/**`. Keys are `titanStatus_*` in both locales and the
   per-locale key count is unchanged from the stamped base.
6. The two legacy constants express their key as a plain string literal. The stored value each
   produces is byte-identical to today's; prove it with a test asserting the exact string
   `codexray.ai.godMode` and the exact string `god-mode`.
7. The `## Call path` table is filled with real `file:line` values, every one of which exists
   in the committed tree.
8. DoD rows 6, 7 and 10 are updated with H01/H03 evidence. Row 6's cell states plainly that
   the two legacy constants remain by design. Row 10 closes: `CLAUDE.md` now exists at the
   root and beside four `AGENTS.md` files.
9. All four gates clean: `npm run lint`, `npm run test`, `npm run build`, `npm run desktop:check`.
10. `npm run test` count is at or above 751 and every added test corresponds to a claim above.
11. `npm run test:e2e` passes locally. **(T0)** The remote `browser` job is Claude's to close;
    do not push.
12. Two commits, in order: `route(R03): close`, then `handoff(H03): record`.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'executeTitanPipeline' | Where-Object { $_.Path -notmatch '\.test\.' }

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'godStatus_'

Get-ChildItem -Recurse -Path src, e2e, src-tauri -File | Select-String -Pattern 'god.?mode' -CaseSensitive:$false

Select-String -Path src/i18n/translations.ts -Pattern 'titanStatus_' | Measure-Object

npm run lint

npm run test

npm run build

npm run desktop:check

git diff --stat "<base>..HEAD"
```

The fourth command has exactly two permitted matches, both legacy-key constants:
`src/context/TimelineContext.tsx` and `src/services/titanModeRunStore.ts`. Any third match
fails the criterion.

The e2e suite runs separately, using the external-server procedure in `AGENTS.md`. Clean up
only the PIDs this run created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## Rollback

`git reset --hard <base>` only when the working tree holds nothing else worth keeping, and
record the decision in `## Deviations`.

## Out of Scope

- **Rewriting `titanEngine.ts` or `titanEntry.ts`.** Read-only this turn. Routing a second
  intent through the pipeline is R06, after this seam has survived one turn.
- **Reconciling the two intent vocabularies.** `TitanIntent` versus `TitanModeIntent` is a
  product decision about what CodeXRay promises, and it is R04. Do not edit either union, and
  do not edit the intent list in `AGENTS.md` — that text becomes true or changes in R04, and
  changing it now would hide the gap this route just documented.
- **Shipping cross-language translation.** `translate.ts`, its prompt, and the `translate`
  role budget are R05. Do not call `translateToVerifiedPackage` and do not delete it.
- **Deleting `titanRouter.ts`, `inputPatch.ts`, or `roleBudgets.ts`.** Their fate is decided
  in R04 and R05. Dead code is not removed while the decision that governs it is open.
- Any change to the interpreter's supported language profile.
- CI workflow files under `.github/`.
- Pushing to `origin`. The remote half of criterion 11 belongs to T0.
