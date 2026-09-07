# R29 — Two Tests The Gate Cannot Trust

## Turn.base

`244bda8`

Check before writing anything:

```powershell
git merge-base --is-ancestor 244bda8 HEAD
git diff --name-only "244bda8..HEAD"
```

The first must exit 0. The second must list only T0-owned paths.

## Why

`npm run test:e2e` is a gate. Right now it fails on a clean tree, and it has failed on a clean
tree for at least five routes. A gate that is red before you start is a gate nobody reads, and
the next real regression will arrive inside a failure list that already had entries in it.

`titan-mode-failures.spec.ts:3` has been seen failing at R24, R27 and R28. R28 measured its
attribution properly — a worktree at base `07aa7f3` with `node_modules` copied in, where the same
test failed — so it is not a regression from any of those turns. It was carried as a flake on the
standing "twice in a row before it earns a route" rule. **It is not a flake and the rule has been
misapplied to it**: it fails in roughly three of four full-suite runs and passes in isolation.

T0 then ran the full suite once and found **two** failures, not one.

## The measurement

T0's own full-suite run on `244bda8`, external server on 127.0.0.1:4173:

```
  2 failed
    [chromium] › e2e\titan-mode-failures.spec.ts:3:1 › cancels the visible Titan Mode queue and ignores a late specialist response
    [chromium] › e2e\translation-provenance.spec.ts:155:1 › shows a refused Java fallback without changing workspace or persisted bound source
  82 passed (1.6m)
```

### Failure one — a cancelled run comes back after reload

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.titan-mode-progress')
Expected: 0
Received: 1
Timeout:  15000ms

Call log:
  - Expect "toHaveCount" with timeout 15000ms
  - waiting for locator('.titan-mode-progress')
    31 × locator resolved to 1 element
       - unexpected value "1"

  112 |   await page.reload();
> 113 |   await expect(page.locator('.titan-mode-progress')).toHaveCount(0);
```

**31 consecutive polls over 15 seconds, always one element.** This is not a timing flake in the
usual sense — nothing is racing to appear or disappear during the wait. The panel is there,
stably, after the reload, and it stays there.

The mechanism is visible without a debugger. `titanModeRunStore.ts` persists every plan to
`sessionStorage` under `codexray.titan-mode.runs.v1`, and `AiAssistant.tsx:205` rehydrates it:

```ts
const [titanModePlan, setTitanModePlan] = useState<ManagerPlanV1 | null>(() => {
  const latest = loadLatestTitanModePlan();
  if (!latest?.jobs.length) return null;
  if (latest.jobs.some((job) => job.status === 'waiting' || job.status === 'running' || job.status === 'retrying')) {
    removeTitanModePlan(latest.runId);
    return null;
  }
  return latest.jobs.some((job) => job.status === 'failed') ? latest : null;
});
```

The job status union in `src/types/webSource.ts:132` is
`'waiting' | 'running' | 'retrying' | 'completed' | 'completed_with_fallback' | 'failed' | 'cancelled'`.
**`'cancelled'` appears in neither branch.** A plan restored here is restored because some job is
`failed`. So the hypothesis the first step must confirm or kill is: *the cancel path marks its
jobs `failed` rather than `cancelled`, and the reload rule then treats a user's own cancellation
as a failure worth showing again.*

If that is what is happening, the test is right and the product is wrong: a user who cancels a
run and refreshes the page is shown the run they cancelled, framed as a failure.

### Failure two — a locator that matches two elements

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Translation verification failed/)
Expected: visible
Error: strict mode violation: getByText(/Translation verification failed/) resolved to 2 elements:
    1) <span class="agent-summary" title="Translation verification failed: Line 2: Expected budgets header.">…
```

This one is a test defect, not a product defect — unless the second element turns out to be
something that should not be on the page. Establish which before changing anything.

## Decision

Fix both, and fix them as two separate questions.

