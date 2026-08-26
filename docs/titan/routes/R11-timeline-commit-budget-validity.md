# R11 — The timeline commit budget measures the runner, not the app

## Özet

R10 kapandı, dört kapı temiz, uzak `browser` işi yeşil — ama ikinci fazda bir flaky var:
`performance-budget.spec.ts:89`, `median of ten in-page timeline commits`, ölçülen
`406.8 ms`, bütçe `400 ms`. Marj **%1.7**. Ama bu R08 ve R09 ile aynı hata değil: bu bütçe
R03'te ölçülerek seçilmişti ve o zaman doğruydu. Ölçüldüğü metrik altından kaydı. Rota
özellik yazmaz, kapıyı düzeltir.

## Objective

**This budget is not one of the unchosen numbers.** `TIMELINE_COMMIT_BUDGET_MS = 400` at
`e2e/performance-budget.spec.ts:3` was measured and chosen in R03, and R03's reasoning is
recorded in its own `## T0 reconciliation` at lines 262-278. Read it before touching
anything here. In summary, R03 found:

- The old assertion spent 98% of its allowance on Playwright transport, and was replaced.
- Paint-aware in-page total measured **166 ms on Windows, 277 ms on Linux** at the median.
- Handler medians were **1.0–1.4 ms** across every run, while maxima swung 442–551 ms.
- R03 therefore rejected max-of-ten explicitly: *"Judging the median measures the
  application; judging the maximum measures the runner."*
- Falsification held: `TIMELINE_TEST_DELAY_MS=30` pushed the median to 457.5 ms and the
  assertion failed; a clean run passed at 166.5 ms.

So `400` was roughly 1.44× the measured Linux median, deliberately. This route exists
because that premise has expired, not because the number was careless.

Unlike R08, no new instrumentation is needed to show it: the spec already prints
`TIMELINE_MEASUREMENTS` as JSON, so four CI observations exist in the log archive right now.

### Measurement, from CI logs (no code change required)

| Run | Head | `inPage.median` | `inPage.max` | Verdict |
|---|---|---|---|---|
| 32933124940 | `5f27c87` | 229.65 | 388.40 | pass |
| 32933942052 | `85146de` | 339.90 | **449.40** | pass |
| 32958195410 attempt 1 | `2e33d8d` | **406.80** | 446.70 | **fail** |
| 32958195410 retry | `2e33d8d` | 319.05 | **448.80** | pass |

**The finding is that R03's median has moved.** R03 measured a Linux median of 277 ms. Four
runs later the median spans 229.65–406.80 — a 1.77× spread across observations of unchanged
timeline code, with the top of that range past the budget.

That spread is the point. R03 chose the median precisely because the maximum was tracking
scheduler pauses while the median tracked the application. If the median itself now swings
1.77× on identical code, the median has stopped doing the job R03 selected it for. The
budget did not become wrong; the metric underneath it did.

The `inPage.max` column is context, not the argument. R03 knowingly discarded the maximum,
so its breaching 400 in three of four runs (388.40, 449.40, 446.70, 448.80) is expected
behaviour and not evidence of anything. It is listed so the turn does not rediscover it and
mistake it for a finding.

### What the number is actually made of

`handler.median` across the same four runs: 1.25, 1.20, 1.30, 1.20 ms — unchanged from
R03's 1.0–1.4 ms, on a codebase eight routes older. The application's contribution has been
flat the whole time; only the number the assertion reads has drifted. The in-page loop is
ten iterations of `nextButton.click()` followed by `await afterPaint()`, where `afterPaint`
is a single `requestAnimationFrame`. So:

- React commit work, measured directly: ~1.2 ms for all ten clicks combined.
- Everything else — 228 to 406 ms — is `requestAnimationFrame` scheduling on a shared,
  virtualized, headless CI runner.

Ten frames at 60 Hz is a 167 ms floor before the application does anything at all. At 30 Hz,
already common under headless contention, it is 333 ms. The budget of 400 leaves the runner
a 67 ms allowance for its own frame pacing, and charges the application for the difference.

The spec's name — "keeps startup, catalog switching, simulation, timeline, and DP rendering
inside interaction budgets" — promises to guard interaction cost. `handler` measures
interaction cost. `inPage.total` measures interaction cost plus the runner's vsync, and it
is `inPage.total` that the assertion reads.

### The other four budgets in the same file

They are in scope for measurement, not necessarily for change:

| Line | Budget | What it wraps |
|---|---|---|
| 28 | `5_000` | startup should remain interactive |
| 33 | `3_500` | seven cross-family preset commits |
| 39 | `2_000` | default graph trace generation |
| 99 | `4_000` | 70-cell matrix package and render |

Line 28 is another appearance of the `5000` that R08 and R09 both found invalid elsewhere. This route does not assume it is
wrong; it requires that its actual margin be measured and stated, the same way R08 measured
before it moved anything.

## Turn

- Route id: `R11`
- Base: `2e33d8d` (`handoff(H10): record`)
- Holder: `sole`
- Expected size: 2–5 files, 2 commits (`route(R11): close`, `handoff(H11): record`)

## Expected Files

| Path | Why |
|---|---|
| `e2e/performance-budget.spec.ts` | The budgets and what the assertion reads |
| `docs/titan/handoffs/H11-timeline-commit-budget-validity.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Write what the criteria require inside your own ownership; justify
extras in `## Deviations`. Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no
route, no protocol file. `.github/workflows/ci.yml` is available if a measurement run needs
it, as in R08.

## Invariants

- **R03 is prior art, not background reading.** Its reconciliation chose this metric and this
  number against measurements. Any change here overturns a measured decision, so the handoff
  says which of R03's findings still hold and which no longer do, by name.
