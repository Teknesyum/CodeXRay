# R07 — Adapt-input moves onto the seam

## Özet

`adapt-input` bugün canlı ama eski gövdede: `titanEngine.ts:792`, serbest kullanıcı
metninden sezgisel türetme. Aynı işin gen-2 tasarımı `inputPatch.ts` — kapalı, şema
doğrulamalı yazım kümesi — sıfır çağrıyla duruyor. Bu rota `adapt-input`'u R04'ün beş fazlı
dikişine taşır ve `inputPatch.ts`'in kaderini karara bağlar: ya uygulama katmanı olur ya
silinir. İki tasarımın yan yana, ilişkisiz yaşaması bu rotanın başarısızlığıdır.

## Objective

Two things, one turn, because they are the same decision seen from two sides:

1. `adapt-input` becomes the **second intent** carried by `executeTitanPipeline`, the way
   R04 carried `discuss-current-step`. The seam has survived three turns with one intent;
   the protocol's reason for existing is that the pipeline, not the legacy engine body,
   is where verification and apply are governed.
2. `src/services/input/inputPatch.ts` — 259 lines, zero callers since T12 — is either the
   typed apply-layer of that seam, or deleted. It is the last dead module from the T10-T14
   era except `translate.ts`'s test-only siblings; R06 wired one, R05 deleted one, and this
   route closes the ledger.

### The two designs, measured at this route's base

**Shipped:** `titanModeRouting.ts:220-229` classifies three phrasings into
`{ type: 'adapt-input' }`; `titanEngine.ts:792-860` derives a new input from the request
text via `adaptSimulationInputFromRequest` heuristics, special-cases two program ids
inline (`spiral_matrix`, `predict_winner_interval_dp`), recompiles, and applies. It works,
it is tested, and users exercise it today.

**Dead:** `inputPatch.ts` defines `InputPatchV1`, a closed union of eleven ops
(`set-array`, `resize-array`, `sort-array`, `shuffle-array`, `set-text`, `set-param`,
`set-target`, `graph-add-node`, `graph-add-edge`, `graph-remove`, `load-preset-input`),
with `parseInputPatch` rejecting anything malformed, `applyInputPatch` enforcing the
input contract, and `applyAndRecompileInputPatch` recompiling atomically — on failure the
original package is returned untouched.

Reverse-reference grep over `src/` and `e2e/`: **nothing outside the module itself
references any of its four exports.** Deleting it cannot reach production code. Wiring it
can.

Note what the dead design is: it is the architecture `AGENTS.md` already mandates.
"The model never computes an index; it selects from a closed set" — `InputPatchV1` *is*
that closed set for input mutation. The shipped path feeds raw request text into
heuristics; the gen-2 path would have a model (or the deterministic router) emit a typed
op that is schema-validated before anything moves. The principles favour the dead code.
That alone does not decide the route — shipped-and-working beats principled-and-dead by
default — but it means option B below is not the automatic answer it was in R05.

## Turn

- Route id: `R07`
- Base: `b4f9ae4` (`handoff(H06): record`)
- Holder: `sole`
- Expected size: 6–12 files, 2 commits (`route(R07): close`, `handoff(H07): record`)

## Expected Files

| Path | Why |
|---|---|
| `src/services/titan/titanPipeline.ts` | The second seam entry, alongside `startDiscussCurrentStepPipeline` |
| `src/components/AiAssistant.tsx` | The intent dispatch that chooses the pipeline entry |
| `src/services/input/inputPatch.ts` | Wired or deleted, per the decision |
| `src/services/input/inputPatch.test.ts` | Follows its module, if one exists or is added |
| `src/services/titanEngine.ts` | Only the `adapt-input` branch, only if the decision moves logic out of it |
| `src/services/titanModeRouting.ts` | Only if classification needs to carry patch details |
| `src/services/titanModeRouting.test.ts` | Follows its module |
| `src/types/titan.ts` | The `adapt-input` member, only if it gains a payload |
| `e2e/**` | A spec proving adapt-input still works through the seam |
| `docs/titan/handoffs/H07-adapt-input-on-the-seam.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**This list is a forecast, not a gate.** Write what the criteria require inside your own
ownership; justify every file outside the forecast in `## Deviations`. Frozen and T0-owned
paths remain absolute — no `AGENTS.md`, no route, no protocol file.

`translate.ts`, `webProblemOrchestrator.ts`, and everything under `src/services/trace/`
are expected untouched this turn.

## Invariants

- **Behaviour first.** Every input-adaptation request that works today works after,
  with the same resulting input. This route moves where the work happens; it does not
  change what the work produces. The two inline special cases (`spiral_matrix`,
  `predict_winner_interval_dp`) keep working, wherever their logic ends up living.
- The five-phase order — route → produce → semantics → verify → apply — is untouched.
  `apply` runs only after `verify` returns ok, and a failed verify leaves the workspace
  exactly as it was. `applyAndRecompileInputPatch`'s return-original-on-failure shape is
  the model for this, whether or not that function survives.
