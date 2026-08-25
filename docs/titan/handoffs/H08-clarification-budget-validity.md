# H08 — The clarification budget is measured

## Turn

- Route: R08
- Base SHA: `954f150`
- End SHA: `8e82e37656cf85259a47c0e4a0f4239d6f44cb4c`
- Status: `closed`
- Next holder: Claude (T0)

## Summary

The repeated clarification flake was a real budget defect in the gate, not a product
intermittency. The assertion waits for the complete `create-algorithm` pipeline. On the
Linux runner, ten sequential samples had a 4937 ms median and 5458 ms worst case, so the
unchosen Playwright default of 5000 ms was below three observed samples and almost equal to
the median. A measured 15000 ms assertion budget leaves 2.75x the observed CI worst case.

The locator and assertion are unchanged, retries remain unchanged, no test was skipped, and
`src/**` was not modified. The browser gate reports `68 passed`, `2 passed`, and zero flaky
on three consecutive attempts of run `32883624515` at the same commit.

## What changed

| path | intent | change |
|---|---|---|
| `playwright.config.ts` | give Titan completion assertions a chosen measured budget | added `expect.timeout: 15_000` |
| `e2e/titan-mode-clarification.spec.ts` | expose the exact Enter-to-label duration | added a timer and one diagnostic log; assertion unchanged |
| `.github/workflows/ci.yml` | collect ten CI samples and preserve retry diagnostics | added a manual measurement mode and always-attempted artifact upload |
| `docs/titan/handoffs/H08-clarification-budget-validity.md` | record evidence | added |

## Root cause

`titan-mode-clarification.spec.ts:27` waits for a complete deterministic Titan
`create-algorithm` pipeline, but inherited Playwright's unchosen 5000 ms default assertion
timeout. CI measurements straddle and exceed that boundary. R06 and R07 did not expose an
incorrect page or locator: they exposed ordinary Linux pipeline latency that retries hid.
The two failing runs already used one worker, so suite worker contention is not the cause.

## Measure first

### 1. What does the operation actually cost?

Local Windows, ten final-configuration samples, one worker:

```text
3336 3026 2982 3001 2980 3005 3005 3002 2993 2984
median: 3003.5 ms
worst: 3336 ms
```

CI run `32883635307`, browser job `97918834858`, same SHA, one worker:

```text
Running 10 tests using 1 worker
CLARIFICATION_PIPELINE_MS 4778
CLARIFICATION_PIPELINE_MS 4488
CLARIFICATION_PIPELINE_MS 5299
CLARIFICATION_PIPELINE_MS 3915
CLARIFICATION_PIPELINE_MS 4937
CLARIFICATION_PIPELINE_MS 5169
CLARIFICATION_PIPELINE_MS 5458
CLARIFICATION_PIPELINE_MS 4688
CLARIFICATION_PIPELINE_MS 4937
CLARIFICATION_PIPELINE_MS 4963
10 passed (1.3m)
median: 4937 ms
worst: 5458 ms
```

### 2. How far is the margin?

The old 5000 ms default is only 0.92x the CI worst case; three of ten CI samples exceeded
it. It is only 1.01x the CI median. The selected 15000 ms budget is 2.75x the measured CI
worst case and 4.50x the local worst case. This is an assertion budget, not an application
performance claim.

### 3. Is this spec alone?

The repository scan found the following existing specs with assertions after Titan or AI
completion paths:

```text
e2e/usage-scenarios.spec.ts
e2e/unicode-and-catalog.spec.ts
e2e/titan-mode.spec.ts
e2e/titan-mode-user-graph.spec.ts
e2e/titan-mode-clarification.spec.ts
e2e/interval-dp.spec.ts
e2e/responsive-layout.spec.ts
e2e/release-tour.spec.ts
e2e/error-isolation.spec.ts
e2e/tree-input.spec.ts
e2e/ai-actions.spec.ts
e2e/dp-family.spec.ts
e2e/model-authored-simulation.spec.ts
```

They share the same default assertion mechanism, so the fix belongs in Playwright config
rather than on line 27. `ai-actions.spec.ts` already used an explicit 15000 ms for the same
algorithm-label wait. Clarification is the recurring boundary case because it submits a
second prompt and waits for source, input, and the complete simulation to be applied.

### 4. Is it contention?

No. The existing CI workflow already set `CODEXRAY_E2E_WORKERS: 1`. Both opening flakes ran
at that current configuration:

```text
32875927404  b4f9ae4  browser  67 passed, 1 flaky  workers=1
32881017681  954f150  browser  67 passed, 1 flaky  workers=1
```

