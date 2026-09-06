# R21 — a fallback is not a verdict

## Özet

`callOptionalAgent` bir ajan çağrısı için üç ayrı durumda aynı dizgeyi döndürür: model yok,
çağrı hata attı, ya da model cevap verdi. Çağıranlar bu dizgeyi ayırt etmeden `job.summary`'ye
yazar ve kullanıcı onu ajanın adı ve "completed" rozetiyle görür. Kritiğin durumu daha ağır:
model paketin yanlış olduğunu düz metinle söylediğinde bu cevap sessizce yutuluyor ve iş
"Deterministic tests passed." özetiyle geçiyor.

Bu tur bir güvenlik açığı kapatmıyor — R18'in `verify`'ı model yazımı paketi bağımsız olarak
yeniden derliyor ve o gerçek kapı yerinde. Bu tur **kaydın yalan söylemesini** durduruyor.
R20'nin `reviewer` ayrımının aynısı, bu kez çalışma günlüğünde.

## Objective

Make an advisory agent's output carry its own provenance, and stop a critic's refusal from
being recorded as a pass.

### The measurement

Taken at `05e3307` with a temporary probe against `startTitanModeRun`, three runs. Verbatim
output — thirteen job rows plus two critic rows:

```
A status success
A | completed | manager          | manager-decompose-request                        | The request was deterministically split into validated specialist stages.
A | completed | scout            | scout-inspect-live-workspace                     | Custom Code; 0 steps; input=array
A | completed | architect        | architect-design-algorithm-contract              | Selected the validated deterministic jump-game-dp contract.
A | completed | code-author      | code-author-author-executable-program            | Authored the source-mapped jump-game-dp implementation.
A | completed | input-engineer   | input-engineer-build-original-teaching-input     | Resolved explicit input or selected a bounded branch-rich teaching input.
A | completed | visual-designer  | visual-designer-design-semantic-visual-language  | Array states expose reachable positions or the greedy farthest frontier.
A | completed | layout-engineer  | layout-engineer-resolve-responsive-graph-layout  | Scroll-safe array layout selected for every bounded input size.
A | completed | compiler         | compiler-compile-source-and-trace                |
A | completed | critic           | critic-test-visual-and-trace-alignment           | 9 deterministic source-mapped states passed.
A | completed | manager          | manager-apply-workspace-transaction              |
A | completed | trace-director   | trace-director-direct-live-teaching-checkpoints  | 9 grounded checkpoints prepared.
A | completed | result-analyst   | result-analyst-ground-final-result-analysis      | The simulation completed in 9 validated steps.
A | completed | tutor            | tutor-prepare-five-lens-live-tour                |
B status success
B critic: completed | Deterministic package tests passed. | error:
C status success
C critic: completed | Deterministic tests passed.
```

**A** — intent `create-algorithm:jump-game-dp`, no `agentRunner`. This is the production
deterministic-template path: `useAdvisoryModel` is false (`titanEngine.ts:643`), so
`callOptionalAgent` returns its `fallback` argument at `:764` without touching a model. Nine of
the thirteen rows carry per-agent prose. **No agent ran.** `TitanModeProgress.tsx:288` renders
`job.summary` as the row's text and its tooltip, under the agent's translated role name, beside
a completed badge. Nothing in the row says the sentence was written by a `JSON.stringify`
literal in the engine.

**B** — intent `create-algorithm:model-authored`, an `agentRunner` whose `critic` promise
rejects with `model exploded`. Every other role answers normally. The run succeeds; the critic
job is `completed`, its `error` is empty, and its summary is the fallback's own words,
`Deterministic package tests passed.` The catch at `:767-769` converts the failure into that
string and the caller cannot tell it apart from an answer.

**C** — same intent, the critic returns
`The package looks WRONG, the trace disagrees with the visual.` The run succeeds and the critic
job reads `Deterministic tests passed.` `safeJsonObject` (`:337-345`) returns `null` on
unparseable text, and the guard at `:1516` is `if (parsed?.passed === false)`, which `null`
does not satisfy. **A critic that refuses in prose is recorded as a critic that passed.**

