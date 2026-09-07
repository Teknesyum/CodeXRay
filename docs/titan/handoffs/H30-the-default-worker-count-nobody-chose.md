# H30 — The Default Worker Count Nobody Chose

## Turn

route: R30 / base SHA: 77d59ba / end SHA: 2b8e49d52fbdcd3cb1cca37fc59fbef78532a2f1 /
status: closed / next holder: Claude

## Özet

`playwright.config.ts`'e sabit bir varsayılan verildi, ama 4 değil 2: bu makinede 4 işçiyle
üç ardışık koşudan biri gerçek bir eşzamanlılık zaman aşımıyla düştü, 2 işçiyle üç ayrı üçlü
koşu da dahil toplam altı koşu temiz geçti. `CODEXRAY_E2E_WORKERS` hâlâ üstün geliyor, CI'nin
`=1` değeri etkilenmedi.

## What changed

| path:line-range | intent | added, edited or deleted |
|---|---|---|
| `playwright.config.ts:19` | give `workers` a measured default instead of inheriting Playwright's half-of-cores default | edited |

## Commits

- `2b8e49d52fbdcd3cb1cca37fc59fbef78532a2f1` — `route(R30): close`

## Gate output

### lint

Exit code: 0

```
> codexray@2.3.4 lint
> oxlint
```

(oxlint prints nothing further on a clean pass; no warnings, no errors.)

### test

Exit code: 0

```
> codexray@2.3.4 test
> vitest run


 RUN  v4.1.10 C:/Users/Administrator/Desktop/Projeler/CodeXray


 Test Files  120 passed (120)
      Tests  909 passed (909)
   Start at  23:04:58
   Duration  24.88s (transform 15.11s, setup 30.35s, import 20.95s, tests 52.87s, environment 203.40s)
```

Test count before turn (base, per route text): 909. After turn: 909. No delta — this route
changes no test, no source under test.

### build

Exit code: 0

```
✓ built in 522ms
Initial JavaScript: 422.6 / 425.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
```

### desktop:check

Not run. `src-tauri/**` did not change this turn (see Diff scope); AGENTS.md requires this
gate only when that path changes.

## Acceptance

1. **`npm run test:e2e` with no environment variable set passes three times in a row —
   not met at the route's proposed value (4), met at the shipped value (2).**

   Evidence, all runs used the AGENTS.md external-server procedure, `PLAYWRIGHT_EXTERNAL_SERVER=1`,
   `CODEXRAY_E2E_WORKERS` confirmed unset via `Test-Path Env:CODEXRAY_E2E_WORKERS` before each run:

   With `workers: configuredWorkers ?? 4` (intermediate value, not shipped):

   ```
   run 1   Running 82 tests using 4 workers   82 passed (1.5m)   /   Running 2 tests using 1 worker   2 passed (40.5s)
   run 2   Running 82 tests using 4 workers   1 failed: ai-actions.spec.ts:112 (Test timeout of 30000ms exceeded)   81 passed (2.7m)
   run 3   Running 82 tests using 4 workers   82 passed (2.0m)   /   Running 2 tests using 1 worker   2 passed (52.5s)
   ```

   Run 2's failure, verbatim:

   ```
   1) [chromium] › e2e\ai-actions.spec.ts:112:1 › builds and applies bidirectional BFS through the visible Titan Mode queue
      Test timeout of 30000ms exceeded.
      Error: locator.click: Test timeout of 30000ms exceeded.
      Call log:
        - waiting for getByRole('button', { name: 'Next step' })
          - locator resolved to <button aria-label="Next step" class="icon-btn primary-step">…</button>
        - attempting click action
          - waiting for element to be visible, enabled and stable
          - element is not enabled
        [... retries omitted, full sequence in trace.zip ...]
          > 257 |   for (let index = 0; index < 100 && !await finalNext.isDisabled(); index += 1) await finalNext.click();
   ```

   This is the same failure family the route describes for 8 workers (30 s budget, no
   assertion error, a spec that finishes in 12.5 s alone) — at 4 workers, not 8. The route's
   own note anticipates this outcome literally: *"If four workers turns out not to be green on
   the implementer's machine, that is a finding, not a failure — report the profile that is,
   with the same table shape."* Reporting it: 4 was not the reliable profile here.

   Three more runs at `CODEXRAY_E2E_WORKERS=2` (exploratory, to find the profile that is
   reliable before changing the shipped default):

   ```
   run 1   Running 82 tests using 2 workers   82 passed (3.2m)   /   Running 2 tests using 1 worker   2 passed (35.2s)
   run 2   Running 82 tests using 2 workers   82 passed (2.5m)   /   Running 2 tests using 1 worker   2 passed (36.0s)
   run 3   Running 82 tests using 2 workers   82 passed (2.7m)   /   Running 2 tests using 1 worker   2 passed (36.3s)
   ```

   The config was then changed to `workers: configuredWorkers ?? 2` (the shipped value), and
   the criterion's literal invocation — `npm run test:e2e`, no environment variable set — was
   run three more times against that shipped config:

   ```
   run 1   Running 82 tests using 2 workers   82 passed (2.5m)   /   Running 2 tests using 1 worker   2 passed (35.9s)
   run 2   Running 82 tests using 2 workers   82 passed (2.5m)   /   Running 2 tests using 1 worker   2 passed (35.9s)
   run 3   Running 82 tests using 2 workers   82 passed (2.4m)   /   Running 2 tests using 1 worker   2 passed (37.2s)
   ```

   Met, against the shipped default of 2, not against the route's proposed 4.

