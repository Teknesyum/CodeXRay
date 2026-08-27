# R17b — the check requires the sentence, not the fact

## Özet

R17 Option A'yı uyguladı ve H17 doğru şeyi iddia etti: `Code` slot'u
`steps[currentIndex].lineNumber` ile doğrulanıyor. Kod bunu yapmıyor. Kod, cevabın
`Active source line 9` / `Aktif kaynak satırı 9` **cümlesini birebir** taşımasını, `Data`
slot'unun ise `JSON.stringify(vars).slice(0, 700)` dizgesini **kelimesi kelimesine
içermesini** şart koşuyor. Doğru ama farklı ifade edilmiş bir cevap reddedilir. Testlerin
hiçbiri farklı ifadeyi denemediği için bu görünmedi.

## Objective

R17 is not rewritten and its decision is not reversed. Option A was the right call and the
fail-closed behaviour, the EN/TR label map, the `Reasoning`-is-not-verified boundary, and the
e2e that proves a divergent answer never reaches the user are all kept. This retry fixes one
thing: the comparison is against the deterministic fallback's *wording* instead of the trace's
*value*.

### The measurement

`titanPipeline.ts:229-256`, as shipped on `60f4595`:

```ts
const lineMatch = lenses.get('code')!.match(
  /(?:Active source line|Aktif kaynak satırı)\s+(\d+|result step|sonuç adımı)\b/iu);
const variables = JSON.stringify(step.visualData.vars).slice(0, 700);
const dataMatches = lenses.get('data')!.includes(variables);
const timeMatch = lenses.get('time')!.match(/(?:Step\s+)?(\d+)\s*\/\s*(\d+)(?:\.\s*adım)?/iu);
```

Three slots, three different strictnesses:

- `Time` genuinely verifies a fact. `Step 2/3`, `2/3`, `2 / 3` all parse; the numbers are
  compared to `currentIndex + 1` and `steps.length`. This one is right.
- `Code` requires a fixed phrase in one of two languages. `Code: line 9 is active.` is correct
  and fails. `Code: Executing line 9 of the source.` is correct and fails.
- `Data` requires verbatim containment of a 700-character JSON slice. Any reformatting,
  truncation, key reordering, or human-readable rendering fails. `Data: i = 2` is correct and
  fails.

### Why no test caught it

Every accepting test feeds `deterministicFiveLens` output or a hand-written copy of its
phrasing. Every rejecting test feeds that same phrasing with a wrong number, or a string with
no labels at all. The suite therefore cannot distinguish "the fact agrees with the trace" from
"the sentence matches the fallback". Both hypotheses predict every existing result.

`titanPipeline.test.ts:180` — the `accepts the actual deterministic five-lens fallback`
test — is the strongest evidence in the turn, and it is exactly the case that cannot separate
the two.

### Why it matters, and why this machine cannot see it

`callOptionalAgent` at `titanEngine.ts:756` returns the fallback only when no advisory model is
loaded — `if (!useAdvisoryModel) return fallback;`. With a model present it returns the model's
own text, and the tutor prompt asks only for "five short labels: Code, Data, Visual, Reasoning,
Time". Nothing instructs the model to reproduce the canonical sentence or to echo the raw
`vars` JSON. `fiveLensContext` passes `lenses: ['code','data','visual','reasoning','time']` and
nothing more.

So on any machine with a local model, `discuss-current-step` now fails verification for almost
every answer, and the user reads "The current-step explanation could not be verified" instead
of an explanation. **This is the gate that cries wolf that R17's own decision section named as
the one outcome that would make Option A the wrong choice.** It is invisible here because
H18 established there is no usable WebGPU adapter in this environment — the configuration that
breaks is the one that cannot be run.

### What this is not

Not a safety hole: nothing wrong is applied, and fail-closed is still the correct direction.
Not a reason to prefer Option B: the route's condition for switching was "extraction is not
robust enough for A", and extraction is not the problem — the comparison is. Not a criticism of
the label extractor: `extractFiveLenses` handles bullets, bold, and both languages, and it is
kept as is.

## Turn

- Route id: `R17b`
- Base: `f531938` (`route(R17): reconcile and reopen`)
- Holder: `sole`
- Expected size: 2–5 files, 2 commits (`route(R17b): close`, `handoff(H17b): record`)

**On the number.** R17b is R17's retry, opened after R17 closed with an unmet criterion 1.
Pairing decides the active route, never numbering.

## Expected Files

