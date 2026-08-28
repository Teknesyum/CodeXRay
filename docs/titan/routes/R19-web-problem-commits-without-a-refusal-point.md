# R19 — the one path that commits fetched content has no external refusal point

## Özet

R15–R18 boyunca dört giriş noktası pipeline'a alındı ve dördünde de `verify` gerçek bir
karşılaştırma yapıyor. Geriye kalanlar arasında bir tanesi diğerlerinden farklı: web problem
yolu. Girdisi internetten geliyor, işleyeni model, ve paketi **doğrudan** uyguluyor —
`AiAssistant.tsx:572`. Üstüne kalıcı depolamaya da yazıyor. Kapıları var ve bir tanesi
deterministik; eksik olan, dışarıdan bir hayır diyebilme noktası.

## Objective

Four entry points now run the five-phase pipeline: `adapt-input` (R15), the four deterministic
array templates (R16), `discuss-current-step` (R17c), and `model-authored` (R18). The remaining
committing paths were dismissed together in `AGENTS.md` as "gates live in the engine's own job
graph". That sentence is true and it flattens a real difference.

### The measurement

`AiAssistant.tsx:546` handles `solve-web-problem`, and it forks:

```
:556  if (!problem.simulationCompatibility.compatible)      -> startJavaFallbackRun
:572      applySimulationPackage(translatedPackage, run.runId)
:594      saveBoundWebSource(nextSession)
:611  else                                                   -> normal engine prompt path
```

The incompatible branch is the one worth a route. Its chain is
`AiAssistant.tsx` → `webProblemOrchestrator.startJavaFallbackRun` → `titan/translate.ts`, and
it commits at `:572` with no `deferApply`, no pipeline, and no caller that can refuse.

### It is not ungated, and the strongest gate is real

Stating this first because the route is not "this path is unsafe":

- `validateJavaCandidate` and `validateTranslationEnvelope` — schema validation on model output.
- `translateToVerifiedPackage` (`titan/translate.ts:46`) — `validateProgramSpec`, then
  `compileCustomSimulationPackage`, then `if (!packageValue.steps.length ||
  !packageValue.tests.passed) throw`. Deterministic, and it earns the word *verified* in its
  name. This is the same class of gate R18 built.
- `previewSource` never runs for a web problem: `AiAssistant.tsx:830` returns early on
  `webProblemForSimulation`. So unlike R18, no unverified source is ever displayed.

### What is different, and it is two things

**The critic here is a model judging itself.** `validateReview` parses the model's own review
and `review.passed` decides whether the run continues. Every other committing path's final gate
is deterministic — the engine's critic checks `tests.passed`, a non-empty trace, and a `result`
variable. On this path a model writes the verdict that gates a package built from content
fetched off the internet. The deterministic translate gate runs *after* it and catches a
program that does not compile or whose tests fail; it cannot catch a program that compiles
cleanly and solves the wrong problem, which is exactly what a lenient self-review lets through.

**It writes persistent state.** `saveBoundWebSource` at `:594` stores a `SolutionArtifactV1`
carrying the review. No other committing path persists anything, so this is the only one whose
failure survives a reload.

### Why this is the last route of its kind

`create-catalog-problem`, `clarify-algorithm`, `ui-control`, `deterministic`,
`bidirectional-bfs`, and the interval/DP families also commit outside the pipeline. All of them
operate on first-party deterministic material. This is the only path where **untrusted external
content and model authorship meet in the same artifact**, which is why it goes first and
possibly alone.

### A stale line, corrected in this commit

`AGENTS.md` said `translate.ts` had "no production caller yet". It has had one since the web
reader shipped — `webProblemOrchestrator.ts:18`. The map is corrected in the same commit that
opens this route; the error was mine and it is the reason this path went unexamined for four
routes.

## Turn

- Route id: `R19`
- Base: `c9e2c43` (`route(R17c): reconcile and close`)
- Holder: `sole`
- Expected size: 4–8 files, 2 commits (`route(R19): close`, `handoff(H19): record`)

## Expected Files

