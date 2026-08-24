# H03 — Timeline budget validity

## Turn

- Route: R03
- Base SHA: `02497a1bd6a0283b7a42fa1731d443e0c7931500`
- End SHA: `7e14d9f2ef9a054a7ff61ce2c6600455d0d971b0`
- Status: `partial`
- Next holder: Claude (T0)

## Özet

Timeline bütçesi artık Playwright gidiş-dönüşünü değil sayfa içindeki on commit'in medyanını ölçüyor.
Windows ve Linux kanıtı ürünün hızlı, eski ölçümün geçersiz olduğunu gösteriyor; 30 ms/adım gecikme bütçeyi düşürüyor.
Teknik kapılar yeşil, ancak yayımlanmış ek düzeltme commit'i ve artık var olmayan agent dalı iki kabul maddesini açık bırakıyor.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `e2e/performance-budget.spec.ts:3-92` | sample Playwright, in-page paint, and handler costs separately; enforce the sampled median; expose a test-only deterministic slowdown | edited |
| `.github/workflows/ci.yml:5` | retain push coverage for `agent/**` in addition to `main` | edited |

## Commits

- `884276c9678d75f2252dd116702d513b0423fb22 route(R03): close`
- `7e14d9f2ef9a054a7ff61ce2c6600455d0d971b0 fix(R03): judge the sampled timeline median`
- `handoff(H03): record` — this handoff commit

## Measurement first

### 1. What does the product actually cost?

Reading 1 is supported: the old measurement was not a valid product budget. The same
Windows run measured Playwright `892.720 / 967.173 / 1301.228 ms` and in-page
`165.400 / 166.400 / 227.400 ms` (min/median/max). Linux run 32766877140 measured
Playwright `1401.829 / 1539.641 / 1857.210 ms` and in-page
`228.200 / 277.400 / 459.600 ms`. The transport/actionability gap dominates.

### 2. How stable is it?

Each row contains ten samples.

| platform/run | Playwright min/median/max ms | in-page min/median/max ms | handler min/median/max ms |
|---|---:|---:|---:|
| Windows focused | 922.902 / 977.197 / 1053.626 | 161.100 / 166.700 / 167.400 | 0.700 / 1.050 / 1.500 |
| Windows full gate | 892.720 / 967.173 / 1301.228 | 165.400 / 166.400 / 227.400 | 0.600 / 0.900 / 1.700 |
| Linux CI 32766877140 | 1401.829 / 1539.641 / 1857.210 | 228.200 / 277.400 / 459.600 | 0.900 / 1.100 / 1.700 |

The failed first Linux run also supplied three ten-sample distributions with in-page
medians `357.200`, `273.850`, and `271.700 ms`; their maxima (`442.700`, `446.900`,
`551.700`) moved with runner scheduling while handler medians stayed `1.400`, `1.250`,
and `1.300 ms`. Therefore the committed budget judges the ten-sample median, not the
single worst scheduler pause.

### 3. Where does the time go?

The in-page total waits for one `requestAnimationFrame` after every click. With handler
medians between `0.900` and `1.400 ms` for all ten clicks, almost all in-page time is React
commit/paint scheduling, not synchronous application work. No product function was
implicated, so `src/**` was not changed.

### 4. Is the button the bottleneck or the state?

Neither is a product bottleneck. Ten synchronous click handlers cost about `1 ms` total;
the paint-aware total costs `166–277 ms` at the median. The original `967–1540 ms` median
was predominantly Playwright transport and actionability checks.

### Budget margin and fail-closed proof

The restated budget is `< 400 ms` for the median of ten paint-aware, in-page samples. It is
`43 ms` (12%) above the highest observed Linux median (`357.2 ms`) and `123 ms` (44%) above
the clean Linux median (`277.4 ms`). It is 60% below the old 1000 ms number.

Test-only `TIMELINE_TEST_DELAY_MS=30` produced this expected failure, then the variable was
removed and the focused performance phase passed:

