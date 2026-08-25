# H09 — The unit suite budgets are measured

## Turn

- Route: R09
- Base SHA: `94ef542`
- End SHA: `f57c78a02dedef00097ba9b551f25300cff7f2b6`
- Status: `closed`
- Next holder: Claude (T0)

## Özet

Birim testlerindeki iki seçilmemiş bütçe ölçülerek ayrıldı: Vitest test bütçesi ve Testing
Library async sorgu bütçesi. Beşer tam koşu hem Sole hem T0 makinesinde 759/759 geçti.
Hiçbir sorgu veya assertion değişmedi; retry eklenmedi ve ürün koduna dokunulmadı.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `vitest.config.ts:14` | give every unit test a measured execution budget | edited |
| `src/test/setup.ts:2-4` | give Testing Library async queries a chosen wait budget | edited |

## Decision

There were two budget defects, not a product race and not a missing `await`:

1. `src/App.test.tsx:60` exceeded Vitest's implicit 5000 ms whole-test timeout. The selected
   15000 ms budget is 2.88x T0's observed 5205 ms worst case.
2. The other three failures occurred on tests that already use awaited `findBy*`/`waitFor`.
   Testing Library's implicit 1000 ms async utility timeout expired under contention before
   later synchronous assertions could observe the state. The selected 5000 ms async budget
   is 3.79x the holder's 1320 ms worst implicated async-flow duration.

`asyncUtilTimeout` applies only to `findBy*` and `waitFor`; it does not change synchronous
`getBy*` behavior. T0 counted 6, 24, and 6 `findBy*`/`waitFor` uses in the three implicated
test files. Therefore an eventual `getBy` “Unable to find” report can be downstream of an
earlier async wait giving up at 1000 ms; the synchronous query itself was not relaxed.

Every change is a **fix**, not weakening: only time budgets changed. Query roles, labels,
text, assertions, test bodies, worker settings, and pass conditions are byte-for-byte
unchanged.

## Measure first

### 1. What do the implicated tests cost?

Ten targeted runs under the normal parallel configuration:

| Test | Samples (ms) | Median | Worst |
|---|---|---:|---:|
| App input save | 1370, 1127, 943, 884, 771, 1098, 799, 924, 1095, 1144 | 1019 | 1370 |
| App panel collapse | 1678, 1503, 1923, 1745, 1594, 1469, 1690, 2157, 2282, 2351 | 1717.5 | 2351 |
| Assistant planner feedback | 244, 272, 250, 256, 257, 252, 279, 272, 417, 273 | 264.5 | 417 |
| Assistant taxonomy cleanup | 1215, 1065, 1101, 1089, 1071, 986, 1020, 1079, 1220, 1320 | 1084 | 1320 |

The opening T0 runs supplied the cross-machine tail: implicated durations ranged from
1111 ms through a 5205 ms whole-test timeout. That tail, not a single already-green local
run, determines the budget.

### 2. How far is the margin?

- Vitest 5000 ms left no margin over the measured 5205 ms worst: `0.96x` and already
  exceeded. The selected 15000 ms leaves `2.88x`.
- Testing Library 1000 ms was below the holder's 1320 ms worst async-flow duration. The
  selected 5000 ms leaves `3.79x` that worst.

### 3. Timeout or race?

Per observed test:

| Test | Root cause | Evidence |
|---|---|---|
| App panel collapse | whole-test timeout | explicit `Test timed out in 5000ms`, T0 worst 5205 ms |
| App input save | async-query timeout | line 18 already awaits `findByLabelText('Algorithm preset')` |
| Planner feedback | async-query timeout | line 108 already awaits `findByText(...)`, followed by `waitFor` |
| Taxonomy cleanup | async-query timeout | line 45 already awaits `findByRole(...)` |

No missing await was found. Ten focused runs and ten full-suite runs across two machines
produced the intended state every time after only the two budget changes. No product state
or effect code changed.

### 4. Whole suite or these four?

Every unit test inherited Vitest's 5000 ms default and every Testing Library `findBy*` or
`waitFor` inherited its 1000 ms default. The four observed tests are the exposed edge:
three render the full application or assistant and await lazy/async UI state; the fourth
performs `userEvent` across all five panels. The global configuration fixes the shared
mechanism without adding per-test exceptions. Tests that do not wait asynchronously are
unaffected by `asyncUtilTimeout`.

