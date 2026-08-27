# H17 — Grounded current-step verification

## Turn

- Route: R17
- Base SHA: `c26fe77`
- End SHA: `3226c74cf77b7af3e6134b26d1710e577bb29cad`
- Status: `closed locally; T0 remote and reconciliation pending`
- Next holder: Claude (T0)

## Özet

Geçerli adım açıklaması Option A ile fail-closed doğrulanıyor; yanlış satır, değişken snapshot'ı
veya adım konumu apply'a ulaşmıyor. Gerçek deterministic fallback EN/TR geçti, etiketsiz cevap
reddedildi ve stub modelin yanlış satırı kullanıcıya gösterilmedi. 821 unit ve yerel 72+2 E2E temiz.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `src/services/titan/titanPipeline.ts:209-256` | extract five EN/TR lenses and verify factual slots against the committed trace | added |
| `src/services/titan/titanPipeline.ts:299` | replace the current-step shape check with fail-closed factual verification | edited |
| `src/services/titanEngine.ts:573` | expose the deterministic five-lens oracle to its verification test | edited |
| `src/services/titan/titanPipeline.test.ts:163-200` | reject wrong line/index and unparseable answers; accept actual EN/TR fallback | added |
| `e2e/titan-mode.spec.ts:46-97` | drive a divergent tutor through the production UI and prove visible rejection | added |

## Decision

Option A was taken. All five labelled slots must be extractable in English or Turkish. `Code`
is verified against `workspace.steps[currentIndex].lineNumber`; that committed simulation step is
its independent source of truth. `Data` is verified against the bounded JSON serialization of
`workspace.steps[currentIndex].visualData.vars`; the deterministic trace snapshot is its independent
source of truth. `Time` is verified against `currentIndex + 1` and `steps.length`; the committed
timeline position and length are its independent source of truth. `Visual` is required as a slot but
its prose is not verified. `Reasoning` is required as a slot and explicitly not verified.

An absent label, unparsable factual slot, or disagreement returns the existing localized verification
failure. Pipeline apply does not run, so the user sees “The current-step explanation could not be
verified. The workspace was not changed.” (or its existing Turkish translation), never a repaired or
mixed-provenance answer.

## Commits

- `3226c74cf77b7af3e6134b26d1710e577bb29cad route(R17): close`
- `handoff(H17): record` — this commit

Both were signed only after `git config user.email` returned `iyott131@gmail.com`.

## Gate output

```text
lint: exit code 0 — > oxlint
test: exit code 0 — Test Files 119 passed (119) | Tests 821 passed (821)
test count before: 816
test count after: 821
build: exit code 0 — Initial JavaScript: 416.8 / 420.0 KiB
desktop:check: exit code 0 — test result: ok. 7 passed; 0 failed
local e2e: exit code 0 — 72 passed (1.0m) | 2 passed (34.6s)
```

Performance output, verbatim:

```text
TIMELINE_MEASUREMENTS {"playwright":{"min":790.4445000000014,"median":849.7671499999997,"max":912.0917},"inPage":{"min":165.39999999850988,"median":166.79999999701977,"max":167.30000000447035},"handler":{"min":0.4000000059604645,"median":0.6999999992549419,"max":1},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1467.3622,"catalogMs":271.52859999999987,"simulationMs":78.67459999999983,"dpMs":2471.2842999999993}
```

## Verification output

```text
3226c74cf77b7af3e6134b26d1710e577bb29cad
.../R17-grounded-current-step-verification.md      | 200 +++++++++++++++++++++
 e2e/titan-mode.spec.ts                             |  53 ++++++
 src/services/titan/titanPipeline.test.ts           |  40 ++++-
 src/services/titan/titanPipeline.ts                |  53 +++++-
 src/services/titanEngine.ts                        |   2 +-
 5 files changed, 338 insertions(+), 10 deletions(-)
```

`deterministicFiveLens` matches, verbatim:

