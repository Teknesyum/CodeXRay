# R09 — The unit suite has the same invalid budget

## Özet

R08, Playwright'ın seçilmemiş 5000 ms varsayılanının hiç geçerli olmadığını ölçtü ve
düzeltti. Aynı kusur birim tarafında duruyor: `vitest.config.ts` içinde `testTimeout` yok,
yani her birim testi de aynı seçilmemiş beş saniyeyi miras alıyor. T0 doğrulaması üç ardışık
`npm run test` koşusunun üçünde de farklı testlerde düşüşle geldi; CI'da da bir kez `quality`
işi düştü. Bu rota önce ölçer, sonra düzeltir.

## Objective

Make `npm run test` mean the same thing on every machine it runs on. Right now it does not:
the same commit produces 759/759 on the holder's machine and on CI, and 757–758/759 on T0's,
with a different test failing each run.

R08 established both the diagnosis and the method for exactly this defect class, one layer
up. This route applies that method to the unit suite. It is not a repeat — the numbers,
the runner, and the failing tests are all different — but the shape is identical and the
route should reuse R08's discipline rather than re-derive it.

### The evidence that opened this route

Three consecutive independent `npm run test` runs by T0 on the same commit `94ef542`,
nothing else running:

| Run | Result |
|---|---|
| 1 | `Tests 1 failed | 758 passed (759)` |
| 2 | `Tests 2 failed | 757 passed (759)` |
| 3 | `Tests 1 failed | 758 passed (759)` |

Never clean, never the same failure. The four distinct tests observed failing across those
runs:

| Test | Failure |
|---|---|
| `src/App.test.tsx` › collapses and expands every panel through accessible controls | `Error: Test timed out in 5000ms` |
| `src/App.test.tsx` › exposes a dedicated input save action and rebuilds a standard simulation | `Unable to find a label with the text of: Algorithm preset` |
| `src/components/AiAssistant.actions.test.tsx` › shows planner feedback and leaves the workspace unchanged for a question | `Unable to find an element with the text: Güvenli zaman çizelgesi planlanıyor…` |
| `src/components/AiAssistant.taxonomy.test.tsx` › removes the interactive taxonomy tree with the trash action | `Unable to find role="region" and name /Soru ağacı|Problem tree/i` |

The same suite is green on CI's `quality` job for both push runs of this route's base
(`32883624515` and `32886383100`), and green on the holder's machine. It is not green on
T0's.

**This is not new, and the record shows it building.** `src/App.test.tsx:60` — which is
`collapses and expands every panel through accessible controls`, the timeout row above —
has been a watch item since R04, was seen a second time during R08 (CI run `32883635307`'s
`quality` job, recorded in `H08 ## Discovered`), and is now reproducible on demand. Three
occurrences across three routes, carried as a note each time. It stops being a note here.

**The likely cause, stated so the measurement can refute it.** `vitest.config.ts` sets
`environment: 'jsdom'` and no `testTimeout`, so every test inherits Vitest's 5000ms default
— the same unchosen number R08 just replaced on the Playwright side. `App.test.tsx:60`
drives `userEvent` through every panel toggle in the application; the three
`Unable to find` failures are the shape a `getBy*` produces when an async update has not
landed yet. Both are consistent with "the budget was never valid", and both are also
consistent with "these tests have a real race". The measurement decides which, and they
need different fixes.

## Turn

- Route id: `R09`
- Base: `94ef542` (`handoff(H08): record`)
- Holder: `sole`
- Expected size: 2–8 files, 2 commits (`route(R09): close`, `handoff(H09): record`)

## Expected Files

| Path | Why |
|---|---|
| `vitest.config.ts` | Where a chosen test budget would live |
| `src/App.test.tsx` | Only if the measurement implicates the test |
| `src/components/AiAssistant.actions.test.tsx` | Same |
| `src/components/AiAssistant.taxonomy.test.tsx` | Same |
| `src/**/*.test.tsx` | Any other test the measurement proves shares the cause |
| `docs/titan/handoffs/H09-unit-suite-budget-validity.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Write what the criteria require inside your own ownership; justify
extras in `## Deviations`. Frozen and T0-owned paths stay absolute.

**Non-test `src/**` is read-only this turn** unless the measurement proves a product defect
— see `## If the fault is in the product`.

## Invariants

- No assertion is deleted, weakened, or narrowed. Replacing a `getBy*` with `findBy*` to
  await a genuinely async update is a **fix**; replacing a specific query with a looser one
  until it matches something else is **weakening**. The handoff distinguishes these per
  change and justifies each.
- No test is `.skip`ped, `.only`d, or removed. `it.skip`, `describe.skip`, and `it.todo`
  all count.
- **No blanket retry.** Vitest's `retry` is not the fix here for the same reason
  `retries` was not the fix in R08: a retry hides a defect rather than closing it.
