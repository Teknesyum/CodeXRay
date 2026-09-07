# H29 — Two Tests The Gate Cannot Trust

## Turn

- Route: `docs/titan/routes/R29-two-tests-the-gate-cannot-trust.md`
- Base SHA: `244bda8`
- End SHA: `624e5b89304f629d6adb7c80def5d8ed81827e24`
- Status: `closed`
- Next holder: Claude (T0)

Base check, run before anything was written:

```
git merge-base --is-ancestor 244bda8 HEAD; echo "ancestor-exit=$?"; git diff --name-only 244bda8..HEAD
```

```
ancestor-exit=0
docs/titan/routes/R29-two-tests-the-gate-cannot-trust.md
```

## Özet

İptal edilen bir koşunun `titan-produce` işi `failed` olarak kalıcılaşıyordu; ölçüldü,
T0'ın hipotezi kısmen doğruydu ama suçlu motor değil boru hattıydı. `executeTitanPipeline`
artık sinyal iptal edilmişse aşamayı `cancelled` yazıyor, `failed` değil.

İkinci hata ürün kusuru değildi: aynı metni taşıyan iki meşru öğe var — sohbet sistem
mesajı ve ilerleme panelindeki ajan özeti. İddia zayıflatılmadı, ikisi de ayrı ayrı
doğrulanıyor artık.

Her iki test de yalnızca ~300 ms'lik bir yarışı izole koşuda kazandığı için yeşildi;
yarış ölçüldü ve rakamlar aşağıda. e2e dört kez üst üste yeşil.

## What changed

| path:line-range | intent | kind |
|---|---|---|
| `src/services/titan/titanPipeline.ts:64-74` | a stage that rejects while the pipeline signal is aborted is published `cancelled`, not `failed` | edited |
| `src/services/titan/titanPipeline.test.ts:182-215` | two tests: a cancelled mid-stage rejection is `cancelled` and no stage is `failed`; a rejection with no abort is still `failed` | added |
| `e2e/titan-mode-failures.spec.ts:202-205` | after a genuinely failed run, a reload still restores the panel and the failed agent | added |
| `e2e/translation-provenance.spec.ts:283-290` | the refusal assertion names both elements that carry the text instead of matching whichever arrived first | edited |

## Commits

| SHA | Subject |
|---|---|
| `624e5b89304f629d6adb7c80def5d8ed81827e24` | `route(R29): close` |

## Criterion 1 — what `job.status` actually is for a cancelled plan

Measured before any fix was written or proposed, with a temporary spec
(`e2e/zz-r29-measure.spec.ts`, deleted after the measurement) that replays
`titan-mode-failures.spec.ts:3` verbatim and dumps `sessionStorage` at four points.
Verbatim console output of that run:

```
### R29 MEASUREMENT [before cancel]
index+plans: [
  {
    "id": "titan-pipeline-62c2fc45-807b-4481-9a1f-d569e8e7ba73",
    "jobs": [
      "titan-route=completed",
      "titan-produce=running",
      "titan-semantics=waiting",
      "titan-verify=waiting",
      "titan-apply=waiting"
    ]
  }
]

### R29 MEASUREMENT [immediately after cancel]
index+plans: [
  {
    "id": "titan-pipeline-62c2fc45-807b-4481-9a1f-d569e8e7ba73",
    "jobs": [
      "titan-route=completed",
      "titan-produce=failed (Titan Mode run was cancelled.)",
      "titan-semantics=cancelled",
      "titan-verify=cancelled",
      "titan-apply=cancelled"
    ]
  }
]

### R29 MEASUREMENT [1500ms after cancel]
index+plans: [
  {
    "id": "titan-pipeline-62c2fc45-807b-4481-9a1f-d569e8e7ba73",
    "jobs": [
      "titan-route=completed",
      "titan-produce=failed (Titan Mode run was cancelled.)",
      "titan-semantics=cancelled",
      "titan-verify=cancelled",
      "titan-apply=cancelled"
    ]
  }
]

### R29 MEASUREMENT [after reload]
index+plans: [
  {
    "id": "titan-pipeline-62c2fc45-807b-4481-9a1f-d569e8e7ba73",
    "jobs": [
      "titan-route=completed",
      "titan-produce=failed (Titan Mode run was cancelled.)",
      "titan-semantics=cancelled",
      "titan-verify=cancelled",
      "titan-apply=cancelled"
    ]
  }
]
```

