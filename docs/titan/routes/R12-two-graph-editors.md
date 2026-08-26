# R12 — The graph editor has two implementations

## Özet

R10 üç dizi op'unu ulaşılabilir yaptı ve geriye beş op bıraktı: `set-param`, `set-target`,
`graph-add-node`, `graph-add-edge`, `graph-remove`. Ölçüm bunların yalnızca "ulaşılamaz"
olmadığını gösterdi — dördünün **ulaşılabilir ve tipsiz bir ikizi var**. Grafik istekleri
bugün `applyStructuralGraphRequest` tarafından, kendi regex'leriyle, `parseInputPatch`
doğrulamasına hiç uğramadan uygulanıyor. Bu rota iki uygulamayı tek bir uygulamaya indirir.

## Objective

Not "make the remaining ops reachable" — that was the guess. The measurement says something
sharper: the closed op union and an older ad-hoc editor **both** implement graph mutation,
and the ad-hoc one is the one users reach.

### The two implementations, measured at this route's base

Production path, `adapt-input`, graph input:

```
titanEngine.ts:802         isVisualOnlyGraphRequest(options.request)
titanEngine.ts:838         adaptSimulationInputFromRequest
inputRequestAdapter.ts:95  graph/tree -> returns the current input unchanged, on purpose
titanEngine.ts:854         spreadGraphLayout            (visual-only branch)
titanEngine.ts:859         applyStructuralGraphRequest  (structural branch)
inputPatch.ts:~96          parseInputPatch  <- sees only the finished document, as set-graph
```

`graphRequestEdits.ts` is 166 lines with its own request parsing: `requestedNodeCount`,
`requestedNodeId`, `requestedRemovalIds`, `requestedAnchorBelow`, `requestsDoubleComplexity`,
`requestedConnections`. Between them they implement add-node, add-edge, remove-node, and
set-target — the same four things the union declares as `graph-add-node`, `graph-add-edge`,
`graph-remove`, and `set-target`.

The two differ in one way that matters. The typed applier enforces the contract:

| Case | `applyInputPatch` | `applyStructuralGraphRequest` |
|---|---|---|
| edge to a missing node | rejects (`inputPatch.test.ts:149`) | `continue`, silently |
| target set to a missing node | rejects (`inputPatch.test.ts:151`) | falls back to another node (`graphRequestEdits.test.ts:60`) |
| removal below the node floor | contract-checked | `continue`, silently |

So the reachable implementation is the permissive one, and the strict one is the decoration.
`set-graph` validates the finished document afterwards, which catches a malformed graph but
never catches a misunderstood request.

### Reverse-reference grep (PROTOCOL requirement, re-run at this route's base `2a1071f`)

```text
src/services/gm2Contracts.test.ts:6,131,138        applyStructuralGraphRequest, spreadGraphLayout
src/services/graphRequestEdits.test.ts:4-7,30-111  all three exports, 9 assertions
src/services/titanEngine.ts:34,802,854,859         the only production caller
```

No `e2e/**` or `src-tauri/**` reference. Production callers: one file, three call sites.
The grep is byte-identical at `2e33d8d` and at this route's base `2a1071f`; R11 changed no
product code, so nothing about this measurement moved between drafting and opening.

Still with zero production callers after R10: `set-param`, `set-target`, `graph-add-node`,
`graph-add-edge`, `graph-remove` — five of eleven ops.

## Turn

- Route id: `R12`
- Base: `2a1071f` (`handoff(H11): record`)
- Holder: `sole`
- Expected size: 4–9 files, 2 commits (`route(R12): close`, `handoff(H12): record`)

## Expected Files

| Path | Why |
|---|---|
| `src/services/graphRequestEdits.ts` | The ad-hoc editor's fate |
| `src/services/graphRequestEdits.test.ts` | Follows its module |
| `src/services/input/inputPatch.ts` | Where a graph request becomes a typed op, if that is the choice |
| `src/services/input/inputPatch.test.ts` | Follows its module |
| `src/services/titanEngine.ts` | Only the `adapt-input` graph branch |
| `src/services/titanEngine.test.ts` | Follows its module |
| `src/services/gm2Contracts.test.ts` | Only if its two call sites move |
| `src/i18n/translations.ts` | Any new EN/TR strings |
| `e2e/**` | A spec proving a graph edit works end to end |
| `docs/titan/handoffs/H12-two-graph-editors.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Write what the criteria require inside your own ownership; justify
extras in `## Deviations`. Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no
route, no protocol file.

## Invariants

- **Behaviour first.** Every graph request that works today still works. Where the strict
  contract now rejects something the permissive editor used to accept, that is a behaviour
  change: name it, show the user-visible result, and argue it is an improvement. Do not let
  a silent `continue` become a silent throw.
