# R14 — The five text parameters, and the two problems they actually are

## Özet

R13 altı sayısal parametreyi ulaşılabilir yaptı ve beş "metin" parametresini adıyla bu
rotaya bıraktı. Ölçüm bunların tek bir problem olmadığını gösterdi: dördü tırnaklı bir
metin literali (`pattern`, `query`, `other`, Minimum Window Substring'in `target`'ı),
beşincisi ise dizi literali (`values`, Knapsack). Depoda tırnaklı literal çıkarımı zaten
iki yerde var ve ikisi birbirinden farklı. Bu rota o ikisini de karara bağlar.

## Objective

R13 closed the op question: all eleven `InputPatchV1` ops have a production caller. It left
the vocabulary question open — six of the eleven parameter keys are reachable, five are not.
This route closes the vocabulary.

### The five are not one problem

| Key | Algorithms | Actual shape | Evidence |
|---|---|---|---|
| `pattern` | KMP, Boyer-Moore, Rabin-Karp | text literal | `algorithmInputs.ts:10,13` |
| `query` | Trie Insert & Search | text literal | `algorithmInputs.ts:20` |
| `other` | LCS, Edit Distance | text literal | `algorithmInputs.ts:32` |
| `target` | Minimum Window Substring | text literal | `algorithmInputs.ts:26` |
| `values` | 0/1 Knapsack | **array literal** | `inputPresets.ts:248`, `compoundSimulators.ts:552` |

`values` is not prose. The preset stores `'[6,12,14,7,3]'` and the simulator reads it with
`parseArrayInput(requiredParameter(input, 'values', 'Item values'))`. Extracting it from a
sentence is the array-literal problem R10 already solved shapes of, not the string-literal
problem the other four are. Treating all five as "text" would apply the wrong extractor to
one of them.

### Quoted-literal extraction already exists, twice, and disagrees with itself

```
inputRequestAdapter.ts:154   /["“”']([^"“”']+)["“”']/   smart quotes and apostrophes
stringCompiler.ts:29         /"([^"]*)"/                                              straight double quotes only
```

Two conventions, one repository. A Turkish user typing `deseni "abc" yap` on a system that
autocorrects to curly quotes gets one behaviour from one path and another from the other.
R14 does not need to invent an extraction convention — it needs to pick one of the two that
exist and stop the third from being born.

Note that `inputRequestAdapter.ts:154`'s class also accepts `'` as a delimiter. In Turkish
that collides with the suffix apostrophe: `pattern'i "abc" yap` contains an apostrophe that
is not a quote. Measure this before adopting that regex wholesale.

### The `target` collision is the sharp edge

`target` is a **number** for Two Pointers, Binary Search, and Ternary Search, and **text**
for Minimum Window Substring. R13's classifier filters `definition.type === 'number'`, so
today `hedefi 42 yap` produces a `set-param` on the numeric algorithms and nothing on
Minimum Window Substring.

R14 makes the text half reachable, which means the same phrase must resolve differently
depending only on the active algorithm. The definitions already carry that distinction and
the classifier already receives `algorithmName`, so the mechanism exists. The risk is not
mechanism, it is regression: `hedefi 42 yap` on Binary Search must keep producing a numeric
`set-param`, and must not start matching a text extractor because 42 can be read as a
string.

### What is already in place

- `getAlgorithmParameterDefinitions(algorithmName)` is the authority on keys and types, and
  `AGENTS.md` now forbids widening it to make a phrase parse.
- `createSemanticParameterPatches(request, algorithmName)` at `inputPatch.ts:161` is the
  classifier, with `numericParameterAliases` at `:156` as its EN/TR alias table.
- `applyInputPatch` already rejects an undeclared key and a non-numeric value for a
  `type: 'number'` key (`inputPatch.ts:276-279`).
- `applyInputPatches` already makes a multi-parameter request atomic.
- Both `CodeEditor.tsx` fields and the request path read the same registry.

The remaining work is extraction and the type-side validation that mirrors the numeric one.

## Turn

- Route id: `R14`
- Base: `ad8bb32` (`route(R13): reconcile and close`)
- Holder: `sole`
- Expected size: 4–9 files, 2 commits (`route(R14): close`, `handoff(H14): record`)

## Expected Files

| Path | Why |
|---|---|
| `src/services/input/inputPatch.ts` | The classifier and the applier's text-side validation |
| `src/services/input/inputPatch.test.ts` | Follows its module |
| `src/services/inputRequestAdapter.ts` | Only if the quote convention is unified there |
| `src/services/stringCompiler.ts` | Only if the quote convention is unified there |
| `src/services/titanModeRouting.ts` | Only if routing needs the text branch |
| `src/services/titanModeRouting.test.ts` | Follows its module |
| `src/services/titanEngine.ts` | Only the `adapt-input` branch |
| `src/services/titanEngine.test.ts` | Follows its module |
| `src/i18n/translations.ts` | Any new EN/TR strings |
| `e2e/**` | A spec proving a text parameter change works end to end |
| `docs/titan/handoffs/H14-text-parameter-reachability.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Write what the criteria require inside your own ownership; justify
extras in `## Deviations`. Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no
route, no protocol file.