The ten-sample CI measurement also used `--workers=1` and still produced three durations
above 5000 ms. There is therefore no distinct higher-worker CI condition to which the
flake tracks.

### 5. What did the failing artifact show?

The two opening runs had no downloadable artifact:

```json
{"total_count":0,"artifacts":[]}
{"total_count":0,"artifacts":[]}
```

The reason was workflow-level: diagnostics uploaded only on job failure, while Playwright
retry converted the flaky test into a successful job. A controlled local run with the same
assertion temporarily bounded at 2500 ms produced the missing trace and screenshot. They
showed a rendered application with no error boundary, the requested Bidirectional BFS
source already present, and Titan progress at 20%: `Route 0.0s`, `Produce 2.4s`, with
Semantics, Verify, and Apply pending. The simulation view said `Awaiting Simulation Data`.
That proves the locator was waiting for a pipeline still running, not missing a completed
render. The temporary bound was reverted. CI now attempts diagnostic upload with
`if: always()` so a retry-created trace is no longer suppressed; green runs without files
still upload nothing.

## CI evidence

Run `32883624515`, commit `8e82e37656cf85259a47c0e4a0f4239d6f44cb4c`:

```text
attempt 1: 68 passed (6.8m)
attempt 1: 2 passed (59.2s)
attempt 1: 0 flaky

attempt 2: 68 passed (6.2m)
attempt 2: 2 passed (55.0s)
attempt 2: 0 flaky

attempt 3: 68 passed (5.5m)
attempt 3: 2 passed (49.7s)
attempt 3: 0 flaky
```

All three attempts use the same workflow run and commit; attempts 2 and 3 were job re-runs,
not pushes.

## Full scoped diff and line-by-line justification

```diff
diff --git a/e2e/titan-mode-clarification.spec.ts b/e2e/titan-mode-clarification.spec.ts
@@
+  const clarificationPipelineStartedAt = performance.now();
   await question.press('Enter');
   await expect(page.getByLabel(/Bidirectional BFS.*Custom execution/)).toBeVisible();
+  console.log(`CLARIFICATION_PIPELINE_MS ${Math.round(performance.now() - clarificationPipelineStartedAt)}`);
   await expect(page.getByText(/code, input, and \d+-step simulation were applied/i)).toBeVisible();
diff --git a/playwright.config.ts b/playwright.config.ts
@@
+  expect: { timeout: 15_000 },
```

- Timer declaration: establishes the required measurement boundary immediately before the
  Enter press; it does not branch or change application behavior.
- Diagnostic log: records the duration only after the original label assertion succeeds;
  it does not alter the locator or assertion.
- Global expect timeout: applies the measured headroom to every assertion sharing the
  default mechanism, including the listed Titan completion paths.

Workflow deviation, line by line:

- `workflow_dispatch.clarification_measurement`: makes the same-commit ten-sample CI
  measurement reproducible.
- Conditional normal gate: prevents the measurement dispatch from also spending time on
  the full browser suite; push and ordinary dispatch behavior remain the full gate.
- Measurement command: repeats only the named existing clarification flow ten times at the
  already-current one-worker setting.
- `if: always()`: retains traces generated by a Playwright retry even when the job succeeds.
- `if-no-files-found: ignore`: preserves zero-artifact green runs.

## Verification output

```text
8e82e37656cf85259a47c0e4a0f4239d6f44cb4c

.github/workflows/ci.yml                           |  18 +-
AGENTS.md                                          |   6 +-
docs/titan/routes/R07-adapt-input-on-the-seam.md   | 104 ++++++++++
docs/titan/routes/R08-clarification-budget-validity.md | 215 +++++++++++++++++++++
docs/titan/routes/queued/R09-semantic-input-ops.md | 209 ++++++++++++++++++++
e2e/titan-mode-clarification.spec.ts               |   2 +
playwright.config.ts                               |   1 +
src/services/titan/AGENTS.md                       |  13 +-
8 files changed, 558 insertions(+), 10 deletions(-)
```

Skip/only scan:

```text
e2e\real-ai.spec.ts:79:  test.skip(
e2e\real-ai.spec.ts:100:    test.skip(
e2e\real-radio.spec.ts:14:  test.skip(
```

These are pre-existing environment guards, not R08 changes. The same command against base
`954f150` returns the same three lines, and the base-to-close diff for both files is empty.
The route's statement that this command must return no output was therefore false at its
own base. The scoped diff above proves R08 added no skip, fixme, only, deletion, or weakened
assertion.