- The nine assertions in `graphRequestEdits.test.ts` describe real accepted behaviour,
  including the Turkish phrasings `17. nolu nodu kaldır`, `1 nolu node'un aşağısına bir node
  ekle`, and `inputumuzu 2 kat karmaşıklaştır`. They are a behaviour spec, not scaffolding.
  If the module moves, they move with it; if they change, the handoff says why per case.
- `isVisualOnlyGraphRequest` and `spreadGraphLayout` are layout, not mutation. They are not
  op candidates and are out of scope unless the route's choice forces them.
- Node ID changes must atomically update edges and root/start/target references — the
  standing `AGENTS.md` data contract. A typed op path must honour it exactly as the ad-hoc
  path does.
- The deterministic router decides. A model may not compute a node id, a count, or a weight.
- Determinism: no `Math.random`, no wall-clock branching.
- Five phases untouched; `apply` only after `verify` returns ok.
- `discuss-current-step`, the R06 translation flow, and R10's three array ops keep working.

## The decision

**Option A — one editor, typed.** `graphRequestEdits.ts`'s request parsing emits a sequence
of typed ops (`graph-add-node`, `graph-add-edge`, `graph-remove`, `set-target`), each
`parseInputPatch`-validated and applied by `applyInputPatch`. `graphRequestEdits.ts` keeps
the request-recognition it already has and loses the mutation it duplicates. Graph editing
gains contract enforcement it does not have today.

Costs: a multi-op request ("iki node ekle, hedefi değiştir") needs a defined transaction —
all ops apply or none do. Requests that used to half-succeed now either fully succeed or
fully fail, and the user must be told which.

**Option B — one editor, ad-hoc.** Delete `graph-add-node`, `graph-add-edge`, `graph-remove`,
and `set-target` from the union. `applyStructuralGraphRequest` becomes the single honest
graph editor and `set-graph` stays its validation envelope. The union shrinks to seven ops
and stops claiming a mutation vocabulary it does not own for graphs.

Costs: gives up contract enforcement on graph edits permanently, and the permissive
behaviours in the table above become the specification rather than a defect. Say that out
loud if choosing it, and state what happens to the four `inputPatch.test.ts` blocks at
lines 71-90, 132-138, and 149-151.

**T0's reading, not binding:** A. The two implementations disagree on error handling, and
the reachable one is the permissive one — that is the wrong way round for a system whose
whole claim is that nothing untyped reaches the workspace. But A is only worth it if the
multi-op transaction is real; a per-op apply that leaves a graph half-edited on failure is
worse than what exists today. If that transaction turns out not to fit inside one turn, B
is the honest answer and this route accepts it.

`set-param` is out of scope either way. It has no ad-hoc twin, it is the only remaining op
with no duplicate, and it is a separate question. Give it a verdict sentence, not code.

## Acceptance Criteria

1. The handoff states the decision and, if A, exactly which ops became reachable and how a
   multi-op request is made atomic.
2. Each op that becomes reachable is produced by a real user request in **both** English and
   Turkish, one classifier test per op per language.
3. **End to end, not unit only.** An e2e spec drives a graph edit through the UI and asserts
   the resulting graph document and rebuilt timeline.
4. Behaviour preservation, case by case: every assertion in `graphRequestEdits.test.ts` is
   accounted for — still passing, moved, or changed with a stated reason. A table, not prose.
5. The three divergences in `## Objective`'s table have a stated resolution each, and the
   chosen behaviour is asserted by a test.
6. A failed op leaves the graph exactly as it was — same nodes, same edges, same target,
   same timeline — proven by a test asserting identity, including the multi-op case if A.
7. `set-param` has a written verdict: a named future route or a deletion, no code either way.
8. No op literal outside the union declaration, its parser, its applier, or a test.
9. Only one implementation of graph mutation remains. Prove it with a grep, pasted verbatim.
10. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
    `npm run desktop:check`.
11. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
    Claude's to close.
12. Two commits, in order: `route(R12): close`, then `handoff(H12): record`, both signed
    `-s` after verifying `git config user.email` returns `iyott131@gmail.com`.

**(T0)** The architecture-map lines describing `inputPatch.ts` reachability and, if A removes
it, `graphRequestEdits.ts` are Claude's, in `## T0 reconciliation`.

**On the measurement that opened this route.** R12 was queued as "make the remaining five ops
reachable." Reading the code changed the question: four of the five already have a working
untyped implementation on the production path. A route written from the op list alone would
have asked Sole to build a second graph editor beside the one that already exists. Check the
call path before trusting a route's own summary, this one included.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "2a1071f..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern "op: '"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'applyStructuralGraphRequest|applyAndRecompileInputPatch|createInputReplacementPatch|createSemanticArrayPatch'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third command is criterion 8's evidence — every match must sit in the union, parser,
applier, or a test. It matches the suffix of `loop: '` and the trace collection's `op` field;
those false positives exist at base and H10 already recorded them. The fourth is criterion
9's evidence. The fifth must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```