| Path | Why |
|---|---|
| `src/services/titan/titanPipeline.ts` | The three slot comparisons |
| `src/services/titan/titanPipeline.test.ts` | Follows its module |
| `e2e/titan-mode.spec.ts` | Only if a second stubbed answer is needed |
| `docs/titan/handoffs/H17b-*.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no route, no
protocol file.

## Invariants

- **Everything R17 got right is kept.** Fail-closed, the EN/TR label map, five slots required,
  `Reasoning` and `Visual` prose unverified, the existing localized failure message, and the
  divergent-tutor e2e all stay.
- **The deterministic fallback must still pass, in both locales.** R17's oracle test is the
  regression guard for this route and must not be weakened to accommodate the fix.
- **Loosening must not lose the rejections.** The three cases R17 already catches — wrong line,
  wrong step index, no labels — must still be caught, by the same tests.
- **No similarity scoring.** Do not solve this by making the comparison fuzzy in the sense of
  "close enough". A number either equals the trace's number or it does not. Extracting a number
  from freer prose is in scope; deciding that a wrong number is nearly right is not.
- `adapt-input` (R15), the array templates (R16), and `model-authored` (R18) keep their verify
  behaviour exactly.
- Determinism: no `Math.random`, no wall-clock branching. The trace never comes from the model.

## The decision

**Option A — compare values, extract them more freely.** `Code` accepts any integer in the
slot and compares it to `lineNumber`; ambiguity (no integer, or more than one distinct integer)
is a rejection, not a guess. `Data` stops requiring the JSON blob and instead requires that
every variable the trace reports at this step is mentioned with its committed value, in
whatever formatting — or, if that proves unstable, that no value contradicting the trace
appears. `Time` is already correct and is left alone.

Costs: `Data` is the hard one, and the honest answer may be that a bounded key/value agreement
check is all that is achievable. Say what you built and what it cannot catch.

**Option B — narrow the contract instead of the check.** Keep the strict comparison and make
it legitimate by telling the model the exact sentence forms it must use for `Code`, `Data`, and
`Time`, so a conforming answer is guaranteed to be checkable. The prompt at
`titanEngine.ts:783` and `fiveLensContext` carry the requirement.

Costs: it constrains the tutor's voice in the three slots and depends on the model obeying —
which cannot be verified on this machine, so a disobedient model still produces a failed run.
It trades an unverifiable comparison for an unverifiable instruction.

**T0's reading, not binding:** A for `Code` and `Time`, and A's weaker form for `Data` — agree
on values, not on rendering — with B's prompt change added only if `Data` cannot be made to
work otherwise. The reason A is preferred is that the verifier must not depend on the model's
cooperation to be sound; a check that only works when the model phrases things our way is the
same class of error this route exists to fix, moved one step upstream. But if the handoff finds
that free-form `Data` agreement cannot be checked without heuristics, **drop `Data` from the
verified set and say so** rather than shipping a fuzzy match. Two verified slots that mean what
they say beat three that do not.

## Acceptance Criteria

1. **A test proves a correctly-worded-but-differently-phrased answer is accepted.** At minimum
   three variants per verified slot, none of them using the deterministic fallback's sentence
   forms, in both EN and TR. This is the criterion R17 lacked and the reason this route exists.
2. R17's three rejection cases still fail: wrong line, wrong step index, no labels. Same tests,
   unchanged.
3. The deterministic fallback still verifies in EN and TR. Same test, unchanged.
4. The handoff states, per slot, exactly what is compared and what an attacker or a sloppy model
   could still slip past. If `Data` was dropped from the verified set, say so in the first
   sentence of the handoff summary, not in a later section.
5. A test proves ambiguity is a rejection, not a guess — an answer whose `Code` slot contains
   two different integers does not verify.
6. `adapt-input`, the array templates, and `model-authored` are untouched. Name the R15, R16,
   and R18 tests that prove it.
7. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`.
8. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
   Claude's to close.
9. Two commits, in order: `route(R17b): close`, then `handoff(H17b): record`, both signed `-s`
   after verifying `git config user.email` returns `iyott131@gmail.com`.

**(T0)** The `AGENTS.md` wording for the `discuss-current-step` verify is Claude's, in
`## T0 reconciliation`, and is deliberately not being written until this route closes.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "f531938..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Active source line|Aktif kaynak satırı'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third command is criterion 1's evidence — after this route, the only matches outside
`deterministicFiveLens` and its tests should be gone. The fourth must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```
