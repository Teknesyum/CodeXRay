# R18 — model-authored source reaches the editor before anything verifies it

## Özet

R16 `deferApply`'ı beş uygulama noktasında da gerçek yaptı ve mekanizmayı deterministik dizi
şablonlarında kanıtladı. Bu rota o mekanizmayı sistemdeki en tehlikeli artifact'e —
`model-authored` — bağlamak içindi. Ölçüm bir katman daha aşağıda ikinci bir uygulama kanalı
buldu: `previewSource`. Paket dışarıdan uygulanıyor, ama modelin yazdığı kaynak `produce`
sırasında zaten editöre yazılıyor. Rollback var; sıra yok.

## Objective

H16 named this route and it keeps its name. What it is *about* changed after reading the
call path — the sixth time in seven routes, and this one is worth stating carefully because
nothing here is broken.

### The measurement

`deferApply` now gates `applyPackage` everywhere. It does not gate the other channel:

```
titanEngine.ts:1044  interval-DP            await options.previewSource?.(preparedPackage.source.code, ...)
titanEngine.ts:1133  array templates        await options.previewSource?.(preparedPackage.source.code, ...)
titanEngine.ts:1214  DP templates           await options.previewSource?.(preparedPackage.source.code, ...)
titanEngine.ts:1353  bidirectional-bfs      await options.previewSource?.(renderProgramSource(authoredProgram).code, ...)
titanEngine.ts:1401  model-authored         await options.previewSource?.(renderProgramSource(validation.program).code, ...)
titanEntry.ts:130    entry                  await options.previewSource?.(compiled.source.code, ...)
```

`AiAssistant.tsx:829` is the implementation, and it is not a preview in the read-only sense.
It pauses playback, sets the algorithm name, clears `steps`, `currentIndex`, and `analysis`,
then types the draft into the editor. That is a workspace mutation, and for `model-authored`
the text being typed is model output that no gate has yet inspected — `validateProgramSpec`
has passed at `:1401`, but the critic, the sample run, and any pipeline `verify` have not.

### Why this is not a hole, and what the actual question is

There is a real rollback. `AiAssistant.tsx:808` snapshots the workspace before the run;
`restoreSourcePreview` at `:320` puts every field back; the snapshot is discarded only when a
genuine apply commits (`:855`, `:871`, `:883`); and the `catch` at `:1052` restores on any
rejection — including a pipeline `verify` rejection, since `startArrayTemplatePipeline`
rejects with `verificationFailureMessage`. Cancel and the Titan toggle restore too. So the
committed state is safe.

The question is therefore not safety but **order**. For a deterministic template the previewed
source is byte-identical to what will be applied, so previewing early costs nothing and buys
the typing animation. For `model-authored` the previewed source is the model's, it replaces
the user's visible workspace, and it may be withdrawn seconds later. Wiring `model-authored`
into the pipeline without deciding this would produce a run where `verify` fails, the user has
already watched model-authored code type itself into their editor, and the rollback quietly
undoes it. **Verification that happens after the user has seen the artifact is not doing the
job the pipeline exists to do.**

### The second measurement: this route cannot be closed on the browser gate

`model-authored` runs `callAgent` for both Architect and Code Author. There is no
deterministic fallback — `:1327` throws on invalid rather than degrading. So the path needs a
real local model, which the remote `browser` job does not have. Evidence for this route comes
from unit tests with a stubbed `agentRunner` (the shape `titanEngine.test.ts` already uses via
`successfulAgent`) plus `npm run test:e2e:ai` locally. Do not promise a `browser`-gate proof
for the model-authored path; promise it only for whatever deterministic behaviour changes
alongside it.

## Turn

- Route id: `R18`
- Base: `a2f91cb` (`route(R16): reconcile and close`)
- Holder: `sole`
- Expected size: 4–9 files, 2 commits (`route(R18): close`, `handoff(H18): record`)

**On the number.** `R17-grounded-current-step-verification` is named and deferred on a stated
reason, and no `R17` file exists. Pairing decides the active route, never numbering — this is
the active route because it is the only file directly in `routes/` without a handoff.

## Expected Files

| Path | Why |
|---|---|
| `src/services/titan/titanPipeline.ts` | The model-authored entry point and its verify |
| `src/services/titan/titanPipeline.test.ts` | Follows its module |
| `src/services/titanEngine.ts` | Only if preview ordering or a gate moves |
| `src/services/titanEngine.test.ts` | Follows its module |
| `src/components/AiAssistant.tsx` | Dispatch, and the preview contract if it changes |
| `src/i18n/translations.ts` | Any new EN/TR strings |
| `e2e/**` | Only for deterministic behaviour that changed |
| `docs/titan/handoffs/H18-*.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Write what the criteria require inside your own ownership; justify
extras in `## Deviations`. Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no
route, no protocol file.