- **The budget must still fail closed.** `deliberateTimelineDelayMs` exists precisely so the
  spec can prove it catches a real regression. Whatever changes, that proof still runs and
  still fails when the deliberate delay is injected. State the injected value and the
  resulting measurement in the handoff.
- Do not delete the assertion. A deleted budget is not a fixed budget, and this route is
  about making the gate mean something, not about making it quiet.
- Do not raise a number without stated provenance and stated margin. "It was flaky so I
  doubled it" is the failure mode R08 named; the new value carries its measurement inline.
- No product code changes. If the timeline commit path itself turns out to be slow, that is
  a finding for `## Discovered` and a future route, not work for this turn.
- Determinism: no `Math.random`, no wall-clock branching in product code.
- Every other spec in the browser gate keeps passing, both phases.

## The decision

**Option A — assert on what the spec claims to measure.** The budget moves onto
`handler.median` (or `handler.max`), which is React commit cost with the runner's frame
pacing excluded, and gets a value derived from the measured 1.2–1.3 ms with a stated
multiple. `inPage.total` stays logged as context and either loses its assertion or keeps a
much looser one whose job is to catch a catastrophic hang rather than a regression.

Costs: `handler` measures synchronous click-handler time only. If a future regression lands
in a `useEffect`, a layout pass, or a paint, `handler` will not see it. Say what the new
assertion cannot catch, and whether anything else in the suite catches it.

**R03 had this option and did not take it.** It saw the same 1.0–1.4 ms handler medians and
still asserted on the in-page total, because the in-page total was the one that included
paint and R03 had just finished removing a budget that excluded too much. Choosing A means
saying what changed since — the honest answer is probably "eight routes of evidence that the
in-page total tracks the runner," but the handoff has to make that argument, not assume it.

**Option B — keep asserting on `inPage.total`, with an honest budget.** Derive the value
from the four observations plus whatever new ones the turn collects: a stated multiple of
the measured worst case, the way R08 chose `15000` as 2.75× a measured `5458`. The spec
keeps measuring interaction-plus-vsync and stops pretending that number is small.

Costs: the budget stays a runner-speed measurement wearing an application-performance label,
and it will drift again when the CI image changes. It also stays weakly correlated with any
regression the product could actually introduce, since the signal is ~1.2 ms inside ~300 ms
of noise.

**T0's reading, not binding:** A, with B's honest number kept as a loose outer bound. The
measurement is unusually clear here — 1.2 ms of application work inside 230–407 ms of
scheduling — and a gate whose signal is 0.4% of its own noise cannot detect a regression
smaller than the noise. But A narrows what the gate can catch, and if the turn's measurement
shows that `handler` misses a class of regression the suite has no other coverage for, B is
the correct answer and this route accepts it.

Either way the four other budgets in the file get measured margins recorded, and line 28's
`5_000` gets an explicit verdict.

## Acceptance Criteria

1. The handoff states the decision and the new value with its derivation: measured base,
   chosen multiple, resulting margin. A number without a derivation fails this criterion.
2. The handoff states, per item, which of R03's six recorded findings still hold at this
   route's base and which have expired. R03's falsification result (`TIMELINE_TEST_DELAY_MS=30`
   → median 457.5 ms, assertion failed) is re-run or explicitly superseded.
3. At least five observations of the chosen metric, from CI, pasted verbatim. The four in
   `## Objective` may be reused and cited by run id; at least one must be new.
4. The budget still fails closed: the deliberate-delay path is exercised and shown failing,
   with the injected value and the measurement it produced.
5. The four other budgets in `performance-budget.spec.ts` each have a measured margin
   recorded in a table. Line 28's `5_000` has an explicit verdict: valid at the measured
   margin, or changed with its own derivation.
6. If A: the handoff names what the new assertion cannot catch, and whether any other spec
   covers it. If B: the handoff states that the metric includes runner frame pacing and what
   that means for the gate's sensitivity.
7. No product code changed. `git diff --name-only 2e33d8d..HEAD -- src src-tauri` is empty,
   pasted verbatim.
8. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`.
9. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
   Claude's to close, and this route's remote evidence is **three** consecutive runs on the
   same head with zero flaky — the standard R08 and R09 were closed against.
10. Two commits, in order: `route(R11): close`, then `handoff(H11): record`, both signed
   `-s` after verifying `git config user.email` returns `iyott131@gmail.com`.

**Why a gate route again, and why now.** This is the third consecutive gate defect, but it
is not the third of the same kind. R08 fixed Playwright's `expect` timeout and R09 fixed
Vitest's `testTimeout`; both were defaults nobody selected, applied to work that legitimately
needed longer. This one was selected, measured, and correct when it was written. It decayed.

That distinction is the reason this route quotes R03 at length instead of re-deriving from
scratch. A measured budget that has drifted is a different problem from an unmeasured one,
and the fix is not "measure it again and pick a bigger number" — R03 already did the first
half of that and the result lasted eight routes. The question is whether the metric can hold
a budget at all on this runner.

R12 is drafted and waiting in `routes/queued/`; it stays there until the gate that would
judge it is worth its verdict.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "2e33d8d..HEAD"

git diff --name-only "2e33d8d..HEAD" -- src src-tauri

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third command is criterion 7's evidence and must print nothing. The fourth must show no
new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

Local numbers are context, not evidence. The budget guards CI, so criterion 3's observations
must come from CI. If a `workflow_dispatch` measurement input is the cheapest way to collect
them, R08 already added that pattern to `.github/workflows/ci.yml`.