| Path | Why |
|---|---|
| `src/services/titan/titanPipeline.ts` | A web-problem entry point and its verify |
| `src/services/titan/titanPipeline.test.ts` | Follows its module |
| `src/services/webProblemOrchestrator.ts` | Deferring the apply, if that is the shape chosen |
| `src/services/webProblemOrchestrator.test.ts` | Follows its module |
| `src/components/AiAssistant.tsx` | The dispatch at `:556` and the persist at `:594` |
| `src/i18n/translations.ts` | Any new EN/TR strings |
| `e2e/**` | A spec driving a stubbed agent worker through the fallback |
| `docs/titan/handoffs/H19-*.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no route, no
protocol file.

## Invariants

- **Only the requested URL may leave the browser.** Nothing this route adds may send cleaned
  content, prompts, attempts, or workspace state anywhere. Re-assert it; do not assume it.
- **Never persist raw HTML, and never execute Java.** The Java artifact is reviewed material,
  not a program to run.
- **Nothing is persisted before it is verified.** If the apply moves behind a gate, so does
  `saveBoundWebSource`. A stored `SolutionArtifactV1` for a package that was refused is worse
  than the defect this route is about.
- **The deterministic translate gate stays exactly as it is.** `validateProgramSpec`, compile,
  non-empty trace, `tests.passed` — do not weaken, do not merge into something else.
- **Exactly once.** Whatever moves, the package is applied once. R16's counted property is the
  standard.
- `adapt-input` (R15), the array templates (R16), `discuss-current-step` (R17c), and
  `model-authored` (R18) keep their verify behaviour exactly.
- Determinism: no `Math.random`, no wall-clock branching. The trace never comes from the model.
- The compatible branch at `:611` is out of scope this turn unless touching it is unavoidable;
  if it is, say why in `## Deviations`.

## The decision

**Option A — put the Java fallback behind the pipeline.** `startJavaFallbackRun` gains
`deferApply`; the pipeline's `verify` recompiles the package from the translated program the
way `verifyModelAuthoredArtifact` does, and `apply` commits both the package and the persisted
session. R18's mechanism is reused rather than reinvented.

Costs: the orchestrator's job graph and the pipeline's five bars have to coexist without the
user seeing two progress displays, which is the problem R16 solved for the array templates and
will have to be solved again here for a longer graph.

**Option B — make the model critic non-decisive.** Leave the apply where it is; add a
deterministic check that runs after the translation and before the commit, comparing the
package against the problem's own worked examples from the fetched source. `review.passed`
becomes advisory text rather than a gate.

Costs: it depends on the examples being extractable from arbitrary fetched content, which is a
parsing problem on untrusted input and may simply not be available for many sources. If the
examples cannot be extracted the check silently does nothing, which is the failure mode this
whole line of routes exists to remove — so it would need an explicit "no examples available"
state that the user can see.

**T0's reading, not binding:** A, because it is the mechanism that already exists and the one
whose properties are proven; the value is a caller that can refuse, and that is exactly what is
missing. B is the better *idea* — comparing against the source's own examples is the only thing
in this route that could catch a cleanly-compiling wrong answer — but it rests on extraction
from untrusted content, and a gate that quietly no-ops when extraction fails is not a gate. If
the handoff finds worked examples are reliably present in `problem.simulationCompatibility` or
the cleaned source, say so with the measurement and take B, or take both. Do not take B alone
with a silent fallback.

## Acceptance Criteria

1. The handoff states the option taken and what the `verify` phase recomputes, naming each
   check's independent source of truth — the form H16, H18, and H17c used.
2. **A test proves a bad web artifact is refused**, and names what makes it bad. If the answer
   is that only a non-compiling or empty-trace package can be refused, say that in the first
   sentence rather than implying more.
3. **Nothing is persisted on refusal.** A test proves `saveBoundWebSource` is not called and no
   `codexray.*` storage key changes when `verify` rejects.
4. **The workspace is unchanged on refusal**, field by field, as R18's criterion 3 required.
5. **Exactly once on success.** Count `applySimulationPackage` for both outcomes.
6. The network invariant is re-asserted by test: only the requested URL leaves the browser on
   this path. Name the existing `privacy-network.spec.ts` assertions if they already cover it,
   or extend them.
7. `adapt-input`, the array templates, `discuss-current-step`, and `model-authored` are
   untouched. Name the R15, R16, R17c, and R18 tests that prove it.
8. A user-visible e2e spec drives a stubbed agent worker through the fallback and shows what
   the user gets on both outcomes. **This criterion may not close on a unit test.**
9. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`.
10. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
    Claude's to close.
11. Two commits, in order: `route(R19): close`, then `handoff(H19): record`, both signed `-s`
    after verifying `git config user.email` returns `iyott131@gmail.com`. An optional published
    `fix(R19)` between them is permitted.

**(T0)** The `AGENTS.md` wording for the web-problem paths is Claude's, in
`## T0 reconciliation`.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "c9e2c43..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'applySimulationPackage\('

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'saveBoundWebSource'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'new Function|eval\('

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third and fourth are criteria 3 and 5's evidence — run them against the base first and
report the delta. The fifth and sixth must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```