2. **`CODEXRAY_E2E_WORKERS` still wins when set — met.**

   ```
   CODEXRAY_E2E_WORKERS=3, PLAYWRIGHT_EXTERNAL_SERVER=1
   node node_modules/@playwright/test/cli.js test --grep-invert "@performance" e2e/tree-input-resilience.spec.ts e2e/unicode-and-catalog.spec.ts e2e/web-problem-routing.spec.ts

   Running 5 tests using 3 workers
     5 passed (7.0s)
   ```

   3 requested, 3 used. `configuredWorkers ?? 2` only substitutes when
   `CODEXRAY_E2E_WORKERS` is unset (`configuredWorkers` is `undefined`); when it parses to any
   number, including CI's `1`, that number wins unchanged — this is unedited pre-existing
   logic, not a new branch, so CI's profile is unaffected by inspection as well as by this test.

3. **The handoff states the worker count the run actually used — met.**

   Every run above quotes Playwright's own `Running N tests using K workers` line verbatim.
   The shipped default's actual runs: **2 workers** (e.g. `Running 82 tests using 2 workers`,
   final run 1/2/3 above).

4. **No spec file, no application file, and no timeout value changed — met.**

   `git diff --stat 77d59ba..HEAD`:

   ```
   .../R30-the-default-worker-count-nobody-chose.md   | 152 +++++++++++++++++++++
    playwright.config.ts                               |   2 +-
    2 files changed, 153 insertions(+), 1 deletion(-)
   ```

   The route file is T0's own (opened in this range). The only Sole-owned file touched is
   `playwright.config.ts`, one line, the `workers` default — no `expect.timeout`, no spec, no
   `e2e/**` or other `src/**` file. See `## Deviations` for the value chosen.

5. **`lint`, `test`, `build` clean, unit test count stated against base's 909 — met.**

   lint exit 0, test exit 0 with `909 passed (909)` (no delta from base's 909, expected —
   this route changes no test), build exit 0 with `Initial JavaScript: 422.6 / 425.0 KiB`
   (unchanged budget, this route touches no bundled source).

6. **(T0) Are the three specs that timed out individually slower than the rest of the suite —
   met, with numbers.**

   From a clean 4-worker run (run 1 above), each test's own duration as printed by Playwright:

   ```
   accessibility-axe.spec.ts:37   9.9s
   ai-actions.spec.ts:112         12.5s
   radio-controller.spec.ts:3     8.1s
   ```

   Same run, all 82 non-performance tests' durations, sorted: min 1.1s, median 3.1s, max
   (excluding these three) under 8s. All three sit well above the suite's median (8.1–12.5s
   vs 3.1s), and are the three longest-running specs alongside a handful in the 5–7s range.
   Yes, they are individually slower than the rest of the suite — this route does not touch
   them, per the route's own instruction, and it names this plainly as a candidate for a
   separate route rather than fixing it here.

## Diff scope

```
git diff --stat 77d59ba..HEAD
 docs/titan/routes/R30-the-default-worker-count-nobody-chose.md | 152 +++++++++++++++++++++
 playwright.config.ts                                            |   2 +-
 2 files changed, 153 insertions(+), 1 deletion(-)
```

## Deviations

**The shipped default is 2, not the route's proposed 4.** The route measured 4 as green on
T0's machine from one run each of the 4- and 2-worker profiles, and asked the implementer to
report if 4 was not reliable here rather than force it. On this machine, three consecutive
runs at 4 workers produced one failure (`ai-actions.spec.ts:112`, `Test timeout of 30000ms
exceeded`, the same contention symptom the route describes for 8 workers) — 4 is not the
reliable profile here. Three consecutive runs at 2 workers were clean, and a second
three-run set at 2 workers, against the actually-shipped config with no environment variable
set, was also clean (six clean runs total at 2, one failure in three at 4). 2 was chosen over
4 on that evidence; both are simple integer literals, deterministic, and not dependent on
anything that varies between runs on the same machine, matching the route's fallback
instruction. No other file changed beyond the value already forecast
(`playwright.config.ts`).

## Discovered

None beyond what criterion 6 above already surfaces (the three specs are consistently the
slowest in the suite, a separate route per the route's own "Still deferred" list).

## Untouched

```
git diff --name-only "77d59ba..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$'
(no output)

git diff --name-only "77d59ba..HEAD" | Select-String -Pattern '^e2e/|^src/'
(no output)

git status --porcelain | Select-String -Pattern 'test-results|dist/|coverage/'
(no output)
```

All three checks print nothing, as required.

## Blockers

None.

## For the human

Yok.
