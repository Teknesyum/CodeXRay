# H18 — Model-authored pipeline verification

## Turn

- Route: R18
- Base SHA: `a2f91cb`
- End SHA: `ccf2cca22596bc72df47f2fec0e0ffae0a145942`
- Status: `closed locally; T0 remote and reconciliation pending`
- Next holder: Claude (T0)

## Özet

Model-authored yaratım artık bağımsız yeniden derleme doğrulamasından geçiyor ve kaynak verify
başarısından önce kullanıcıya gösterilmiyor. Boş taşınan trace reddediliyor, workspace'in altı
alanı korunuyor; 816 test ve yerel 71+2 E2E temiz, gerçek WebGPU testi donanım yüzünden atlandı.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `src/services/titan/titanPipeline.ts:66-87` | failed pipeline stages cannot leave the UI running | edited |
| `src/services/titan/titanPipeline.ts:125-205` | model-authored intent recognition and independent artifact verification | added |
| `src/services/titan/titanPipeline.ts:422-493` | deferred model-authored produce, verify-before-preview, exactly-once apply | added |
| `src/components/AiAssistant.tsx:800-924` | dispatch model-authored creation through the five-phase pipeline | edited |
| `src/services/titan/titanPipeline.test.ts:271-359` | prove rejection, field preservation, ordering, and exactly-once | added |
| `src/services/titanEngine.test.ts:53-100` | count eager/deferred apply for the fifth branch | edited |

## Decision

Option B's independent verification plus Option A's ordering were both taken. If one had to
be dropped, ordering would have been dropped: independent content verification is the safety
property R18 exists to add, while the old preview already had rollback.

`verifyModelAuthoredArtifact` treats the produced package as an untrusted candidate and calls
`compileCustomSimulationPackage` again. That independently re-runs `validateProgramSpec`
against the SimLang schema, `parseSimulationInput` against the input parser,
`validateTypedVisualization` and the V2 visual validator against the visualization contract,
`executeSimLang` for a deterministic sample execution, and `runPackageTests` for the active
input. It then compares the freshly rendered source, deterministic trace, and test results to
the carried artifact. It does not re-read the engine critic verdict. The visualization choice
itself remains model-supplied candidate data; the validators and interpreter check its contract
and mapped execution, not whether it is the pedagogically best metaphor.

During `produce`, the model engine receives `deferApply: true` and `previewSource: undefined`.
Only after verify succeeds does pipeline `apply` replay the rendered source once and commit the
package once. Deterministic engine preview sites are unchanged.

## Failure and rollback

The negative test starts with a package that was successfully compiled, then replaces its
carried trace with `[]`. Independent compilation produces a non-empty trace, so comparison
rejects it. Neither preview nor apply runs. `algorithmName`, `code`, `steps`, `currentIndex`,
`analysis`, and `inputError` are asserted field by field against the pre-run snapshot.

The first full browser run exposed one related lifecycle defect: after engine production
failed, pipeline left its later `apply` stage waiting, so the UI correctly preserved the
workspace but kept the question input disabled. The executor now marks only still-waiting
later stages cancelled after an earlier failure. The existing
`titan-mode-failures.spec.ts` failure/rollback test then passed without timeout or assertion
changes.

## Exactly once

`titanEngine.test.ts` now counts all five branches:

```text
interval-DP: eager 1 / deferred 0
array template: eager 1 / deferred 0
DP template: eager 1 / deferred 0
bidirectional-BFS custom creation: eager 1 / deferred 0
model-authored creation: eager 1 / deferred 0
model-authored pipeline: preview 1 / apply 1
```

## Preserved paths

- R15: `rejects a well-formed artifact whose carried trace disagrees with independent recomputation`.
- R15: `keeps the committed workspace untouched when verification rejects the produced artifact`.
- R16: `defers the deterministic array engine apply and applies its verified package exactly once`.
- E2E: `usage-scenarios.spec.ts` Jump Game and LIS scenarios both passed.
- E2E: `model-authored-titan-mode.spec.ts` passed through the new production dispatch.

The five visible bars retain `route → produce → semantics → verify → apply`. On failure,
unreached bars now become terminal `cancelled` instead of falsely remaining `waiting`.

## Real model evidence