## Invariants

- **The rollback stays.** Whatever changes about ordering, a failed or cancelled run must
  still leave the workspace byte-identical to the snapshot. Prove it, do not assume it.
- **Exactly once, still.** R16's counted property holds for every branch, wired or not.
- **The deterministic paths keep their preview.** If the typing animation is removed or
  delayed for `jump-game-dp` and friends, that is a user-visible regression and needs its own
  justification. Prefer a change that touches only `model-authored`.
- **Never execute model text.** No `eval`, no `new Function`. SimLang stays interpreted.
- **The trace never comes from the model.** Whatever the model authors, the trace is the
  interpreter's.
- Determinism: no `Math.random`, no wall-clock branching.
- `adapt-input` (R15), the array-template pipeline (R16), R10's array ops, R12's graph ops,
  R13–R14's parameters, and R06's translation flow all keep working.
- Do not regress the five-bar progress display for any intent.

## The decision

**Option A — verify before the user sees it.** `model-authored` runs through the pipeline with
its `previewSource` suppressed during `produce` and replayed by `apply` after `verify` passes.
The user sees the five bars advance, then the source types itself once, and a rejected artifact
is never displayed at all.

Costs: the run feels slower for the one path where the model is also the slowest part, and the
typing animation moves to a phase that currently does no typing. The engine's `previewSource`
call at `:1401` has to become suppressible without disturbing the other five call sites.

**Option B — verify independently, keep the preview, mark it provisional.** The preview stays
where it is, but it is visibly labelled as unverified draft until `apply` commits, and the
pipeline's `verify` does the real work: independently re-run the schema validation, the
deterministic compile, the sample execution, and the visual-contract check against the produced
artifact — **not** a re-read of the engine's own critic verdict, which is the limit R16 named in
its array-template check and stated it was not claiming to have solved.

Costs: the user still sees model source that may be withdrawn, and "provisional" is a label the
user has to notice. The independent re-verification is the larger piece of work and duplicates
computation the engine already did.

**T0's reading, not binding:** B's verify with A's ordering, if both fit in one turn — but if
they do not, **take B's verify and leave the ordering alone**. The reason is that ordering is a
UX question with a working rollback behind it, while the verify is the thing R18 was named for
and the thing no route has yet delivered for a model artifact. Shipping A alone would move a
weak check earlier; shipping B alone gives the system its first genuine gate on model-authored
output. Say which you took, and if you take both, say which one you would have dropped.

## Acceptance Criteria

1. The handoff states the option taken and, in one paragraph, what the `verify` phase for
   `model-authored` actually recomputes — naming each check and its independent source of
   truth. If a check re-reads an engine verdict rather than recomputing, say so explicitly, as
   H16 did.
2. **A test proves `verify` rejects a bad model artifact.** Construct one — a `ProgramSpecV1`
   that validates but whose sample run disagrees with the declared visualization mapping, or
   whose trace is empty — and prove the pipeline refuses it. A test that only proves the good
   path passes does not meet this criterion.
3. **The rollback is proven for the rejection in criterion 2.** After the refusal, the
   workspace equals the pre-run snapshot: `algorithmName`, `code`, `steps`, `currentIndex`,
   `analysis`, `inputError`. Field by field, not "looks unchanged".
4. If ordering changed: a test proves `previewSource` is not called before `verify` completes
   for `model-authored`, and **is** still called at its current point for at least one
   deterministic template. If ordering did not change, state that and skip this criterion by
   name.
5. `applyPackage` is still counted exactly-once for all five branches, including
   `model-authored`. Re-run R16's counting test and report the numbers.
6. `adapt-input` and the array-template pipeline are untouched. Name the R15 and R16 tests
   that prove it.
7. The stubbed-agent unit tests and `npm run test:e2e:ai` results are reported with what
   model was loaded. If `test:e2e:ai` cannot run on your machine, say so plainly and name what
   is unproven rather than substituting a stub result for it.
8. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`.
9. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
   Claude's to close, and it does **not** cover the model-authored path — say what it does
   cover.
10. Two commits, in order: `route(R18): close`, then `handoff(H18): record`, both signed `-s`
    after verifying `git config user.email` returns `iyott131@gmail.com`. An optional published
    `fix(R18)` between them is permitted.

**(T0)** The `AGENTS.md` wording for `previewSource`, preview ordering, and model-authored
pipeline coverage is Claude's, in `## T0 reconciliation`.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "a2f91cb..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'previewSource'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'applyPackage\('

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'new Function|eval\('

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third command is criterion 4's evidence — run it against the base first and report the
delta. The fifth and sixth must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## T0 reconciliation

