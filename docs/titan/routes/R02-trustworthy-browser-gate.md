# R02 — Make the browser job a gate again

## Özet

CI'daki `browser` işi ölçtüğü ağacı ölçmüyor: yalnız Markdown değiştiren bir commit'te bile
başarısız test sayısı 6'dan 10'a çıktı. Aynı testler yerelde 66/66 geçiyor. Bu rota önce
nedeni bulur, sonra düzeltir — testi zayıflatarak değil. Gate güvenilir olmadan hiçbir
sonraki rotanın "e2e geçti" kriteri bir şey ifade etmiyor.

## Objective

Make the GitHub Actions `browser` job produce a result that is a function of the commit it
runs on. Until that holds, every downstream route's e2e criterion is unfalsifiable and the
protocol cannot verify anything it claims to verify.

This route diagnoses first and fixes second. Reaching green by deleting assertions, adding
blanket retries, marking specs `.skip`, or raising every timeout is an explicit failure of
this route, not a completion of it.

### The evidence that opened this route

Three CI runs, same workflow, same runner image:

| Head | What changed relative to the row above | browser result |
|---|---|---|
| `4e99311` (main) | the inherited baseline | 6 failed · 5 flaky · 55 passed |
| `6c7e5ff` (branch) | **Markdown only** — zero `src/**`, zero `e2e/**` | 10 failed · 3 flaky · 53 passed |
| `7a6f9f3` (branch) | R01's six spec renames and two new unit tests | 12 failed · 4 flaky · 50 passed |

The middle row is the whole argument. Nothing executable changed and the failure count moved
by four. Meanwhile the same suite passes locally on Windows at `66 passed` + `2 passed` with
`E2E_EXIT=0`, observed independently by Sole and by T0.

Where the failures land, from run 32756724301:

| Spec | Failure mentions |
|---|---|
| `e2e/dp-family-titan-mode.spec.ts` | 46 |
| `e2e/usage-scenarios.spec.ts` | 22 |
| `e2e/titan-mode-user-graph.spec.ts` | 6 |
| `e2e/titan-mode-clarification.spec.ts` | 6 |
| `e2e/release-tour.spec.ts` | 6 |
| `e2e/interval-dp-titan-mode.spec.ts` | 5 |

Every failure is the same shape: `expect(locator).toBeVisible()` timing out. Two of the six
specs were never renamed, so the rename is not a sufficient explanation.

## Turn

- Route id: `R02`
- Base: `7a6f9f32954fd728cd3f20a36bd9318ed04876a3`
- Holder: `sole`
- Expected size: 3–8 files, 2 commits (`route(R02): close`, `handoff(H02): record`)

## Owned Files