```text
> node scripts/run-e2e.mjs --real-ai
Running 1 test using 1 worker
  -  1 [chromium] › e2e\real-ai.spec.ts:84:3 › real on-device WebLLM › downloads, initializes, and answers with the default local model
  1 skipped
```

Chromium exposed no usable WebGPU adapter, so no model was loaded. Real model inference,
download/cache lifecycle, and a real model-authored response remain unproven on this machine.
The stubbed Architect/Code Author tests are reported separately and are not substituted for it.

## Commits

- `ccf2cca22596bc72df47f2fec0e0ffae0a145942 route(R18): close`
- `handoff(H18): record` — this commit

Both were signed only after `git config user.email` returned `iyott131@gmail.com`.

## Gate output

```text
lint: exit code 0 — > oxlint
test: exit code 0 — Test Files 119 passed (119) | Tests 816 passed (816)
test count before: 813
test count after: 816
build: exit code 0 — Initial JavaScript: 416.8 / 420.0 KiB
desktop:check: exit code 0 — test result: ok. 7 passed; 0 failed
local e2e: exit code 0 — 71 passed (1.1m) | 2 passed (32.4s), zero flaky
real-ai e2e: exit code 0 — 1 skipped; no model loaded
```

Performance output, verbatim:

```text
TIMELINE_MEASUREMENTS {"playwright":{"min":738.1383999999998,"median":791.1408499999994,"max":860.3811000000005},"inPage":{"min":165.7999999988824,"median":167.04999999981374,"max":182.5},"handler":{"min":0.5,"median":0.6000000005587935,"max":1.1000000033527613},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1269.643,"catalogMs":229.22860000000014,"simulationMs":72.52780000000007,"dpMs":2447.2538999999997}
```

## Verification output

```text
ccf2cca22596bc72df47f2fec0e0ffae0a145942
 .../R18-model-authored-pipeline-verification.md    | 210 +++++++++++++++++++++
 src/components/AiAssistant.tsx                     |   9 +-
 src/services/titan/titanPipeline.test.ts           | 129 +++++++++++++
 src/services/titan/titanPipeline.ts                | 139 +++++++++++++-
 src/services/titanEngine.test.ts                   |  33 +++-
 5 files changed, 503 insertions(+), 17 deletions(-)

BASE_PREVIEW_SOURCE_COUNT=17
HEAD_PREVIEW_SOURCE_COUNT=28
NEW_MATH_RANDOM_LINES=0
NEW_DYNAMIC_EXECUTION_LINES=0
```

`previewSource` matches after the change, verbatim:

```text
src\components\AiAssistant.tsx:831:          previewSource: async (draftCode, title, runId) => {
src\services\titan\titanPipeline.ts:470:        previewSource: undefined,
src\services\titan\titanPipeline.ts:479:      await options.previewSource?.(result.package.source.code, result.package.title, runId);
src\services\titanEngine.ts:85:  previewSource?: (code: string, title: string, runId: string) => Promise<void> | void;
src\services\titanEngine.ts:1044:          await options.previewSource?.(preparedPackage.source.code, preparedPackage.title, runId);
src\services\titanEngine.ts:1133:          await options.previewSource?.(preparedPackage.source.code, preparedPackage.title, runId);
src\services\titanEngine.ts:1214:          await options.previewSource?.(preparedPackage.source.code, preparedPackage.title, runId);
src\services\titanEngine.ts:1353:          await options.previewSource?.(renderProgramSource(authoredProgram).code, design.title, runId);
src\services\titanEngine.ts:1401:              await options.previewSource?.(renderProgramSource(validation.program).code, design.title, runId);
src\services\titanEntry.ts:130:        await options.previewSource?.(compiled.source.code, compiled.title, runId);
```

`applyPackage(` matches after the change, verbatim:

```text
src\services\titan\titanPipeline.ts:330:          : options.applyPackage(result.package, runId);
src\services\titan\titanPipeline.ts:410:      return options.applyPackage(result.package, runId);
src\services\titan\titanPipeline.ts:480:      await options.applyPackage(result.package, runId);
src\services\titanEngine.test.ts:186:        applyPackage(...args);
src\services\titanEngine.ts:112:  : options.applyPackage(packageValue, runId);
src\services\titanEngine.ts:977:              : options.applyPackage(updatedPackage, runId)
src\services\titanEntry.ts:146:      await runJob('manager-atomic-apply', () => options.applyPackage(packageValue, runId));
```