**The finding, stated against T0's hypothesis.**

T0's reading was *"the cancel path marks its jobs `failed` rather than `cancelled`"*.
That is **half right and it names the wrong module**.

- Right: exactly one job is persisted `failed` for a user cancellation — `titan-produce`,
  carrying the error text `Titan Mode run was cancelled.` — and the reload rule at
  `AiAssistant.tsx:212` restores the plan because of it. The product defect T0 predicted is
  real and this is the mechanism.
- Wrong in scope: **three of the five jobs already carry `'cancelled'`**. It is not "the
  cancel path" that mislabels; it is one stage.
- Wrong in module: the plan that is persisted is **not** `startTitanModeRun`'s engine plan.
  It is the **pipeline** plan, `runId` `titan-pipeline-…`, whose jobs are synthesised from
  `TitanStageState` in `titanPipeline.ts`. `startTitanModeRun`'s own cancel path
  (`titanEngine.ts:1674-1683`) is correct and was never at fault; `runJob`'s catch
  (`titanEngine.ts:691`) already writes `cancelled ? 'cancelled' : 'failed'`.

The actual mechanism is in `executeTitanPipeline`. `cancel()` on a pipeline handle does
`controller.abort()` and then `activeRun?.cancel()`. The `produce` stage is awaiting the
engine promise, which now rejects. `run()`'s catch was:

```ts
} catch (error) {
  if (states.get(id)?.status !== 'cancelled') {
    publish(id, 'failed', error instanceof Error ? error.message : `${id} failed.`);
  }
  throw error;
}
```

`ensureActive` — the only place that consults `tasks.signal` — runs *before* a stage and
*after* a stage resolves successfully, never in the catch. So the rejection the pipeline's
own `abort()` provoked was classified as a failure. The stages still `waiting` were then
correctly marked `cancelled` by the outer catch, which is why the other three were right.

A second, independent defect was found while measuring and is **not** fixed by this turn:
`AiAssistant.tsx:857` calls `persistTitanModePlan(plan)` **before** the
`dismissedTitanModeRunsRef` guard on the next line, so a late `onPlan` re-writes a plan that
the cancel handler had already sanitised at `:1455` and removed at `:1462`. That is why the
sanitiser's `waiting|running|retrying → cancelled` map never reached `titan-produce`: it ran
on the React snapshot before the rejection, and the rejection re-persisted afterwards. With
the status now correct the re-persist is harmless, so it was left alone. See `## Discovered`.

## Criterion 2 — `npm run test:e2e` passes on a clean tree

Whole suite, external server on 127.0.0.1:4173, `PLAYWRIGHT_EXTERNAL_SERVER=1`. Tail of the
first post-fix run, verbatim:

```
  ok 65 [chromium] › e2e\titan-mode-user-graph.spec.ts:25:1 › requires a missing target, then builds on the exact user graph without replacing it (11.3s)
  ok 70 [chromium] › e2e\translation-provenance.spec.ts:3:1 › translates a reviewed Java web solution into a verified simulation badge (6.3s)
  ok 80 [chromium] › e2e\usage-scenarios.spec.ts:86:1 › changes a numeric algorithm parameter and rebuilds its trace from a natural command (4.0s)
  ok 75 [chromium] › e2e\unicode-and-catalog.spec.ts:42:1 › clears incompatible timeline and analysis while touring catalog families (9.3s)
  ok 74 [chromium] › e2e\unicode-and-catalog.spec.ts:17:1 › finds and then clears Unicode KMP results without replacing user text (11.1s)
  ok 76 [chromium] › e2e\usage-scenarios.spec.ts:13:1 › changes Jump Game from quadratic DP to linear greedy (9.6s)
  ok 73 [chromium] › e2e\tree-input-resilience.spec.ts:55:1 › renames, adds, traverses, exports, reimports, and deletes a sparse-tree child (11.8s)
  ok 78 [chromium] › e2e\usage-scenarios.spec.ts:43:1 › edits, expands, and recompiles the active input from natural commands (8.4s)
  ok 81 [chromium] › e2e\usage-scenarios.spec.ts:106:1 › changes a text algorithm parameter and rebuilds its trace from a quoted command (2.6s)
  ok 77 [chromium] › e2e\usage-scenarios.spec.ts:28:1 › changes LIS from quadratic DP to n-log-n binary search (9.3s)
  ok 79 [chromium] › e2e\usage-scenarios.spec.ts:71:1 › resizes a true matrix simulation to a rectangular 8 by 15 grid (6.7s)
  ok 82 [chromium] › e2e\web-problem-routing.spec.ts:3:1 › a fetched page cannot select the intent of a bound web solve (2.7s)

  82 passed (1.2m)

Running 2 tests using 1 worker

(node:21188) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
TIMELINE_MEASUREMENTS {"playwright":{"min":746.0878000000012,"median":806.2536500000006,"max":951.3492000000001},"inPage":{"min":158.39999997615814,"median":166.69999998807907,"max":172.30000001192093},"handler":{"min":0.40000009536743164,"median":0.6500000655651093,"max":0.8999999761581421},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1635.1781,"catalogMs":265.5477000000001,"simulationMs":71.72800000000007,"dpMs":2454.011400000003}
  ok 1 [chromium] › e2e\performance-budget.spec.ts:23:1 › keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets @performance (23.5s)
  ok 2 [chromium] › e2e\performance-budget.spec.ts:123:1 › survives repeated cross-subsystem use without stale state, overflow, or locked controls @performance (8.8s)

  2 passed (33.5s)
exit=0
```

`npm run test:e2e` is `node scripts/run-e2e.mjs`, which runs the suite in two phases — 82
functional tests in parallel, then the 2 `@performance` tests with one worker. Both phases
are reported.

## Criterion 3 — four consecutive runs

Four full `npm run test:e2e` invocations, back to back, nothing else changed between them.
Summary lines verbatim:

| Run | Phase 1 | Phase 2 | exit |
|---|---|---|---|
| 1 | `  82 passed (1.2m)` | `  2 passed (33.5s)` | 0 |
| 2 | `  82 passed (1.1m)` | `  2 passed (34.9s)` | 0 |
| 3 | `  82 passed (1.3m)` | `  2 passed (38.3s)` | 0 |
| 4 | `  82 passed (1.6m)` | `  2 passed (52.5s)` | 0 |

Runs 2-4 were filtered to the summary lines at the shell; the filter was
`Select-String -Pattern '^\s+\d+ (passed|failed)|^\s+\d+ flaky|✘'`, so a failed or flaky
line would have printed. None did, and `$LASTEXITCODE` was 0 for all four.

## Criterion 4 — the fix for failure one is a fix, not a mask

The cancel path changed, so the required test is the one asserting a cancelled plan's jobs
carry `'cancelled'`. `src/services/titan/titanPipeline.test.ts` gains:

```
it('marks the running stage cancelled, not failed, when the run is cancelled mid-stage')
it('still marks a genuinely failed stage failed when nothing was cancelled')
```

The first aborts the signal and then rejects from inside `produce` — exactly what
`activeRun.cancel()` does to the awaited engine promise — and asserts
`final.get('produce') === 'cancelled'` **and** that no stage anywhere in the run is
`'failed'`. The second is its negative control: the same rejection with the signal never
aborted still yields `'failed'`, so the fix cannot be satisfied by never writing `'failed'`.

Both fail on `244bda8`'s `titanPipeline.ts`: the first would read `'failed'` for produce.

The restore-on-failure behaviour the route forbids trading away is asserted separately, at
the product level, in `e2e/titan-mode-failures.spec.ts:202-205` — see criterion 6.

Call path for the changed line:
`AiAssistant.tsx:1450 (TitanProgress onCancel) → titanModeRunRef.current.cancel() →
titanPipeline.ts:631 (pipeline handle cancel) → controller.abort() + activeRun.cancel() →
titanPipeline.ts:64-74 (executeTitanPipeline run catch) → publishPlan → AiAssistant.tsx:857
persistTitanModePlan → AiAssistant.tsx:205-213 rehydration`.
Traversing e2e spec: `e2e/titan-mode-failures.spec.ts:3` — *cancels the visible Titan Mode
queue and ignores a late specialist response*, whose closing `page.reload()` +
`toHaveCount(0)` is the assertion that was red.

