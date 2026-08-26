# H15 — Adapt-input verification verifies

## Turn

- Route: R15
- Base SHA: `abd8d54`
- End SHA: `2b7c250856cfe93f5c01f263da1ba23c86d63ea7`
- Status: `closed`
- Next holder: Claude (T0)

## Özet

A seçildi: `adapt-input` doğrulaması artık taşınan trace'i girdiden bağımsız yeniden
üretip birebir karşılaştırıyor. İyi biçimli fakat tutarsız artifact reddediliyor ve UI
çalışma alanını koruyor; maliyet ölçümü, 807 test ve 71+2 E2E temiz.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `src/services/titan/titanPipeline.ts:113-143,254-261` | independently recompute and compare adapt-input traces before apply | edited |
| `src/services/titan/titanPipeline.test.ts:146-245` | prove success, reachable mismatch rejection, identity, ordering, and cost | edited |
| `e2e/titan-pipeline-verification.spec.ts:1-43` | force a browser-only trace mismatch and prove visible rollback | added |

## Decision

Option A. `verify` can now reject a well-formed, non-empty artifact whose carried trace does
not equal a fresh deterministic trace generated from the artifact's own input; the previous
shape check accepted it.

For package artifacts, verification calls `recompileSimulationInput` with a cloned produced
input and compares the rebuilt steps. For registry inputs, it calls
`generateSimulationSteps` with the committed algorithm and source. No model participates.

## Measurement

The active-package semantic patch path caps expanded arrays at 20 values. On the same
machine, 25 checks on a descending 20-value Bubble Sort input measured:

```text
ADAPT_VERIFY_MEASUREMENT {"size":20,"iterations":25,"beforeMs":0.004,"afterMs":17.886}
```

The old shape check cost `0.00016 ms/check`; independent recomputation and comparison cost
`0.71544 ms/check`. The added cost is small enough for Option A.

## Atomicity and ordering

The mismatch test's `startRun` returns `status: success`, a valid input, and a non-empty but
tampered trace. Verification rejects it. The original workspace input and timeline remain
the same objects, current index remains `1`, the committed package remains unchanged, and
neither apply callback runs. `deferApply: true` is asserted inside `startRun`; event order is
`produce`, then `rejected`, with no apply event.

The browser test intercepts only Vite's dynamically loaded pipeline module during that test
and replaces the comparison result with `false`; product code contains no test hook. The
real application displays the Turkish verification failure while parameter, input, and
visible step remain unchanged.

## Other intents

`discuss-current-step`: its current deterministic shape check could compare factual claims
in the summary/tutor answer against the selected committed step and its bounded trace
context. That needs a deterministic claim extractor and is deferred, without code, to
`R16-grounded-current-step-verification`.

`create-algorithm` with `template: 'model-authored'`: before it can sit behind this phase, a
successor must independently re-run schema validation, deterministic compilation, sample
execution, visual-contract checks, and critic gates on the produced package, then prove
rollback before application. Deferred to `R17-model-authored-pipeline-verification`.

## Progress display

Before and after, users see the same five ordered synthetic bars: `route → produce →
semantics → verify → apply`; semantics remains skipped when deterministic semantics are
already sufficient. No labels, weights, order, or suppressed seven-job engine progress
changed. Only the work performed while the verify bar is running changed.

## Behaviour preservation

- R10 array ops: `usage-scenarios.spec.ts` “edits, expands, and recompiles…”
- R12 graph ops: `titan-mode-user-graph.spec.ts` “requires a missing target, then builds…”
- R13 numeric parameter: `usage-scenarios.spec.ts` “changes a numeric algorithm parameter…”
- R14 text parameter: `usage-scenarios.spec.ts` “changes a text algorithm parameter…”

All four pass through the new verifier in the clean 71-test browser run.

## Call path

`e2e/titan-pipeline-verification.spec.ts:3-43` → `AiAssistant.tsx:902` →
`titanPipeline.ts:236-275` → `verifyAdaptInputArtifact:116-143` → rejected verify →
`AiAssistant.tsx:1040-1060` visible failure, without either apply callback.

## Commits

- `2b7c250856cfe93f5c01f263da1ba23c86d63ea7 route(R15): close`
- `957da74 fix(R15): target visible verification error`
- `handoff(H15): record` — this commit

