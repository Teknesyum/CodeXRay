# R02b — Close the browser gate

> **Queued, not open.** This file is planning material. The active route is the one directly
> in `docs/titan/routes/` that has no matching handoff. Nothing here is an instruction to
> write code until it moves there. R02b opens after R03 closes.

## Özet

R02 teşhisi tamamladı ve `partial` devredildi: paralel worker yükü eski rastgele hataların
sebebiydi, tek worker'la 66 test geçiyor, trace/screenshot/HTML artifact'ları artık yükleniyor.
Kapanmayan üç kriter — üç ardışık yeşil koşu, iki koşunun aynı sayıyı vermesi, sıfır flaky —
ürün tarafındaki timeline bütçesi düzelmeden ölçülemiyordu. R02b onları kapatır ve geçici
teşhis matrisini kaldırır.

## Objective

Finish what R02 started: remove the temporary diagnosis scaffolding, and demonstrate that the
`browser` job's result is a function of the commit by producing three consecutive green runs
of one SHA.

R02 is not rewritten. This is its retry, and it inherits R02's invariants unchanged — no
weakened assertion, no skipped spec, no retry raised as a fix, no timeout raised without a
measurement.

## What R02 established

From `docs/titan/handoffs/H02-trustworthy-browser-gate.md`, run 32759081011 on SHA `9aa5a41`:

| Question | Answer | Evidence |
|---|---|---|
| Contention? | **Yes.** One worker: `66 passed (5.1m)`. Parallel: failed. | job 97533313957 |
| Order? | No. Single-test files passed; internally parallel heavy files still failed. | artifact 9532120414 |
| Environment? | Runner CPU capacity, not WebGPU, OPFS, model cache, or network. | job 97533313957 |
| Real? | The label genuinely is not committed under contention — the trace shows a correct page with the preset still reading `Algorithm Presets`. | artifact 9532294164 |

Criteria met in R02: 1, 5, 6, 8, 9, 10. Not met: 2, 3, 4, 7 — all four blocked on the
timeline budget, which is R03.

## Turn

- Route id: `R02b`
- Base: **not yet stamped.** Written when this file moves into `docs/titan/routes/` as
  `route(R02b): open`, which happens after `H03` lands.
- Holder: `sole`
- Expected size: 1–3 files, 2 commits (`route(R02b): close`, `handoff(H02b): record`)

## Owned Files

| Path | Why |
|---|---|
| `.github/workflows/ci.yml` | Remove the diagnosis matrix; narrow artifact uploads |
| `playwright.config.ts` | Only if the worker count needs pinning rather than defaulting |
| `docs/titan/handoffs/H02b-trustworthy-browser-gate.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

`src/**` and `e2e/**` are **read-only this turn**. If the gate is still red after R03, that
is a finding to report, not a licence to edit tests.

## Invariants

Inherited from R02, unchanged:

- No assertion deleted, weakened, or narrowed. No spec `.skip`ped, `.fixme`d, or removed.
- `retries` is not raised as a fix. If it changes, the handoff states what it compensates for.
- Timeouts rise only against a measurement, never because raising them produced green.
- The suite stays deterministic, and the local Windows run must still pass.

Added by this route:

- The diagnosis matrix added in `9aa5a41` is temporary scaffolding and is removed. It existed
  to answer four questions; H02 answered them.

## The artifact problem

H02 recorded, under `## Discovered`:

```
Failure artifacts can be very large: the parallel diagnostic artifact is 648,454,966 bytes.
```

648 MB from one run, plus 73 MB for the gate artifact itself. That is a storage and
retention problem, and it is the direct cost of `trace: 'retain-on-failure'` across a matrix
of failing jobs. Keep the diagnostic value, drop the volume:

- Traces and screenshots stay on failure — criterion 6 of R02 depends on them and they are
  what made question 4 answerable.
- Set an explicit retention period on the upload rather than the default.
- Once the suite is green the artifacts are near-empty anyway; the size problem is a symptom
  of redness, so verify the steady-state size after the gate is green and report it.

## Acceptance Criteria

1. The diagnosis matrix introduced in `9aa5a41` is removed from `.github/workflows/ci.yml`.
   The `browser` job remains, with its artifact upload.
2. The `browser` job is green on **three consecutive runs of the same commit**, triggered by
   re-running the workflow, not by pushing new commits. Paste all three run ids and their
   job conclusions.
3. Two runs of that commit report identical pass, fail, and flaky counts. Paste both summary
   lines.
4. `flaky` is 0 across those runs, or every remaining flaky spec is named with the reason it
   is tolerated and the route number where it is fixed.
5. Artifact size in the green steady state is reported, and retention is set explicitly.
6. `git diff <base>..HEAD -- e2e/ src/` returns no output.
7. The local Windows run passes, both phases, using the external-server procedure in
   `AGENTS.md`. Paste both phase summaries and `E2E_EXIT`.
8. All four gates clean: `npm run lint`, `npm run test`, `npm run build`, `npm run desktop:check`.
9. `npm run test` count is at or above 751.
10. Two commits, in order: `route(R02b): close`, then `handoff(H02b): record`.

**Push authority:** granted, because criteria 2 and 3 cannot be evaluated without CI runs.
`main` is the working branch, so an ordinary `git push origin main` is expected. Force-push,
history rewrite, tags, releases, and anything that rewrites published history remain out of
bounds — ask before any of those.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "<base>..HEAD"

git diff "<base>..HEAD" -- e2e/ src/

Get-ChildItem -Recurse -Path e2e -File | Select-String -Pattern '\.skip|\.fixme|test\.only'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third command must return nothing. The fourth returns only the three pre-existing
conditional skips in `e2e/real-ai.spec.ts` and `e2e/real-radio.spec.ts`, which R02 already
recorded as inherited.

CI evidence, three runs of one commit:

```powershell
gh run list --branch main --limit 5
gh run view <id> --json jobs -q '.jobs[] | \"\(.name) \(.conclusion)\"'
```

## Rollback

`git reset --hard <base>` only when the working tree holds nothing else worth keeping, and
record the decision in `## Deviations`.

## Out of Scope

- The timeline budget. R03 owns it; if it is not closed, this route does not open.
- The one-worker decision. Established in R02, not reopened.
- Wiring the second-generation pipeline (R04), the intent vocabularies (R05), translation
  (R06).
- Merging, tagging, or releasing. `main` is where the work lands turn by turn; cutting a
  release from it is a separate decision and not this route's to make.