The `Math.random` and `new Function|eval(` scans contain only base matches; the base-to-head
diff adds zero lines for both patterns.

## Acceptance

1. **Met** — “The handoff states the option taken and, in one paragraph, what the `verify`
   phase for `model-authored` actually recomputes — naming each check and its independent
   source of truth. If a check re-reads an engine verdict rather than recomputing, say so
   explicitly, as H16 did.” Evidence: `H18 / Decision`.
2. **Met** — “A test proves `verify` rejects a bad model artifact. Construct one — a
   `ProgramSpecV1` that validates but whose sample run disagrees with the declared visualization
   mapping, or whose trace is empty — and prove the pipeline refuses it. A test that only proves
   the good path passes does not meet this criterion.” Evidence: `titanPipeline.test.ts:313`.
3. **Met** — “The rollback is proven for the rejection in criterion 2. After the refusal, the
   workspace equals the pre-run snapshot: `algorithmName`, `code`, `steps`, `currentIndex`,
   `analysis`, `inputError`. Field by field, not ‘looks unchanged’.” Evidence: `titanPipeline.test.ts:354`.
4. **Met** — “If ordering changed: a test proves `previewSource` is not called before `verify`
   completes for `model-authored`, and is still called at its current point for at least one
   deterministic template. If ordering did not change, state that and skip this criterion by
   name.” Evidence: `titanPipeline.test.ts:271`.
5. **Met** — “`applyPackage` is still counted exactly-once for all five branches, including
   `model-authored`. Re-run R16's counting test and report the numbers.” Evidence: `titanEngine.test.ts:74`.
6. **Met** — “`adapt-input` and the array-template pipeline are untouched. Name the R15 and R16
   tests that prove it.” Evidence: `H18 / Preserved paths`.
7. **Met as report / live inference unproven** — “The stubbed-agent unit tests and
   `npm run test:e2e:ai` results are reported with what model was loaded. If `test:e2e:ai`
   cannot run on your machine, say so plainly and name what is unproven rather than substituting
   a stub result for it.” Evidence: `H18 / Real model evidence`.
8. **Met** — “All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`.” Evidence: `H18 / Gate output`.
9. **Met locally / T0 remote pending** — “`npm run test:e2e` passes locally, both phases.
   (T0) The remote `browser` job is Claude's to close, and it does not cover the model-authored
   path — say what it does cover.” Evidence: `model-authored-titan-mode.spec.ts:3` + `AiAssistant.tsx:919`.
10. **Met locally** — “Two commits, in order: `route(R18): close`, then `handoff(H18): record`,
    both signed `-s` after verifying `git config user.email` returns `iyott131@gmail.com`.
    An optional published `fix(R18)` between them is permitted.” Evidence: `H18 / Commits`.

## Diff scope

```text
docs/titan/routes/R18-model-authored-pipeline-verification.md | 210 +++++++++++++++++++++
src/components/AiAssistant.tsx                                |   9 +-
src/services/titan/titanPipeline.test.ts                      | 129 +++++++++++++
src/services/titan/titanPipeline.ts                           | 139 +++++++++++++-
src/services/titanEngine.test.ts                              |  33 +++-
5 files changed, 503 insertions(+), 17 deletions(-)
```

All implementation files were forecast by R18. The route is the T0-authored opening commit.

## Deviations

none

## Discovered

- A failed pipeline left later phases waiting, keeping the UI disabled. Existing
  `titan-mode-failures.spec.ts` found it; the executor now terminalizes unreached phases.
- This Chromium environment has no usable WebGPU adapter, so `test:e2e:ai` skipped before
  selecting or loading the default model.

## Untouched

Filtered diff over frozen and T0-owned paths returns only the T0-opened route:

```text
docs/titan/routes/R18-model-authored-pipeline-verification.md
```

No engine preview call site, adapt-input implementation, array-template implementation,
translation path, frozen path, AGENTS file, or protocol file was modified by Sole.

## Blockers

none for local closure. T0 owns remote browser evidence and reconciliation. Real-model proof
requires a WebGPU-capable browser environment.

## For the human

none
