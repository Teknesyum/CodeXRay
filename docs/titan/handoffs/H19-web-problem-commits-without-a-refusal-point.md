# H19 — web Java fallback gains an external refusal point

## Turn

- Route: `R19`
- Base SHA: `c9e2c43`
- End SHA: `c6cc8617a11c77fcc94c9c7273b6c1892e334254`
- Status: `closed`
- Next holder: `Claude`

## Özet

Option A uygulandı: Java fallback paketi beş aşamalı pipeline dışında artık workspace'e veya çözüm oturumuna yazamıyor.
Verify, artifact program/input/visualization'ından paketi yeniden derleyip source, trace ve test sonuçlarını karşılaştırıyor; yanlış problem çözümünü kanıtlamıyor.
Refusal workspace'i, bound-source kaydını ve bütün `codexray.*` kalıcı anahtarlarını koruyor; hata mevcut oturumda görünür kalıyor.

## What changed

| Path:line-range | Intent | Change |
|---|---|---|
| `src/services/titan/titanPipeline.ts:209-247` | Independently recompile and compare a web fallback artifact | added |
| `src/services/titan/titanPipeline.ts:608-688` | Run Java fallback behind route/produce/verify/apply with one visible plan | added |
| `src/components/AiAssistant.tsx:144-162,560-627` | Move workspace apply and solution persistence into verified apply callback; restore pre-request chat persistence on refusal | edited |
| `src/services/titan/titanPipeline.test.ts:498-591` | Prove bad-trace refusal, unchanged state/persistence, and exactly-once success | added |
| `e2e/translation-provenance.spec.ts:3-297` | Drive visible success/refusal and requested-URL privacy behavior | edited |

## Commits

- `a41c7a0dec028550663705517d1a8b1184a64b0d route(R19): close`
- `c6cc8617a11c77fcc94c9c7273b6c1892e334254 fix(R19): preserve persisted chat on refusal`

## Option and verification ceiling

**Option A.** The orchestrator remains a producer; it never applied the package, so no artificial
`deferApply` flag was added. `startWebProblemFallbackPipeline` suppresses the inner job graph,
shows one five-stage plan, and owns the only apply callback.

| Check | Independent source of truth | What it proves | What it cannot prove |
|---|---|---|---|
| Program compile | `artifact.package.program`, `input`, and `visualization`, each structured-cloned and passed to `compileCustomSimulationPackage` | The carried package is reproducible from its own deterministic program contract | The program solves the fetched problem |
| Source | Recompiler output | Carried source exactly equals deterministic renderer output | Java and SimLang are semantically equivalent |
| Trace | Recompiler output through `sameTrace` | Carried steps exactly equal deterministic compilation | Trace answers the source problem |
| Tests | Recompiler test run plus carried `tests.passed` and exact result equality | Both deterministic test runs pass and agree | Tests cover the problem's true semantics or examples |

The earlier `translateToVerifiedPackage` gate is unchanged: schema validation, program validation,
compile, non-empty trace, and passing tests still run before this independent refusal point.

## Gate output

### Verification greps — exit 0

Base direct fallback sites:

```text
c9e2c43:src/components/AiAssistant.tsx:572:          applySimulationPackage(translatedPackage, run.runId);
c9e2c43:src/components/AiAssistant.tsx:594:          saveBoundWebSource(nextSession);
```

Final product sites, verbatim:

```text
src\components\AiAssistant.tsx:585:              applySimulationPackage(translatedPackage, runId);
src\components\AiAssistant.tsx:891:            applySimulationPackage(value, runId);
src\context\TimelineContext.titanMode.test.tsx:38:      <button type="button" onClick={() => timeline.applySimulationPa
ckage(packageValue, 'run-1')}>apply</button>
src\App.tsx:247:        applySimulationPackage(rebuiltPackage, `manual-input-${Date.now().toString(36)}`);

src\components\AiAssistant.tsx:35:  saveBoundWebSource,
src\components\AiAssistant.tsx:549:        saveBoundWebSource(activeWebSession);
src\components\AiAssistant.tsx:607:              saveBoundWebSource(nextSession);
src\components\AiAssistant.tsx:981:          saveBoundWebSource(nextSession);
src\services\webSource.test.ts:2:import { WEB_SOURCE_SESSION_KEY, buildWebProblemPrompt, clearBoundWebSource, extractFi
rstPublicHttpsUrl, loadBoundWebSource, normalizeWebProblem, readWebSource, saveBoundWebSource } from './webSource';
src\services\webSource.test.ts:127:    saveBoundWebSource({ version: 1, document, problem, solution: null });
src\services\webSource.ts:361:export const saveBoundWebSource = (session: BoundWebSourceSessionV1): void => {
```

The fallback call counts remain one each; both moved inside `applyArtifact`, reached only after
`verifyWebProblemFallbackArtifact` succeeds.

No new `Math.random`, `new Function`, or `eval(` match exists in `c9e2c43..c6cc861`.

### `npm run lint` — exit 0

```text
> oxlint
```

### `npm run test` — exit 0

Before R19: 119 files / 831 tests. After R19:

```text
> vitest run
 RUN  v4.1.10 C:/Users/Administrator/Desktop/Projeler/CodeXray
 Test Files  119 passed (119)
      Tests  834 passed (834)
   Start at  14:22:47
   Duration  27.53s (transform 8.09s, setup 32.72s, import 19.91s, tests 50.72s, environment 212.06s)
```

### `npm run build` — exit 0

```text
✓ 1888 modules transformed.
✓ built in 398ms
Initial JavaScript: 416.8 / 420.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
```

### `npm run desktop:check` — exit 0

```text
CodeXRay desktop version 2.3.4 is synchronized.
running 7 tests
test tests::loopback_urls_are_normalized ... ok
test tests::non_loopback_and_credential_urls_are_rejected ... ok
test tests::reasoning_only_length_stop_is_returned_for_a_bounded_retry ... ok
test tests::structured_output_requires_three_native_trials ... ok
test tests::authentication_errors_are_actionable_without_echoing_credentials ... ok
test tests::probe_json_parser_accepts_plain_or_fenced_objects ... ok
test tests::completion_timeout_scales_with_the_requested_output_budget ... ok
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
running 0 tests
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
running 0 tests
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### `npm run test:e2e` with external server and `CODEXRAY_E2E_WORKERS=2` — exit 0

```text
Running 73 tests using 2 workers
  73 passed (2.3m)
Running 2 tests using 1 worker
TIMELINE_MEASUREMENTS {"playwright":{"min":731.7737000000016,"median":784.6419999999994,"max":875.1413999999995},"inPage":{"min":163.80000000074506,"median":166.6499999994412,"max":182.5},"handler":{"min":0.2999999988824129,"median":0.5,"max":0.9999999962747097},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1357.7392,"catalogMs":259.31669999999986,"simulationMs":75.12609999999995,"dpMs":2445.1659}
  2 passed (33.3s)
```

Final-run listener and launcher PIDs `25868` and `25572` were stopped.

## Acceptance

1. The handoff states the option taken and what the `verify` phase recomputes, naming each
   check's independent source of truth — the form H16, H18, and H17c used. — **met**: `## Option and verification ceiling`.
2. **A test proves a bad web artifact is refused**, and names what makes it bad. If the answer
   is that only a non-compiling or empty-trace package can be refused, say that in the first
   sentence rather than implying more. — **met**: `src/services/titan/titanPipeline.test.ts:498` uses a compilable package whose carried trace explanation disagrees with independent recompilation.
3. **Nothing is persisted on refusal.** A test proves `saveBoundWebSource` is not called and no
   `codexray.*` storage key changes when `verify` rejects. — **met**: `e2e/translation-provenance.spec.ts:155` snapshots and compares every `codexray.*` key; `src/services/titan/titanPipeline.test.ts:521` proves the persist/apply callback is not called.