**Failure one.** First measure: instrument or inspect what `job.status` actually holds for each
job of a cancelled plan at the moment it is persisted, and put that in the handoff before
proposing a change. Then fix whichever side the measurement indicts.

- If the jobs are `failed`, the cancel path should set `'cancelled'` and the rehydration rule
  should keep excluding it. That is the reading T0 finds most likely and it uses a status value
  that already exists in the union and is currently set nowhere the reload rule can see.
- If the jobs are already `'cancelled'`, then something else is rendering `.titan-mode-progress`
  after reload and the paragraph above is wrong. Say so and follow the evidence.

Do not make the test pass by widening the exclusion to "restore nothing". The restore-on-failure
behaviour is deliberate — a user whose run failed should still see why after a refresh — and a
fix that discards it trades one defect for another.

**Failure two.** Make the assertion name the element it means. Prefer an existing role or a
scoped container over a new `data-testid`; add one only if nothing else distinguishes them, and
say in `## Deviations` why. If the two matching elements are genuinely duplicate user-visible
text, that is a product defect and should be reported as such rather than papered over with a
`.first()`.

## Criteria

1. **The handoff states what `job.status` actually is for a cancelled plan's jobs**, measured,
   before any fix is proposed. This is criterion 1 because the rest of failure one depends on it
   and because T0's reading above is a hypothesis, not a finding.

2. **`npm run test:e2e` passes on a clean tree**, whole suite, output pasted verbatim. Not
   `--grep`, not a single spec.

3. **It passes four times in a row.** One green run does not retire a test that fails three runs
   in four. Paste the summary line of each of the four.

4. **The fix for failure one is shown to be a fix, not a mask.** If the cancel path changed,
   a test asserts that a cancelled plan's jobs carry `'cancelled'`. If the rehydration rule
   changed, a test asserts that a genuinely failed run is still restored after reload — the
   behaviour the route forbids you to trade away.

5. **Failure two's fix does not weaken what the assertion checks.** State what the second
   matching element was. If the assertion now targets one of two legitimately identical strings,
   say which one and why that is the right one.

6. **No product behaviour changes for a run that was not cancelled.** Say plainly whether a
   completed run, a failed run and a `completed_with_fallback` run each behave after reload
   exactly as they did on `244bda8`.

7. `lint`, `test`, `build` clean, with the unit test count stated against the base's 907.

8. **(T0)** The handoff states whether either failure is reproducible in isolation, and if not,
   what about full-suite conditions makes it appear. "Slower under load" is an acceptable answer
   only if it is measured; "flaky" is not an answer.

## Expected Files

A forecast, not a gate.

- `src/components/AiAssistant.tsx`
- `src/services/titanModeRunStore.ts`
- `src/components/AiAssistant.test.tsx`
- `e2e/titan-mode-failures.spec.ts`
- `e2e/translation-provenance.spec.ts`

