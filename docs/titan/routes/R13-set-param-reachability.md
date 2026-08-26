# R13 — The assistant cannot change what the user can

## Özet

R12 grafik mutasyonunu tek uygulamaya indirdi ve `set-param`'ı adıyla bu rotaya bıraktı.
Ölçüm bunun küçük bir temizlik olmadığını gösterdi: parametreler on kadar algoritmanın
anlam düğmeleri — `target`, `windowSize`, `capacity`, `amount`, `pattern`. Kullanıcı bunları
arayüzden elle değiştirebiliyor; asistan hiç değiştiremiyor. `set-param` bu boşluğu
kapatacak op ve birliğin ulaşılamayan son üyesi.

## Objective

`set-param` is the eleventh and last op with no production caller. Naming it "the last
unreachable op" makes it sound like tidying. The measurement says otherwise.

### Parameters are the semantic knobs, not decoration

`src/services/algorithmInputs.ts:8-41` is a registry of ten definition groups covering
eleven distinct keys:

| Algorithms | Keys |
|---|---|
| KMP, Boyer-Moore | `pattern` |
| Rabin-Karp | `pattern`, `modulus` (number) |
| Sliding Window Maximum | `windowSize` (number) |
| Trie Insert & Search | `query` |
| Two Pointers, Binary Search, Ternary Search | `target` (number) |
| Minimum Window Substring | `target` (text) |
| 0/1 Knapsack | `values`, `capacity` (number) |
| Longest Common Subsequence, Edit Distance | `other` |
| Coin Change | `amount` (number) |
| Detect Cycle in Linked List | `cycleEntry` (number) |

"Binary Search'ü 42 hedefiyle çalıştır", "kapasiteyi 15 yap", "pencereyi 4 yap" are ordinary
requests about the thing being taught. None of them work today.

### The gap is that the assistant cannot do what the UI already does

`CodeEditor.tsx:146` calls `getAlgorithmParameterDefinitions(algorithmName)` and
`CodeEditor.tsx:297-317` renders one labelled field per definition, writing straight into
`simulationInput.parameters`. So the user can already do this by hand.

The request path cannot. `inputRequestAdapter.ts:171` carries parameters forward unchanged —
`parameters: options.current?.parameters ?? preset.parameters` — and nothing else on the
`adapt-input` path touches them. The only way to change a parameter through the assistant
today is to load a different preset, which replaces the input as well.

### The vocabulary problem is already solved, in the repo

This is what makes the route cheap. A classifier does not have to invent parameter names:
the definitions *are* the closed set, they are keyed per algorithm, and each carries a
`labelKey` and `placeholderKey` that already resolve to EN and TR text through
`src/i18n/translations.ts`. `getAlgorithmParameterDefinitions` returns `[]` for an algorithm
with no parameters, so the empty case is already expressed.

The model is not needed and is not permitted to compute a value. The active algorithm
selects the candidate keys deterministically; the request supplies a literal.

### The inverted R12 gap, measured

R12 found the typed op stricter than its ad-hoc twin. `set-param` has the opposite problem.
`inputPatch.ts:243` is the whole applier:

```ts
} else if (patch.op === 'set-param') {
  next = { ...input, parameters: { ...input.parameters, [patch.name]: String(patch.value) }, origin: 'user' };
}
```

The result does reach `constraintFailure(next, contract)` and
`parseSimulationInput(next.kind, next.text, next.graph, next.parameters)` at
`inputPatch.ts:308-312`, so it is not unvalidated. But two things are true and both need a
measured answer in this turn rather than an assumption:

- **The key is never checked against the active algorithm's definitions.** Nothing stops
  `{ op: 'set-param', name: 'nonsense', value: 1 }` from adding a key the UI never offers.
- **`type: 'number'` is declared on six of the eleven keys and the applier coerces with
  `String(...)` regardless.** Whether that matters depends on what `parseSimulationInput`
  does with each parameter — measure it, do not guess.

The UI cannot produce either problem, because it only renders keys the definitions declare.
Making the op reachable without closing that gap would ship a request path looser than the
form beside it.

## Turn

- Route id: `R13`
- Base: `cc8098a` (`route(R12): reconcile and close`)
- Holder: `sole`
- Expected size: 4–9 files, 2 commits (`route(R13): close`, `handoff(H13): record`)

## Expected Files

| Path | Why |
|---|---|
| `src/services/input/inputPatch.ts` | The `set-param` applier and its validation |
| `src/services/input/inputPatch.test.ts` | Follows its module |
| `src/services/algorithmInputs.ts` | Only if the definitions need a lookup the classifier requires |
| `src/services/algorithmInputs.test.ts` | Follows its module |
| `src/services/titanModeRouting.ts` | Where a request becomes a typed op, if that is the choice |
| `src/services/titanModeRouting.test.ts` | Follows its module |
| `src/services/titanEngine.ts` | Only the `adapt-input` branch |
| `src/services/titanEngine.test.ts` | Follows its module |
| `src/i18n/translations.ts` | Any new EN/TR strings |
| `e2e/**` | A spec proving a parameter change works end to end |
| `docs/titan/handoffs/H13-set-param-reachability.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Write what the criteria require inside your own ownership; justify
extras in `## Deviations`. Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no
route, no protocol file.

## Invariants