```text
TIMELINE_MEASUREMENTS {"playwright":{"min":938.8885999999984,"median":1026.2977499999997,"max":1199.2430999999997},"inPage":{"min":402.6000000014901,"median":457.5,"max":529.7999999970198},"handler":{"min":300.5,"median":301.05000000819564,"max":301.6000000163913},"deliberateDelayMs":30}
Expected: < 400
Received:   457.5
DELAY_EXIT=1
TIMELINE_MEASUREMENTS {"playwright":{"min":952.0993999999992,"median":984.9277000000002,"max":1080.2957999999999},"inPage":{"min":165.79999999701977,"median":166.4999999962747,"max":168},"handler":{"min":0.6000000014901161,"median":0.9500000029802322,"max":1.3999999985098839},"deliberateDelayMs":0}
2 passed (38.4s)
CLEAN_EXIT=0
```

## Gate output

### lint

```text
exit code: 0
> oxlint
```

### test

Before: 751. After: 751.

```text
exit code: 0
Test Files  120 passed (120)
     Tests  751 passed (751)
```

### build

```text
exit code: 0
Initial JavaScript: 415.7 / 420.0 KiB
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

### local e2e, one worker

```text
66 passed (4.6m)
TIMELINE_MEASUREMENTS {"playwright":{"min":892.7197999999989,"median":967.1725499999993,"max":1301.2278000000001},"inPage":{"min":165.39999999850988,"median":166.39999999850988,"max":227.39999999850988},"handler":{"min":0.6000000089406967,"median":0.9000000059604645,"max":1.6999999955296516},"deliberateDelayMs":0}
2 passed (38.8s)
E2E_EXIT=0
```

### Linux CI push gate

```text
run: 32766877140
event: push
conclusion: success
Running 66 tests using 1 worker
66 passed (6.4m)
Running 2 tests using 1 worker
TIMELINE_MEASUREMENTS {"playwright":{"min":1401.8289320000003,"median":1539.6414964999994,"max":1857.2099230000003},"inPage":{"min":228.20000000001164,"median":277.4000000000233,"max":459.6000000000349},"handler":{"min":0.8999999999068677,"median":1.099999999976717,"max":1.7000000000116415},"deliberateDelayMs":0}
2 passed (57.5s)
```

## Acceptance

1. **Met** — `H03 / Measurement first / Windows focused, Windows full gate, Linux CI 32766877140`.
2. **Met** — `e2e/performance-budget.spec.ts:42-91 / run 32766877140 job 97558226284`.
3. **Met (not applicable branch)** — `H03 / Measurement first` supports reading 1, so no product fix was permitted.
4. **Met** — `e2e/performance-budget.spec.ts:3,89 / H03 Budget margin`.
5. **Met** — `TIMELINE_TEST_DELAY_MS=30 / DELAY_EXIT=1`, followed by `CLEAN_EXIT=0`.
6. **Met** — local e2e output: `66 passed`, `2 passed`, `E2E_EXIT=0`.
7. **Met** — unabridged e2e diff and budget grep below; only timeline `1000` became sampled `400`.
8. **Met** — gate output above: lint 0, test 751/751, build 0, desktop 7/7.
9. **Met** — `npm run test`: `751 passed (751)`.
10. **Not met** — `.github/workflows/ci.yml:5` contains `agent/**`, but T0 commit `de30411` deleted agent branches and moved the single working branch to `main`; run 32766877140 proves `push` on `main`, not an `agent/**` push.
11. **Met** — unabridged `.github` diff below contains exactly one trigger-line edit.
12. **Not met** — published Linux evidence required follow-up commit `7e14d9f`; force-push was prohibited, so the turn has three commits including this handoff rather than exactly two.

## Verification output

```text
7e14d9f2ef9a054a7ff61ce2c6600455d0d971b0

 .github/workflows/ci.yml                           |   2 +-
 AGENTS.md                                          |   8 +-
 docs/titan/PROTOCOL.md                             |  29 ++-
 docs/titan/SOLE_BOOTSTRAP.md                       |  20 +-
 docs/titan/routes/R03-timeline-budget-validity.md  | 231 +++++++++++++++++++++
 .../routes/queued/R02b-trustworthy-browser-gate.md | 160 ++++++++++++++
 .../{R03-first-seam.md => R04-first-seam.md}       |  26 +--
 e2e/performance-budget.spec.ts                     |  70 ++++++-
 8 files changed, 512 insertions(+), 34 deletions(-)
```

The verbatim budget scan is:

```text
e2e\accessibility-axe.spec.ts:67:    .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 2));
e2e\accessibility-axe.spec.ts:73:    .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 2));
e2e\accessibility-contract.spec.ts:69:    .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 1));
e2e\ai-actions.spec.ts:267:    .toBeLessThan(finalIndex);
e2e\desktop-provider-settings.spec.ts:18:  expect(providerBox!.y + providerBox!.height).toBeLessThan(webLlmModelBox!.y);
e2e\interval-dp-titan-mode.spec.ts:45:  expect(assistantContainment.scrollWidth).toBeLessThanOrEqual(assistantContainment.clientWidth + 1);
e2e\markdown-resilience.spec.ts:100:  expect(containment.scrollWidth).toBeLessThanOrEqual(containment.clientWidth + 1);
e2e\markdown-resilience.spec.ts:103:  expect(codeBounds?.width ?? 0).toBeLessThanOrEqual(panelBounds?.width ?? 0);
e2e\markdown-resilience.spec.ts:117:  await expect.poll(async () => (await assistant.boundingBox())?.height ?? 0).toBeLessThan(initialHeight);
e2e\markdown-resilience.spec.ts:118:  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
e2e\markdown-resilience.spec.ts:125:  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
e2e\performance-budget.spec.ts:28:  expect(performance.now() - started, 'startup should remain interactive').toBeLessThan(5_000);
e2e\performance-budget.spec.ts:33:  expect(performance.now() - catalogStarted, 'seven cross-family preset commits').toBeLessThan(3_500);
e2e\performance-budget.spec.ts:39:  expect(performance.now() - simulationStarted, 'default graph trace generation').toBeLessThan(2_000);
e2e\performance-budget.spec.ts:89:  expect(timelineMeasurements.inPage.median, 'median of ten in-page timeline commits').toBeLessThan(
e2e\performance-budget.spec.ts:99:  expect(performance.now() - dpStarted, '70-cell matrix package and render').toBeLessThan(4_000);
e2e\performance-budget.spec.ts:131:    .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 2));
e2e\real-ai.spec.ts:206:    expect(cacheReturnMs).toBeLessThan(30_000);
e2e\release-tour.spec.ts:184:  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
e2e\responsive-layout.spec.ts:35:  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(390);
e2e\responsive-layout.spec.ts:43:  expect((radioBox?.x ?? 0) + (radioBox?.width ?? 0)).toBeLessThanOrEqual(390);
e2e\responsive-layout.spec.ts:49:  expect(overflow.body).toBeLessThanOrEqual(1);
e2e\responsive-layout.spec.ts:50:  expect(overflow.root).toBeLessThanOrEqual(1);
e2e\smoke.spec.ts:239:  expect(initial.controls).toBeLessThan(130);
e2e\smoke.spec.ts:252:    .toBeLessThan(initial.assistant - 15);
e2e\smoke.spec.ts:276:    .toBeLessThan(beforeUpper.assistant - 18);
e2e\smoke.spec.ts:307:    .toBeLessThan(initialAssistant - 60);
e2e\smoke.spec.ts:378:  expect(box?.y ?? 0).toBeLessThan(controlBox?.y ?? 0);
e2e\smoke.spec.ts:393:  expect(radioBox?.width).toBeLessThanOrEqual(360);
e2e\smoke.spec.ts:478:  expect(defaults.visualizer).toBeLessThanOrEqual(379);
e2e\smoke.spec.ts:480:  expect(defaults.assistant).toBeLessThanOrEqual(275);
e2e\smoke.spec.ts:482:  expect(defaults.controls).toBeLessThanOrEqual(60);
```

## Unabridged e2e diff

```diff
diff --git a/e2e/performance-budget.spec.ts b/e2e/performance-budget.spec.ts
index 65c8fa5..6a56d9c 100644
--- a/e2e/performance-budget.spec.ts
+++ b/e2e/performance-budget.spec.ts
@@ -1,6 +1,21 @@
 import { expect, test } from '@playwright/test';
 
-test('keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets', { tag: '@performance' }, async ({ page }) => {
+const TIMELINE_COMMIT_BUDGET_MS = 400;
+const deliberateTimelineDelayMs = Number(process.env.TIMELINE_TEST_DELAY_MS ?? 0);
+
+const summarize = (samples: number[]) => {
+  const sorted = [...samples].sort((left, right) => left - right);
+  return {
+    min: sorted[0],
+    median: (sorted[4] + sorted[5]) / 2,
+    max: sorted[sorted.length - 1],
+  };
+};
+
+test('keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets', {
+  tag: '@performance',
+}, async ({ page }) => {
+  test.setTimeout(120_000);
   await page.addInitScript(() => {
     localStorage.setItem('codexray.locale', 'en');
     localStorage.setItem('codexray.ai.autoLoad', 'false');
@@ -24,9 +39,56 @@ test('keeps startup, catalog switching, simulation, timeline, and DP rendering i
   expect(performance.now() - simulationStarted, 'default graph trace generation').toBeLessThan(2_000);
 
   const next = page.getByRole('button', { name: 'Next step' });
-  const stepStarted = performance.now();
-  for (let index = 0; index < 10 && !await next.isDisabled(); index += 1) await next.click();
-  expect(performance.now() - stepStarted, 'ten timeline commits').toBeLessThan(1_000);
+  const previous = page.getByRole('button', { name: 'Previous step' });
+  const playwrightSamples: number[] = [];
+  const inPageSamples: number[] = [];
+  const handlerSamples: number[] = [];
+  for (let sample = 0; sample < 10; sample += 1) {
+    while (!await previous.isDisabled()) await previous.click();
+    const playwrightStarted = performance.now();
+    for (let index = 0; index < 10 && !await next.isDisabled(); index += 1) await next.click();
+    playwrightSamples.push(performance.now() - playwrightStarted);
+
+    const inPage = await page.evaluate(async (deliberateDelayMs) => {
+      const nextButton = document.querySelector<HTMLButtonElement>('button[aria-label="Next step"]');
+      const previousButton = document.querySelector<HTMLButtonElement>('button[aria-label="Previous step"]');
+      if (!nextButton || !previousButton) throw new Error('Timeline controls are unavailable.');
+      const afterPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
+      const delayCommit = () => {
+        const delayStarted = performance.now();
+        while (performance.now() - delayStarted < deliberateDelayMs) {
+          // Deliberate test-only slowdown used to prove that the budget fails closed.
+        }
+      };
+      if (deliberateDelayMs > 0) nextButton.addEventListener('click', delayCommit, true);
+      while (!previousButton.disabled) {
+        previousButton.click();
+        await afterPaint();
+      }
+      let handlerMs = 0;
+      const started = performance.now();
+      for (let index = 0; index < 10 && !nextButton.disabled; index += 1) {
+        const handlerStarted = performance.now();
+        nextButton.click();
+        handlerMs += performance.now() - handlerStarted;
+        await afterPaint();
+      }
+      if (deliberateDelayMs > 0) nextButton.removeEventListener('click', delayCommit, true);
+      return { totalMs: performance.now() - started, handlerMs };
+    }, deliberateTimelineDelayMs);
+    inPageSamples.push(inPage.totalMs);
+    handlerSamples.push(inPage.handlerMs);
+  }
+  const timelineMeasurements = {
+    playwright: summarize(playwrightSamples),
+    inPage: summarize(inPageSamples),
+    handler: summarize(handlerSamples),
+    deliberateDelayMs: deliberateTimelineDelayMs,
+  };
+  console.log(`TIMELINE_MEASUREMENTS ${JSON.stringify(timelineMeasurements)}`);
+  expect(timelineMeasurements.inPage.median, 'median of ten in-page timeline commits').toBeLessThan(
+    TIMELINE_COMMIT_BUDGET_MS,
+  );
 
   const chat = page.getByPlaceholder('Type your question here...');
   const dpStarted = performance.now();
```

Line-by-line justification: constants name the restated budget and opt-in falsification;
`summarize` reports the required spread; the timeout covers twenty ten-step samples plus
the existing budgets; reset loops make samples comparable; Playwright samples retain the
old harness path; `page.evaluate` removes transport; handler timing separates synchronous
work from paint; the log supplies cross-platform evidence; the median assertion rejects
sustained regressions without treating one scheduler pause as product work. No other budget changed.

## Unabridged CI diff

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index bf022db..feff52e 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -2,7 +2,7 @@ name: CI
 on:
   push:
-    branches: [main]
+    branches: [main, 'agent/**']
   pull_request:
```

## Diff scope

```text
 .github/workflows/ci.yml                           |   2 +-
 AGENTS.md                                          |   8 +-
 docs/titan/PROTOCOL.md                             |  29 ++-
 docs/titan/SOLE_BOOTSTRAP.md                       |  20 +-
 docs/titan/routes/R03-timeline-budget-validity.md  | 231 +++++++++++++++++++++
 .../routes/queued/R02b-trustworthy-browser-gate.md | 160 ++++++++++++++
 .../{R03-first-seam.md => R04-first-seam.md}       |  26 +--
 e2e/performance-budget.spec.ts                     |  70 ++++++-
 8 files changed, 512 insertions(+), 34 deletions(-)
```

## Deviations

1. The first published close used the maximum of ten samples. Linux evidence showed that
   maximum tracked scheduler pauses while the handler remained near 1 ms, so a follow-up
   commit changed the assertion to the distribution median. Force-push/history rewrite was
   explicitly forbidden; this makes acceptance criterion 12 not met.
2. T0 commit `de30411` changed the single working branch to `main` after R03 opened. The CI
   line requested by the route remains, but an `agent/**` push cannot be demonstrated because
   those branches were deleted. Run 32766877140 proves the replacement main-push contract.

## Discovered

- A max-of-ten browser paint budget is still a scheduler budget under CI contention; the
  median of a declared sample set distinguishes sustained application cost from one pause.
- The temporary H02 diagnosis matrix continues to fail on deterministic mocked Titan specs
  even while the authoritative one-worker browser job is green. Run 32766877140 concludes
  `success` because those diagnosis jobs are informational; R02b still owns their removal.

## Untouched

```text
git diff 02497a1..7e14d9f -- .claude CodeXray-readme-neon.svg docs/TITAN_MODE_YOL_HARITASI.md docs/tasks docs/legacy
```

The command returned no output. No `src/**`, `src-tauri/**`, other CI line, frozen path, or
other performance threshold changed.

## Blockers

- Criterion 12 requires a protocol decision: accept the append-only corrective commit or
  reopen as R03b. Published history cannot be reduced to two commits without a forbidden
  force-push.
- Criterion 10 names an `agent/**` push that is impossible under T0's newer single-main
  protocol. R03b should restate it as a main push or explicitly waive the obsolete branch.

## For the human

none
