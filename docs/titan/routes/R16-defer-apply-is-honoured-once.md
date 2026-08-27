# R16 — `deferApply` is honoured at one of five apply sites

## Özet

R15 `adapt-input` için `verify`'ı gerçek hâle getirdi ve H15 iki ardıl rota adlandırdı.
Ölçüm sırayı değiştirdi: `create-algorithm`'ı boru hattına almadan önce yapısal bir engel
var. `deferApply` motorda beş uygulama noktasından yalnız birinde dinleniyor. Diğer dördü
paketi koşulsuz uyguluyor, yani bir yaratım intent'i bugün boru hattına sarılsa çalışma
alanı `verify` daha çalışmadan değişmiş olurdu.

## Objective

H15 named `R16-grounded-current-step-verification` and `R17-model-authored-pipeline-verification`.
This route is neither, and the swap is deliberate — read `## Why the order changed` before
concluding a promise was dropped.

### The measurement

`deferApply` exists so the pipeline can own application. It is checked exactly once:

```
titanEngine.ts:964   adapt-input          if (options.deferApply) return 'Application deferred ...'
titanEngine.ts:1079  interval-DP          options.applyPackage(packageValue, runId)
titanEngine.ts:1161  array templates      options.applyPackage(packageValue, runId)
titanEngine.ts:1245  (creation branch)    options.applyPackage(packageValue, runId)
titanEngine.ts:1511  (creation branch)    options.applyPackage(packageValue, runId)
```

Four of the five apply sites ignore the flag. So `deferApply: true` is not a general
capability of the engine — it is a special case of one branch that happens to be the only
branch the pipeline currently drives.

### What that means for the route H15 actually wants

If a successor wraps `create-algorithm` in `startTitanModePipeline`-shaped code with
`deferApply: true`, the engine applies the package during `produce` anyway. The pipeline's
`verify` then runs against an artifact that is already in the workspace, and its `apply`
becomes a second application of something already applied. A failed verify would report
failure over a workspace that had already changed.

That is not a bug today, because nothing takes that path. It is a trap laid for the exact
route H15 named, and it is invisible from the pipeline side: `deferApply: true` is accepted
without complaint at every call site.

### The creation paths are not unguarded, which is worth stating

R15's reconciliation could be misread as "creation has no verification". It does have gates,
in the engine's job graph, and some are real content checks:

```
titanEngine.ts:1151  critic-test-visual-and-trace-alignment
  if (!packageValue.tests.passed || !packageValue.steps.length) throw ...
  if (!resultStep || !hasOwnProperty(resultStep.visualData.vars, 'result')) throw ...
```

And `model-authored` runs `validateArchitectureContract` on the model's response, retries
once on truncation, and throws on invalid rather than falling back.

So the gap is not "no gates". It is that the gates run *before* apply only because they
happen to be earlier in the same function — there is no structural separation between
deciding and committing, and no point at which an external caller can refuse.

## Turn

- Route id: `R16`
- Base: `1197541` (`route(R15): reconcile and close`)
- Holder: `sole`
- Expected size: 3–8 files, 2 commits (`route(R16): close`, `handoff(H16): record`)

## Expected Files

| Path | Why |
|---|---|
| `src/services/titanEngine.ts` | The four apply sites that ignore the flag |
| `src/services/titanEngine.test.ts` | Follows its module |
| `src/services/titan/titanPipeline.ts` | Only if a creation intent is wired through it |
| `src/services/titan/titanPipeline.test.ts` | Follows its module |
| `src/components/AiAssistant.tsx` | Only if a creation intent's entry point moves |
| `src/i18n/translations.ts` | Any new EN/TR strings |
| `e2e/**` | A spec proving the chosen creation path still applies exactly once |
| `docs/titan/handoffs/H16-defer-apply-is-honoured-once.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Write what the criteria require inside your own ownership; justify
extras in `## Deviations`. Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no
route, no protocol file.

## Invariants

- **Exactly once.** Whatever changes, every path applies its package exactly once. Not zero
  times, not twice. This is the failure mode the route exists to prevent, so prove it rather
  than asserting it.
- **`adapt-input` is untouched.** R15's verification, `deferApply` at `:964`, and the
  ordering all stay exactly as they are.
- **Do not wire `model-authored` in this turn.** It is the most dangerous artifact and it
  gets its own route once the mechanism is proven on a safer one.