**Verdict: closed.** Both options taken — B's verify with A's ordering, which is what the
route hoped for and did not require. Head `ba5f74a`, CI run `33064313461`, all three jobs
green.

### Remote gate (criterion 9)

```
71 passed (4.8m)
2 passed (43.7s)
TIMELINE_MEASUREMENTS {"playwright":{"min":1037.6330650000018,"median":1180.7438069999998,"max":1333.7629120000006},"inPage":{"min":166.70000000001164,"median":188.35000000000582,"max":299.79999999998836},"handler":{"min":0.5,"median":0.7999999999883585,"max":1.1999999998952262},"deliberateDelayMs":0}
```

Zero flaky. `handler.median` 0.8 ms against R15's 10 ms gate.

**What the browser gate covers for this route, stated as the criterion required.** More than
I expected when writing it. `e2e/model-authored-titan-mode.spec.ts` stubs `navigator.gpu` and
the agent worker, feeding a fixed `ProgramSpecV1` through the real orchestration. So the
remote gate does cover the model-authored *wiring* — routing, pipeline ordering, verification,
commit, and the grounded answer — end to end in a browser. What it does not cover is a real
model producing that program. That distinction is the whole of criterion 7, and H18 states it
plainly: `test:e2e:ai` ran, found no WebGPU adapter, and skipped before loading anything. **No
live inference has been proven on this machine.** Recorded as unproven, not as passed.

### The verify is genuinely independent, and its limit is worth writing down

`verifyModelAuthoredArtifact` recompiles the package from the artifact's own `program`,
`input`, and `visualization` and compares `source`, `steps`, and `tests.results`. That is the
R15 shape, not the R16 shape — it recomputes rather than re-reading the engine's verdict, and
R18 was named for exactly this.

Its ceiling: it proves the artifact **is what its program deterministically produces**. It
cannot prove the program solves the request. Nothing in the system can, and the danger now is
the opposite of the one R15 found — a gate strong enough that its name starts to imply more
than it does. `AGENTS.md` says so at the point of description.

### Criterion 4 is met, and the handoff under-cited it

H18 cites `titanPipeline.test.ts:271` for criterion 4. That test proves only the
model-authored half — `previewSource` undefined into the engine, `['produce','preview','apply']`
ordering out of it. No unit test asserts the second half, that a deterministic template still
previews at its old point; `startArrayTemplatePipeline` gets it by spreading `...options`, and
"by construction" is precisely what R16 disproved for `deferApply`.

The evidence exists anyway, and is better than the unit test the criterion asked for.
`e2e/dp-family-titan-mode.spec.ts:148` asserts `.titan-mode-code-typing` is visible and
growing **while `.titan-mode-agent.running` still reads `Üret`** — a deterministic DP template
previewing during produce, user-visibly, in an unmodified spec that passed on this head.
Criterion 4 closes on that. Not reopened; recorded so the next reader does not re-derive it.

### Criterion 3 proves something slightly different from what it asked

The route asked that after a rejection the workspace equals the pre-run snapshot. The test at
`titanPipeline.test.ts:354` asserts the workspace object was never mutated and that
`previewSource` was never called. That is not the rollback firing — it is the rollback being
unnecessary, which is the stronger result and a direct consequence of taking option A. Worth
naming because "rollback proven" and "nothing to roll back" are different claims, and only the
second is true here. The restore path still exists and still covers the deterministic
templates, which do preview early.

### The executor change nobody asked for, found by a test

A failed pipeline left later phases `waiting`, leaving the UI disabled;
`titan-mode-failures.spec.ts` caught it and `executeTitanPipeline` now terminalizes unreached
phases as `cancelled`. This touches every intent that runs the pipeline, not just this one. It
is listed under `## Discovered` and not under `## Deviations`, which is the wrong file — a
behaviour change to shared code outside the route's stated objective is a deviation even when
it is an improvement. Accepted as correct and in scope; the filing is noted, not held against
the turn.

### Architecture map

`AGENTS.md` updated in this commit: the `titan/` entry adds `model-authored`; a new paragraph
records `previewSource` as the second workspace channel, the rollback that makes it safe, and
the deliberate split between model-authored ordering and deterministic ordering; the per-intent
`verify` list gains `model-authored` with its stated ceiling; and the "everything else" list is
corrected now that no successor route is pending against it.