### 5. Why one machine and not another?

The holder machine reports 16 available processors and 63.6 GiB memory. Vitest used its
default `forks` pool with file parallelism enabled and no worker cap. Five parallel full
suites varied from 41.62 to 87.06 seconds, over 2x, while a one-worker comparison took
355.16 seconds:

```text
default forks: 41.62s, 48.99s, 51.33s, 79.61s, 87.06s
maxWorkers=1: 355.16s
```

The failure follows transient scheduling/contention near implicit timeout boundaries, not a
deterministic product branch. Worker reduction would multiply suite time and does not
repair an invalid budget. Capacity remains unchanged; measured budgets absorb the valid
tail.

## Five-run evidence

### Holder

```text
run 1: Test Files 119 passed (119) | Tests 759 passed (759) | Duration 51.33s
run 2: Test Files 119 passed (119) | Tests 759 passed (759) | Duration 48.99s
run 3: Test Files 119 passed (119) | Tests 759 passed (759) | Duration 41.62s
run 4: Test Files 119 passed (119) | Tests 759 passed (759) | Duration 79.61s
run 5: Test Files 119 passed (119) | Tests 759 passed (759) | Duration 87.06s
```

### T0

This is the same machine that had produced `1, 2, 1` failures in three consecutive runs at
the base:

```text
run 1: Tests 759 passed (759)
run 2: Tests 759 passed (759)
run 3: Tests 759 passed (759)
run 4: Test Files 119 passed (119) | Tests 759 passed (759)
run 5: Test Files 119 passed (119) | Tests 759 passed (759)
```

## Commits

- `f57c78a02dedef00097ba9b551f25300cff7f2b6 route(R09): close`
- `handoff(H09): record` — this handoff commit

Both commits use `Signed-off-by: Mustafa Ozel <iyott131@gmail.com>` after the repository
email returned exactly `iyott131@gmail.com`.

## Gate output

### lint

```text
exit code: 0
> oxlint
```

### test

Before: 759. After: 759.

```text
exit code: 0
Test Files  119 passed (119)
      Tests  759 passed (759)
Duration  56.99s
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

The first eight-worker run exposed an unrelated existing accessibility test capacity
boundary: `accessibility-axe.spec.ts:37` timed out at 30000 ms while R08 clarification
passed at 4300 ms (`67 passed / 1 failed`). No E2E test or timeout was changed. The full
documented external-server run at the repository's established four-worker local setting
then passed both phases:

```text
exit code: 0
Running 68 tests using 4 workers
CLARIFICATION_PIPELINE_MS 3713
68 passed (1.6m)
Running 2 tests using 1 worker
2 passed (42.4s)
```

## Full diff and fix-versus-weakening classification

```diff
diff --git a/src/test/setup.ts b/src/test/setup.ts
@@
 import '@testing-library/jest-dom/vitest';
+import { configure } from '@testing-library/react';
+
+configure({ asyncUtilTimeout: 5_000 });