## Criterion 5 — failure two's fix does not weaken the assertion

**What the second matching element was.** Measured with a temporary spec that waited 3 s and
dumped every match with its ancestry. Verbatim:

```
### R29 MEASUREMENT match count = 2
### element: <span class="agent-summary" title="Translation verification failed: Line 2: Expected budgets header.">Translation verification failed: Line 2: Expected budgets header.</span>
### ancestry: div.titan-mode-agent failed < div.titan-mode-agent-list < div.titan-mode-progress-main < section.titan-mode-progress failed   < div.ai-assistant < section.assistant-container panel-region
### element: <p>Translation verification failed: Line 2: Expected budgets header.</p>
### ancestry: div.markdown-preview < div.ai-message-content < div.chat-message system-msg < div.ai-body < div.ai-assistant < section.assistant-container panel-region
```

The two elements are **legitimately different surfaces carrying the same sentence**, not a
duplicated string:

1. `span.agent-summary` inside `div.titan-mode-agent.failed` — the failing agent's row in the
   progress panel, which is where a user looks to see *which stage* refused.
2. `p` inside `div.chat-message.system-msg` — the assistant's reply in the conversation,
   which is the message the user is actually told.

This is not a product defect. The same refusal reaching both the progress panel and the chat
transcript is the intended design; neither is redundant with the other.

**The assertion was strengthened, not scoped down.** The old line matched whichever of the
two happened to exist at the first poll and asserted nothing about the other:

```ts
await expect(page.getByText(/Translation verification failed/)).toBeVisible();
```

It is now three assertions, and all three must hold:

```ts
await expect(page.getByText(/Translation verification failed/)).toHaveCount(2);
await expect(page.locator('.chat-message.system-msg')
  .getByText(/Translation verification failed/)).toBeVisible();
await expect(page.locator('.titan-mode-agent.failed .agent-summary'))
  .toHaveText(/Translation verification failed/);
```

No `.first()`, no new `data-testid` — both surfaces were already distinguishable by classes
the product already renders (`chat-message system-msg`, `titan-mode-agent failed`). The
count assertion also converts the old race into a positive wait: `toHaveCount(2)` polls
upward, so it cannot pass by arriving early.

## Criterion 6 — no product behaviour changes for a run that was not cancelled

Stated plainly, per status:

- **Completed run** — unchanged. A stage that resolves never enters `run()`'s catch, and the
  changed expression is inside that catch. Nothing on the success path was touched.
- **Failed run** — unchanged. `tasks.signal?.aborted` is false for every rejection that is
  not a cancellation, so the stage is still published `'failed'` with the same detail string,
  the plan still carries `error`, and `AiAssistant.tsx:212`'s `some(job.status === 'failed')`
  still restores it after a reload. This is asserted twice: by the negative-control unit test
  above, and at the product level by the new lines in
  `e2e/titan-mode-failures.spec.ts:202-205`, which reload after a genuine SimLang failure and
  require `.titan-mode-progress` to have count **1** and `.titan-mode-agent.failed` count 1.
  That e2e assertion is the guard against the "restore nothing" fix the route forbids: any
  future change that widened the exclusion would turn it red.
- **`completed_with_fallback` run** — unchanged, and it cannot be reached through this code
  at all. `TitanStageStatus` is `waiting | running | completed | skipped | failed | cancelled`;
  the pipeline synthesises `ManagerJobV1.status` from it through `stageStateStatus`, which can
  only ever emit those six. `completed_with_fallback` is written only by the engine
  (`titanEngine.ts`) on its own `gm-…` plans, which this turn did not touch.
- **Non-pipelined runs** — unchanged. `startTitanModeRun` in `titanEntry.ts` does not go
  through `executeTitanPipeline`.

The signal is aborted from exactly one place per pipeline: the `cancel()` on the handle the
pipeline returns (`titanPipeline.ts:415`, `:484`, `:561`, `:629`, `:765`, `:840`). Nothing
else can abort it, so the new branch is reachable only by a user cancellation.

