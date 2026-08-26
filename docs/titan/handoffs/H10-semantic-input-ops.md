# H10 — Semantic array ops become reachable

## Turn

- Route: R10
- Base SHA: `5f27c87`
- End SHA: `942b5f33c49178016f248ccd1cf46f7c040e44f5`
- Status: `closed`
- Next holder: Claude (T0)

## Özet

A seçeneği üç dizi opuyla uygulandı: resize, sort ve seeded shuffle artık gerçek EN/TR
isteklerinden üretim dikişine giriyor. Genel input istekleri eski sezgisel fallback'te kaldı.
Tüm kapılar ve 68+2 yerel E2E temiz; test sayısı 759'dan 772'ye çıktı.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `src/services/input/inputPatch.ts:113-147` | parse narrow EN/TR requests into validated semantic patches | edited |
| `src/services/input/inputPatch.test.ts:49-61,98-108,186-208` | prove bilingual classification, seeded determinism, and atomic rejection | edited |
| `src/services/titanModeRouting.ts:8,118` | route semantic requests to `adapt-input` | edited |
| `src/services/titanModeRouting.test.ts:51-61` | prove six real requests enter the intent | edited |
| `src/services/titanEngine.ts:42-47,798-844,882-886` | apply and recompile semantic patches in production | edited |
| `e2e/usage-scenarios.spec.ts:43-69` | drive Turkish semantic sort through the UI and preserve fallback | edited |

## Decision

Option A was selected, narrowly. `resize-array`, `sort-array`, and `shuffle-array` became
reachable. `set-param`, `set-target`, `graph-add-node`, `graph-add-edge`, and `graph-remove`
remain deliberately unreachable; attempting all eight was explicitly out of scope.

The deterministic `createSemanticArrayPatch` classifier accepts only requests that fully
state the operation. Resize additionally requires a fill policy, sort requires a direction,
and shuffle requires an integer seed. Each result is passed through `parseInputPatch`.
Ambiguous requests such as `inputu genişlet` and `inputu düzenle` return `null` and continue
through `adaptSimulationInputFromRequest`, preserving prior behavior byte-for-byte.

`applyAndRecompileInputPatch` now has its first production caller at
`src/services/titanEngine.ts:822`. It validates against the active contract, recompiles a
candidate package, and returns it to the existing five-phase pipeline. The pipeline remains
the only apply authority, after verify succeeds.

## Call path

| hop | file:line |
|---|---|
| User submits `diziyi azalan sırala` | `e2e/usage-scenarios.spec.ts:60` |
| Deterministic router selects `adapt-input` | `src/services/titanModeRouting.ts:118` |
| UI dispatches the five-phase seam | `src/components/AiAssistant.tsx:902` |
| Pipeline produces with deferred apply | `src/services/titan/titanPipeline.ts:214-235` |
| Semantic request becomes a validated patch | `src/services/input/inputPatch.ts:120-147` |
| Engine invokes atomic apply-and-recompile | `src/services/titanEngine.ts:818-835` |
| Existing pipeline verifies then applies | `src/services/titan/titanPipeline.ts:225-235` |
| E2E observes sorted input and rebuilt timeline | `e2e/usage-scenarios.spec.ts:62-64` |

## Behaviour and fallback evidence

Six classifier cases, one per op per language:

```text
resize-array EN: resize the array to 10 descending values
resize-array TR: diziyi 10 elemanli azalan yap
sort-array EN: sort the array in ascending order
sort-array TR: diziyi azalan sirala
shuffle-array EN: shuffle the array with seed 17
shuffle-array TR: diziyi tohum 17 ile karistir
```

The existing E2E first sends `inputu genişlet`, records the resulting input, sends the new
semantic sort, asserts the exact descending permutation and a rebuilt step-1 timeline, then
sends unrecognized `inputu düzenle` and asserts that the fallback changes the input and
keeps the active package visible. Thus both previously heuristic phrases remain live.

The same `shuffle the array with seed 42` request is parsed once and applied twice in
`inputPatch.test.ts:105-107`; both serialized inputs are identical.

The contract-failure test submits `sort-array` against a non-negative contract with an
invalid active input and proves the result retains the exact package object, timeline array,
workspace input, and current index (`inputPatch.test.ts:186-208`).

## Commits

- `942b5f33c49178016f248ccd1cf46f7c040e44f5 route(R10): close`
- `handoff(H10): record` — this handoff commit

Both commits use `Signed-off-by: Mustafa Özel <iyott131@gmail.com>` after
`git config user.email` returned exactly `iyott131@gmail.com`.

## Gate output

### lint

```text
exit code: 0
> oxlint
```

### test

Before: 759. After: 772.

```text
exit code: 0
Test Files  119 passed (119)
      Tests  772 passed (772)
Duration  18.48s
```

### build

```text
exit code: 0
Initial JavaScript: 416.6 / 420.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
```

### desktop:check

```text
exit code: 0
CodeXRay desktop version 2.3.4 is synchronized.
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### local e2e

The full external-server run used the established four-worker local setting and cleaned up
only its listener and launcher PIDs.

```text
exit code: 0
Running 68 tests using 4 workers
CLARIFICATION_PIPELINE_MS 3058
68 passed (1.1m)
Running 2 tests using 1 worker
2 passed (36.3s)
```

The modified flow passed:

```text
ok 67 [chromium] › e2e\usage-scenarios.spec.ts:43:1 › edits, expands, and recompiles the active input from natural commands (5.2s)
```

## Verification output

```text
942b5f33c49178016f248ccd1cf46f7c040e44f5

