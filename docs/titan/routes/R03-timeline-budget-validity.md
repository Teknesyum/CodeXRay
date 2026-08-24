# R03 — Make the timeline budget measure the product

## Özet

H02 gerçek bir bulgu çıkardı: on timeline adımı 1000 ms bütçesini Linux'ta 1320–1326 ms,
Windows'ta 1049 ms ile aşıyor. Ama bu bir gerileme değil — T19'dan bu yana tek satır ürün
mantığı değişmedi. Ölçüm on Playwright tıklamasının gidiş-dönüş maliyetini ürünün maliyeti
sanıyor. Bu rota önce ölçümü geçerli hale getirir, sonra ürünü gerçek sayıyla yargılar.
Eşiği yükselterek yeşile geçmek bu rotanın başarısızlığıdır.

## Objective

Replace a measurement that cannot distinguish application work from harness overhead with
one that can, then hold the product to a budget derived from that measurement. If the valid
measurement shows the product is genuinely slow, fix the product — but find that out before
changing any number.

### Why this is not a regression

`e2e/performance-budget.spec.ts:26-28` is the failing assertion:

```js
const next = page.getByRole('button', { name: 'Next step' });
const stepStarted = performance.now();
for (let index = 0; index < 10 && !await next.isDisabled(); index += 1) await next.click();
expect(performance.now() - stepStarted, 'ten timeline commits').toBeLessThan(1_000);
```

The 1000 ms budget was set in `dfe894c` and declared met by T19
(`docs/tasks/T19-isolated-performance-e2e.md`), whose Decision section rejected raising it:

> "the observed 1.193-second result occurred only while eight independent browser workers
> competed for the same CPU; the unchanged test repeatedly passed when isolated."

T19's criterion 3 states the threshold "remains unchanged and passes in the isolated phase".
It now fails in exactly that isolated phase, on one worker, on two operating systems.

The decisive fact is what changed in between. Every `src/**` change from `f16ebc4` (T19) to
`9aa5a41` is:

```
 src/components/TitanModeProgress.tsx          |  6 +-
 src/i18n/translations.test.ts                 |  6 ++
 src/i18n/translations.ts                      | 66 ++++++++++----------
 src/services/titan/AGENTS.md                  | 17 +++++
 src/services/trace/AGENTS.md                  | 18 ++++++
 src/services/trace/tracerWorkerClient.test.ts | 89 +++++++++++++++++++++++++++
```

Translation-key renames, a new test file, and two guide documents. No product logic changed
at all. A string-key rename cannot add 300 ms to ten step commits, so the application today
performs exactly as it did when the budget was declared met.

Two readings survive, and the route must decide between them with evidence, not preference:

1. **The measurement was never valid.** The loop performs ten `click()` calls and up to ten
   `isDisabled()` calls. Each is a WebSocket round trip to the browser plus Playwright's
   actionability checks — visible, enabled, stable, receives-events — before the event is
   dispatched. Twenty round trips of harness cost sit inside a budget named "ten timeline
   commits", and T19's pass may have been a single lucky sample near the line.
2. **The product is genuinely at the limit** and the harness overhead merely pushed a
   marginal number over it.

These are distinguishable. Measure the commits from inside the page, where Playwright's
transport does not exist, and compare against the outside number.

## Turn

- Route id: `R03`
- Base: `02497a1bd6a0283b7a42fa1731d443e0c7931500`
- Holder: `sole`
- Expected size: 2–5 files, 2 commits (`route(R03): close`, `handoff(H03): record`)

## Owned Files

| Path | Why |
|---|---|
| `e2e/performance-budget.spec.ts` | The measurement under repair |
| `src/**` | Only if the valid measurement proves a product defect, and only the code it implicates |
| `docs/titan/handoffs/H03-timeline-budget-validity.md` | Handoff |
| `.github/workflows/ci.yml` | **Trigger block only** — see below. The diagnosis matrix is untouched. |
| `docs/titan/DOD.md` | Evidence cells only |

`playwright.config.ts` is **read-only this turn**, and so is the rest of `ci.yml`: the
diagnosis matrix stays until R02b removes it.

### The one CI change this route makes

`ci.yml` triggers on `push` to `main` and on `pull_request`. While the work lived on
`agent/titan-relay`, CI ran **only because pull request #1 happened to be open** — a gate
that disappears the moment someone closes a PR.

That is now settled from the other side: the branch was fast-forwarded into `main`, PR #1
merged, and every other branch deleted. Work happens on `main`, which already triggers on
push, so the gate no longer depends on a pull request existing.

Keeping `'agent/**'` in the push trigger is harmless and costs nothing if a branch is ever
needed again:

```yaml
on:
  push:
    branches: [main, 'agent/**']
  pull_request:
```