diff --git a/vitest.config.ts b/vitest.config.ts
@@
   test: {
     environment: 'jsdom',
+    testTimeout: 15_000,
```

- `configure` import — **fix**: uses Testing Library's supported configuration API; no
  assertion or query changes.
- blank separator — formatting only.
- `asyncUtilTimeout: 5_000` — **fix**: changes only how long existing `findBy*`/`waitFor`
  calls may await their existing exact targets; synchronous `getBy*` is unaffected.
- `testTimeout: 15_000` — **fix**: replaces Vitest's implicit whole-test default with the
  measured budget; it changes no pass condition.

No weakening exists in the diff. No retry, worker change, assertion, test body, skip, or
test-count change exists.

## Acceptance

1. **Met** — The handoff answers all five `## Measure first` questions with pasted evidence and names the root cause per failing test. "Flaky" is the symptom being explained. Evidence: `H09 / Measure first`.
2. **Met** — Any chosen budget is justified by the measured distribution, with margin stated as a multiple of the measured worst case. Evidence: `H09 / Measure first / 2`.
3. **Met** — `npm run test` reports **759 or more passing and zero failing on five consecutive runs** on the holder's machine. Paste all five summary lines. One clean run is what an intermittent failure produces routinely. Evidence: `H09 / Five-run evidence / Holder`.
4. **Met (T0)** — T0 re-runs the same five on its own machine and the route does not close until they are clean there too. This criterion exists because the defect is invisible on the holder's machine, and a route graded only where it already passed would close on nothing. Evidence: `H09 / Five-run evidence / T0`.
5. **Met** — No assertion weakened, no test skipped, no retry added. Prove it with `git diff <base>..HEAD` in full, unabridged, with a line-by-line justification of every change, and each marked as fix-versus-weakening per the invariant above. Evidence: `H09 / Full diff and fix-versus-weakening classification`.
6. **Met** — If other tests share the cause, the same fix covers them and the handoff names them; if they are deliberately left alone, it says why. Evidence: `H09 / Measure first / 4`.
7. **Met** — `npm run test` count is at or above 759 — this route removes no tests. Evidence: `H09 / Gate output / test`.
8. **Met** — All four gates clean: `npm run lint`, `npm run test`, `npm run build`, `npm run desktop:check`. Evidence: `H09 / Gate output`.
9. **Met locally / T0 remote pending** — `npm run test:e2e` passes locally, both phases, and R08's clarification budget is untouched. **(T0)** The remote `browser` and `quality` jobs are Claude's to close. Evidence: `H09 / Gate output / local e2e`.
10. **Met** — Two commits, in order: `route(R09): close`, then `handoff(H09): record`, both signed `-s` after verifying `git config user.email` returns `iyott131@gmail.com`. Evidence: `H09 / Commits`.

## Diff scope

```text
.../routes/R08-clarification-budget-validity.md    |  68 +++++++
.../titan/routes/R09-unit-suite-budget-validity.md | 211 +++++++++++++++++++++
docs/titan/routes/queued/R10-semantic-input-ops.md | 211 +++++++++++++++++++++
src/test/setup.ts                                  |   3 +
vitest.config.ts                                   |   1 +
5 files changed, 494 insertions(+)
```

The first three rows are T0-owned route work already present between the recorded base and
the holder close. The holder commit contains exactly the final two rows.

## Deviations

- `src/test/setup.ts` was outside Expected Files. Acceptance criteria 1, 5, and 6 required
  correcting the distinct Testing Library async-query budget that the three `Unable to
  find` failures exposed. A Vitest-only timeout would not affect `findBy*`/`waitFor`.

## Discovered

- The three “Unable to find” failures were not synchronous `getBy*` mistakes. Their tests
  already await `findBy*`/`waitFor`; the visible synchronous failure is downstream of an
  earlier async utility exhausting its implicit 1000 ms budget.
- Default Vitest execution uses the `forks` pool, file parallelism, and 16 available
  processors on the holder. Serializing the suite made it 355.16 seconds, so worker
  reduction is not a proportionate gate fix.
- Eight local Playwright workers can push the accessibility axe sweep beyond its independent
  30000 ms budget. Four workers passed the entire suite. R09 changed neither E2E config nor
  tests.
- `npm ci` still reports the existing high-severity audit advisory and a Node/jsdom engine
  warning; dependency changes were explicitly out of scope.

## Untouched

```text
git diff --name-only 94ef542..f57c78a -- src e2e playwright.config.ts vitest.config.ts
src/test/setup.ts
vitest.config.ts
```

No non-test product module, E2E file, Playwright configuration, assertion, or implicated
test file changed. The pre-existing T0-owned working-tree deletion of
`docs/titan/routes/queued/R09-semantic-input-ops.md` was not staged or modified. Frozen
untracked `.claude/`, `CodeXray-readme-neon.svg`, and
`docs/TITAN_MODE_YOL_HARITASI.md` remain untouched.

The base and close scans for `it.skip`, `describe.skip`, `it.only`, `describe.only`, and
`it.todo` both returned no matches.

## Blockers

- T0 must run the remote `quality` and `browser` gates before opening R10.

## For the human

none
