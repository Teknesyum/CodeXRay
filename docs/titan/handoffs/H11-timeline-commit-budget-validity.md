# H11 — Timeline commit budget validity

## Turn

- Route: R11
- Base SHA: `2e33d8d`
- End SHA: `f2e04241fd55fff2f2e80486857578dd47854d0f`
- Status: `closed`
- Next holder: Claude (T0)

## Özet

Option A was selected with Option B retained as a catastrophic outer guard. The interaction
budget now asserts the median synchronous handler cost of ten commits at 10 ms. Eight CI
observations put the unchanged handler median at 1.15–1.45 ms, so the budget has 6.90x
margin over the measured worst. The paint-aware median remains logged and has a 1,000 ms
catastrophic-hang guard, 3.05x the new CI worst of 327.50 ms.

The same measurement pass invalidated the unselected 5,000 ms startup default: ten local
observations included 6,699.97 ms. It is now 15,000 ms, 2.24x that measured local worst and
15.71x the new CI worst. Catalog and DP remain unchanged but are the thinnest surviving CI
budgets at 1.43x each.

## What changed

| path | intent | change |
|---|---|---|
| `e2e/performance-budget.spec.ts` | assert application commit cost, retain a catastrophic frame guard, and log every sibling budget | edited |
| `docs/titan/handoffs/H11-timeline-commit-budget-validity.md` | record measurements and closure evidence | added |

## Decision and derivation

The primary assertion moved from `inPage.median < 400` to `handler.median < 10`. The worst
handler median among the eight cited CI observations is 1.45 ms; `10 / 1.45 = 6.90x`.
Unlike the old signal, this value excludes Playwright transport and shared-runner frame
pacing. A deliberate 30 ms delay per click produced a 300.65 ms handler median and failed
the 10 ms assertion, so the budget still fails closed.

The paint-aware measurement remains asserted at 1,000 ms only as a catastrophic-hang
guard. Its worst new CI median is 327.50 ms; `1000 / 327.50 = 3.05x`. One new maximum was
542.20 ms, still below the outer bound. This guard is not presented as a sensitive
application-performance budget.

The handler cannot detect work deferred into `useEffect`, layout, or paint. The outer guard
catches only catastrophic frame/paint stalls, while the other browser specs verify visible
rendered outcomes and interaction completion. No existing spec provides precise
performance attribution for deferred effects, layout, or paint; that limitation is
explicit rather than hidden inside runner noise.

## R03 findings revisited

1. **Still holds:** the pre-R03 Playwright loop spent about 98% of its allowance on harness
   transport. The current Playwright medians are 1,533.72–1,643.97 ms while handler medians
   are 1.15–1.45 ms.
2. **Historically true, no longer a stable budget basis:** R03 measured paint-aware medians
   of 166 ms on Windows and 277 ms on Linux. Unchanged CI code now spans 229.65–406.80 ms
   across the four inherited observations and 263.35–327.50 ms across the four new ones.
3. **Still holds:** handler medians remain flat. R03 saw 1.0–1.4 ms; the eight current CI
   observations span 1.15–1.45 ms.
4. **Partly superseded:** rejecting max-of-ten remains correct because maximum frame delay
   follows the scheduler. R03's further inference that the median isolates application cost
   expired after unchanged-code medians spread 1.77x and crossed 400 ms.
5. **Superseded and re-proven on the chosen metric:** R03's 30 ms injection produced a
   457.5 ms paint-aware median and failed. R11 repeated the same injection; handler median
   was 300.65 ms and the new 10 ms assertion failed.
6. **Still holds as historical evidence:** R03's clean 166.5 ms run passed. R11's clean
   local full E2E produced handler median 0.65 ms and paint-aware median 166.25 ms, and both
   assertions passed.

## CI observations

The four inherited observations from R11's objective and the four new observations give
eight chosen-metric samples:

| Run | Head/attempt | `handler.median` |
|---|---|---:|
| 32933124940 | `5f27c87` | 1.25 |
| 32933942052 | `85146de` | 1.20 |
| 32958195410 | `2e33d8d`, attempt 1 | 1.30 |
| 32958195410 | `2e33d8d`, retry | 1.20 |
| 32990511864 | `f2e0424` | 1.2500000000582077 |
| 32990514514 | `f2e0424` | 1.1500000000814907 |
| 32990570355 | `f2e0424` | 1.349999999976717 |
| 32991203850 | `f2e0424` | 1.4499999998952262 |

