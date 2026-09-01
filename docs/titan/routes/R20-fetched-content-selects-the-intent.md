# R20 — the fetched page chooses the intent

## Özet

R19 uyumsuz web kolunu pipeline'ın arkasına aldı ve rotanın metni "bu türden son yol" dedi.
O cümle bana ait ve yanlış. Uyumlu kol — yani normal durum — aynı buluşmayı barındırıyor,
üstelik daha erken bir yerde: **niyeti seçen regex'in girdisi, indirilen sayfanın metni.**
Ölçtüm; sayfadaki kelimeler `ui-control`, `adapt-input` ve pipeline'sız şablonlar dahil
kapalı kümenin herhangi bir üyesini seçebiliyor.

## Objective

`AiAssistant.tsx:647` sets `webProblemForSimulation`, then `:648` builds `modelQuestion` with
`buildWebProblemPrompt`, which serializes the fetched `title`, `description`, `inputFormat`,
`outputFormat`, `examples`, `constraints`, `notes`, and `signature` into one string
(`webSource.ts:392`). At `:689` that same string — not the user's message — is handed to
`routeTitanModeRequest`.

`routeTitanModeRequest` is a deterministic keyword router written for text a user typed. It
now regex-matches a document.

### The measurement

Ran on `ce0f5b2` against the shipped `buildWebProblemPrompt` and `routeTitanModeRequest`,
with the production instruction string and an empty step list:

```
neutral ("Two Sum", "Return indices.")               -> adapt-input
"Predict the Winner" / "Classic interval dp problem" -> create-algorithm:predict-winner-interval-dp
"Word Ladder" / "Use bidirectional BFS ..."          -> create-algorithm:bidirectional-bfs
"Radio Signals" / "The radio must play a tone."      -> ui-control:radio-play
"Grid" / "Change the input data to expand the grid." -> adapt-input
"Jump Game" / "Solve and simulate the jump game."    -> create-algorithm:jump-game-dp
```

Four separate facts fall out of that table.

**1. The page can select a UI action.** A fetched problem whose text contains *radio* and
*play* turns "solve this problem" into `ui-control: radio-play`. The user asked for a
solution and the page opened the player.

**2. The page can select a template that has no external refusal point.** The dispatch ladder
at `:929` gives a pipeline to exactly four intents: `discuss-current-step`, `adapt-input`, the
array templates, and `model-authored`. Everything else falls to `startTitanModeRun` and
commits at `:889`. `predict-winner-interval-dp`, `bidirectional-bfs`, and
`lcs-space-optimized-1d-dp` are all reachable from page text and all land there.

**3. The ordinary case does the wrong thing.** A neutral problem page routes to `adapt-input`.
The generic input rule matches because the serialized payload carries `inputFormat` and the
instruction carries *create*. So the common path of "solve this bound web problem" mutates the
workspace input instead of producing a solution — a plain behavioural defect, gated by R15's
verify and therefore invisible to every gate we have.

**4. The persisted review is a literal.** `:977` writes
`review: { passed: true, summary, findings: [] }` into a `SolutionArtifactV1` whose `kind` is
`validated-simulation`. On the fallback path the same field carries a real critic verdict
(`webProblemOrchestrator.ts:361`). One field, two meanings, and a reader of stored state
cannot tell which it is holding.

### What this is not

No code executes. Nothing new leaves the browser — only the requested URL was ever fetched,
and the router runs locally on already-fetched text. Every downstream artifact is still
schema-validated, deterministically compiled, and non-executing, and R15/R18 still gate the
intents they own. The blast radius is workspace state and one UI action, all reversible.
State it in those terms; do not write this up as an escape.

### The category error

The closed intent set is right and stays. `EXTERNAL_WEB_CONTENT_BEGIN` exists precisely
because fetched text is data — and then the router reads straight past the delimiter it was
given. The selector's input is the defect, not the selector.

## Turn

- Route id: `R20`
- Base: `b80f667` (`route(R19): reconcile and close`)
- Holder: `sole`
- Expected size: 3–6 files, 2 commits (`route(R20): close`, `handoff(H20): record`)

## Expected Files