### lint

```text
> oxlint
exit code: 0
```

### test

```text
> vitest run
Test Files  119 passed (119)
Tests  759 passed (759)
exit code: 0
```

### build

```text
Initial JavaScript: 416.7 / 420.0 KiB
Lazy JavaScript: 34 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
exit code: 0
```

### desktop:check

```text
CodeXRay desktop version 2.3.4 is synchronized.
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
exit code: 0
```

### local e2e

The documented external-server procedure ran the full suite with the repository's existing
four-worker local setting:

```text
Running 68 tests using 4 workers
CLARIFICATION_PIPELINE_MS 3049
68 passed (1.2m)
2 passed (38.2s)
exit code: 0
```

## Acceptance

1. **Met** — all five measurement questions are answered above; root cause is the unchosen
   5000 ms default around a full pipeline whose CI distribution crosses it. Evidence:
   `H08 / Measure first + Root cause`.
2. **Met** — 15000 ms is 2.75x the measured CI worst case. Evidence: `H08 / Measure first / 2`.
3. **Met** — three consecutive browser attempts of run `32883624515` on one commit report
   zero flaky. Evidence: `H08 / CI evidence`.
4. **Met** — every attempt reports identical `68 passed / 2 passed / 0 flaky`. Evidence:
   `H08 / CI evidence`.
5. **Met** — full scoped diff is pasted and justified; assertion, locator, retry count, and
   spec set are unchanged. Evidence: `H08 / Full scoped diff and line-by-line justification`.
6. **Met** — all sharing specs are named and covered by the global expect budget. Evidence:
   `H08 / Measure first / 3`.
7. **Met** — full local Windows E2E passes through the external-server procedure. Evidence:
   `H08 / Verification output / local e2e`.
8. **Met** — lint, test, build, and desktop check pass. Evidence: `H08 / Verification output`.
9. **Met** — unit count is 759. Evidence: `H08 / Verification output / test`.
10. **Met** — `route(R08): close` is signed; `handoff(H08): record` is the signed commit
    containing this file. Email was checked as `iyott131@gmail.com` before both commits.
    Evidence: `H08 / Commits`.

## Commits

- `8e82e37656cf85259a47c0e4a0f4239d6f44cb4c route(R08): close`
- `handoff(H08): record` — this handoff commit

Both use `Signed-off-by: Mustafa Özel <iyott131@gmail.com>`.

## Deviations

- `.github/workflows/ci.yml` was outside Expected Files. Criteria 1–4 required a
  reproducible same-commit CI distribution, and criterion 5 required the opening retry
  artifact to be readable. The workflow's failure-only upload made that artifact
  unavailable, so measurement dispatch and retry-safe diagnostics were necessary.
- `docs/titan/DOD.md` was forecast but unchanged because R08 has no DOD evidence cell.

## Discovered

- Run `32883635307`'s measurement browser job passed 10/10, but the independent quality job
  failed at the previously recorded `src/App.test.tsx:60` coverage timeout. This is the
  second observed occurrence of that product-test timeout. `src/**` was read-only in R08,
  and it did not affect the browser measurement or the clean push workflow.
- The opening CI runs contained no artifacts because Playwright retries made the job green
  before the failure-only upload condition was evaluated.
- GitHub's Node 20 action deprecation warning applies to the existing v4 actions; dependency
  upgrades were outside R08.
- `npm ci` continues to report one existing high-severity audit advisory; no package file
  changed.
- R08's skip scan expected zero output, but its own base already contains two conditional
  real-AI skips and one conditional real-radio skip. R08 did not touch those files; T0
  should correct future verification language to distinguish newly introduced skips from
  established live-test environment guards.

## Untouched

```text
git diff --name-only 954f150..8e82e37 -- src .claude .agents docs/tasks docs/legacy CodeXray-readme-neon.svg docs/TITAN_MODE_YOL_HARITASI.md docs/titan/routes/queued/R09-semantic-input-ops.md
<no holder-authored output; base-range T0 files are pre-existing>
```

The route close commit touches no `src/**`, frozen path, T0-owned file, or queued R09 file.
The pre-existing untracked `.claude/`, `CodeXray-readme-neon.svg`, and
`docs/TITAN_MODE_YOL_HARITASI.md` remain untouched.

## Blockers

- None for R08. T0 should route the repeated `src/App.test.tsx:60` coverage timeout under
  the same recurrence discipline; it was not legal to repair in this read-only diagnosis
  route.

## For the human

none
