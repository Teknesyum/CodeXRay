# R30 — The Default Worker Count Nobody Chose

## Turn.base

`77d59ba`

Check before writing anything:

```powershell
git merge-base --is-ancestor 77d59ba HEAD
git diff --name-only "77d59ba..HEAD"
```

The first must exit 0. The second must list only T0-owned paths.

## Why

R29 closed with criteria 2 and 3 recorded as *not reproduced by T0*: two full-suite runs on T0's
machine failed a different set of specs each time, every one with `Test timeout of 30000ms
exceeded` and none of them R29's own. That remainder is this route.

It is not a new problem. `docs/titan/handoffs/H17c` and `H19` both record running the suite with
`CODEXRAY_E2E_WORKERS=2` because *"the default 8-worker profile twice timed out"*, and `H02`
records falling back to `=1`. Three separate turns hit the same wall, worked around it inside
their own handoff, and moved on. **Nothing in `AGENTS.md`, `PROTOCOL.md`, or
`playwright.config.ts` records the workaround**, so every turn since has rediscovered it as a
flake. R29 spent part of a turn attributing failures that were this.

## The measurement

`playwright.config.ts:20` is `workers: configuredWorkers`, where `configuredWorkers` is
`undefined` unless `CODEXRAY_E2E_WORKERS` is set. Undefined means Playwright's own default: half
the logical cores. This machine has 16, so an unset local run uses **8**.

`.github/workflows/ci.yml:32` sets `CODEXRAY_E2E_WORKERS: 1`, and `playwright.config.ts:19` sets
`retries: process.env.CI ? 2 : 0`. **CI has never run the profile a local developer gets, and it
retries twice besides.** The gate is green on CI for reasons unrelated to whether the suite
passes as invoked.

T0 ran the full suite on `77d59ba`, external server, same machine, same session:

```
unset (8 workers), run 1   2 failed   accessibility-axe:37, radio-controller:3            82 passed (1.9m)
unset (8 workers), run 2   3 failed   accessibility-axe:37, ai-actions:112, radio:3       81 passed (2.2m)
CODEXRAY_E2E_WORKERS=4     0 failed                                                       84 passed (1.7m)
CODEXRAY_E2E_WORKERS=2     0 failed                                                       84 passed (2.8m)
```

The failing set is different each time and every failure is the 30 s per-test budget with no
assertion error. The same three specs, run alone at one worker, are nowhere near that budget:

```
accessibility-axe.spec.ts:37   7.7s
ai-actions.spec.ts:112         9.4s
radio-controller.spec.ts:3     6.8s
```

7–9 seconds alone, over 30 under eight-way contention. This is contention, not slow tests, and
four workers is both green and the fastest of the three profiles measured.

## Decision

Give the config a default instead of inheriting Playwright's.

```ts
workers: configuredWorkers ?? 4,
```

or whatever equivalent keeps `CODEXRAY_E2E_WORKERS` authoritative when it is set — CI must keep
getting 1 from its environment variable, unchanged.

Four, not two: both are green, four is 1.1 minutes faster, and a slower gate is a gate people
skip. Four, not eight: eight is what is failing today.

**Do not raise the 30 s per-test timeout.** Every one of these tests finishes in under ten
seconds when it is not fighting for a core. Raising the budget would hide the contention rather
than remove it, and would slow every genuine hang from 30 s to whatever the new number is.

**Do not touch the three specs.** They are not the defect; they are where the contention
happened to land, and it landed somewhere different on each run.

If a hard-coded 4 is wrong for a machine with very few cores, a bounded expression is acceptable
— but state the reasoning in `## Deviations` and keep it deterministic and readable. Do not make
it depend on anything that varies between runs on the same machine.

## Criteria

1. **`npm run test:e2e` with no environment variable set passes three times in a row**, whole
   suite. Paste all three summary lines. This is the invocation `AGENTS.md` documents and the one
   that has been failing.

2. **`CODEXRAY_E2E_WORKERS` still wins when set.** Show a run with it set to a value different
   from the new default and confirm the worker count actually used. CI's `=1` must be unaffected.

3. **The handoff states the worker count the run actually used**, not the one the config asks
   for. Playwright prints it; quote it.

4. **No spec file, no application file, and no timeout value changed.** The diff for this route
   should be one configuration line plus documentation and the handoff. Anything else needs a
   `## Deviations` entry saying why it was unavoidable.

5. `lint`, `test`, `build` clean, with the unit test count stated against the base's 909. The e2e
   count is 84.

6. **(T0)** The handoff states whether the three specs that timed out are individually slower
   than the rest of the suite, with numbers. If they are, say so plainly — that is a separate
   route and T0 wants it named, not fixed here.

## Expected Files

A forecast, not a gate.

- `playwright.config.ts`