- **Behaviour first.** Every request that adapts input correctly today still does. A request
  that used to fall through to the heuristic adapter and produce a sensible result must not
  start failing because a parameter phrase was recognized too eagerly.
- **The definitions are the authority.** A parameter key the active algorithm does not
  declare is not a parameter. Do not add keys, do not rename them, do not widen the registry
  to make a phrase parse.
- **Do not become looser than the form.** Whatever the UI refuses, the request path refuses.
- The deterministic router decides. A model may not compute a parameter value, pick a key,
  or choose an algorithm. It supplies nothing here.
- Determinism: no `Math.random`, no wall-clock branching.
- Five phases untouched; `apply` only after `verify` returns ok; a failed verify leaves the
  workspace exactly as it was.
- Language switching must not rerun the simulation. A parameter change is a real edit and
  may rebuild; changing the display language is not.
- `discuss-current-step`, the R06 translation flow, R10's array ops, and R12's graph ops all
  keep working.

## The decision

**Option A — make `set-param` reachable, validated against the definitions.** A
deterministic classifier maps a request plus the active algorithm onto a `set-param` op,
matching against the definition keys and their EN/TR labels. The applier gains the
validation it lacks: unknown key rejects, and `type: 'number'` is enforced rather than
coerced. `applyInputPatches` already makes a multi-parameter request atomic, so
"kapasiteyi 15, değerleri 3 4 5 yap" is one transaction or none.

Costs: eleven keys across ten algorithm groups in two languages is the widest recognition
surface any of these routes has attempted, and `target` means a number for Binary Search and
text for Minimum Window Substring. Scope it — a defensible subset with the rest named is a
better outcome than eleven half-recognized keys. Say which keys are in and which are not.

**Option B — delete `set-param`.** The union becomes ten ops, all reachable, and the
architecture claim is finally exact. Parameters stay a form-only concern, which is a
coherent position: they are typed values with labelled fields, and a form is a better
instrument for them than a sentence.

Costs: the assistant permanently cannot change the one thing most likely to be asked about
mid-lesson — the search target, the capacity, the window. Say that plainly if choosing B,
and state what happens to the `set-param` cases in `inputPatch.test.ts`.

**T0's reading, not binding:** A, scoped. The numeric single-key parameters are the obvious
first set — `target` for Binary Search / Two Pointers / Ternary Search, `capacity`,
`amount`, `windowSize`, `modulus`, `cycleEntry` — because a number after a recognized label
is unambiguous in both languages. The text-valued keys (`pattern`, `query`, `other`,
`values`, and Minimum Window Substring's `target`) are a judgement call: extracting a string
literal from a sentence is a different and harder problem, and getting it wrong silently
corrupts the lesson. Deferring them with a named successor is a good outcome, not a
shortfall.

Whichever is chosen, the two applier gaps in `## Objective` get a verdict: closed, or
measured and explicitly accepted with a reason.

## Acceptance Criteria

1. The handoff states the decision and, if A, exactly which parameter keys became reachable
   and which deliberately did not, with the reason for the split.
2. Each key that becomes reachable is produced by a real user request in **both** English
   and Turkish, one classifier test per key per language.
3. The unknown-key gap has a verdict backed by a test: either a request naming a key the
   active algorithm does not declare is rejected, or the handoff measures what currently
   happens and argues why it is acceptable.
4. The `type: 'number'` gap has a verdict backed by a measurement: what
   `parseSimulationInput` actually does with a non-numeric value for each numeric key, and
   whether the applier now enforces the type. Measure it; do not reason about it.
5. **End to end, not unit only.** An e2e spec drives a parameter change through the UI and
   asserts both the parameter value and the rebuilt timeline reflecting it. A parameter that
   does not change the trace has not been proven to work.
6. Behaviour preservation: an adaptation request that worked before still works, including
   one that mentions a number without meaning a parameter. Name the tests.
7. A rejected `set-param` leaves input, package, and timeline identical, proven by a test
   asserting identity, including the multi-parameter case.
8. No op literal outside the union declaration, its parser, its applier, or a test.
9. Every op in `InputPatchV1` is either reachable from production or deleted. State the
   final count and prove it with a grep, pasted verbatim.
10. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
    `npm run desktop:check`.
11. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
    Claude's to close.
12. Two commits, in order: `route(R13): close`, then `handoff(H13): record`, both signed
    `-s` after verifying `git config user.email` returns `iyott131@gmail.com`.

**(T0)** The architecture-map line describing `inputPatch.ts` reachability is Claude's, in
`## T0 reconciliation`.

**This route closes the union.** After it, either every declared op is reachable or the
declaration matches what the code can do. That claim has been approximately true and
precisely false since R07, and three routes have each corrected one part of it. R13 is the
last one, which is exactly why the scoping matters more than the coverage: an honest
"six keys reachable, five deferred to R14" closes the architecture question. Eleven keys
recognized badly reopens it.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "cc8098a..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern "op: '"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'createSemanticArrayPatch|createStructuralGraphPatches|applyAndRecompileInputPatch'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third command is criterion 8's evidence — every match must sit in the union, parser,
applier, or a test. It also matches the suffix of `loop: '` and the trace collection's `op`
field; those false positives exist at base and H10 already recorded them. The fourth is
criterion 9's evidence. The fifth must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```