All are signed after `git config user.email` returned `iyott131@gmail.com`. The corrective
commit records that the first post-close full E2E run found two visible copies of the same
error string; the locator was narrowed to the chat paragraph without changing product code.

## Gate output

```text
lint: exit code 0 — > oxlint
test: exit code 0 — Test Files 119 passed (119) | Tests 807 passed (807)
test count: before 805; after 807
build: exit code 0 — Initial JavaScript: 416.6 / 420.0 KiB
desktop:check: exit code 0 — test result: ok. 7 passed; 0 failed
local e2e: exit code 0 — 71 passed (1.1m) | 2 passed (34.0s)
```

## Verification output

```text
2b7c250856cfe93f5c01f263da1ba23c86d63ea7
docs/titan/routes/R15-verify-does-not-verify.md | 224 ++++++++++++++++++++++++
 e2e/titan-pipeline-verification.spec.ts         |  41 +++++
 src/services/titan/titanPipeline.test.ts        |  87 ++++++++-
 src/services/titan/titanPipeline.ts             |  39 ++++-
 4 files changed, 379 insertions(+), 12 deletions(-)
```

After the corrective commit the unabridged stat is:

```text
docs/titan/routes/R15-verify-does-not-verify.md | 224 ++++++++++++++++++++++++
 e2e/titan-pipeline-verification.spec.ts         |  43 +++++
 src/services/titan/titanPipeline.test.ts        |  87 ++++++++-
 src/services/titan/titanPipeline.ts             |  39 ++++-
 4 files changed, 381 insertions(+), 12 deletions(-)
```

`deferApply` evidence:

```text
src/services/titan/titanPipeline.test.ts:174:        expect(options.deferApply).toBe(true);
src/services/titan/titanPipeline.test.ts:206:        expect(options.deferApply).toBe(true);
src/services/titan/titanPipeline.ts:254:        deferApply: true,
src/services/titanEngine.ts:94:  deferApply?: boolean;
src/services/titanEngine.ts:965:          if (options.deferApply) return 'Application deferred to the five-phase pipeline.';
```

The `Math.random` scan contains only base matches; R15 adds none.

## Acceptance

1. **Met** — Option A and the newly rejected inconsistency are stated. Evidence: `H15 / Decision`.
2. **Met** — successful production result with tampered non-empty trace rejects. Evidence: `titanPipeline.test.ts:182-224`.
3. **Met** — before/after largest semantic input measurement is numeric. Evidence: `H15 / Measurement`.
4. **Met** — identities and visible UI state remain unchanged. Evidence: `titan-pipeline-verification.spec.ts:3-43` + `titanPipeline.ts:116-143`.
5. **Met** — apply follows successful verify and `deferApply` is unchanged. Evidence: `titanPipeline.test.ts:146-224`.
6. **Met** — deterministic current-step verdict and named route recorded. Evidence: `H15 / Other intents`.
7. **Met** — model-authored successor and required gates recorded. Evidence: `H15 / Other intents`.
8. **Met** — five bars unchanged before/after. Evidence: `H15 / Progress display`.
9. **Met** — R10/R12/R13/R14 browser paths pass. Evidence: `H15 / Behaviour preservation`.
10. **Met** — four gates clean. Evidence: `H15 / Gate output`.
11. **Met locally / T0 remote pending** — 71+2 clean. Evidence: `H15 / Gate output`.
12. **Met** — signed close, corrective, and handoff commits. Evidence: `H15 / Commits`.

## Diff scope

The unabridged final stat is under `Verification output`. The route file is T0-owned opening
work; all three implementation files match Expected Files.

## Deviations

none

## Discovered

- At eight browser workers, the unrelated `radio-controller.spec.ts` once exhausted its
  30-second whole-test timeout while waiting to hover the radio. No timeout or retry changed;
  the full suite passed cleanly with four workers.
- The verification failure text appears both in the failed verify progress summary and the
  chat paragraph. The E2E deliberately targets the paragraph as the user-facing result.

## Untouched

Frozen paths, T0-owned paths, `src-tauri/**`, and the engine's `deferApply` implementation
have no R15 implementation diff. Pre-existing untracked frozen files remain untouched.

## Blockers

- T0 must run the remote browser gate and reconcile `AGENTS.md` plus `PROTOCOL.md` wording.

## For the human

none