docs/titan/PROTOCOL.md                             |   6 +
.../titan/routes/R09-unit-suite-budget-validity.md | 103 ++++++++++
.../routes/{queued => }/R10-semantic-input-ops.md  |  21 ++-
docs/titan/routes/queued/R09-semantic-input-ops.md | 209 ---------------------
e2e/usage-scenarios.spec.ts                        |   6 +
src/services/input/inputPatch.test.ts              |  39 ++++
src/services/input/inputPatch.ts                   |  36 ++++
src/services/titanEngine.ts                        |  34 +++-
src/services/titanModeRouting.test.ts              |  11 ++
src/services/titanModeRouting.ts                   |   2 +
10 files changed, 248 insertions(+), 219 deletions(-)
```

`applyAndRecompileInputPatch|createInputReplacementPatch` production evidence:

```text
src\services\input\inputPatch.ts:96:export const createInputReplacementPatch = (
src\services\input\inputPatch.ts:314:export const applyAndRecompileInputPatch = (options: {
src\services\titanEngine.ts:43:  applyAndRecompileInputPatch,
src\services\titanEngine.ts:45:  createInputReplacementPatch,
src\services\titanEngine.ts:822:            const semanticResult = applyAndRecompileInputPatch({
src\services\titanEngine.ts:862:          const patch = createInputReplacementPatch(generated, {
```

The `op: '` scan returns only the InputPatch union/parser/applier/tests plus two pre-existing
substring false positives (`loop: '` translations and trace collection `op`). No new op
literal exists elsewhere. The `Math.random` scan has the same pre-existing matches at base;
the R10 close commit adds none.

## Acceptance

1. **Met** — The handoff states the decision and, if A, exactly which ops became reachable and which deliberately did not. Evidence: `H10 / Decision`.
2. **Met** — Each newly-reachable op is produced by a real user request in **both** English and Turkish, one classifier test per op per language. Evidence: `src/services/input/inputPatch.test.ts:49-61`.
3. **Met** — **End to end, not unit only.** An e2e spec drives at least one semantic op through the UI and asserts the resulting input and rebuilt timeline. Evidence: `e2e/usage-scenarios.spec.ts:60-64 + src/services/titanEngine.ts:822`.
4. **Met** — Behaviour preservation: the requests that worked before still work. Name the tests that cover the previously-heuristic phrasings and show them passing. Evidence: `e2e/usage-scenarios.spec.ts:52-69`.
5. **Met** — An unrecognized adaptation request still falls through to the existing path and works — proven by a test, so the fallback is not silently lost. Evidence: `e2e/usage-scenarios.spec.ts:65-69`.
6. **Met** — A malformed or contract-violating op changes nothing: workspace, package, and timeline untouched, proven by a test asserting identity. Evidence: `src/services/input/inputPatch.test.ts:186-208`.
7. **Met** — `applyAndRecompileInputPatch` has a verdict: a production caller, a deletion with the test-count move stated, or a named future route. Evidence: `src/services/titanEngine.ts:822`.
8. **Met** — No op literal outside the union declaration, its parser, its applier, or a test. Evidence: `H10 / Verification output / op scan`.
9. **Met** — Determinism shown: the same seeded request twice produces the same input, asserted in a test rather than argued in prose. Evidence: `src/services/input/inputPatch.test.ts:105-107`.
10. **Met** — All four gates clean: `npm run lint`, `npm run test`, `npm run build`, `npm run desktop:check`. Evidence: `H10 / Gate output`.
11. **Met locally / T0 remote pending** — `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is Claude's to close. Evidence: `H10 / Gate output / local e2e`.
12. **Met** — Two commits, in order: `route(R10): close`, then `handoff(H10): record`, both signed `-s` after verifying `git config user.email` returns `iyott131@gmail.com`. Evidence: `H10 / Commits`.

## Diff scope

```text
docs/titan/PROTOCOL.md                             |   6 +
.../titan/routes/R09-unit-suite-budget-validity.md | 103 ++++++++++
.../routes/{queued => }/R10-semantic-input-ops.md  |  21 ++-
docs/titan/routes/queued/R09-semantic-input-ops.md | 209 ---------------------
e2e/usage-scenarios.spec.ts                        |   6 +
src/services/input/inputPatch.test.ts              |  39 ++++
src/services/input/inputPatch.ts                   |  36 ++++
src/services/titanEngine.ts                        |  34 +++-
src/services/titanModeRouting.test.ts              |  11 ++
src/services/titanModeRouting.ts                   |   2 +
10 files changed, 248 insertions(+), 219 deletions(-)
```

The first four rows are T0-owned work already present between the recorded base and holder
close. The close commit contains exactly the six rows in `What changed`.

## Deviations

none

## Discovered

- The route's `op: '` verification pattern also matches the suffix of `loop: '` and the
  unrelated trace collection `op` field. Those false positives existed at base; R10 added
  no out-of-contract literal.
- Importing the semantic parser into routing grows the lazy routing chunk, but every build
  budget remains green and the initial bundle decreases by 0.1 KiB.
- `npm ci` reports the existing audit advisory and Node/jsdom engine warning; dependencies
  were out of scope.

## Untouched

```text
git diff --name-only 5f27c87..942b5f3 -- .claude .agents docs/tasks docs/legacy CodeXray-readme-neon.svg docs/TITAN_MODE_YOL_HARITASI.md src/services/titan/translate.ts src/services/webProblemOrchestrator.ts src/services/trace
<no output>
```

The frozen untracked `.claude/`, `CodeXray-readme-neon.svg`, and
`docs/TITAN_MODE_YOL_HARITASI.md` remain untouched.

## Blockers

- T0 must run the remote browser gate and reconcile the architecture-map line before
  opening the next route.

## For the human

none