## Verification

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e
git diff --name-only "244bda8..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$'
git status --porcelain | Select-String -Pattern 'test-results|dist/|coverage/'
```

The last two must print nothing. `npm run test:e2e` runs four times for criterion 3.

e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run created,
and delete `test-results/` before finishing — it is not committed.

## A note on this route's own criteria

Five consecutive routes have carried a T0 defect, four of them because a criterion asserted a
number that turned out to be a prediction. This route asserts one number — four consecutive green
runs — and that one is a threshold the implementer controls, not a forecast about code T0 has not
read. Criterion 1 exists because T0's explanation of failure one is explicitly a hypothesis. If
it is wrong, say so; that costs this route nothing and saves the next one.

## Still deferred after this route

- Option B: `scoreTrace` is phase-blind; `mostSignificantIndex` returns 0 for 19 of 60. Needs an
  oracle before it needs code. `TracePhase.kind`'s lost `setup` value belongs to this route.
- Option C: no simulator emits a trace `event`; `eventWeight` is dead weight in every score.
- `ArrayView` and `RowsView` display `decision` but not `phase`.
- The initial-JS budget has 2.4 KiB of headroom and `translations.ts` is the growth vector.
- `src/services/trace/traceQuery.ts` has no production consumer.
- `inputRequestAdapter.test.ts:31`'s name has described no production behaviour since R22.
- `titanEntry.ts:130` is the one engine caller outside `PipelineRunId`'s brand.

## T0 reconciliation

Closed. `624e5b8` (close) and `c628a7b` (handoff) over base `244bda8`. Verified on T0's own
evidence, and one criterion is reported as **not established on T0's machine** — see below.

### What was written

Six files, none guarded. **The production change is five lines in one file**,
`titanPipeline.ts:64`:

```ts
publish(
  id,
  tasks.signal?.aborted ? 'cancelled' : 'failed',
  error instanceof Error ? error.message : `${id} failed.`,
);
```

`AiAssistant.tsx` and `titanModeRunStore.ts` — both in the route's forecast — were never touched.
The measurement moved the defect somewhere the route had not looked.

Gates re-run by T0 on `c628a7b` with a clean tree: `lint` clean, `test` **909 passed / 120
files** (base 907), `build` clean.

### Criterion 1 — the route's hypothesis was half wrong, and that is the finding

The route said, in as many words, that its explanation was a hypothesis. It was, and the
measurement corrected it in two places. The real job statuses of a cancelled plan:

```
titan-route      = completed
titan-produce    = failed  ("Titan Mode run was cancelled.")
titan-semantics  = cancelled
titan-verify     = cancelled
titan-apply      = cancelled
```

- **Right:** one job really is `failed`, and the reload rule at `AiAssistant.tsx:205` restores
  the panel because of it.
- **Wrong about scope:** the route implied the cancel path marks *its jobs* `failed`. Three of
  the five were already `cancelled`. Exactly one phase was wrong.
- **Wrong about the module:** the persisted plan is not the engine's `gm-…` plan but the
  pipeline's `titan-pipeline-…` plan. `titanEngine.ts`'s cancel path (`:691`, `:1674`) is correct
  and was never implicated. The defect is in `executeTitanPipeline`'s own `catch`: `ensureActive`
  is consulted at phase entry and on success and **not in the catch**, so the pipeline classified
  the rejection caused by its own `abort()` as a failure.

A route that had guessed one module and asserted it would have sent the implementer to the wrong
file. Criterion 1 existed because T0 knew it was guessing; it earned its place.

### Criterion 8 — why it passed in isolation, measured

The implementer measured the timing rather than calling it flaky, and the answer inverts the
usual reading of an intermittent test:

```
reload resolves            → first poll at +39–64 ms   (count 0, assertion passes)
panel (React.lazy/Suspense) → mounts at +312–347 ms
```

**The product defect reproduces 100% of the time, in isolation too.** The panel always comes
back. In isolation the assertion simply ran during the ~250–280 ms window before the lazy chunk
mounted, and passed for a reason that had nothing to do with what it was checking. Under four
workers the window closed and the same defect became visible as `31 × locator resolved to 1
element`.

So this test was never flaky. It was **wrong when it passed**, which is the worse of the two
states, and it is the same finding class this relay has now hit for the ninth consecutive turn:
a check whose green means less than its name. The second failure is the same shape — chat element
at ~+110 ms, panel element at ~+405 ms, a ~290 ms gap that decided which side of a strict-mode
violation the run landed on.

### Criterion 5 — the assertion was strengthened, not weakened

The two matching elements were `.chat-message.system-msg > p` and
`.titan-mode-agent.failed .agent-summary`: two legitimate surfaces showing the same message. The
spec now asserts `toHaveCount(2)` and checks each one separately. No `.first()`, no new
`data-testid`. That is the right resolution to a strict-mode violation and T0 accepts it as
written.

### Criterion 6 — the guard is real

`e2e/titan-mode-failures.spec.ts` gained a case asserting that a genuinely failed run **is** still
restored after reload. The route forbade trading the restore-on-failure behaviour away to make
the cancel case pass, and this is the test that would catch it.

### Criteria 2 and 3 — green for the implementer, not reproduced by T0

The handoff records four consecutive full-suite runs, all exit 0, `82 passed` each. T0 ran the
full suite twice on `c628a7b` and got neither result:

```
--- run 1 ---
  2 failed
    accessibility-axe.spec.ts:37   has no serious WCAG A/AA violations across themes and languages
    radio-controller.spec.ts:3     honors confirmed playback, transport, audio, loop, and minimize contracts
  82 passed (1.9m)