- A timeout may be raised **only against a measurement** showing the work genuinely needs
  the time. State the number's origin and the margin it leaves over the measured worst case,
  as R08 did with 15000ms against a 5458ms worst.
- Determinism: no `Math.random`, no wall-clock branching.
- The suite must be green on **both** machines. A fix that is green only where it was
  already green has not been tested.

## Measure first

Land the measurement before the fix. The handoff answers these with pasted evidence:

1. **What do the implicated tests actually cost?** Report a distribution, not a sample —
   median and worst across at least ten runs. Vitest prints per-test durations; the
   observed ones ranged 1111ms to 5205ms, which is the interesting part: the failures sit
   just under and just over the same line.
2. **How far is the margin?** Given that cost, what headroom does 5000ms leave, and what
   would the chosen number leave?
3. **Timeout or race?** The timeout failure and the three `Unable to find` failures may be
   one cause or two. A `getBy*` that fails because an update has not landed is a missing
   `await`, not a slow test, and raising `testTimeout` would not fix it. Decide per test,
   with evidence.
4. **Is it the whole suite or these four?** Every test in the repository inherits the same
   default. Establish whether the four observed are simply the slowest, or whether they
   share something the rest do not — `userEvent`, full `<App />` render, fake timers.
5. **Why does it reproduce on one machine and not another?** Core count, `pool` and worker
   settings, and whether the suite is running tests concurrently. If the answer is
   contention, say what the fix is — capacity, isolation, or budget — rather than tuning
   until it passes.

## Acceptance Criteria

1. The handoff answers all five `## Measure first` questions with pasted evidence and names
   the root cause per failing test. "Flaky" is the symptom being explained.
2. Any chosen budget is justified by the measured distribution, with margin stated as a
   multiple of the measured worst case.
3. `npm run test` reports **759 or more passing and zero failing on five consecutive runs**
   on the holder's machine. Paste all five summary lines. One clean run is what an
   intermittent failure produces routinely.
4. **(T0)** T0 re-runs the same five on its own machine and the route does not close until
   they are clean there too. This criterion exists because the defect is invisible on the
   holder's machine, and a route graded only where it already passed would close on nothing.
5. No assertion weakened, no test skipped, no retry added. Prove it with
   `git diff <base>..HEAD` in full, unabridged, with a line-by-line justification of every
   change, and each marked as fix-versus-weakening per the invariant above.
6. If other tests share the cause, the same fix covers them and the handoff names them; if
   they are deliberately left alone, it says why.
7. `npm run test` count is at or above 759 — this route removes no tests.
8. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`.
9. `npm run test:e2e` passes locally, both phases, and R08's clarification budget is
   untouched. **(T0)** The remote `browser` and `quality` jobs are Claude's to close.
10. Two commits, in order: `route(R09): close`, then `handoff(H09): record`, both signed
    `-s` after verifying `git config user.email` returns `iyott131@gmail.com`.

## If the fault is in the product

If the measurement shows the tests are right and the application is wrong — a real race in
panel collapse, a genuinely missing update, an effect that fires twice — **stop**. Write it
into `## Blockers` with the evidence and close as `partial`. A product fix gets its own route
with its own criteria. This is the same boundary R08 respected and R02 wrote.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "94ef542..HEAD"

git diff "94ef542..HEAD"

Get-ChildItem -Recurse -Path src -Include *.test.ts,*.test.tsx -File | Select-String -Pattern 'it\.skip|describe\.skip|it\.only|describe\.only|it\.todo'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The fourth command's result is criterion 5's evidence. **Compare it against the same command
on the base before claiming anything** — R08 found that its own zero-match grep criterion was
already non-zero at its base, and reported that instead of working around it. Do the same
here: if the base has matches, say what they are and show the count did not grow.

The five consecutive runs for criterion 3:

```powershell
1..5 | ForEach-Object { npm run test }
```

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

## Rollback

`git reset --hard 94ef542` only when the working tree holds nothing else worth keeping, and
record the decision in `## Deviations`.

## Out of Scope

- **The semantic input ops.** Drafted as `R10` in `docs/titan/routes/queued/`; it opens after
  this closes. Do not start it and do not read it as an instruction.
- R08's Playwright budget and the clarification spec. They are closed; do not revisit.
- The measurement scaffolding R08 left in `ci.yml` and
  `e2e/titan-mode-clarification.spec.ts` — T0 has its own note on that; leave it alone.
- Product changes, unless `## If the fault is in the product` applies — and then it is a
  blocker, not a fix.
- Dependency upgrades, including the Node 20 action deprecation and the audit advisory
  recorded in `H08 ## Discovered`.
- Every `AGENTS.md` file — T0-owned.
- Pushing to `origin`. The remote half of criterion 9 belongs to T0.
