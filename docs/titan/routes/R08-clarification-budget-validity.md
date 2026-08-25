# R08 — The clarification budget was never valid

## Özet

`titan-mode-clarification.spec.ts` üst üste iki commit'te flake etti, ikisinde de aynı
satırda ve aynı biçimde: `getByLabel(...)` beş saniyede görünmedi, retry'da geçti. R06
kapanışında "bir daha olursa kendi rotasını açar" diye eşik koymuştum; oldu, açıyorum.
Playwright'ın `expect` zaman aşımı yapılandırılmamış — yani beş saniye kimsenin seçmediği
bir varsayılan. Bu rota önce ölçer, sonra düzeltir. Testi zayıflatarak yeşile getirmek bu
rotanın başarısızlığıdır.

## Objective

Establish what `e2e/titan-mode-clarification.spec.ts:27` actually needs, and give it a
budget somebody chose. Then make the `browser` gate report zero flaky again, so a green run
means the same thing it meant for the three commits before this one.

This is R03's shape, not R02's: the suspicion is not that the gate is measuring the wrong
tree — R02b fixed that and it has held — but that this assertion's budget was **never
valid**, and R02b lowered the failure probability by reducing contention without changing
the margin.

### The evidence that opened this route

Two consecutive commits, same spec, same line, same failure text:

| Head | Route | browser result |
|---|---|---|
| `0a5c1af` | R04 | 67 passed · 0 flaky |
| `e38fb9e` | R05 | 67 passed · 0 flaky |
| `b4f9ae4` | R06 | 67 passed · **1 flaky** |
| `954f150` | R07 | 67 passed · **1 flaky** |

The failure, verbatim from run `32881017681`:

```
Error: expect(locator).toBeVisible() failed

Locator: getByLabel(/Bidirectional BFS.*Custom execution/)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

  25 |   await question.fill('write bidirectional BFS for me');
  26 |   await question.press('Enter');
> 27 |   await expect(page.getByLabel(/Bidirectional BFS.*Custom execution/)).toBeVisible();
```

Run `32875927404` on `b4f9ae4` produced the same text at the same line.

Three facts worth having before the diagnosis starts:

1. **Nobody chose 5000ms.** `playwright.config.ts` sets `retries` and `workers` and has no
   `expect` block at all, so line 27 inherits Playwright's default assertion timeout. R02's
   original failure table was full of `toBeVisible()` timeouts at exactly this default, and
   `titan-mode-clarification.spec.ts` was one of the six specs on it.
2. **Line 27 is not waiting for a render; it is waiting for a pipeline.** Line 26 submits
   `write bidirectional BFS for me`, which runs a full deterministic Titan `create-algorithm`
   pass — source, input, and a complete simulation — and line 27 waits for the resulting
   algorithm label. Compare line 19, which waits only for a clarification message and has
   never flaked.
3. **The retry passes.** Whatever the cost is, it is near the boundary rather than far past
   it, which is what makes it intermittent rather than a hard failure.

## Turn

- Route id: `R08`
- Base: `954f150` (`handoff(H07): record`)
- Holder: `sole`
- Expected size: 2–6 files, 2 commits (`route(R08): close`, `handoff(H08): record`)

## Expected Files

| Path | Why |
|---|---|
| `playwright.config.ts` | Where a chosen assertion budget would live |
| `e2e/titan-mode-clarification.spec.ts` | Only if the measurement implicates the spec itself |
| `e2e/**` | Any other spec the measurement proves shares the cause |
| `docs/titan/handoffs/H08-clarification-budget-validity.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Write what the criteria require inside your own ownership; justify
extras in `## Deviations`. Frozen and T0-owned paths stay absolute.

`src/**` is **read-only this turn** unless the measurement proves a product defect — see
`## If the fault is in the product`.

## Invariants

- No assertion is deleted, weakened, or narrowed. Changing `toBeVisible()` to something
  softer, loosening the `getByLabel` regex until it matches something earlier, or asserting
  on a parent all count as weakening.
- No spec is `.skip`ped, `.fixme`d, or removed.
- **`retries` is not raised.** It is already 2 on CI, which is what is currently absorbing
  this. Raising it further would hide the defect harder.
- A timeout may be raised **only against a measurement** showing the operation genuinely
  needs the time on this runner. "It stopped failing after I raised it" is not a measurement.
  Whatever number is chosen, the handoff says where it came from and what margin it leaves.