| Path | Why |
|---|---|
| `src/components/AiAssistant.tsx` | The router call at `:689` and the review literal at `:977` |
| `src/services/titanModeRouting.ts` | Only if the fix belongs in the router rather than its caller |
| `src/services/titanModeRouting.test.ts` | Follows its module |
| `src/types/webSource.ts` | Only if the review field needs an honest shape |
| `src/i18n/translations.ts` | Any new EN/TR strings |
| `e2e/**` | A spec driving a bound web problem whose text carries a routing keyword |
| `docs/titan/handoffs/H20-*.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no route,
no protocol file.

## Invariants

- **Only the requested URL may leave the browser.** Unchanged, re-asserted by test.
- **Never persist raw HTML, never execute Java.** Unchanged.
- **The closed intent set stays closed.** No new intent strings, no free-form routing.
- **The fetched problem still reaches the model.** This route changes what selects the intent,
  not what the model is asked. `buildWebProblemPrompt` keeps its delimiters and its payload.
- R19's fallback pipeline, R15 `adapt-input`, R16 array templates, R17c `discuss-current-step`,
  and R18 `model-authored` keep their verify behaviour exactly.
- Determinism: no `Math.random`, no wall-clock branching. The trace never comes from the model.
- **Exactly once.** Whatever moves, the package is applied once.

## The decision

**Option A — route from the user's words, never from the page.** At `:689` pass `userMessage`
to `routeTitanModeRequest` instead of `modelQuestion`, and decide explicitly what a bound web
solve routes to when the user's own message names no algorithm. `model-authored` is the
obvious default: it is the intent that means "author a program for this problem", and R18
already gates it.

Costs: a user who *does* name a template ("solve this with interval dp") still reaches a
non-pipelined branch — this route does not close fact 2's gap, it only stops the page from
opening it. Say that in the handoff rather than implying more. The default choice is a
product decision and must be stated, not slipped in.

**Option B — filter the intents the web branch may reach.** Keep the current selector, discard
any routed intent outside a permitted creation set. Cheaper and it kills facts 1 and 2.

Costs: fact 3 survives only in the sense that a neutral page would now fall back to the
permitted default anyway, so B and A converge on the common case while B leaves the page still
choosing *which* template. And a filter is a denylist maintained beside a router that keeps
growing rules; the next rule added to `titanModeRouting.ts` is reachable from page text again
until someone remembers this file.

**T0's reading, not binding:** A. The router was built to read a person's sentence, and the
fix is to give it one. B guards the symptom at the boundary and leaves the coupling in place,
which is the shape this route line has reopened three times already. If the handoff finds that
`userMessage` is empty or useless on this path — for instance when the solve is triggered by a
button rather than typed text — say so with the measurement and take B, naming the default it
falls back to.

Fact 4 is separate from both options and is not optional: a persisted `review` must either
carry a verdict something actually produced, or say that no critic ran.

## Acceptance Criteria

1. The handoff states the option taken and **what now selects the intent on this path**, in one
   sentence, with the default named explicitly.
2. **A test proves page text cannot select an intent.** Re-run the six rows in `## The
   measurement` as a test and record the routed intent for each, before and after. The radio row
   is named explicitly so the regression has a reproduction that outlives this turn.
3. **The neutral case routes to a creation intent**, and the handoff says which and why.
4. **Fact 4 is fixed.** A persisted `SolutionArtifactV1` never carries a fabricated
   `passed: true`. Show the new shape and what a reader can now conclude from it.
5. Fact 2's remaining gap is stated plainly: which templates still commit without an external
   refusal point, and that a user who names one still reaches them. **Do not close this
   criterion by claiming the gap is gone.**
6. The network invariant is re-asserted by test: only the requested URL leaves the browser.
7. R15, R16, R17c, R18, and R19 verify behaviour untouched — name the test in each case.
8. A user-visible e2e spec drives a bound web problem whose text carries a routing keyword and
   shows what the user gets. **This criterion may not close on a unit test.**
9. All four gates clean: `npm run lint`, `npm run test`, `npm run build`, `npm run desktop:check`.
10. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
    Claude's to close.
11. Two commits, in order: `route(R20): close`, then `handoff(H20): record`, both signed `-s`
    after verifying `git config user.email` returns `iyott131@gmail.com`. An optional published
    `fix(R20)` between them is permitted.

**(T0)** The `AGENTS.md` wording for the web routing boundary is Claude's, in
`## T0 reconciliation`.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "b80f667..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'routeTitanModeRequest\('

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'passed: true'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'new Function|eval\('

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third and fourth are criteria 1 and 4's evidence — run them against the base first and
report the delta. The fifth and sixth must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```