## Invariants

- **Behaviour first, and R13 is the thing most at risk.** Every numeric parameter request
  that works today still produces the same numeric `set-param`. Name the tests.
- **The definitions remain the authority.** Do not add keys, do not change a declared type,
  do not widen the registry to make a phrase parse.
- **Do not become looser than the form.** The `CodeEditor.tsx` field accepts what it accepts;
  the request path refuses whatever the form refuses.
- **An unextractable literal is a refusal, not a guess.** If the request does not contain a
  delimited literal, produce no patch and fall through. Never infer a string from surrounding
  prose — a wrong pattern or a wrong second text silently teaches the wrong lesson, and
  unlike a wrong number it does not look wrong.
- The deterministic router decides. A model may not supply, complete, or repair a literal.
- Determinism: no `Math.random`, no wall-clock branching.
- Five phases untouched; `apply` only after `verify` returns ok; a failed verify leaves the
  workspace exactly as it was.
- R10's array ops, R12's graph ops, R13's numeric parameters, `discuss-current-step`, and
  the R06 translation flow all keep working.

## The decision

Two decisions, and they are separable — a defensible split is a valid outcome.

**Decision one: the four text literals.**

**Option A — explicit delimiter only.** A text parameter changes only when the request
carries a delimited literal: `set the pattern to "abc"`, `deseni "abc" yap`. No delimiter,
no patch, fall through to the existing path. Exact, deterministic, and refuses rather than
guesses.

Costs: the user must know to quote. A request like `deseni abc yap` does nothing and the
reason is invisible unless the assistant says so — so say so. Decide whether an
unrecognized-but-nearly-matching request deserves an explanatory reply rather than silence.

**Option B — defer the four as well, and delete nothing.** State that text parameters stay
form-only, and record the reason. The union stays closed and honest; the vocabulary stays
at six of eleven permanently.

Costs: `pattern` is arguably the single most-asked-about parameter in a string-matching
lesson, and the form is one panel away. Say that plainly if choosing B.

**Decision two: `values`.**

It is an array literal for one algorithm. Options: extract `[..]` the way the request text
already carries it, treat it as out of scope with a named successor, or fold it into the
same delimiter rule if a bracket counts as a delimiter. Whichever — say which, and do not
let it ride along silently on a decision made about strings.

**Decision three, unavoidable either way: the two quote regexes.** Unify, or state which is
canonical and why the other is allowed to differ. Do not add a third.

**T0's reading, not binding:** A for the four literals, with the Turkish apostrophe measured
before any regex is copied. `values` folded in only if brackets fall out of the same rule
naturally; otherwise defer it by name rather than half-implementing it. And unify the quote
handling toward the smart-quote-aware form, minus the `'` delimiter if the measurement shows
it collides with Turkish suffixes — a straight-quotes-only extractor will fail on real input
from a phone keyboard.

## Acceptance Criteria

1. The handoff states both decisions and, for each key that became reachable, exactly what
   syntax the user must type in English and in Turkish.
2. Each key that becomes reachable is produced by a real user request in **both** English
   and Turkish, one classifier test per key per language.
3. **The Turkish apostrophe is measured, not reasoned about.** Show what
   `deseni "abc" yap`, `pattern'i "abc" yap`, and `pattern'i 'abc' yap` each produce under
   the chosen extractor. Paste the results.
4. **R13 regression proof.** `hedefi 42 yap` / `set the target to 42` on Binary Search still
   produces a numeric `set-param` with value `42` as a number, not a string. Assert the type,
   not just the value.
5. The `target` collision is resolved and tested both ways: numeric on Binary Search, text on
   Minimum Window Substring, from comparable phrasings.
6. A request with no delimited literal produces no patch and falls through to the existing
   path, proven by a test.
7. The applier validates the text side as it validates the numeric side. State what a text
   parameter can be rejected for, or state that nothing can reject it and why that is safe.
8. The two quote regexes have a stated verdict, and a grep proves no third one was added.
9. **End to end, not unit only.** An e2e spec drives a text parameter change through the UI
   and asserts both the parameter value and the rebuilt trace reflecting it. A parameter that
   does not change the trace has not been proven to work.
10. A rejected patch leaves input, package, and timeline identical, proven by a test
    asserting identity, including the multi-parameter case.
11. The final state of the vocabulary is stated as a count: how many of the eleven keys are
    reachable, which are not, and under which named route they would become so.
12. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
    `npm run desktop:check`.
13. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
    Claude's to close.
14. Two commits, in order: `route(R14): close`, then `handoff(H14): record`, both signed
    `-s` after verifying `git config user.email` returns `iyott131@gmail.com`.

**(T0)** The architecture-map lines describing `inputPatch.ts` and `algorithmInputs.ts` are
Claude's, in `## T0 reconciliation`.