New CI log lines, verbatim:

```text
32990511864
TIMELINE_MEASUREMENTS {"playwright":{"min":1502.3820979999946,"median":1643.9655235,"max":1787.961241},"inPage":{"min":263.30000000004657,"median":317.45000000001164,"max":444.70000000006985},"handler":{"min":0.9999999997671694,"median":1.2500000000582077,"max":3.699999999953434},"deliberateDelayMs":0}

32990514514
TIMELINE_MEASUREMENTS {"playwright":{"min":1382.4113540000035,"median":1533.7236030000022,"max":1796.8813329999994},"inPage":{"min":209.5,"median":327.5000000000582,"max":542.2000000000698},"handler":{"min":0.9999999997671694,"median":1.1500000000814907,"max":1.5999999998603016},"deliberateDelayMs":0}

32990570355
TIMELINE_MEASUREMENTS {"playwright":{"min":1410.5711979999978,"median":1544.8363394999997,"max":1786.5481600000003},"inPage":{"min":218.20000000001164,"median":263.3500000000058,"max":451.29999999998836},"handler":{"min":0.9000000000232831,"median":1.349999999976717,"max":2.900000000023283},"deliberateDelayMs":0}

32991203850
TIMELINE_MEASUREMENTS {"playwright":{"min":1363.2858489999999,"median":1601.319888,"max":1848.5864980000006},"inPage":{"min":226.69999999995343,"median":277.20000000001164,"max":471.29999999993015},"handler":{"min":0.9999999998835847,"median":1.4499999998952262,"max":1.8999999997904524},"deliberateDelayMs":0}
```

## Sibling budget margins

Margins use the worst value from the four new CI runs. The timeline rows are included for
comparison; criterion 5's four sibling budgets are startup, catalog, simulation, and DP.

| Measurement | CI worst | Budget | Margin | Verdict |
|---|---:|---:|---:|---|
| handler median | 1.45 ms | 10 ms | 6.90x | valid primary application-cost budget |
| in-page median | 327.50 ms | 1,000 ms | 3.05x | valid only as catastrophic outer guard |
| startup | 954.93 ms | 15,000 ms | 15.71x | valid; changed after local 6,699.97 ms falsified 5,000 ms |
| seven catalog commits | 2,447.00 ms | 3,500 ms | 1.43x | passes but thin; unchanged this route |
| graph simulation | 202.81 ms | 2,000 ms | 9.86x | valid |
| 70-cell DP | 2,792.81 ms | 4,000 ms | 1.43x | passes but thin; unchanged this route |

CI lines, verbatim:

```text
32990511864
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":944.6016179999999,"catalogMs":2418.55294,"simulationMs":202.81132400000024,"dpMs":2792.8118479999976}

32990514514
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":954.929797,"catalogMs":2447.00327,"simulationMs":191.84538500000008,"dpMs":2736.369310999995}

32990570355
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":926.310894,"catalogMs":2361.6003220000002,"simulationMs":179.28637200000003,"dpMs":2779.113151999998}

32991203850
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":909.7763729999999,"catalogMs":2370.141217,"simulationMs":192.53353600000037,"dpMs":2677.201122999999}
```

## Deliberate failure

```text
TIMELINE_TEST_DELAY_MS=30
Expected: < 10
Received: 300.64999999990687
Error: median synchronous cost of ten timeline commits
exit code: 1
```

## Gate output

### lint

```text
exit code: 0
> oxlint
```

### test

