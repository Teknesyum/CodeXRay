# H07 — Adapt-input moves onto the seam

## Turn

- Route: R07
- Base SHA: `b4f9ae4`
- End SHA: `ea4c07f9c659f282d82ab9210911a03aab8dcbca`
- Status: `closed`
- Next holder: Claude (T0)

## Özet

`adapt-input` artık üretimde beş fazlı dikişten geçiyor ve gerçek mutation yalnız doğrulama
sonrası apply fazında yapılıyor. Option A seçildi: doğal dil adaptörünün her çıktısı kapalı,
çalışma zamanı doğrulamalı `InputPatchV1` op'una çevriliyor. Matris, grafik ve iki özel program
davranışı korundu; başarısız doğrulama çalışma alanı, paket ve timeline kimliğini koruyor.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `src/services/titan/titanPipeline.ts:104-252` | add the second production seam | edited |
| `src/components/AiAssistant.tsx:801,886-907` | dispatch `adapt-input` to the seam | edited |
| `src/services/titanEngine.ts:43-89,792-910` | emit typed patches and defer mutation to pipeline apply | edited |
| `src/services/input/inputPatch.ts:8-112,169-265` | add validated matrix/graph replacement ops and deterministic adapter bridge | edited |
| `src/services/titan/titanPipeline.test.ts:145-217` | prove verified apply and failed identity preservation | edited |
| `src/services/titanEngine.test.ts:679-722` | prove spiral and Predict Winner special cases | edited |
| `src/services/input/inputPatch.test.ts:48-170` | validate all closed ops and adapter output | edited |
| `src/i18n/translations.ts:249,608` | add EN/TR verification-failure text | edited |
| `src/i18n/translations.test.ts:32-36` | prove both failure translations | edited |
| `e2e/usage-scenarios.spec.ts:43-62` | assert adapted input and rebuilt navigable timeline | edited |

## Decision

Option A was selected. The shipped natural-language heuristics remain the deterministic
producer so current behavior is preserved, but their output is no longer directly mutable
state. `createInputReplacementPatch` converts it to one of the closed operations and calls
`parseInputPatch`; `applyInputPatch` enforces the active input contract. `set-matrix` and
`set-graph` were added because flattening matrices into `set-array`, or expressing a complete
graph transaction as an accidental sequence, would change existing behavior.

The engine now runs with `deferApply: true` under this seam. It produces a rebuilt candidate
and the pipeline verifies a nonempty input/timeline before applying the package or input.
Option B would have kept heuristic mutation as the architectural contract and deleted the
only closed, schema-validated mutation vocabulary; that cost is unnecessary because the
typed bridge preserves the existing outputs.

## Commits

- `ea4c07f9c659f282d82ab9210911a03aab8dcbca route(R07): close`
- `handoff(H07): record` — this handoff commit

Both commits use `-s`; repository-local email was checked before each commit:

```text
Signed-off-by: Mustafa Özel <iyott131@gmail.com>
```

## Call path

| hop | file:line |
|---|---|
| User submits an adaptation request | `src/components/AiAssistant.tsx:785-805` |
| Existing router returns `adapt-input` | `src/services/titanModeRouting.ts:220-229` |
| Production dispatch selects the seam | `src/components/AiAssistant.tsx:886-906` |
| Adapt-input seam invokes the five phases | `src/services/titan/titanPipeline.ts:178-252` |
| Engine derives current-compatible candidate | `src/services/titanEngine.ts:792-835` |
| Candidate becomes parser-validated closed op | `src/services/input/inputPatch.ts:96-112` |
| Contract applies op and compiler rebuilds candidate | `src/services/titanEngine.ts:836-884` |
| Engine defers mutation | `src/services/titanEngine.ts:888-899` |
| Pipeline verifies, then applies atomically | `src/services/titan/titanPipeline.ts:225-241` |
| UI test observes new input and timeline | `e2e/usage-scenarios.spec.ts:43-62` |

Production seam measurement:

```text
src/components/AiAssistant.tsx:801:        const { startAdaptInputPipeline, startDiscussCurrentStepPipeline, startTitanModeRun } = await import('../services/titan/titanPipeline');
src/components/AiAssistant.tsx:902:            ? startAdaptInputPipeline({
src/services/titan/titanPipeline.ts:178:export const startAdaptInputPipeline = (
src/services/titan/titanPipeline.ts:214:  const promise = executeTitanPipeline({
```

## Gate output

### lint

```text
exit code: 0
> oxlint
```

### test

Before: 753. After: 759.

```text
exit code: 0
Test Files  119 passed (119)
      Tests  759 passed (759)
```

### build

```text
exit code: 0
Initial JavaScript: 416.7 / 420.0 KiB
Lazy JavaScript: 34 chunks, each <= 100.0 KiB
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

The clean run used the existing documented `CODEXRAY_E2E_WORKERS=4` setting; retries and
timeouts remained unchanged.

```text
exit code: 0
Running 68 tests using 4 workers
68 passed (2.3m)
TIMELINE_MEASUREMENTS {"playwright":{"min":1283.876400000001,"median":1543.0860500000003,"max":2230.9416999999994},"inPage":{"min":197.60000000149012,"median":313.25,"max":506.1000000014901},"handler":{"min":0.9999999925494194,"median":1.1999999955296516,"max":5.299999989569187},"deliberateDelayMs":0}
2 passed (1.1m)
```

The modified user flow passed:

```text
ok 67 [chromium] › e2e\usage-scenarios.spec.ts:43:1 › edits, expands, and recompiles the active input from natural commands (6.3s)
```

The watched clarification spec passed on its first attempt in all three local runs. The first
two full-suite attempts at the default eight workers failed with unrelated, inconsistent
resource-timeout sets (`60 passed / 8 failed`, then `65 passed / 3 failed`); the R07 flow
passed both. No timeout or retry setting was changed.

## Verification output

```text
ea4c07f9c659f282d82ab9210911a03aab8dcbca

.../routes/R06-translation-reaches-the-user.md     |  74 ++++++++
 docs/titan/routes/R07-adapt-input-on-the-seam.md   | 211 +++++++++++++++++++++
 e2e/usage-scenarios.spec.ts                        |   2 +
 src/components/AiAssistant.tsx                     |   9 +-
 src/i18n/translations.test.ts                      |   5 +
 src/i18n/translations.ts                           |   2 +
 src/services/input/inputPatch.test.ts              |  20 ++
 src/services/input/inputPatch.ts                   |  43 +++++
 src/services/titan/titanPipeline.test.ts           |  71 +++++++
 src/services/titan/titanPipeline.ts                |  77 ++++++++
 src/services/titanEngine.test.ts                   |  20 ++
 src/services/titanEngine.ts                        |  33 +++-
 12 files changed, 559 insertions(+), 8 deletions(-)