Nothing else in the file changes. This is the whole edit.

## Invariants

- **No threshold is raised to reach green.** A number may change only as the conclusion of a
  measurement that is reported in the handoff, with the sample count and the spread. "It
  passes now" is not a reason.
- No assertion is deleted, no test is skipped, no `@performance` tag is removed, and the
  performance phase keeps running with one worker.
- The other four budgets in the spec — startup 5000, seven preset commits 3500, graph trace
  2000, 70-cell matrix 4000 — are not touched unless the same measurement work proves one of
  them invalid too, and then the same evidence rule applies.
- Everything stays deterministic. No `Math.random`, no wall-clock branching in product code.
  `performance.now()` inside a test is measurement, not branching, and is allowed.
- If product code changes, its behaviour is unchanged: same steps, same trace, same visual
  output. A performance fix that alters what the user sees is a different route.

## Measurement first

Land the measurement before any fix. The handoff answers all four, with numbers:

1. **What does the product actually cost?** Drive the same ten commits from inside the page
   and time them there — click the control via `page.evaluate`, or have the application emit
   `performance.mark`/`measure` around the step commit and read the entries. Report the
   in-page total next to the Playwright-measured total for the same run. The difference is
   the harness cost, and naming it settles reading 1 versus reading 2.
2. **How stable is it?** Ten samples minimum, on Linux CI and on Windows. Report min, median,
   max for each. A budget set from one sample is how this defect was created; do not repeat
   the method that produced it.
3. **Where does the time go?** If the in-page number is itself large, profile one commit and
   name the cost: re-rendering the whole visualizer instead of the changed nodes, recomputing
   a derived structure per step, an unmemoised context value re-rendering every consumer, or
   serialising a large `TraceValue` on each commit. Name the function, not the subsystem.
4. **Is the button the bottleneck or the state?** Distinguish the cost of the click handler
   from the cost of the React commit that follows it. They have different fixes.

## Acceptance Criteria

1. The handoff answers all four `## Measurement first` questions with pasted numbers, and
   states which of the two readings the evidence supports.
2. The timeline assertion measures application work, with harness round trips excluded or
   accounted for. The handoff shows the before and after measurement for the same commit so
   the two numbers can be compared.
3. If the evidence supports reading 2, the product is fixed and the in-page measurement drops
   below the budget with the fix and exceeds it without — prove both directions.
4. If the evidence supports reading 1, the budget is restated in terms of what is now
   measured, and the handoff states the sample-based margin. The new number is justified by
   the distribution from criterion 2, not by the value that happens to pass.
5. The assertion still fails when the product is genuinely slower. Prove it by deliberately
   introducing a delay in the step commit path, showing the failure, then removing it. A
   budget that cannot fail is not a budget.
6. `npm run test:e2e` is green locally on Windows, both phases, including `@performance`.
   Paste both phase summaries and `E2E_EXIT`.
7. No threshold other than the timeline one changed, and `git diff <base>..HEAD -- e2e/` is
   pasted unabridged with a line-by-line justification.
8. All four gates clean: `npm run lint`, `npm run test`, `npm run build`, `npm run desktop:check`.
9. `npm run test` count is at or above 751.
10. `ci.yml` triggers on pushes to `agent/**`, proven by a run on this branch whose trigger
    event is `push` rather than `pull_request`. Paste the run id and its event.
11. No other line of `ci.yml` changed. Prove it with `git diff <base>..HEAD -- .github/`
    pasted unabridged.
12. Two commits, in order: `route(R03): close`, then `handoff(H03): record`.

**Push authority:** granted for this route, because criterion 2 needs Linux samples and only
CI produces them. `main` is now the working branch, so an ordinary `git push origin main` is
expected. Force-push, history rewrite, tags, releases, and anything that rewrites what is
already published remain out of bounds — ask before any of those.

## If the product is fine

If the in-page measurement shows the application commits ten steps well inside a sensible
budget and the entire overage is harness cost, say so plainly and fix the measurement. That
is a complete, successful route — not a smaller one. The defect was in the instrument, and
the record should say that rather than inventing a product problem to justify the turn.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "02497a1bd6a0283b7a42fa1731d443e0c7931500..HEAD"

git diff "02497a1bd6a0283b7a42fa1731d443e0c7931500..HEAD" -- e2e/

Get-ChildItem -Recurse -Path e2e -File | Select-String -Pattern 'toBeLessThan'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The fourth command lists every budget in the suite so the handoff can show which numbers
moved and which did not.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## Rollback

`git reset --hard 02497a1bd6a0283b7a42fa1731d443e0c7931500` only when the working tree holds nothing else worth keeping, and
record the decision in `## Deviations`.

## Out of Scope