## Criterion 7 — gates

`npm run lint`:

```
> codexray@2.3.4 lint
> oxlint


LINT_EXIT=0
```

`npm run test`:

```
> codexray@2.3.4 test
> vitest run


 RUN  v4.1.10 C:/Users/Administrator/Desktop/Projeler/CodeXray


 Test Files  120 passed (120)
      Tests  909 passed (909)
   Start at  22:37:13
   Duration  83.60s (transform 33.45s, setup 80.93s, import 75.81s, tests 157.84s, environment 554.10s)


TEST_EXIT=0
```

Unit test count: base `244bda8` = **907**, after this turn = **909**. Delta **+2**, which is
exactly the two tests added to `titanPipeline.test.ts` for criterion 4.

`npm run build`:

```
dist/assets/recompileSimulationInput-rDSYxmwj.js      81.54 kB │ gzip:  23.50 kB
dist/assets/titanPipeline-CrMI7oLX.js                 93.22 kB │ gzip:  25.84 kB
dist/assets/index-8unpYaVt.js                        432.69 kB │ gzip: 133.43 kB

✓ built in 2.49s
Initial JavaScript: 422.6 / 425.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB

BUILD_EXIT=0
```

`desktop:check` was not run: `src-tauri/**` did not change (see `## Diff scope`).

## Criterion 8 — reproducibility in isolation, measured

**Failure one.** The *test failure* is **not** reproducible in isolation. With the
`titanPipeline.ts` fix stashed out — that is, on `244bda8`'s product code — the spec was run
alone four times with `--workers=1`:

```
--- isolation run 1 (titanPipeline.ts fix reverted) ---
  ok 1 [chromium] › e2e\titan-mode-failures.spec.ts:3:1 › cancels the visible Titan Mode queue and ignores a late specialist response (2.7s)
  1 passed (4.1s)
--- isolation run 2 (titanPipeline.ts fix reverted) ---
  ok 1 [chromium] › e2e\titan-mode-failures.spec.ts:3:1 › cancels the visible Titan Mode queue and ignores a late specialist response (2.7s)
  1 passed (3.1s)
--- isolation run 3 (titanPipeline.ts fix reverted) ---
  ok 1 [chromium] › e2e\titan-mode-failures.spec.ts:3:1 › cancels the visible Titan Mode queue and ignores a late specialist response (2.7s)
  1 passed (3.1s)
--- isolation run 4 (titanPipeline.ts fix reverted) ---
  ok 1 [chromium] › e2e\titan-mode-failures.spec.ts:3:1 › cancels the visible Titan Mode queue and ignores a late specialist response (2.9s)
  1 passed (3.6s)
```

**The product defect, however, is 100 % reproducible in isolation.** On the same reverted
code, a temporary spec that reloads and then waits measures the panel coming back every
single time:

```
### R29 after-reload panel count = 1
### R29 after-reload storage = ["{"version":1,"runId":"titan-pipeline-635f71bb-cb6d-4ab0-80c3-e9abd6fd652c",...,{"id":"titan-produce","role":"compiler","label":"produce","dependsOn":["titan-route"],"weight":20,"status":"failed","attempt":1,"maxAttempts":1,"error":"Titan Mode run was cancelled."},{"id":"titan-semantics",...,"status":"cancelled",...},{"id":"titan-verify",...,"status":"cancelled",...},{"id":"titan-apply",...,"status":"cancelled",...}]}"]
```

So the difference between green and red is not the defect — it is *when the first poll runs*.
Measured, three isolation runs on the reverted code:

```
### R29 reload()->resolve = 198 ms
### R29 first poll count = 0 at +39 ms after reload resolve
### R29 panel appeared at +312 ms after reload resolve
### R29 after-reload panel count = 1

### R29 reload()->resolve = 336 ms
### R29 first poll count = 0 at +62 ms after reload resolve
### R29 panel appeared at +340 ms after reload resolve
### R29 after-reload panel count = 1

### R29 reload()->resolve = 339 ms
### R29 first poll count = 0 at +64 ms after reload resolve
### R29 panel appeared at +347 ms after reload resolve
### R29 after-reload panel count = 1
```