4. **The workspace is unchanged on refusal**, field by field, as R18's criterion 3 required. — **met**: `src/services/titan/titanPipeline.test.ts:521` compares the full workspace snapshot and `e2e/translation-provenance.spec.ts:155` checks visible preset/input/step fields.
5. **Exactly once on success.** Count `applySimulationPackage` for both outcomes. — **met**: `src/services/titan/titanPipeline.test.ts:521` counts zero on refusal and `:567` counts one on success.
6. The network invariant is re-asserted by test: only the requested URL leaves the browser on
   this path. Name the existing `privacy-network.spec.ts` assertions if they already cover it,
   or extend them. — **met**: `e2e/translation-provenance.spec.ts:3` asserts one reader request containing only the requested URL and excluding candidate/input payload; `e2e/privacy-network.spec.ts:3` retains the broader private-payload assertion.
7. `adapt-input`, the array templates, `discuss-current-step`, and `model-authored` are
   untouched. Name the R15, R16, R17c, and R18 tests that prove it. — **met**: unchanged tests `rejects a well-formed artifact whose carried trace disagrees with independent recomputation`, `defers the deterministic array engine apply and applies its verified package exactly once`, `accepts every deterministic fallback at the maximum legal input size`, and `independently verifies a model-authored package before previewing and applying it exactly once` in `titanPipeline.test.ts` all pass.
8. A user-visible e2e spec drives a stubbed agent worker through the fallback and shows what
   the user gets on both outcomes. **This criterion may not close on a unit test.** — **met**: `e2e/translation-provenance.spec.ts:3` and `:155`, production call `src/components/AiAssistant.tsx:558`.
9. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`. — **met**: `## Gate output`.
10. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
    Claude's to close. — **met locally**: `73 passed (2.3m)` and `2 passed (33.3s)` above; remote remains T0.
11. Two commits, in order: `route(R19): close`, then `handoff(H19): record`, both signed `-s`
    after verifying `git config user.email` returns `iyott131@gmail.com`. An optional published
    `fix(R19)` between them is permitted. — **met at record time**: close `a41c7a0`; handoff follows after identity verification.

## Diff scope

```text
AGENTS.md                                          |   4 +-
 ...-web-problem-commits-without-a-refusal-point.md | 213 +++++++++++++++++++++
 e2e/translation-provenance.spec.ts                 | 157 +++++++++++++++
 src/components/AiAssistant.tsx                     |  93 ++++++---
 src/services/titan/titanPipeline.test.ts           |  96 ++++++++++
 src/services/titan/titanPipeline.ts                | 111 +++++++++++
 6 files changed, 644 insertions(+), 30 deletions(-)
```

## Deviations

All four product/test files are forecast in `## Expected Files`; `webProblemOrchestrator.ts`
did not need a synthetic `deferApply` because it was already producer-only. The permitted
`fix(R19)` commit was added after the first full run because the literal persistence criterion
also covers `codexray.ai-chat.v1`; it restores that key's pre-request value while keeping the
refusal visible in the current React session.

## Discovered

- A refused fallback must remain visible in the current chat without becoming reload-persistent; `AiAssistant.tsx` restores the pre-request chat-storage value only on fallback failure.
- The compatible web branch remains untouched.

## Untouched

`git show --name-only a41c7a0`:

```text
e2e/translation-provenance.spec.ts
src/components/AiAssistant.tsx
src/services/titan/titanPipeline.test.ts
src/services/titan/titanPipeline.ts
```

No frozen or T0-owned path changed in the close commit. `AGENTS.md` and the route in the base-range
stat are T0's opening/reconciliation changes. Corrective commit `c6cc861` changes only
`src/components/AiAssistant.tsx` and `e2e/translation-provenance.spec.ts`.

## Blockers

none locally. T0 owns the remote browser job and `AGENTS.md` reconciliation.

## For the human

none
