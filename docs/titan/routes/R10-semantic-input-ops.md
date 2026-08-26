# R10 — The semantic ops become reachable

## Özet

R07 `adapt-input`'u dikişe taşıdı ve her uyarlamayı `parseInputPatch` doğrulamasından
geçirdi — ama üretimde yalnız beş op'a ulaşılabiliyor, hepsi de "girdiyi bütünüyle değiştir"
biçiminde. Kapalı birliğin asıl anlamı olan altı semantik op (`resize-array`, `sort-array`,
`shuffle-array`, `set-param`, `set-target`, üç `graph-*`) doğrulanmış ama ulaşılamaz duruyor.
Bu rota onları ya kullanıcının erişebileceği hale getirir ya da birlikten çıkarır.

## Objective

Close the gap R07 left on purpose. `InputPatchV1` declares eleven ops; the production path
can construct five, and all five are wholesale replacements. The route that wired the union
was explicit that model-driven op emission was out of scope, so this is a planned successor,
not a defect being cleaned up after the fact.

The user-facing question is concrete: today "diziyi 10 elemana çıkar" and "diziyi tersten
sırala" are answered by re-deriving an entire new input from request text through
`adaptSimulationInputFromRequest` heuristics, then wrapping the result in a `set-array`
envelope. The union already contains `resize-array` and `sort-array`, which say exactly
those two things, deterministically and without re-deriving anything.

### What R07 actually landed, measured at this route's base

The production chain is real:

```
AiAssistant.tsx:902  startAdaptInputPipeline
titanPipeline.ts:214 executeTitanPipeline
titanEngine.ts:833   createInputReplacementPatch
inputPatch.ts:~96    parseInputPatch      (validates, throws on malformed)
titanEngine.ts:847   applyInputPatch      (enforces the input contract)
```

`parseInputPatch` genuinely gates every adaptation. The narrowness is elsewhere:
`createInputReplacementPatch` can only emit `set-graph`, `set-matrix`, `set-array`,
`set-text`, or a `load-preset-input` fallback — one op per input kind, each carrying a
fully-formed replacement value that the heuristics produced first.

So the closed vocabulary currently functions as a **validation envelope around a
heuristic result**, not as the mutation vocabulary. Both are worth having; only the second
was the point of writing the union.

Still with zero production callers after R07:

| Export | Where |
|---|---|
| `applyAndRecompileInputPatch` | `inputPatch.ts:278` — test-only |

Ops declared but unreachable in production: `resize-array`, `sort-array`, `shuffle-array`,
`set-param`, `set-target`, `graph-add-node`, `graph-add-edge`, `graph-remove`.

## Turn

- Route id: `R10`
- Base: `5f27c87` (`handoff(H09): record`)
- Holder: `sole`
- Expected size: 5–11 files, 2 commits (`route(R10): close`, `handoff(H10): record`)

## Expected Files

| Path | Why |
|---|---|
| `src/services/input/inputPatch.ts` | The op set, and `applyAndRecompileInputPatch`'s fate |
| `src/services/input/inputPatch.test.ts` | Follows its module |
| `src/services/titanModeRouting.ts` | Where a request becomes a typed op, if that is the choice |
| `src/services/titanModeRouting.test.ts` | Follows its module |
| `src/services/titanEngine.ts` | Only the `adapt-input` branch |
| `src/services/titanEngine.test.ts` | Follows its module |
| `src/services/titan/titanPipeline.ts` | Only if the produce phase's shape changes |
| `src/i18n/translations.ts` | Any new EN/TR strings |
| `e2e/**` | A spec proving a semantic op works end to end |
| `docs/titan/handoffs/H10-semantic-input-ops.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Write what the criteria require inside your own ownership; justify
extras in `## Deviations`. Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no
route, no protocol file.

## Invariants