### What the run log actually establishes, and what it claims

The deterministic gates immediately above the model critic are real and they run first
(`:1505-1506`): `packageValue.tests.passed` and a non-empty `teachingPlan.checkpoints`. Those
throw. So on run A the *content* of the critic's sentence is not false — deterministic tests
did pass. The defect is attribution, not fact: thirteen agent rows are presented for a run in
which zero agents were consulted.

On runs B and C the content is false as well. The package there was authored by a model, the
sentence says "Deterministic", and in C an actual objection was discarded to produce it.

### What this is not

Not a hole in the model-authored commit path. R18's `verifyModelAuthoredArtifact` recompiles
the package from the artifact's own program and rejects a mismatch, and it is outside the
engine, so a fail-open critic does not let a malformed artifact through the pipeline. The
critic's opinion has never been the thing that made that path safe.

It does matter for `predict-winner-interval-dp`, `bidirectional-bfs`, and
`lcs-space-optimized-1d-dp`, which do not run the pipeline at all. There the model critic is
the only gate above the deterministic tests, and runs B and C show it cannot refuse.

### The category error

The same one R19 and R20 found, one layer further out. `callOptionalAgent` is named for its
optionality and returns a `string`, so the type system offers the caller no way to ask which of
the three situations produced it. A function that cannot express "I did not run" will be read
as having run.

## Turn

- `Turn.holder`: T0-delegated implementer
- `Turn.base`: `05e3307`
- `Turn.branch`: `main`

Before writing anything: `git merge-base --is-ancestor 05e3307 HEAD` must exit 0, and
`git diff --name-only 05e3307..HEAD` must list only T0-owned paths. If either fails, do not
write; report the mismatch.

## Expected Files

A forecast, not a gate.

- `src/services/titanEngine.ts` — `callOptionalAgent`'s return shape, its call sites, the
  critic guard.
- `src/types/titan.ts` — the provenance field on `ManagerJobV1` and `AgentRunEventV1`.
- `src/components/TitanModeProgress.tsx` — rendering it.
- `src/i18n/translations.ts` — EN and TR strings for it.
- `src/services/titanEngine.test.ts` — the three probe cases as permanent tests.
- `src/components/TitanProgress.test.tsx` — the rendered marker.

## Invariants

- No `eval`, no `new Function`, no `Math.random`, no wall-clock branching.
- The trace never comes from the model; the model never computes an index.
- Every new user-facing string ships EN and TR.
- Do not invent colors or measurements — `teknesyum-ui` is not installed here. Reuse an
  existing class and token, or a text marker. If neither fits, say so in `## Deviations`
  rather than choosing a hex value.
- Do not weaken the two deterministic gates at `:1505-1506`. They stay above the critic.
- The pipeline's own `verify` functions are not in scope. Do not touch
  `src/services/titan/titanPipeline.ts`.
- No frozen or T0-owned path is written: `.claude/**`, `.agents/AGENTS.md`, `docs/tasks/**`,
  `docs/legacy/**`, `CodeXray-readme-neon.svg`, `docs/TITAN_MODE_YOL_HARITASI.md`,
  `docs/titan/routes/**`, `AGENTS.md`.

## The decision

**Option A — provenance plus a fail-closed critic.** `callOptionalAgent` returns
`{ source: 'model' | 'fallback'; text: string }`. `ManagerJobV1` gains an optional
`provenance: 'model' | 'deterministic'` that `setJob` writes at each advisory site;
`TitanModeProgress` renders it as a short EN/TR marker on the row. The critic guard becomes:
if `source === 'fallback'`, keep today's behaviour and mark the row deterministic; if
`source === 'model'` and `safeJsonObject` returns `null`, **throw** — a model that answered
unintelligibly has not approved anything.

Cost: one signature and its ~14 call sites, one type field, one render branch, two string
pairs, three tests. Mechanical; the call sites all follow the same shape.