```text
src\services\titan\titanPipeline.test.ts:14:import { deterministicFiveLens } from '../titanEngine';
src\services\titan\titanPipeline.test.ts:194:    const tutorAnswer = deterministicFiveLens(locale, workspace.steps[1], 1, 3);
src\services\titanEngine.ts:573:export const deterministicFiveLens = (
src\services\titanEngine.ts:627:  return deterministicFiveLens(locale, packageValue.steps[0], 0, packageValue.steps.length);
src\services\titanEngine.ts:785:            deterministicFiveLens(
src\services\titanEngine.ts:981:          deterministicFiveLens(options.locale, steps[0], 0, steps.length));
```

The `Math.random` scan has only pre-existing matches and no R17-added match:

```text
src\components\AiAssistant.tsx:1138
src\components\AiAssistant.tsx:1141
src\services\trace\interpreter.ts:163
src\services\trace\jsTracer.test.ts:114
src\services\algorithmCatalog.ts:90
src\services\titanEngine.ts:104
src\services\titanEntry.ts:67
src\services\webProblemOrchestrator.ts:190
```

## Acceptance

1. **Met** — The handoff names Option A, the Code/Data/Time sources of truth, and names Reasoning as unverified. Evidence: `H17 / Decision`.
2. **Met** — Wrong line and wrong step index are separately rejected. Evidence: `src/services/titan/titanPipeline.test.ts:163`.
3. **Met** — The actual deterministic fallback passes for EN and TR. Evidence: `src/services/titan/titanPipeline.test.ts:185`.
4. **Met** — An answer without recognizable labels is rejected with the localized existing failure and no apply. Evidence: `src/services/titan/titanPipeline.test.ts:163`.
5. **Met** — The same committed step receives `{ ok: true }` in both locales. Evidence: `src/services/titan/titanPipeline.test.ts:185`.
6. **Met** — A stubbed tutor returns line 999, the production pipeline rejects it, and the wrong answer is absent. Evidence: `e2e/titan-mode.spec.ts:46` + `src/components/AiAssistant.tsx:897`.
7. **Met** — R15 `rejects a well-formed artifact whose carried trace disagrees with independent recomputation`, R16 `defers the deterministic array engine apply and applies its verified package exactly once`, and R18 `independently verifies a model-authored package before previewing and applying it exactly once` all pass. Evidence: `src/services/titan/titanPipeline.test.ts:268`.
8. **Met** — All four gates clean. Evidence: `H17 / Gate output`.
9. **Met locally / T0 remote pending** — Both local e2e phases pass. Evidence: `e2e/titan-mode.spec.ts:46` + `src/components/AiAssistant.tsx:897`.
10. **Met locally** — Close commit precedes this signed handoff commit. Evidence: `H17 / Commits`.

## Diff scope

```text
docs/titan/routes/R17-grounded-current-step-verification.md | 200 +++++++++++++++++++++
e2e/titan-mode.spec.ts                                      |  53 ++++++
src/services/titan/titanPipeline.test.ts                    |  40 ++++-
src/services/titan/titanPipeline.ts                         |  53 +++++-
src/services/titanEngine.ts                                 |   2 +-
5 files changed, 338 insertions(+), 10 deletions(-)
```

All implementation files were forecast by R17. The route is the T0-authored opening commit.

## Deviations

none

## Discovered

- The first e2e attempt waited on an execution label that becomes visible before the chat is re-enabled. The final spec creates the committed DFS trace through the preset and Simulate controls, then enters the same production discussion path without that race.
- `DOD.md` has no R17-specific claim row; no unrelated evidence cell was changed.

## Untouched

Filtered diff over frozen and T0-owned paths returns only the T0-opened route:

```text
docs/titan/routes/R17-grounded-current-step-verification.md
```

R15 adapt-input, R16 array-template, R18 model-authored behavior, frozen paths, AGENTS files,
protocol files, and the three pre-existing untracked user paths were not modified by Sole.

## Blockers

none for local closure. T0 owns remote browser evidence and reconciliation.

## For the human

none