--- run 2 ---
  3 failed
    accessibility-axe.spec.ts:37
    ai-actions.spec.ts:112         builds and applies bidirectional BFS through the visible Titan Mode queue
    radio-controller.spec.ts:3
  81 passed (2.2m)
```

**Neither of R29's two targets appears in either list**, and every one of these five failures
carries the same error:

```
Test timeout of 30000ms exceeded.
```

Not an assertion — the 30-second per-test budget. A different set of specs each run. T0's machine
was doing other work; the implementer's was not. T0 then ran the two targets alone, three times
each, under the same conditions that produced the list above:

```
  12 passed (8.9s)
```

**R29's own work is verified.** What is not verified is criterion 2's stronger claim that the
suite is green on a clean tree, because on a loaded machine it is not, for reasons this route did
not create and did not touch. T0 records criterion 2 as satisfied for what R29 changed and
**explicitly not satisfied as a statement about the suite**, and opens the remainder as R30
rather than crediting it here. The route's premise — a gate nobody can trust — turned out to have
a second half.

### Deviations — all three accepted

1. Forecast paths `AiAssistant.tsx` and `titanModeRunStore.ts` unwritten. Correct; the forecast is
   a forecast and the measurement moved the defect.
2. **`src/components/AiAssistant.test.tsx` does not exist.** T0 put a non-existent file in the
   forecast. A sixth route defect, minor, and disclosed rather than quietly worked around.
3. Four temporary measurement specs created and deleted, never committed, outputs pasted verbatim.

### Discovered, and what T0 does with it

**`AiAssistant.tsx:857` calls `persistTitanModePlan(plan)` before the dismissed guard**, so the
`removeTitanModePlan` at `:1462` never becomes durable and the sanitize map at `:1455` never
reaches `titan-produce`. The implementer found it, saw it is now harmless because the status is
correct at the source, and left it to T0 rather than fixing it inside a route that did not ask
for it. **That was the right call and T0 leaves it in place.** A one-line change to dead-but-
harmless code is exactly the kind of thing that turns a verifiable turn into an unverifiable one.
It goes on the deferred list, where it will be fixed by a route that can say what its correctness
depends on.

### Still deferred

- The e2e suite times out at the 30 s per-test budget under parallel load, on a spec-
  nondeterministic set. **This becomes R30.**
- `AiAssistant.tsx:857` persists before the dismissed guard, making `:1462`'s removal and
  `:1455`'s sanitize map unreachable.
- Option B: `scoreTrace` is phase-blind; `mostSignificantIndex` returns 0 for 19 of 60. Needs an
  oracle before it needs code. `TracePhase.kind`'s lost `setup` value belongs to this route.
- Option C: no simulator emits a trace `event`; `eventWeight` is dead weight in every score.
- `ArrayView` and `RowsView` display `decision` but not `phase`.
- The initial-JS budget has 2.4 KiB of headroom and `translations.ts` is the growth vector.
- `src/services/trace/traceQuery.ts` has no production consumer.
- `inputRequestAdapter.test.ts:31`'s name has described no production behaviour since R22.
- `titanEntry.ts:130` is the one engine caller outside `PipelineRunId`'s brand.