**After this route the input story is finished.** R07 put `adapt-input` on the seam, R10 made
the array ops reachable, R12 removed the duplicate graph editor, R13 closed the op union.
R14 closes the vocabulary. What remains after it is a different and larger question, recorded
in R13's reconciliation and not part of this route: five of the seven intents still bypass
the five-phase pipeline entirely. Do not start on that here.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "ad8bb32..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern "op: '"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern '\[\^?"'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third command is criterion 8's op evidence — every match must sit in the union, parser,
applier, or a test. It also matches the suffix of `loop: '` and the trace collection's `op`
field; those false positives exist at base and H10 already recorded them. The fourth is the
quote-regex census for criterion 8; run it against the base first and report the delta, not
the raw count. The fifth must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## T0 reconciliation

Written by Claude after verifying H14, pushing both commits, and running the remote gate.

### Criterion 13, remote half — **closed**

`git push origin main` moved `8b8a688..d9f06a6`. CI run `33011710391` on head `d9f06a6`:

```text
quality success
desktop success
browser success
```

`70 passed` then `2 passed`, zero flaky in both phases. `handler.median` 1.10 ms against 10,
a 9.09x margin.

### The input story is finished

Eleven ops, eleven keys, all reachable, all validated, all atomic. R07 put `adapt-input` on
the seam, R10 made the array ops reachable, R12 removed the duplicate graph editor, R13
closed the op union, R14 closed the vocabulary. Five routes, and the claim in `AGENTS.md`
now matches the code exactly.

### The unification fixed a latent bug, and that is worth stating

H14 records the apostrophe measurement and the decision to drop `'` as a delimiter. What it
does not say is what the old regex did on the pre-existing path.

`inputRequestAdapter.ts:154` was `/["“”']([^"“”']+)["“”']/`. On
`pattern'i "abc" yap` it matches from the suffix apostrophe, captures `[^"“”']+`
as `i `, and closes on the `"`. The old adapter therefore extracted **`i `** — not `abc`,
and not nothing. For a `kind === 'string'` input that value became the input text.

So dropping the single quote is not a narrowing that cost something. On Turkish input it
replaced a wrong answer with a right one. The three-line measurement in H14 shows the new
behaviour; this is the missing half — what the old behaviour was.

### One thing was changed without being declared as a behaviour change

The `'` removal alters `inputRequestAdapter.ts` and `stringCompiler.ts`, both of which
existed before this route. `stringCompiler.ts` only widened (it now accepts smart quotes,
having accepted straight quotes only). `inputRequestAdapter.ts` genuinely changed what it
extracts, as above.

H14 declares `requestLiterals.ts` in `## Deviations` as a new file, correctly, but treats
the consumer changes as mechanical. They were not entirely mechanical, and no test covered
quoted extraction on either older path in **either** direction — before or after. The
behaviour is now better and it is still uncovered.

Not a defect in the turn and not worth reopening: criterion 8 required exactly this
unification, and the direction is right. Recorded so the next route touching those two files
knows the coverage is absent, and so that "criterion 8 required it" is not mistaken for
"criterion 8 verified it".

### The architecture map — **reconciled**

`AGENTS.md`'s `inputPatch.ts` entry now states 11/11 ops and 11/11 keys instead of listing
what is deferred. The `algorithmInputs.ts` entry records the `target` type collision and
that it is resolved only by the active algorithm. A new entry names `requestLiterals.ts` as
the single literal extractor, records why the single quote is not a delimiter, and forbids a
fourth convention.

`src/services/titan/AGENTS.md` needs no change, for the fourth time and the same reason.

### Recorded, not acted on — and it supersedes what R13 recorded

R13's reconciliation said five of seven intents bypass the five-phase pipeline. Reading
`titanPipeline.ts:178-240` makes that description wrong in a way that matters, so replace it
with this:

`startAdaptInputPipeline` does not replace the engine. It calls `startTitanEngineRun` with
`deferApply: true` and `onPlan: () => undefined`, so:

- **`produce` is the entire engine run** — its own seven-job `manager → scout →
  input-engineer → compiler → critic → manager → tutor` graph, collapsed into one phase and
  with its progress events suppressed.
- **`verify` is a shape check**, not a verification:
  `result.status === 'success' && result.input && result.steps?.length`.
- **`apply` is genuinely owned by the pipeline**, which is real and is the phase that earns
  its name.

And the engine's own `critic-validate-input-and-trace` for `adapt-input` is
`if (!steps.length) throw` — also a shape check. So there are two verification steps on this
path and neither inspects content.

The system is nonetheless safe, which is the part that must not be lost: what actually
rejects a bad adaptation is `applyInputPatch`'s contract validation — the work of R10
through R14 — running inside `produce`. The guarantee is real. The claim about **where** it
comes from is wrong.

That is the honest next question, and it is not "migrate five intents to the pipeline".
It is: the phase named `verify` does not verify, and for `create-algorithm` with
`template: 'model-authored'` — the one intent that puts model-authored source into the
workspace — there is no pipeline at all.