- The suite stays deterministic: no `Math.random`, no wall-clock branching.
- The local Windows run must still pass.

## Measure first

Land the measurement before the fix. The handoff answers these with pasted evidence:

1. **What does the operation actually cost?** Instrument the wait — time from the `Enter`
   press at line 26 to the label appearing — and report a distribution, not one sample.
   Median and worst of at least ten runs, locally and on CI. R03 established this method for
   the timeline budget and it is the reason that budget is now defensible.
2. **How far is the margin?** Given that cost, how much headroom does 5000ms leave, and how
   much would the chosen number leave? A budget with no stated margin is another unchosen
   default.
3. **Is this spec alone?** Every other assertion in `e2e/**` waiting on a Titan run inherits
   the same default. List them. If they share the cause, they share the fix; if they have
   never flaked, say why this one is different — heavier pipeline, more contention, earlier
   position in the run.
4. **Is it contention?** The two flakes appeared as the suite grew: R06 added
   `translation-provenance.spec.ts` and the total went 67 → 68. Test whether the flake
   tracks worker load by comparing a `--workers=1` CI run against the current configuration
   on the same commit.
5. **Read the artifact.** Download the failing run's trace and screenshot and state what the
   page actually showed when the label was absent: a pipeline still running, an error
   boundary, or a rendered page the locator missed. This decides between "too slow" and
   "sometimes wrong", and those need opposite fixes.

## Acceptance Criteria

1. The handoff answers all five `## Measure first` questions with pasted evidence and names
   one root cause. "Flaky" is the symptom being explained, not the cause.
2. The chosen budget is justified by the measured distribution, with its margin stated as a
   multiple of the measured worst case.
3. The `browser` job reports **0 flaky** on three consecutive runs of the **same** commit,
   triggered by re-running the workflow rather than by pushing. One clean run is what an
   intermittent failure produces routinely.
4. Determinism shown positively: those runs report identical pass/fail/flaky counts. Paste
   all three summary lines.
5. No assertion weakened, no spec skipped, `retries` unchanged. Prove it with
   `git diff <base>..HEAD -- e2e/ playwright.config.ts` in full, unabridged, with a
   line-by-line justification of every change.
6. If other specs share the cause, they are covered by the same fix, and the handoff names
   them. If they are deliberately left alone, it says why.
7. The local Windows run still passes, using the external-server procedure in `AGENTS.md`.
8. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`.
9. `npm run test` count is at or above 759 — this route removes no unit tests.
10. Two commits, in order: `route(R08): close`, then `handoff(H08): record`, both signed
    `-s` after verifying `git config user.email` returns `iyott131@gmail.com`.

**Push authority:** criteria 3 and 4 cannot be evaluated without CI runs, so this route
grants Sole permission to push `main` for that purpose alone, exactly as R02 did. It does
not extend to any later route. Force-push, history rewrite, tags, and releases stay out of
bounds.

## If the fault is in the product

If the measurement shows the spec is right and the application is wrong — a real delay or a
real intermittent render failure that only appears on Linux or under contention — **stop**.
Write it into `## Blockers` with the trace that proves it and close as `partial`. A product
fix gets its own route with its own criteria. A route that fixes the gate and the product at
once can prove neither.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "954f150..HEAD"

git diff "954f150..HEAD" -- e2e/ playwright.config.ts

Get-ChildItem -Recurse -Path e2e -File | Select-String -Pattern '\.skip|\.fixme|test\.only'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The fourth command must return nothing; any match is criterion 5 failing.

CI evidence, three re-runs of one commit:

```powershell
gh run list --branch main --limit 5
gh run view <id> --json jobs
```

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## Rollback

`git reset --hard 954f150` only when the working tree holds nothing else worth keeping, and
record the decision in `## Deviations`.

## Out of Scope

- **The semantic input ops.** Drafted as `R09` in `docs/titan/routes/queued/`; it opens after
  this closes. Do not start it and do not read it as an instruction.
- Any product change, unless `## If the fault is in the product` applies — and then it is a
  blocker, not a fix.
- Adding e2e coverage for uncovered behaviour. This route makes the existing gate
  trustworthy again; it does not grow it.
- Every `AGENTS.md` file — T0-owned.