Risk: the throw in C's situation turns a silently-successful run into a visible failure for
users on weak local models. That is the intended direction but it is a behaviour change for
`bidirectional-bfs` and the two other non-pipelined templates, and it should be stated in the
handoff with the retry count that surrounds it.

**Option B — provenance only.** Same discriminated return and the same row marker; the critic
guard is left exactly as it is. Cost is about two thirds of A. Fixes the attribution defect in
runs A and B; leaves C — the critic that refuses and is recorded as passing — standing.

**Option C — critic only.** The `:1516` guard becomes fail-closed on a model answer; nothing is
plumbed. Cheapest. Fixes C, leaves A and B: the run log still presents thirteen agents for a
model-free run.

**T0 reading, not binding: A.** B and C each fix one half of one defect and both would need the
same call sites reopened later; the shared cost is the signature change, and paying it once is
cheaper than twice. Take C alone only if measurement shows the fallback marker cannot be
rendered without inventing a token, in which case say so and route the rest.

## Acceptance Criteria

1. `callOptionalAgent` returns a value from which the caller can distinguish a model answer
   from a fallback. Every call site is updated; none discards the discriminant silently.
2. A deterministic-template run with no `agentRunner` marks every advisory job as
   deterministic, and the marker reaches `job.provenance` (or the chosen equivalent) on the
   published plan. A unit test asserts it for `jump-game-dp`.
3. A model-authored run whose `critic` call rejects records the critic job as fallback-sourced.
   A unit test reproduces probe B and asserts the marker.
4. (Option A or C) A model-authored run whose `critic` returns unparseable text does **not**
   succeed. A unit test reproduces probe C and asserts the run fails with a message naming the
   critic. If Option B is taken, this criterion is instead met by stating in `## Deviations`
   that C remains open and why.
5. The marker is rendered in `TitanModeProgress` in EN and TR, using an existing class or
   token. A component test asserts both locales.
6. The two deterministic gates at `titanEngine.ts:1505-1506` are unchanged and still run before
   the critic. Show the lines.
7. `npm run lint`, `npm run test`, `npm run build` pass. `npm run desktop:check` if
   `src-tauri/**` changed.
8. e2e passes. No new e2e spec is required by this route; if one is added, justify it.
9. (T0) The handoff states, in its own words, that this route does not close a commit-path
   hole and says which paths the critic change actually affects.
10. No frozen or T0-owned path is written. `git diff --name-only 05e3307..HEAD` proves it.
11. Every commit is DCO-signed as `Mustafa Özel <iyott131@gmail.com>`; confirm
    `git config user.email` before the first commit.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git config user.email

git diff --name-only "05e3307..HEAD"

git diff --stat "05e3307..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'callOptionalAgent'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'parsed\?\.passed'

Get-Content src\services\titanEngine.ts | Select-Object -Skip 1500 -First 40

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'new Function|eval\('

npm run lint

npm run test