## Verification

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e
git diff --name-only "77d59ba..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$'
git diff --name-only "77d59ba..HEAD" | Select-String -Pattern '^e2e/|^src/'
git status --porcelain | Select-String -Pattern 'test-results|dist/|coverage/'
```

The last three must print nothing. `npm run test:e2e` runs three times for criterion 1, with no
`CODEXRAY_E2E_WORKERS` in the environment — check that it is unset rather than assuming it.

e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run created,
and delete `test-results/` before finishing.

## A note on this route's own criteria

Six consecutive routes have carried a T0 defect. This one asserts no number about code T0 has not
read: the four profiles above were measured on this machine in this session, and criterion 1 is a
threshold the implementer controls. If four workers turns out not to be green on the
implementer's machine, that is a finding, not a failure — report the profile that is, with the
same table shape.

## Still deferred after this route

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

---

## T0 reconciliation

Closed by `2b8e49d` (`route(R30): close`) and `044c2f7` (`handoff(H30): record`). Handoff:
`docs/titan/handoffs/H30-the-default-worker-count-nobody-chose.md`.

### The route was wrong about the number, again

R30 named 4 workers. The implementer ran three consecutive suites at 4 and one of them failed
`ai-actions.spec.ts:112` with `Test timeout of 30000ms exceeded` — the same contention symptom
the route attributes to 8, at 4. Six runs at 2 were clean, so `workers: configuredWorkers ?? 2`
shipped.

**T0's 4 came from a single green run.** The route's own table says `CODEXRAY_E2E_WORKERS=4 →
84 passed (1.7m)` and treats it as a profile; it was one sample of a nondeterministic failure,
and one sample cannot distinguish "green" from "green this time". T0 had written, four
paragraphs earlier, that the failing set differs on every run — and then priced a
recommendation off a single observation of exactly that.

This is the seventh consecutive route carrying a T0 defect, and the same one as R25–R29:
**T0 states a number where it means a property.** R30 even opens with a section explaining that
it would not do this. The escape clause in `## A note on this route's own criteria` — *"If four
workers turns out not to be green on the implementer's machine, that is a finding, not a
failure"* — is what made the route survivable, and it is the pattern to keep: when T0 must name
a number it has only sampled, name it as a starting point and say out loud what the implementer
should do when it does not hold.

### Independent T0 verification

Not taken from the handoff. Run by T0 on `044c2f7`, external server, `CODEXRAY_E2E_WORKERS`
confirmed unset:

```
Running 82 tests using 2 workers
  82 passed (2.7m)
Running 2 tests using 1 worker
  2 passed (35.3s)
```

```
 Test Files  120 passed (120)
      Tests  909 passed (909)
Initial JavaScript: 422.6 / 425.0 KiB
```

`npm run lint` clean. Working tree clean apart from the three permanently-untracked guarded
paths.

**The 82/84 split is not a shortfall.** `scripts/run-e2e.mjs:67` runs the suite as
`--grep-invert @performance` and then `--grep @performance --workers=1`; 82 + 2 = the 84 that
`npx playwright test --list` reports. Criterion 1's "whole suite" is satisfied. A future route
reading a bare `82 passed` should know the second batch exists and is pinned to one worker
regardless of this default.

### Criteria

1. **Met.** Three consecutive unset runs green in the handoff, plus T0's independent fourth
   above.
2. **Met.** `CODEXRAY_E2E_WORKERS=3` produced `Running 5 tests using 3 workers`; the variable
   still wins. CI's `=1` in `.github/workflows/ci.yml:32` is untouched.
3. **Met.** Every run quotes Playwright's own `Running N tests using K workers` line.
4. **Met.** `git diff --stat 77d59ba..HEAD` is one line of `playwright.config.ts` plus the route
   and the handoff. No spec, no application file, no timeout value. No guarded path.
5. **Met.** 909/909 unit tests against the base's 909 — R30 adds no test, correctly: a worker
   count is not a thing a test can assert about itself.
6. **Met, and the answer is yes.** All 82 durations sorted give median 3.1 s; the three specs
   that time out under contention are 9.9 s, 12.5 s and 8.1 s — three to four times the median.
   **T0 names this and does not fix it here.** These three being the slowest is why they are the
   ones that lose the race, but the defect R30 removed is the contention, not their duration. A
   route that wants them faster must first say what it expects them to cost.

### What R30 does not establish

Two workers is green on **this** machine, sixteen cores, at this suite size. It is not a proof
about any other machine, and the suite grows. The durable protection is not the number: it is
that the number is now written down in one place, with `CODEXRAY_E2E_WORKERS` still overriding
it, so the next turn that has to change it changes it once instead of rediscovering the
workaround inside its own handoff — which is what H02, H17c and H19 each did.

CI still runs a profile no developer runs (`=1`, two retries). R30 deliberately does not touch
that: making CI match the local default would slow the gate, and making local match CI would
hide contention behind retries. The asymmetry is now intentional and documented rather than
accidental.

### Still deferred

Unchanged from the route's own list, minus nothing. The three slow specs above join it:

- `accessibility-axe.spec.ts:37` (9.9 s), `ai-actions.spec.ts:112` (12.5 s),
  `radio-controller.spec.ts:3` (8.1 s) are 3–4x the 3.1 s median. Not a defect; a cost nobody
  has priced.
- `AiAssistant.tsx:857` persists before the dismissed guard.
- Option B: `scoreTrace` is phase-blind; `mostSignificantIndex` returns 0 for 19 of 60.
  `TracePhase.kind`'s lost `setup` value belongs here.
- Option C: no simulator emits a trace `event`; `eventWeight` is dead weight.
- `ArrayView` and `RowsView` display `decision` but not `phase`.
- Initial-JS budget: 2.4 KiB of headroom, `translations.ts` the growth vector.
- `src/services/trace/traceQuery.ts` has no production consumer.
- `inputRequestAdapter.test.ts:31`'s name has described no production behaviour since R22.
- `titanEntry.ts:130` is the one engine caller outside `PipelineRunId`'s brand.