| Path | Why |
|---|---|
| `.github/workflows/ci.yml` | Worker count, sharding, reporter, artifact upload |
| `playwright.config.ts` | Workers, retries, timeouts, projects |
| `e2e/**` | Only the specs the diagnosis actually implicates |
| `docs/titan/handoffs/H02-trustworthy-browser-gate.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

`src/**` is **read-only this turn** unless the diagnosis proves a product defect. If it does,
see `## If the fault is in the product` — do not fix it inside this route.

## Invariants

- No assertion is deleted, weakened, or narrowed to make a test pass. Changing
  `toBeVisible()` to a softer check, shortening a selector until it matches something else,
  or asserting on a parent instead of the element under test all count as weakening.
- No spec is `.skip`ped, `.fixme`d, or removed from the run.
- `retries` is not raised as a fix. A retry hides a defect; it does not close one. If
  retries change at all, the handoff states what the retry is compensating for and why that
  is acceptable.
- Timeouts may be raised only against a measurement showing the operation genuinely needs
  the time on this runner. "It passed after I raised it" is not a measurement.
- The suite must stay fully deterministic: no `Math.random`, no wall-clock branching.
- Whatever changes, the local Windows run must still pass.

## Diagnosis first

Land the diagnosis before the fix. The handoff must answer, with evidence pasted verbatim:

1. **Is it contention?** Compare a `--workers=1` CI run against the current configuration on
   the same commit. If serialising the suite turns it green, the failures are resource
   contention on the runner and the fix is capacity or sharding, not timeouts.
2. **Is it order?** Run the implicated specs alone, then in the full suite, on CI. If a spec
   passes alone and fails in company, something leaks between specs — storage, a service
   worker, a cached model, a port.
3. **Is it the environment?** `dp-family` and `usage-scenarios` carry the heaviest setup.
   Establish whether the runner has what they need — WebGPU absence, an OPFS-backed cache
   the Linux container does not provide, or a download the network blocks. Name the specific
   capability, do not gesture at "CI is slower".
4. **Is it real?** Download the failing run's Playwright trace and screenshot artifacts and
   read them. State what the page actually showed when the locator was not visible: an error
   boundary, an empty panel, a spinner that never resolved, or a correct page the selector
   missed. This single step usually decides between the three hypotheses above.

If the workflow does not currently upload traces on failure, adding that upload is the first
change of this route and is worth landing on its own.

## Acceptance Criteria

1. The handoff answers all four `## Diagnosis first` questions, each with pasted evidence,
   and names one root cause. "Flaky" is not a root cause; it is the symptom being explained.
2. The `browser` job is green on three consecutive runs of the **same** commit, triggered by
   re-running the workflow rather than by pushing new commits. One green run does not close
   this criterion, because one green run is exactly what an unstable suite produces sometimes.
3. Determinism is shown positively: two runs of the same commit report the same pass, fail,
   and flaky counts. Paste both summary lines.
4. `flaky` is 0 in those runs, or every remaining flaky spec is named in the handoff with the
   reason it is tolerated and a route number where it is fixed.
5. No assertion was weakened and no spec was skipped. Prove it with
   `git diff <base>..HEAD -- e2e/` in full, unabridged, and a line-by-line justification of
   every change to a spec file.
6. Playwright traces, screenshots, and the HTML report upload as artifacts on failure, and
   the handoff links the run where that was confirmed.
7. The local Windows run still passes, using the external-server procedure in `AGENTS.md`.
8. All four gates clean: `npm run lint`, `npm run test`, `npm run build`, `npm run desktop:check`.
9. `npm run test` count is at or above 751 — this route does not remove unit tests.
10. Two commits, in order: `route(R02): close`, then `handoff(H02): record`.

**Push authority:** this route grants Sole permission to push `agent/titan-relay` to
`origin`, solely because criteria 2 and 3 cannot be evaluated without CI runs. This is the
one route that carries that authority; it does not extend to any later route. Force-push,
history rewrite, tags, releases, and anything touching `main` remain out of bounds.

## If the fault is in the product

If the diagnosis shows the specs are right and the application is wrong — a real defect that
only manifests on Linux, or under contention, or without WebGPU — **stop**. Write the defect
into `## Blockers` with the trace that proves it and close the route as `partial`. A product
fix gets its own route with its own criteria. Do not widen this one; a route that fixes the
gate and the product at once can prove neither.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "7a6f9f32954fd728cd3f20a36bd9318ed04876a3..HEAD"

git diff "7a6f9f32954fd728cd3f20a36bd9318ed04876a3..HEAD" -- e2e/

Get-ChildItem -Recurse -Path e2e -File | Select-String -Pattern '\.skip|\.fixme|test\.only'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The fourth command must return nothing. Any match is criterion 5 failing.

CI evidence, three runs of one commit:

```powershell
gh run list --branch agent/titan-relay --limit 5
gh run view <id> --json jobs -q '.jobs[] | \"\(.name) \(.conclusion)\"'
```

The local e2e run uses the external-server procedure from `AGENTS.md`. Clean up only the
PIDs this run created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## Rollback

`git reset --hard 7a6f9f32954fd728cd3f20a36bd9318ed04876a3` only when the working tree holds
nothing else worth keeping, and record the decision in `## Deviations`.

## Out of Scope

- **Wiring the second-generation pipeline.** That is R03, already drafted in
  `docs/titan/routes/queued/R03-first-seam.md`. Do not start it, and do not read it as an
  instruction — it is queued, not open.
- Reconciling the two intent vocabularies (R04) or shipping translation (R05).
- Renaming anything. R01 finished the rename; the two remaining legacy storage constants are
  R03's business.
- Adding e2e coverage for behaviour that is not currently covered. This route makes the
  existing suite trustworthy; it does not grow it.
- `main`. The branch stays unmerged until the gate is green.