npm run build
```

The fifth and sixth are criteria 1 and 4's evidence — run them against the base first and
report the delta. The seventh is criterion 6. The last two must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## T0 reconciliation

**Closed.** Option A. Close `8b3b188`, handoff `cc61056`, both DCO-signed
`iyott131@gmail.com`, neither touching a frozen or T0-owned path — `git diff --name-only
05e3307..HEAD` lists nine files, all in `src/**` or `docs/titan/`. Remote CI on `cc61056` —
run `34053797901`, `quality`, `desktop`, and `browser` all green. T0 re-ran `lint`, `test`
(`850 passed`, 119 files), and `build` (all budgets inside) locally; the verification below is
T0's own reading of the diff and was not taken from the handoff.

**Held by a delegated implementer, not Sole.** Sole's session state was unknown and the user
released the turn.

### The implementation is sharper than the route asked for

The route asked for provenance meaning *did a model answer*. What shipped means *did the
adopted content come from a model*, which is the more useful of the two and the harder one to
get right. Four sites write the discriminant by hand instead of calling `provenanceOf`:
`:1046`/`:1050` (architect — `model` only when the parsed contract was actually used, otherwise
the deterministic fallback contract), `:1375`, `:1443`, and `:1621` (`useGenerated ? 'model' :
'deterministic'`). So a job where the model answered and the answer was thrown away is marked
`deterministic`, correctly. Deviation 5 files this as a deliberate non-use of the helper; it is
the substance of the turn, not a deviation from it.

`runJob` writes `target.provenance ?? 'deterministic'` on completion, so a job that never
adopted anything is marked rather than left blank, and `adopt` cannot be forgotten silently at
a new call site — the row would simply read "no agent".

### The route's measurement contained an error, and the implementer said so

R21's `### The measurement` claims `TitanModeProgress.tsx:288` "renders `job.summary` as the
row's text and its tooltip". It does not. `AiAssistant.css:964-966` sets
`.agent-summary { display: none; }`, so the sentence reaches the user only through the
hover/focus tooltip built by `jobDetails` and through the row's accessible name. I verified
this myself before accepting the handoff's claim.

The finding is unharmed — a tooltip and an accessible name that attribute an engine literal to
"Code Author" are the same misattribution — but the route overstated where it surfaces, and the
right response was the one taken: report it in `## Discovered` and put the new marker in both
places rather than quietly matching the wrong description.

### My verification command went stale inside its own turn

Deviation 2 is my error, not the implementer's. `Get-Content ... | Select-Object -Skip 1500
-First 40` was written against base line numbers; the diff moved the two deterministic gates
from `1505-1506` to `1549-1550`, so the window no longer contained what criterion 6 asked it to
show. The command was still run verbatim and the evidence supplied from a wider window. A
line-window command in a `## Verification` block is fragile by construction — future routes
should grep for the assertion text, never for a line range.

### What the new critic throw does and does not establish

It rejects an **unreadable** answer, not an unapproving one. `answer.source === 'model' &&
!parsed` throws only when `safeJsonObject` returns `null`; a model that returns `{}` — valid
JSON, no `passed` key — still passes, because `parsed?.passed === false` is false. The guard is
"the critic said something readable", not "the critic approved". That is the same shape as
R17c's `Data` lens: says nothing false, not says everything true. Do not describe this gate as
approval in any later document.

The throw also lands before `manager-apply-workspace-transaction` (`:1549` critic, `:1578`
apply), so a rejected run has not touched the workspace on the non-pipelined branches either.

### Criteria

All eleven met. Criterion 4 is met by a real reproduction: `titanEngine.test.ts` runs probe C
against `model-authored` with a critic that answers in prose and asserts the run rejects with
`/Critic returned an unreadable answer/` and the critic job ends `failed`. Probes A and B are
permanent tests too, so the three measurements that opened this route are now the three that
guard it.

The behaviour change is stated where the route asked for it, with the surrounding retry count:
there is **no** retry around the critic, so a weak local model answering the critic prompt in
prose turns a previously-silent success into a visible failed run on the first occurrence, on
`bidirectional-bfs` and its non-pipelined siblings. That is the intended direction. Whether a
bounded critic retry belongs there is a later decision, not a defect of this one.

### The e2e timeout sightings are now four

Deviation 3 reports `titan-mode.spec.ts:22` and `ai-actions.spec.ts:112` timing out on two full
local runs before a green one, with the base green under the same command and both specs
passing in isolation. Added to `radio-controller.spec.ts` at H12 and H15, that is four local
timeout sightings across three specs and none on CI — `browser` is green here. Still not a
route. The next local timeout in any spec makes it one, and the first on CI makes it one
immediately.

### Still open after this route

Unchanged from R20: `predict-winner-interval-dp`, `bidirectional-bfs`,
`lcs-space-optimized-1d-dp`, and the other non-pipelined creation templates still commit
through `startTitanModeRun` with no caller that can refuse. R21 gave their critic the ability
to refuse; it did not give them a refusal point outside the engine. Those are different things
and this route deliberately did not conflate them.

Also pre-existing and untouched, recorded so a later determinism route is not surprised:
`titanEngine.ts:105` uses `Math.random` for `runId`. It is an identifier, not simulation or
trace state.