`await expect(...).toHaveCount(0)` succeeds on the **first** poll where the count is 0. In
isolation that first poll lands at +39 to +64 ms after `page.reload()` resolves, and the
restored panel — a `React.lazy` `TitanProgress` behind `Suspense fallback={null}`, so it
needs its chunk fetched and a second render — appears at +312 to +347 ms. There is a
**~250-280 ms window** in which the assertion is true, and in isolation it always wins it.
Under `fullyParallel` with four workers the first poll arrives after that window, the count
is already 1, and it stays 1 for the full 15 s — which is precisely the reported
`31 × locator resolved to 1 element`. That is a measured mechanism, not "slower under load"
and not "flaky".

**Failure two** is the same class, measured the same way. Timestamps of the two matching
elements, three isolation runs:

```
### R29 panel element at +409 ms, chat element at +127 ms, gap = 282 ms
### R29 panel element at +420 ms, chat element at +107 ms, gap = 313 ms
### R29 panel element at +400 ms, chat element at +105 ms, gap = 295 ms
```

The chat system message renders at ~+110 ms, the progress panel's `agent-summary` at
~+405 ms. `getByText(...).toBeVisible()` polls immediately after the preceding
`press('Enter')` chain, lands inside that ~290 ms gap, resolves against the single chat
element and passes. Under load it lands after +400 ms, both elements exist, and Playwright's
strict mode throws.

**Both failures are therefore genuine, deterministic, and were being masked by an accidental
race that isolation happened to win.** Neither was ever a flake. The standing "twice in a row
before it earns a route" rule was misapplied, as R29 says — and the reason it kept looking
like a flake is now measured: run alone, they are green 4/4; run in the suite, red.

## Diff scope

```
git diff --stat 244bda8..HEAD
```

```
 .../routes/R29-two-tests-the-gate-cannot-trust.md  | 202 +++++++++++++++++++++
 e2e/titan-mode-failures.spec.ts                    |   4 +
 e2e/translation-provenance.spec.ts                 |   6 +-
 src/services/titan/titanPipeline.test.ts           |  35 ++++
 src/services/titan/titanPipeline.ts                |   6 +-
 5 files changed, 251 insertions(+), 2 deletions(-)
```

The route file is T0's own `route(R29): open` commit inside the range, not a write by this
turn.

Product diff, verbatim:

```
e2e/titan-mode-failures.spec.ts
  @@ -199,6 +199,10 @@
  +  await page.reload();
  +  await expect(page.locator('.titan-mode-progress')).toHaveCount(1);
  +  await expect(page.locator('.titan-mode-agent.failed')).toHaveCount(1);
  +
     await page.getByRole('button', { name: 'Clear conversation memory' }).click();

e2e/translation-provenance.spec.ts
  @@ -283,7 +283,11 @@
  -  await expect(page.getByText(/Translation verification failed/)).toBeVisible();
  +  await expect(page.getByText(/Translation verification failed/)).toHaveCount(2);
  +  await expect(page.locator('.chat-message.system-msg')
  +    .getByText(/Translation verification failed/)).toBeVisible();
  +  await expect(page.locator('.titan-mode-agent.failed .agent-summary'))
  +    .toHaveText(/Translation verification failed/);

src/services/titan/titanPipeline.ts
  @@ -64,7 +64,11 @@
  -        publish(id, 'failed', error instanceof Error ? error.message : `${id} failed.`);
  +        publish(
  +          id,
  +          tasks.signal?.aborted ? 'cancelled' : 'failed',
  +          error instanceof Error ? error.message : `${id} failed.`,
  +        );
         }
         throw error;
       }
```

## Deviations

- **`src/components/AiAssistant.tsx` and `src/services/titanModeRunStore.ts` were forecast
  and not written.** The measurement in criterion 1 moved the defect out of both of them and
  into `titanPipeline.ts`, which the forecast did not list. The route's `## Expected Files`
  is a forecast, so this is recorded rather than treated as a boundary problem.