- **Behaviour first, again.** Every request that adapts input correctly today still does,
  producing the same input. A semantic op replacing a heuristic must produce byte-identical
  results for the cases the heuristic already handled, or the handoff names the difference
  and argues it is an improvement rather than a regression.
- The deterministic router decides. A model may not compute a count, an index, or a seed;
  if a model participates at all it selects an op from the closed set and every field is
  `parseInputPatch`-validated before anything moves.
- Determinism: `shuffle-array` stays seeded, `random-seeded` fill stays deterministic per
  seed. No `Math.random`, no wall-clock branching.
- Five phases untouched; `apply` only after `verify` returns ok; a failed verify leaves the
  workspace exactly as it was.
- `discuss-current-step` and the R06 translation flow keep working unchanged.
- Both the EN and TR phrasings of any newly-recognized request must be recognized. This
  product is used in both languages and `titanModeRouting.ts` already classifies Turkish.

## The decision

**Option A — make the semantic ops reachable.** `titanModeRouting.ts` (or a deterministic
parser beside it) recognizes the requests that map cleanly onto existing ops and emits a
typed op instead of falling through to whole-input re-derivation. Start with the ops whose
meaning is unambiguous — `resize-array`, `sort-array`, `shuffle-array` are the obvious
three; `set-target` and the `graph-*` ops are a judgement call. The heuristic path stays as
the fallback for everything not recognized.

Costs: request recognition in two languages, and every recognized phrasing is a behaviour
change risk for a request that already worked.

**Option B — shrink the union to what is reachable.** Delete the unreachable ops and
`applyAndRecompileInputPatch`. `InputPatchV1` becomes an honest five-member replacement
vocabulary, and the architecture claim shrinks to match the code.

Costs: gives up the closed-op mutation design permanently for input, the same way B in R07
would have. Say that out loud if choosing it.

**T0's reading, not binding:** A, scoped tightly — the three array ops, both languages, with
the heuristic fallback intact. That is a real user-visible improvement with a bounded blast
radius, and it converts the union from decoration into mechanism. Do not attempt all eight
unreachable ops in one turn; `set-param` and the graph ops can be their own route or their
own option-B deletion later. A justified B is valid, and so is A-with-a-different-three if
the measurement points elsewhere.

Whatever is chosen, `applyAndRecompileInputPatch` gets a verdict: wired, deleted, or
explicitly deferred with the route number that will decide it.

## Acceptance Criteria

1. The handoff states the decision and, if A, exactly which ops became reachable and which
   deliberately did not.
2. Each newly-reachable op is produced by a real user request in **both** English and
   Turkish, one classifier test per op per language.
3. **End to end, not unit only.** An e2e spec drives at least one semantic op through the
   UI and asserts the resulting input and rebuilt timeline.
4. Behaviour preservation: the requests that worked before still work. Name the tests that
   cover the previously-heuristic phrasings and show them passing.
5. An unrecognized adaptation request still falls through to the existing path and works —
   proven by a test, so the fallback is not silently lost.
6. A malformed or contract-violating op changes nothing: workspace, package, and timeline
   untouched, proven by a test asserting identity.
7. `applyAndRecompileInputPatch` has a verdict: a production caller, a deletion with the
   test-count move stated, or a named future route.
8. No op literal outside the union declaration, its parser, its applier, or a test.
9. Determinism shown: the same seeded request twice produces the same input, asserted in a
   test rather than argued in prose.
10. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
    `npm run desktop:check`.
11. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
    Claude's to close.
12. Two commits, in order: `route(R10): close`, then `handoff(H10): record`, both signed
    `-s` after verifying `git config user.email` returns `iyott131@gmail.com`.

**(T0)** The architecture-map line describing `inputPatch.ts` reachability is Claude's, in
`## T0 reconciliation`.

**Requeued twice, and both gates are now honest.** The clarification flake took R08; the
intermittent unit suite took R09. Both were the same defect — an unchosen `5000 ms` default
applied to work that legitimately needed longer — one at the Playwright layer and one at the
Vitest layer. Both now carry budgets with stated provenance and margin.

