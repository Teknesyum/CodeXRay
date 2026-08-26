# R15 — The phase named verify does not verify

## Özet

R07'den R14'e kadar beş rota girdi hikâyesini bitirdi ve `AGENTS.md` artık kodla birebir
uyuşuyor. R14'ün uzlaştırması sırasında boru hattının kendisi okundu ve iddia ile kod
ayrıştı: `verify` fazı içeriği denetlemiyor, yalnız sonucun boş olup olmadığına bakıyor.
Sistem yine de güvenli — ama güvenliği sağlayan şey `verify` değil, `produce`'un içinde
çalışan tipli yama doğrulayıcıları. Bu rota iddiayı koda ya da kodu iddiaya uydurur.

## Objective

`AGENTS.md` and `PROTOCOL.md` both state that the pipeline is route → produce → semantics →
verify → apply, and that `apply` runs only after `verify` returns ok. Both sentences are
true. The implication a reader draws from them — that an artifact is inspected before it
reaches the workspace — is not.

### Both verify phases are shape checks, measured

```
titanPipeline.ts:225  adapt-input
  verify: (result) => result.status === 'success' && result.input && result.steps?.length
            ? { ok: true } : { ok: false, reason: ... }

titanPipeline.ts:156  discuss-current-step
  verify: (result) => selectedStepExists && (result.summary.trim() || result.tutorAnswer?.trim())
            ? { ok: true } : { ok: false, reason: ... }
```

Neither reads the artifact's content. An adaptation that produced a well-formed input and a
non-empty trace passes `verify` no matter what that input or trace contains.

### `produce` is the whole engine, with its progress suppressed

`startAdaptInputPipeline` calls `startTitanEngineRun` with `deferApply: true` and
`onPlan: () => undefined`. So `produce` contains the engine's entire seven-job graph —
`manager → scout → input-engineer → compiler → critic → manager → tutor` — collapsed into
one phase, and the user sees five synthetic bars instead of the seven real jobs.

The engine's own critic for this path is also a shape check:

```
titanEngine.ts:958  critic-validate-input-and-trace
  if (!steps.length) throw new Error('The compatible input produced no trace.');
```

So there are two verification steps on the `adapt-input` path and neither inspects content.

### The guarantee is real, and it comes from somewhere else

This must not be lost when the gap is described. What actually rejects a bad adaptation is
`applyInputPatch`'s contract validation — the work of R10 through R14 — and it runs inside
`produce`, in the applier, before the artifact is ever returned. A malformed graph, an
undeclared parameter key, a wrong-typed value, an edge to a missing node: all rejected, all
tested.

So this is not a safety hole. It is a **provenance error in the architecture claim**: the
system is safe for reasons the documentation does not describe, and a reader trusting the
phase names would put a new artifact type behind `verify` and get nothing.

That matters concretely for what comes next. `create-algorithm` with
`template: 'model-authored'` is the one intent that puts model-authored source into the
workspace, and it has no pipeline at all. Extending the current seam to it would wrap it in
a phase that checks its result is non-empty.

### `apply` earns its name

The pipeline genuinely owns application: `deferApply: true` moves the workspace transaction
out of the engine, and `executeTitanPipeline` runs `apply` only after `verify` returns ok.
That half of the design works and this route must not damage it.

## Turn

- Route id: `R15`
- Base: `abd8d54` (`route(R14): reconcile and close`)
- Holder: `sole`
- Expected size: 3–8 files, 2 commits (`route(R15): close`, `handoff(H15): record`)

## Expected Files

| Path | Why |
|---|---|
| `src/services/titan/titanPipeline.ts` | The verify phase |
| `src/services/titan/titanPipeline.test.ts` | Follows its module |
| `src/services/input/inputPatch.ts` | Only if verification needs a pure re-check exposed |
| `src/services/input/inputPatch.test.ts` | Follows its module |
| `src/services/titanEngine.ts` | Only if the engine's critic changes |
| `src/services/titanEngine.test.ts` | Follows its module |
| `src/i18n/translations.ts` | Any new EN/TR failure messages |
| `e2e/**` | A spec proving a failed verification leaves the workspace untouched |
| `docs/titan/handoffs/H15-verify-does-not-verify.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Write what the criteria require inside your own ownership; justify
extras in `## Deviations`. Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no
route, no protocol file.

## Invariants

- **Scope is `adapt-input`.** `discuss-current-step` gets a written verdict, not code.
  `create-algorithm` is out of scope entirely and is named for a successor route.
- **`verify` never calls a model.** It is deterministic, it runs on the produced artifact,
  and it produces the same answer for the same artifact every time.
- **`verify` must be able to fail on a well-formed artifact.** A check that can only fail
  when `produce` already threw is not a verification. Prove it fails on something `produce`
  returns successfully.