- **The CI diagnosis matrix and its artifacts.** H02 recorded a 648,454,966-byte diagnostic
  artifact. Removing that matrix and narrowing the uploads is R02b, queued at
  `docs/titan/routes/queued/R02b-trustworthy-browser-gate.md`. Do not edit `ci.yml`.
- Proving three consecutive green CI runs. Also R02b, and impossible until this route lands.
- The parallel-worker configuration. H02 established one worker as the gate's configuration;
  that decision is not reopened here.
- Wiring the second-generation pipeline (R04), the intent vocabularies (R05), translation
  (R06). All queued, none open.
- Any change to what the user sees. This route changes cost, not behaviour.

## T0 reconciliation

Written by Claude/T0 after re-running the gates independently and reading
`docs/titan/handoffs/H03-timeline-budget-validity.md`. Appended, not substituted: the
criteria above stand as written, including the two that turned out to be unsatisfiable.

Independent gate re-run, T0's own invocation:

```
lint    clean
test    Test Files  120 passed (120)   Tests  751 passed (751)
build   Initial JavaScript: 415.7 / 420.0 KiB
```

CI run 32766877140, `event=push`, head `7e14d9f`, overall `success`:

```
browser                                success
quality                                success
desktop                                success
browser-diagnosis (isolated-implicated) failure
browser-diagnosis (parallel-full)       failure
```

**The `browser` job is green for the first time in this relay.** The two failing jobs are
H02's temporary diagnosis matrix, whose entire purpose is to run the configuration already
proven bad; they are informational and R02b removes them.

### The finding is confirmed, and it is reading 1

The measurement was never valid. Ten clicks cost the application about **1 ms** of
synchronous handler time; the paint-aware in-page total is 166 ms on Windows and 277 ms on
Linux at the median. The old assertion's 967–1540 ms was almost entirely Playwright
transport and actionability checks. A budget named "ten timeline commits" was spending 98%
of its allowance on the harness.

The restated budget — median of ten in-page samples under 400 ms — is judged the right
shape. It survives the falsification test: `TIMELINE_TEST_DELAY_MS=30` pushed the median to
457.5 ms and the assertion failed, then a clean run passed at 166.5 ms. A budget that cannot
fail is not a budget, and this one demonstrably fails.

The mid-turn correction from max-of-ten to median-of-ten is the right call and is the more
interesting result of the turn. A maximum over ten browser paint samples measures whichever
scheduler pause happened to be worst; the handler medians stayed at 1.0–1.4 ms across every
run while the maxima swung from 442 to 551 ms. Judging the median measures the application;
judging the maximum measures the runner.

### Criterion 10 — waived. T0's error, not Sole's.

Criterion 10 required proof of a push to an `agent/**` branch. Between opening this route and
Sole reaching that criterion, T0 landed `de30411`, which fast-forwarded the work onto `main`
and deleted every agent branch. The criterion became impossible while the turn was running,
because T0 removed the thing it named.

The contract it was written to protect — CI runs on push, not only on an open pull request —
is satisfied and proven by run 32766877140, `event=push` on `main`, conclusion `success`.
**Criterion 10 is waived and its intent is met.**

**Standing correction:** T0 does not change the ground a route stands on while that route is
open. A protocol change that invalidates an active criterion waits for the turn to close, or
the route is reopened with the criterion restated. Convenience is not a reason to move the
floor under someone mid-turn.

### Criterion 12 — accepted as three commits. The rule was wrong, not the turn.

Criterion 12 required exactly two commits. The turn published three: `884276c` closed the
route, `7e14d9f` corrected the assertion from maximum to median after Linux CI evidence
showed the maximum was tracking scheduler pauses, and the handoff followed.

Sole could only have satisfied the letter of the criterion by force-pushing, which every
route forbids, or by not correcting a defect it had just proven. It chose correctly.

The rule is the defect. Two commits assumed all evidence exists before the close commit, and
that is false whenever a criterion's evidence lives on a remote: the close must be published
before CI can grade it, so anything CI teaches necessarily arrives afterward. **Corrected in
`PROTOCOL.md`:** a published corrective commit may sit between `route(R<n>): close` and
`handoff(H<n>): record`, provided the handoff lists it and says what the correction was and
what taught it. Silent amending and force-pushing stay forbidden.

### Verdict

R03 closes. Ten criteria met as written; criterion 10 waived as impossible through T0's own
mid-turn change, with its intent proven by other means; criterion 12 accepted as three
commits with the rule corrected. No `R03b` is opened — nothing remains for Sole to implement,
and both open items were T0's to resolve.

The gate is green. `R02b` opens next: remove the diagnosis matrix, narrow the artifacts, and
prove the green result is repeatable rather than a first occurrence.