- `discuss-current-step` keeps flowing through the R04 seam unchanged.
- The trace never comes from the model; the model never computes an index. If a model is
  given the patch vocabulary, it selects ops from the closed set and every op is
  `parseInputPatch`-validated before touching anything.
- No new intent. `adapt-input` already exists; this route moves it, not the set.
- Determinism: no `Math.random`, no wall-clock branching. `shuffle-array` is seeded and
  `random-seeded` fill is deterministic per seed — keep them that way.

## The decision

Choose one, and justify it in the handoff against what the other would cost.

**Option A — inputPatch becomes the seam's apply-layer.** The pipeline's `produce` phase
yields a validated `InputPatchV1` (from the deterministic router's own parse where the
request is unambiguous, from the model only where it is not), `verify` checks the
recompile result, `apply` commits it. The engine's `adapt-input` branch shrinks or
delegates. This is the gen-2 architecture actually landing.

Costs: the heuristics in `adaptSimulationInputFromRequest` must be mapped onto typed ops
without behaviour change, and the two special-cased programs need explicit handling. That
mapping is real work with real regression risk, which is what the behaviour-first
invariant and the e2e criterion are for.

**Option B — the engine path is the contract; inputPatch is deleted.** `adapt-input`
still moves onto the seam, but as a thin wrapper around the existing engine branch, the
way R04 wrapped `discuss-current-step`. `inputPatch.ts` goes the way of `titanRouter.ts`.

Costs: the closed-op architecture the docs mandate stays unimplemented for input
mutation, permanently — deleting the module is deciding the principle, not just the file.
The handoff must say that out loud, and the intent-set paragraph's claim about closed
vocabularies keeps meaning "for intents" and stops meaning "for mutations".

**T0's reading, not a binding instruction:** A is worth attempting first. R05's delete was
right because `titanRouter` duplicated a *classifier* that already existed in better
shape; here the dead module is the *better* shape — validated, atomic, closed — and the
live path is the heuristic one. If the mapping proves riskier than the measurement
suggests, a justified B with the wrapper seam is a valid outcome; the seam move happens
either way.

## Acceptance Criteria

1. `adapt-input` requests enter `executeTitanPipeline` in production: shown as the
   dispatch site plus the pipeline entry, `file:line` each.
2. `## Call path` is filled: user request to applied input, every hop `file:line`, naming
   the e2e spec that traverses it.
3. **Behaviour is preserved, proven end to end.** An e2e spec drives a real
   input-adaptation request through the UI and asserts the resulting input and rebuilt
   timeline. If a spec covering this exists, extend or cite it; if not, write it.
4. The two special-cased programs still adapt correctly — one test each naming
   `spiral_matrix` and `predict_winner_interval_dp` behaviour explicitly.
5. A failed adaptation changes nothing: workspace, package, and timeline are untouched,
   proven by a test that submits an impossible request and asserts identity.
6. The `inputPatch.ts` decision is implemented and stated. If A: `parseInputPatch`
   validates every op on the path, shown by test. If B: the module and its references are
   gone, the test count move is stated, and the handoff names the architectural claim
   being given up.
7. `discuss-current-step` still flows through its seam — the existing e2e assertion,
   unmodified.
8. No free-form mutation strings: if ops exist, grep shows every op literal lives in the
   union declaration, its parser, or a test.
9. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`.
10. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
    Claude's to close.
11. Two commits, in order: `route(R07): close`, then `handoff(H07): record`, both signed
    `-s` after verifying `git config user.email` returns `iyott131@gmail.com`. A published
    `fix(R07): ...` between them is permitted when remote evidence forces it.

**(T0)** Documentation follow-through — the architecture map's `inputPatch.ts` line and
the titan `AGENTS.md` seam count — is Claude's, in `## T0 reconciliation`.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "b4f9ae4..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'applyAndRecompileInputPatch|parseInputPatch|applyInputPatch'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'startDiscussCurrentStepPipeline|executeTitanPipeline'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third command is criterion 6's evidence — under A it shows the production path, under
B it shows nothing. The fourth is criterion 1's and must show the new adapt-input entry
beside the R04 one.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this
run created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## Rollback

`git reset --hard b4f9ae4` only when the working tree holds nothing else worth keeping,
and record the decision in `## Deviations`.

## Out of Scope

- Adding intents, or moving any third intent onto the seam.
- Rewriting `titanEngine.ts` beyond the `adapt-input` branch, or `titanEntry.ts` at all.
- `translate.ts` and the web-problem flow — R06 closed them; do not revisit.
- Model-driven patch generation beyond what the decision strictly needs. If A lands with
  the deterministic router alone emitting ops, that is complete; model emission can be a
  later route.
- Every `AGENTS.md` file — T0-owned, criteria there are marked **(T0)**.
- Pushing to `origin`. The remote half of criterion 10 belongs to T0.

## T0 reconciliation

Handoff `H07` recorded at `954f150`, closing `ea4c07f`. **Option A** was chosen. Claude
re-ran the gates and greps independently; every claim held.