- **A failed verify changes nothing.** Workspace, package, timeline, and current index stay
  identical — the existing guarantee, now exercised by a reachable failure.
- **Do not damage `apply`.** `deferApply` and the ordering stay exactly as they are.
- Determinism: no `Math.random`, no wall-clock branching.
- R10's array ops, R12's graph ops, R13-R14's parameters, the R06 translation flow, and
  `discuss-current-step` all keep working.
- **Do not regress the progress display.** If the five synthetic bars change, say what the
  user sees before and after.

## The decision

**Option A — make `verify` verify, by independent recomputation.** The artifact carries an
input and a trace. `verify` recomputes the trace deterministically from the artifact's input
and compares it to the trace the artifact carries. If they disagree, the artifact is
internally inconsistent and never reaches the workspace.

This is a real check because it is *independent*: `produce` derived the trace one way, and
`verify` derives it again from the committed input. It can fail on a well-formed artifact,
which is the property the current check lacks.

Costs: it recomputes the trace, so the `adapt-input` path does that work twice. Measure the
added time before and after on the same machine and state it — R11 established that a budget
without a measurement is not a budget. If the cost is unacceptable for large inputs, say so
with numbers and choose B rather than shipping a slow gate.

**Option B — make the claim match the code.** Keep the shape check, rename what it is in the
handoff's own words, and record that content safety is delivered by the typed appliers inside
`produce`. The five phases stay a progress and transaction structure — which is a coherent
and useful thing to be — and stop implying content inspection.

Costs: the pipeline's verify phase stays ceremonial, and the next artifact type placed behind
it gets no protection unless whoever adds it knows to bring its own. Say that plainly, and
say what `create-algorithm` would need.

**A third possibility, if the measurement points there:** the artifact could carry the
validation result that `applyInputPatch` already computed inside `produce`, and `verify`
could assert on it. That is cheaper than recomputation but weaker — it re-reads a decision
rather than re-deriving it. If chosen, say explicitly that verify is confirming produce's
work rather than checking it independently, so nobody later mistakes it for A.

**T0's reading, not binding:** A, if the recomputation cost measures small. The
`adapt-input` artifact is an input plus a trace and the deterministic tracer already exists;
this is the one place in the system where an independent second derivation is cheap and
meaningful. But B is a genuinely honest answer and is better than an A that is slow or that
only re-reads produce's own conclusion while claiming otherwise. Whichever is chosen,
`AGENTS.md` and `PROTOCOL.md` must end up describing what the code does — that reconciliation
is T0's, in `## T0 reconciliation`.

## Acceptance Criteria

1. The handoff states the decision, and states in one sentence what `verify` can now reject
   that it could not reject before. If the answer is "nothing", say so — that is option B and
   it is a valid outcome, not a failure.
2. **If A: verification fails on a well-formed artifact.** A test constructs an artifact that
   `produce` returns successfully and that `verify` rejects. Without this the criterion is
   not met by any amount of passing tests.
3. **If A: the added cost is measured**, before and after, on the same machine, on the
   largest input the `adapt-input` path accepts. Numbers, not adjectives.
4. A failed verify leaves workspace, package, timeline, and current index identical, proven
   by a test asserting object identity, and by an e2e spec showing the user-visible result.
5. `apply` still runs only after `verify` returns ok, and `deferApply` is unchanged. Prove
   with a test that ordering did not move.
6. `discuss-current-step` has a written verdict: what its `verify` could check, whether that
   check is deterministic, and the named route that would do it. No code.
7. `create-algorithm` has a written verdict naming the successor route and what that route
   would have to establish before a model-authored package could sit behind this phase.
8. The five-phase progress display is described before and after. If nothing changed, say so.
9. Behaviour preservation: every `adapt-input` request that succeeds today still succeeds.
   Name the tests, including at least one from each of R10, R12, R13, and R14.
10. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
    `npm run desktop:check`.
11. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
    Claude's to close.
12. Two commits, in order: `route(R15): close`, then `handoff(H15): record`, both signed
    `-s` after verifying `git config user.email` returns `iyott131@gmail.com`.

**(T0)** The `AGENTS.md` and `PROTOCOL.md` wording describing the pipeline is Claude's, in
`## T0 reconciliation`.

**Why this route and not the migration.** R13's reconciliation described this gap as "five of
seven intents bypass the pipeline" and proposed migration. Reading `titanPipeline.ts` showed
that description was wrong: the two intents that are on the seam are not verified either, so
migrating a third would spread the gap rather than close it. Make the seam mean something
first, then decide what else belongs behind it. This is the fourth time a queued objective
did not survive contact with the call path — R11, R12, R14, and now R15.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "abd8d54..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'deferApply'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third command is criterion 5's evidence. The fourth must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```