```

Criterion 6 command, verbatim output:

```text
src\services\input\inputPatch.test.ts:6:  applyAndRecompileInputPatch,
src\services\input\inputPatch.test.ts:7:  applyInputPatch,
src\services\input\inputPatch.test.ts:9:  parseInputPatch,
src\services\input\inputPatch.test.ts:44:  const result = applyInputPatch(input, patch, contract(input.kind, input, constraints));
src\services\input\inputPatch.test.ts:82:    expect(valid.map(parseInputPatch).every(Boolean)).toBe(true);
src\services\input\inputPatch.test.ts:83:    expect(invalid.map(parseInputPatch).every((patch) => patch === null)).toBe(true);
src\services\input\inputPatch.test.ts:130:    expect(applyInputPatch(arrayInput, { op: 'set-text', value: 'wrong' }, contract('array', arrayInput)))
src\services\input\inputPatch.test.ts:132:    expect(applyInputPatch(arrayInput, { op: 'set-array', values: [-1, 2] }, contract('array', arrayInput, ['Non-negative values only'])))
src\services\input\inputPatch.test.ts:134:    expect(applyInputPatch(graphInput, { op: 'graph-add-edge', from: 'B', to: 'missing', weight: 4 }, contract('graph', graphInput)))
src\services\input\inputPatch.test.ts:136:    expect(applyInputPatch(graphInput, { op: 'set-target', nodeId: 'missing' }, contract('graph', graphInput)))
src\services\input\inputPatch.test.ts:156:    const result = applyAndRecompileInputPatch({
src\services\input\inputPatch.ts:32:export const parseInputPatch = (value: unknown): InputPatchV1 | null => {
src\services\input\inputPatch.ts:109:  const patch = parseInputPatch(raw);
src\services\input\inputPatch.ts:169:export const applyInputPatch = (
src\services\input\inputPatch.ts:278:export const applyAndRecompileInputPatch = (options: {
src\services\input\inputPatch.ts:285:  const applied = applyInputPatch(options.currentInput, options.patch, options.activePackage.input);
src\services\titanEngine.ts:42:import { applyInputPatch, createInputReplacementPatch } from './input/inputPatch';
src\services\titanEngine.ts:847:          const applied = applyInputPatch(current ?? generated, patch, contract);
```

Criterion 1/R04 preservation command, verbatim output:

```text
src\components\AiAssistant.tsx:801:        const { startAdaptInputPipeline, startDiscussCurrentStepPipeline, startTitanModeRun } = await import('../services/titan/titanPipeline');
src\components\AiAssistant.tsx:887:          ? startDiscussCurrentStepPipeline({
src\services\titan\titanPipeline.test.ts:3:  executeTitanPipeline,
src\services\titan\titanPipeline.test.ts:5:  startDiscussCurrentStepPipeline,
src\services\titan\titanPipeline.test.ts:13:    const result = await executeTitanPipeline({
src\services\titan\titanPipeline.test.ts:34:    await expect(executeTitanPipeline({
src\services\titan\titanPipeline.test.ts:46:    await expect(executeTitanPipeline({
src\services\titan\titanPipeline.test.ts:67:    await expect(executeTitanPipeline({
src\services\titan\titanPipeline.test.ts:89:    const run = startDiscussCurrentStepPipeline({
src\services\titan\titanPipeline.test.ts:119:    const run = startDiscussCurrentStepPipeline({
src\services\titan\titanPipeline.ts:31:export const executeTitanPipeline = async <Route, Artifact>(
src\services\titan\titanPipeline.ts:110:export const startDiscussCurrentStepPipeline = (
src\services\titan\titanPipeline.ts:146:  const promise = executeTitanPipeline({
src\services\titan\titanPipeline.ts:214:  const promise = executeTitanPipeline({
```

## Acceptance

1. **Met** — `adapt-input` requests enter `executeTitanPipeline` in production: shown as the dispatch site plus the pipeline entry, `file:line` each. Evidence: `src/components/AiAssistant.tsx:902 → src/services/titan/titanPipeline.ts:214`.
2. **Met** — `## Call path` is filled: user request to applied input, every hop `file:line`, naming the e2e spec that traverses it. Evidence: `H07 / Call path`.
3. **Met** — **Behaviour is preserved, proven end to end.** An e2e spec drives a real input-adaptation request through the UI and asserts the resulting input and rebuilt timeline. If a spec covering this exists, extend or cite it; if not, write it. Evidence: `e2e/usage-scenarios.spec.ts:43-62 + src/components/AiAssistant.tsx:902`.
4. **Met** — The two special-cased programs still adapt correctly — one test each naming `spiral_matrix` and `predict_winner_interval_dp` behaviour explicitly. Evidence: `src/services/titanEngine.test.ts:679-722`.
5. **Met** — A failed adaptation changes nothing: workspace, package, and timeline are untouched, proven by a test that submits an impossible request and asserts identity. Evidence: `src/services/titan/titanPipeline.test.ts:177-217`.
6. **Met** — The `inputPatch.ts` decision is implemented and stated. If A: `parseInputPatch` validates every op on the path, shown by test. If B: the module and its references are gone, the test count move is stated, and the handoff names the architectural claim being given up. Evidence: `src/services/input/inputPatch.test.ts:48-107`.
7. **Met** — `discuss-current-step` still flows through its seam — the existing e2e assertion, unmodified. Evidence: `e2e/titan-mode.spec.ts:22 + src/components/AiAssistant.tsx:887`.
8. **Met** — No free-form mutation strings: if ops exist, grep shows every op literal lives in the union declaration, its parser, or a test. Evidence: `rg op-literal scan excluding inputPatch.ts/inputPatch.test.ts: <no output>`.
9. **Met** — All four gates clean: `npm run lint`, `npm run test`, `npm run build`, `npm run desktop:check`. Evidence: `H07 / Gate output`.
10. **Met locally / T0 remote pending** — `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is Claude's to close. Evidence: `H07 / Gate output / local e2e`.
11. **Met** — Two commits, in order: `route(R07): close`, then `handoff(H07): record`, both signed `-s` after verifying `git config user.email` returns `iyott131@gmail.com`. A published `fix(R07): ...` between them is permitted when remote evidence forces it. Evidence: `H07 / Commits`.

**(T0)** Documentation follow-through — the architecture map's `inputPatch.ts` line and the titan `AGENTS.md` seam count — is Claude's, in `## T0 reconciliation`.

## Diff scope

```text
.../routes/R06-translation-reaches-the-user.md     |  74 ++++++++
 docs/titan/routes/R07-adapt-input-on-the-seam.md   | 211 +++++++++++++++++++++
 e2e/usage-scenarios.spec.ts                        |   2 +
 src/components/AiAssistant.tsx                     |   9 +-
 src/i18n/translations.test.ts                      |   5 +
 src/i18n/translations.ts                           |   2 +
 src/services/input/inputPatch.test.ts              |  20 ++
 src/services/input/inputPatch.ts                   |  43 +++++
 src/services/titan/titanPipeline.test.ts           |  71 +++++++
 src/services/titan/titanPipeline.ts                |  77 ++++++++
 src/services/titanEngine.test.ts                   |  20 ++
 src/services/titanEngine.ts                        |  33 +++-
 12 files changed, 559 insertions(+), 8 deletions(-)
```

The base range includes T0-owned R06 reconciliation and the R07 route. The close commit has
exactly the ten holder-owned rows in `What changed`.

## Deviations

- `src/services/titan/titanPipeline.test.ts` was outside the forecast; criteria 1 and 5 required direct seam-order and failed-identity evidence.
- `src/services/titanEngine.test.ts` was outside the forecast; criterion 4 required named tests for both special programs.
- `src/i18n/translations.ts` and `src/i18n/translations.test.ts` were outside the forecast; criterion 5 required a visible failure message and the standing bilingual-string contract required both outputs and a test.

## Discovered

- The default eight-worker local E2E setting saturates this desktop enough to create broad,
  inconsistent 5-second visibility failures. The repository's existing four-worker setting
  ran the same suite clean without retries or timeout changes.
- `titan-mode-clarification.spec.ts` did not reproduce its remote R06 flake in any of the
  three local runs.
- `npm ci` reports one existing high-severity audit advisory; dependency updates were outside
  R07 and no package file changed.

## Untouched

```text
git diff --name-only b4f9ae4..HEAD -- .claude .agents docs/tasks docs/legacy CodeXray-readme-neon.svg docs/TITAN_MODE_YOL_HARITASI.md src/services/titan/translate.ts src/services/webProblemOrchestrator.ts src/services/trace
<no output>
```

The pre-existing untracked `.claude/`, `CodeXray-readme-neon.svg`, and
`docs/TITAN_MODE_YOL_HARITASI.md` remain untouched.

## Blockers

- T0 must push, close the remote `browser` job, and perform the marked documentation reconciliation.

## For the human

none
