# H02 — Trustworthy browser gate

## Turn

- Route: R02
- Base SHA: `7a6f9f32954fd728cd3f20a36bd9318ed04876a3`
- End SHA: `9aa5a410331eb46b84fda01ff95f7454dedbe79a`
- Status: `partial`
- Next holder: Claude (T0)

## Özet

CI kararsızlığının ana nedeni aynı runner'daki paralel Playwright worker yükü olarak kanıtlandı.
Tek worker ile 66 normal test geçiyor; trace, ekran görüntüsü ve HTML raporu artık yükleniyor.
Gate ilk kez performans aşamasına ulaştı ve iki işletim sisteminde gerçek timeline bütçe ihlali buldu.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `.github/workflows/ci.yml:22-92` | run the gate with one worker, compare parallel/full and isolated implicated runs on the same SHA, upload failure artifacts | edited |
| `playwright.config.ts:7-27` | accept an explicit worker count and retain trace, screenshot, and HTML diagnostics on failure | edited |

## Commits

- `9aa5a410331eb46b84fda01ff95f7454dedbe79a route(R02): close`
- `handoff(H02): record` — this handoff commit

## Diagnosis first

### 1. Is it contention?

Yes. On the same SHA `9aa5a41`, CI run
[32759081011](https://github.com/Teknesyum/CodeXRay/actions/runs/32759081011) reported:

```text
-   66 passed (5.1m)
```

for `browser` with `CODEXRAY_E2E_WORKERS=1`. The current parallel configuration failed.
The same relation reproduced locally: the default 8-worker run was `7 failed / 59 passed`;
the one-worker run was `66 passed` before reaching the separate performance phase.

### 2. Is it order?

No. The implicated files were started as separate Playwright invocations. Single-test files
passed, while internally parallel heavy files still failed:

```text
3 failed
  [chromium] › e2e/usage-scenarios.spec.ts:13:1
  [chromium] › e2e/usage-scenarios.spec.ts:28:1
  [chromium] › e2e/usage-scenarios.spec.ts:43:1
1 flaky
  [chromium] › e2e/usage-scenarios.spec.ts:63:1

6 failed
  [chromium] › e2e/dp-family-titan-mode.spec.ts:25:1
  [chromium] › e2e/dp-family-titan-mode.spec.ts:42:1
  [chromium] › e2e/dp-family-titan-mode.spec.ts:64:1
  [chromium] › e2e/dp-family-titan-mode.spec.ts:94:1
  [chromium] › e2e/dp-family-titan-mode.spec.ts:108:1
  [chromium] › e2e/dp-family-titan-mode.spec.ts:122:1
2 flaky
  [chromium] › e2e/dp-family-titan-mode.spec.ts:80:1
  [chromium] › e2e/dp-family-titan-mode.spec.ts:136:1
```

Evidence: job `97533313957`, artifact `browser-diagnosis-isolated-implicated`
(`9532120414`).

### 3. Is it the environment?

The missing capability is runner CPU capacity for concurrent browser workers, not WebGPU,
OPFS, model cache, or network. These specs use the deterministic mocked Titan path and need
no downloaded model. With one worker the exact same Linux environment passed all 66 normal
tests; with parallel workers the same SHA timed out. Windows showed the same capacity
relationship (8 workers: 7/59; 1 worker: 66/66 normal tests).

### 4. Is it real?

The original missing-label failure is a real incomplete atomic UI commit under contention,
not an error boundary or empty page. The parallel LCS screenshot in artifact
`browser-diagnosis-parallel-full` (`9532294164`) shows the correct Java LCS source, 2D matrix,
`Step 1/26`, and all five Titan phases completed, while the preset still reads
`Algorithm Presets`; therefore the required `LeetCode 1143 — Longest Common Subsequence
execution` accessible name is not committed when the assertion expires.

After serializing normal tests, a second real defect became reachable. The page is fully
rendered and interactive, but ten timeline commits miss the performance budget:

```text
Expected: < 1000
Received:   1326.5324909999995
```

CI retries measured `1326.1398310000004` and `1320.0898829999996`; the one-worker Windows
run measured `1049.1024000000002`. Evidence: job `97533313801`, artifact
`browser-diagnostics` (`9532172816`), including `trace.zip`, `test-failed-1.png`,
`error-context.md`, and the HTML report.

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
66 passed (4.4m)
1 failed
  [chromium] › e2e\performance-budget.spec.ts:3:1 › keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets @performance
1 passed (15.3s)
E2E_EXIT=1
```

## Acceptance

1. **Met** — `run 32759081011 / jobs 97533313801, 97533313957, 97533314023 / artifacts 9532120414, 9532172816, 9532294164`.
2. **Not met** — `run 32759081011 / browser job 97533313801: failure`; three green reruns are impossible until the product performance defect is fixed.
3. **Not met** — `run 32759081011 / serial normal: 66 passed; parallel and isolated jobs: failure`; the route exposed distinct configurations rather than two identical-result runs.
4. **Not met** — `run 32759081011 / performance-budget.spec.ts:3:1 failed`; normal serial tests have zero flaky, but the gate remains red.
5. **Met** — `git diff 7a6f9f3..9aa5a41 -- e2e/` returns no output; no spec or assertion changed.
6. **Met** — [run 32759081011 artifacts](https://github.com/Teknesyum/CodeXRay/actions/runs/32759081011) contains traces, screenshots, error contexts, and HTML reports.
7. **Not met** — local one-worker run: `66 passed`, then performance budget `1049.1024 >= 1000`.
8. **Met** — gate output above: lint 0, test 751/751, build 0, desktop 7/7.
9. **Met** — `npm run test`: `751 passed (751)`.
10. **Met** — `9aa5a41 route(R02): close`, followed by this `handoff(H02): record` commit.

## Diff scope

```text
 .github/workflows/ci.yml                          |  59 ++++++
 AGENTS.md                                         |   4 +-
 docs/titan/PROTOCOL.md                            |  24 ++-
 docs/titan/SOLE_BOOTSTRAP.md                      |  15 +-
 docs/titan/routes/R01-record-truth.md             | 130 ++++++++++++
 docs/titan/routes/R02-trustworthy-browser-gate.md | 193 +++++++++++++++++
 docs/titan/routes/queued/R03-first-seam.md        | 241 ++++++++++++++++++++++
 playwright.config.ts                              |  11 +-
 8 files changed, 669 insertions(+), 8 deletions(-)
```

## Deviations

1. The route work commit was pushed before the diagnosis completed so the same SHA could
   host serial, parallel, isolated, and artifact-producing jobs. The route explicitly grants
   that push authority.
2. The verbatim skip grep is nonempty because pre-existing real-integration specs contain
   conditional `test.skip` calls:

```text
e2e\real-ai.spec.ts:79:  test.skip(
e2e\real-ai.spec.ts:100:    test.skip(
e2e\real-radio.spec.ts:14:  test.skip(
```

No R02 e2e file changed, so none were added by this route.
3. The unabridged base diff includes T0-owned route-opening files between the stated base and
   the work commit. R02 itself changed only the two files listed under `What changed`.

## Discovered

- Serializing normal tests exposes a deterministic timeline performance-budget failure that
  previous normal-suite failures prevented the runner from reaching.
- Failure artifacts can be very large: the parallel diagnostic artifact is 648,454,966 bytes.
  T0 should remove or narrow the temporary diagnostic matrix in the reopened route after it
  has consumed this evidence; the gate artifact itself is 73,411,618 bytes.

## Untouched

```text
git diff 7a6f9f3..9aa5a41 -- e2e/
```

The command returns no output. No `src/**`, `e2e/**`, `src-tauri/**`, frozen path, assertion,
retry count, or timeout changed.

## Blockers

- Product performance defect: ten deterministic timeline commits exceed the existing 1000 ms
  budget on both Linux CI and local Windows. Per `If the fault is in the product`, R02 cannot
  fix this; open a dedicated product-performance route with the recorded traces.
- After that fix, reopen R02 to remove/narrow the temporary diagnosis matrix and prove three
  consecutive green reruns of one commit.

## For the human

none