- **A deferred apply that never happens is worse than an eager one.** If a path defers and
  the caller forgets to apply, the user sees a successful run that changed nothing. Whatever
  the design, make that state impossible or make it loud.
- Determinism: no `Math.random`, no wall-clock branching.
- R10's array ops, R12's graph ops, R13-R14's parameters, R15's verification, the R06
  translation flow, and `discuss-current-step` all keep working.
- Do not regress the progress display; if bars change for any intent, say which and how.

## The decision

**Option A — make `deferApply` mean what it says, and prove it on one safe path.** The four
sites honour the flag. Then one creation intent — the **deterministic array-template** branch
at `:1161`, not `model-authored` — is driven through the pipeline so the mechanism is
exercised end to end: engine produces, pipeline verifies, pipeline applies.

Costs: four call sites to change and one entry point to move, with the exactly-once property
to protect at each. The verify for that path would initially be the existing shape check
unless a content check falls out cheaply — say which it is, and do not claim more than was
built.

**Option B — make the flag honest about its scope.** Rename or retype it so it cannot be
passed to a branch that ignores it — a per-branch capability rather than a global option, or
a compile-time impossibility. The engine keeps owning creation apply, and the successor route
knows it must change that first.

Costs: the trap is documented and type-enforced but not removed; H15's named successor still
has to do this work, just with a clearer error.

**T0's reading, not binding:** A, with the array-template branch as the proving ground. The
value is not the flag — it is having one creation path where apply is external, so the route
that eventually verifies a model-authored package has a working mechanism to plug into
instead of inventing one under pressure. But B is a legitimate answer if honouring the flag
at four sites turns out to entangle branches that share state, and a type-level fix that
makes the trap unrepresentable is worth more than a half-migrated path. Say which, with the
code that made the call.

## Acceptance Criteria

1. The handoff states the decision and, if A, exactly which paths now honour `deferApply` and
   which creation intent was wired.
2. **Exactly-once is proven per path**, by a test that counts `applyPackage` calls for every
   branch touched — including the ones left unwired. A count, not an assertion that it looks
   right.
3. If A: a test proves that with `deferApply: true` the engine does **not** apply, and that
   the pipeline's `apply` does. Both halves, or the criterion is not met.
4. **The forgotten-apply state is addressed.** Show what happens if a caller defers and never
   applies — either it cannot be expressed, or it fails loudly. A test either way.
5. `adapt-input` is byte-for-byte unaffected: R15's verification still runs, still rejects a
   tampered trace, and still leaves the workspace identical. Name the tests.
6. The wired creation path still produces the same package and the same trace as before.
   Name the e2e spec that proves the user-visible result did not change.
7. `model-authored` is untouched, and the handoff states what its own route will need now
   that the mechanism exists.
8. `discuss-current-step` grounding is still deferred and still named. One sentence.
9. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`.
10. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
    Claude's to close.
11. Two commits, in order: `route(R16): close`, then `handoff(H16): record`, both signed
    `-s` after verifying `git config user.email` returns `iyott131@gmail.com`. An optional
    published `fix(R16)` between them is permitted, as in R15.

**(T0)** The `AGENTS.md` wording describing `deferApply` and pipeline coverage is Claude's,
in `## T0 reconciliation`.

## Why the order changed

H15 named this slot `R16-grounded-current-step-verification`. Two measurements moved it.

**The grounding route is not ready to be written.** `discuss-current-step`'s tutor answer
comes from `callOptionalAgent` with `deterministicFiveLens` as the fallback, so on a machine
with a local model the text is model prose. Verifying it deterministically means extracting
checkable claims from free text and comparing them to the trace — a research problem, not a
turn. A route asking for that would either get a keyword matcher dressed as verification or
get nothing. It stays named, as `R17-grounded-current-step-verification`, until someone can
state what a claim is.

**And the model-authored route has a blocker underneath it.** H15's
`R17-model-authored-pipeline-verification` cannot be written honestly while four of five
apply sites ignore `deferApply`, because its first step would be discovering that. Better to
clear it in a bounded turn than to hand it to a route already carrying the hardest artifact
in the system. That route keeps its name and becomes `R18`.

Nothing was dropped. Both successors are still named, both still have their requirements from
H15, and this route is the precondition one of them needed. **Fifth time a queued objective
did not survive contact with the call path** — R11, R12, R14, R15, and now R16.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "1197541..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'deferApply'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'applyPackage\('

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third and fourth commands are criteria 1 and 2's evidence — run them against the base
first and report the delta, not the raw count. The fifth must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```