- **`src/components/AiAssistant.test.tsx` was forecast and does not exist.** There is no such
  file in the repository — `AiAssistant` is tested through `AiAssistant.actions.test.tsx`,
  `.analysis.`, `.copy.` and `.taxonomy.`. Since the rehydration rule in `AiAssistant.tsx` was
  not changed, no test there was needed; criterion 6's restore-on-failure guarantee is proven
  at the product level in `e2e/titan-mode-failures.spec.ts` instead, which is stronger than a
  unit test would have been.
- **`src/services/titan/titanPipeline.test.ts` was written and was not forecast.** Criterion 4
  requires a test asserting a cancelled plan's jobs carry `'cancelled'`; that assertion belongs
  beside the code that now makes it true.
- **Four temporary measurement specs were created and deleted** (`e2e/zz-r29-measure*.spec.ts`).
  They exist in no commit; their verbatim output is pasted above. They were the only way to
  satisfy criteria 1, 5 and 8, all of which demand a measurement rather than a claim.
- **The second defect found in `AiAssistant.tsx:857` was deliberately not fixed.** It is
  described under `## Discovered`. Fixing it was not required by any criterion, is not needed
  for any of the four green runs, and would have widened this turn beyond the two failures the
  route names.

## Discovered

1. **`AiAssistant.tsx:857` persists before it checks whether the run was dismissed.**

   ```ts
   onPlan: (plan) => {
     persistTitanModePlan(plan);
     if (!mountedRef.current || dismissedTitanModeRunsRef.current.has(plan.runId)) return;
   ```

   The cancel handler at `:1449-1462` adds the run to `dismissedTitanModeRunsRef`, writes a
   sanitised copy, then calls `removeTitanModePlan`. Every `onPlan` that arrives afterwards —
   and at least one always does, because the pipeline stage rejection is asynchronous —
   re-writes the run into `sessionStorage` and back into the index. So a cancelled run is
   *always* left in storage despite the explicit `removeTitanModePlan` call. With the status
   now correct this is invisible to the user, but the removal is still not doing what it says,
   and the sanitising map at `:1455` is dead for exactly the job that matters: it runs on the
   React snapshot, where `titan-produce` is still `running`, and is then overwritten. Moving
   the guard above the persist would make both do what they claim. One line.

2. **`ensureActive` in `executeTitanPipeline` never runs in a catch.** The fix addresses the
   symptom at the one site that publishes a status. The wider shape — that the signal is
   consulted only on entry and on success — is unchanged, and any future stage-level status
   added to that function will need the same guard.

3. **`e2e/titan-mode-failures.spec.ts:113`'s `toHaveCount(0)` was structurally unable to fail
   in isolation** for a defect that takes ~300 ms to render, because the assertion is
   satisfied by the *absence* of an element and passes on its first poll. Any assertion of the
   form "after a reload, X is not there" has this property. There are others in the suite; the
   two here were found only because the parallel suite happened to lose the race. A route that
   wants this class closed would have to look for `toHaveCount(0)` immediately after
   `page.reload()` across `e2e/**` and add a positive wait before each.

4. **T0's route text names `AiAssistant.tsx:205` for the rehydration hook and that is right**,
   but the job-status union it quotes from `src/types/webSource.ts:132` is reached through
   `src/types/titan.ts`'s `ManagerJobV1`; the pipeline never emits four of its seven members.

## Untouched

```
git diff --name-only "244bda8..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$'
```

```
GREP1_DONE
```

Nothing printed before the marker: no frozen or T0-owned path changed.

```
git status --porcelain | Select-String -Pattern 'test-results|dist/|coverage/'
```

```
GREP2_DONE
```

Nothing printed: `test-results/` was deleted, and no build output is staged or untracked.

## Blockers

None. Two decisions are offered to T0 rather than taken:

1. Whether the `persistTitanModePlan`-before-guard inversion at `AiAssistant.tsx:857`
   (`## Discovered` 1) earns its own route or is folded into a future one. It is one line and
   currently harmless, but `removeTitanModePlan` does not remove.
2. Whether the `toHaveCount(0)`-after-`reload()` pattern (`## Discovered` 3) should be swept
   across `e2e/**`. This turn fixed the two instances that were caught; it did not look for
   more, because the route did not ask and a sweep is a different turn's size.

## For the human

None.