| Claim in H07 | Independent result |
|---|---|
| `npm run lint` clean | clean |
| `npm run test` | `Test Files 119 passed (119)`, `Tests 759 passed (759)` |
| `npm run build` | `Initial JavaScript: 416.7 / 420.0 KiB`, under budget |
| `adapt-input` enters the pipeline | `AiAssistant.tsx:902` → `titanPipeline.ts:178,214` |
| the R04 seam is unchanged | `AiAssistant.tsx:887` → `titanPipeline.ts:110,146` |
| both commits signed | two `Signed-off-by: Mustafa Özel <iyott131@gmail.com>` trailers |

`desktop:check` was not re-run — `src-tauri/**` is absent from the diff; the handoff's 7/7
stands. The count moved 753 → 759 with six new tests backing new behaviour claims.

**A grep of mine was wrong, and the record should say so.** Checking criterion 6, Claude
grepped for `parseInputPatch` outside `input/inputPatch.ts`, found nothing, and briefly read
that as the criterion failing. It was the wrong instrument. `parseInputPatch` is called from
`createInputReplacementPatch` *inside* the same module, and that wrapper is called from
`titanEngine.ts:833` — so the parser does gate every adaptation. This is the exact
zero-callers-versus-zero-production-callers distinction R05 added to the protocol, arriving
from the other direction: an internal call that is nonetheless on the production path. The
rule needs no change; the reader did.

The production chain, verified by reading rather than grepping:

```
AiAssistant.tsx:902  startAdaptInputPipeline
titanPipeline.ts:214 executeTitanPipeline
titanEngine.ts:833   createInputReplacementPatch
inputPatch.ts        parseInputPatch     (throws on malformed)
titanEngine.ts:847   applyInputPatch     (enforces the input contract)
```

`deferApply` is the mechanism that makes the seam real rather than decorative: the engine
stops applying and hands the transaction to the pipeline's `apply` phase, so mutation now
happens after `verify` returns ok instead of inside the engine body.

**What did not land, recorded so no future route assumes it did.** Criterion 6 is met as
written — `parseInputPatch` validates every op on the path — but the path is narrower than
"every adaptation goes through a closed patch op" suggests. `createInputReplacementPatch`
can emit exactly five ops (`set-graph`, `set-matrix`, `set-array`, `set-text`, and a
`load-preset-input` fallback), all wholesale replacements carrying a value the existing
heuristics derived first. The eight semantic ops stay validated-but-unreachable, and
`applyAndRecompileInputPatch` still has no production caller.

That is not a shortfall against this route. R07's invariant was behaviour-first and its
`## Out of Scope` explicitly said deterministic-router-only emission was complete. But the
closed vocabulary is currently a validation envelope around a heuristic result rather than
the mutation vocabulary it was written to be, and a document that let "Option A landed"
stand unqualified would be claiming more than the code does. That is the failure R05 spent a
whole turn undoing.

**T0 documentation, done in this turn.** `src/services/titan/AGENTS.md` now reads
`STATUS: three seams live` and names `adapt-input` since R07. The architecture map's
`inputPatch.ts` line in `AGENTS.md` now states both what became reachable and what did not,
including the unwired export by name.

**Successor opened.** `R08 — The semantic ops become reachable` takes the gap above as its
subject: make the semantic ops reachable from real requests in both languages, or shrink the
union to what is honest. `applyAndRecompileInputPatch` gets a verdict there.

## Remote closure

Criterion 10's remote half is closed. Both commits are pushed to `main`. Run `32881017681`
on `954f150`, all three jobs `success`:

```
quality  success
desktop  success
browser  success
```

**And the flake threshold fired.** The `browser` job reported:

```
  1 flaky
    [chromium] > e2e/titan-mode-clarification.spec.ts:3:1
  67 passed (6.8m)
  2 passed (1.0m)
```

Same spec, same line, same failure text as `b4f9ae4` — `getByLabel(...)` not visible within
5000ms at line 27. Two consecutive commits.

R06's reconciliation set the threshold in writing: *"if this spec flakes again on any commit,
it opens a route of its own. Not a timeout bump, not a retry allowance — a diagnosis, on
R02's terms. One occurrence is watched; two is a defect with a name."* It flaked again, so
that is what happens. The threshold existed precisely so this would not be re-argued now that
it is inconvenient, with a finished route already drafted and a green checkmark available to
hide behind.

**R07 still closes as met.** Criterion 10 asked for a passing remote gate and the gate
passed; the flake belongs to R08, not to this route's ledger. Recording it as a clean green
would be the dishonesty R02 existed to end.

**The queue changed.** `R08 — The semantic ops become reachable` was written and is now
requeued as `R09` in `docs/titan/routes/queued/`, base unstamped. `R08` is instead the
clarification diagnosis. Ordering the gate ahead of the feature is the same call R02 made
over the pipeline wiring: while the gate is untrustworthy, every later route's e2e criterion
means less than it claims.