That matters for this route specifically. R10's criteria rest on `npm run test` and
`npm run test:e2e`, and two turns ago neither meant the same thing on two machines. They do
now: five consecutive clean unit runs on the machine where the suite had never once passed,
and three same-commit browser runs at zero flaky. This is the first feature route since R07
whose evidence is worth what it claims.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "5f27c87..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern "op: '"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'applyAndRecompileInputPatch|createInputReplacementPatch'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third command is criterion 8's evidence — every match must sit in the union, parser,
applier, or a test. The fifth must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## Rollback

`git reset --hard 5f27c87` only when the working tree holds nothing else worth keeping, and
record the decision in `## Deviations`.

## Out of Scope

- Adding intents, or moving a third intent onto the seam.
- Model-driven op emission. The deterministic router decides in this route; a model-assisted
  path is a later decision with its own criteria.
- All eight unreachable ops at once. Scope to what can be proven in one turn.
- `translate.ts`, the web-problem flow, `titanEntry.ts`, and `src/services/trace/**`.
- Every `AGENTS.md` file — T0-owned; such criteria are marked **(T0)**.
- Pushing to `origin`. The remote half of criterion 11 belongs to T0.

## T0 reconciliation

Written by Claude after verifying H10, pushing, and running the remote gate.

### Criterion 11, remote half — **closed**

`git push origin main` moved `85146de..2e33d8d`. CI run `32958195410` on head `2e33d8d`:

```text
desktop completed success
quality completed success
browser completed success
```

Browser gate, phase one: `68 passed (6.8m)`, zero flaky. Phase two: `1 flaky`, `1 passed
(1.9m)`. The flaky spec is `performance-budget.spec.ts`, not a spec R10 touched; it is
recorded below and it is what opens R11.

### The architecture-map line — **reconciled**

`AGENTS.md`'s `inputPatch.ts` entry claimed the semantic ops were validated-but-unreachable
and that `applyAndRecompileInputPatch` had no production caller. Both were true when R10
opened and neither is true now. The entry now names `createSemanticArrayPatch` as the
classifier, the three array ops as reachable since R10 through `titanModeRouting.ts` and
`titanEngine.ts`, `applyAndRecompileInputPatch` as their production applier, the heuristic
adapter as the surviving fallback, and `set-param`, `set-target`, and the three `graph-*`
ops as still unreachable.

`src/services/titan/AGENTS.md` needs no change. Its `STATUS: three seams live` describes
which intents reach `executeTitanPipeline`; R10 widened what `adapt-input` can express
inside a seam that was already live since R07, so the seam count is unchanged.

### Verifying criterion 8's empty grep — a correction to the reader, not the rule

`grep -rn "resize-array\|sort-array\|shuffle-array" src/` excluding tests and
`input/inputPatch.ts` returns nothing. Read carelessly that says the ops are still
unreachable. Read correctly it is criterion 8 being satisfied: the literals are confined to
the union, its parser, and its applier, and production reaches them through
`createSemanticArrayPatch`, which `titanModeRouting.ts:118` and `titanEngine.ts:818` call.

This is the second time an absence-grep nearly produced a false verdict here — R07 had the
same shape with `parseInputPatch`. The rule that survives both: **an empty grep for an
identifier proves nothing about reachability when the module deliberately encapsulates that
identifier.** Follow the call path instead.

### Recorded, not acted on

- `handler.median` in the performance spec is ~1.2 ms while the asserted `inPage.median` is
  230–407 ms. R11 carries this.
- `graphRequestEdits.ts` implements add-node, add-edge, remove-node, and set-target with its
  own regexes, on the production path, bypassing `parseInputPatch` entirely. Four of the five
  ops R10 deliberately deferred therefore have a reachable untyped twin. Drafted as
  `routes/queued/R12-two-graph-editors.md`.