```text
exit code: 0
Test Files  119 passed (119)
Tests  772 passed (772)
Duration  17.57s
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

```text
exit code: 0
Running 68 tests using 8 workers
CLARIFICATION_PIPELINE_MS 3974
68 passed (58.4s)
Running 2 tests using 1 worker
TIMELINE_MEASUREMENTS {"playwright":{"min":739.3257999999987,"median":804.7128499999999,"max":860.0316000000003},"inPage":{"min":159.5,"median":166.25,"max":167},"handler":{"min":0.2999999988824129,"median":0.650000000372529,"max":0.9999999990686774},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1520.0423,"catalogMs":261.6627000000001,"simulationMs":119.97109999999975,"dpMs":2948.060800000003}
2 passed (34.3s)
```

### remote browser

All four runs used head `f2e0424`. Each completed `desktop`, `quality`, and `browser` with
`success`, `68 passed + 2 passed`, and zero flaky.

```text
32990511864 success — 68 passed + 2 passed — 0 flaky
32990514514 success — 68 passed + 2 passed — 0 flaky
32990570355 success — 68 passed + 2 passed — 0 flaky
32991203850 success — 68 passed + 2 passed — 0 flaky
```

The first three are consecutive workflow-dispatch runs; the fourth is the push run. This
exceeds criterion 9's three consecutive same-head clean runs.

## Verification output

```text
f2e04241fd55fff2f2e80486857578dd47854d0f
AGENTS.md                                          |  13 +-
 docs/titan/routes/R10-semantic-input-ops.md        |  54 +++++
 .../routes/R11-timeline-commit-budget-validity.md  | 244 +++++++++++++++++++++
 docs/titan/routes/queued/R12-two-graph-editors.md  | 209 ++++++++++++++++++
 e2e/performance-budget.spec.ts                     |  35 ++-
 5 files changed, 543 insertions(+), 12 deletions(-)

git diff --name-only "2e33d8d..HEAD" -- src src-tauri
<no output>
```

The `Math.random` scan printed only the same pre-existing base matches in
`AiAssistant.tsx`, `algorithmCatalog.ts`, the trace interpreter/test, `titanEngine.ts`,
`titanEntry.ts`, and `webProblemOrchestrator.ts`. R11 added none.

## Acceptance

1. **Met** — Option A plus outer guard, values, measured bases, multiples, and margins are recorded above.
2. **Met** — All six R03 findings are individually classified under `R03 findings revisited`.
3. **Met** — Eight CI handler-median observations are cited; four new raw log lines are pasted verbatim.
4. **Met** — The 30 ms deliberate delay failed at a 300.65 ms handler median.
5. **Met** — All four sibling margins and the startup verdict are recorded; catalog and DP are identified as the two thinnest at 1.43x.
6. **Met** — Deferred effects/layout/paint limitations and existing functional coverage are stated.
7. **Met** — The product-path diff command printed no output.
8. **Met** — lint, 772 tests, build, and desktop checks are clean.
9. **Met** — Local 68+2 is clean; four consecutive same-head remote runs are clean with zero flaky.
10. **Met** — `route(R11): close` then `handoff(H11): record`, both signed after email verification.

## Commits

- `f2e04241fd55fff2f2e80486857578dd47854d0f route(R11): close`
- `handoff(H11): record` — this handoff commit

Both commits use `Signed-off-by: Mustafa Özel <iyott131@gmail.com>` after
`git config user.email` returned exactly `iyott131@gmail.com`.

## Diff scope

The holder close changed only `e2e/performance-budget.spec.ts`. T0-owned route and planning
files already present between base and holder close are recorded in the verification stat.
This handoff commit adds H11 and updates only the derivation comment in the same E2E file
from the earlier four-observation 7.69x figure to the final eight-observation 6.90x figure.

## Deviations

- `e2e/performance-budget.spec.ts` appears again in the handoff commit because the final CI
  sample changed the measured worst handler median from 1.30 to 1.45 ms. The 10 ms budget
  did not change; only its provenance comment was reconciled to the remote evidence.

## Discovered

- Catalog switching and 70-cell DP are now the two thinnest sibling budgets, both at 1.43x
  their worst new CI observation. They passed all four runs and were not changed because
  R11 required measurement, not unrelated retuning.
- The paint-aware maximum reached 542.20 ms while the median remained below the 1,000 ms
  catastrophic guard, reinforcing that maximum frame delay follows runner scheduling.

## Untouched

No product source changed. Frozen untracked `.claude/`, `CodeXray-readme-neon.svg`, and
`docs/TITAN_MODE_YOL_HARITASI.md` remain untouched.

## Blockers

none

## For the human

none
