# R17c — the oracle fails its own check on a legal input

## Özet

R17b `Code`'u ve `Data`'yı doğru yöne çevirdi: artık cümle değil değer karşılaştırılıyor.
Ama `Data` kontrolü trace'in **bütün** anahtarlarını arıyor, oysa `deterministicFiveLens`
değişkenleri 700 karakterde kesiyor. 200 elemanlı bir dizide — girdi ayrıştırıcısının izin
verdiği tam üst sınır — fallback kendi kontrolünü geçemiyor. Model gerekmiyor; bu makinede,
bugün, üretimde oluyor. Kusurun kaynağı R17b'nin uygulaması değil, o rotanın Option A metni:
"her değişken" yazan bendim ve kesmeyi hesaba katmadım.

## Objective

R17b's direction is correct and is kept. `Code` comparing a single distinct integer against
`lineNumber`, ambiguity rejecting rather than guessing, `Time` unchanged, six accepted
phrasings, and all of R17's rejection tests still passing — none of that is reopened. One
interaction is wrong.

### The measurement

`deterministicFiveLens` at `titanEngine.ts:582` truncates:

```ts
const variables = JSON.stringify(step.visualData.vars).slice(0, 700);
```

`dataLensMatchesVariables` at `titanPipeline.ts:234` requires **every** entry:

```ts
Object.entries(variables).every(([key, value]) => { ... binding.test(dataLens) })
```

When the serialized `vars` exceed 700 characters the fallback's own `Data` lens is cut mid-way,
the later keys have no binding in it, and the fallback is rejected by the check it is supposed
to define. Measured directly against the shipped code on `081d2cc`, Merge Sort, `origin: 'user'`
arrays:

```
size=20   steps=147   worstVarsChars=136  fallbackVerifies=true
size=60   steps=535   worstVarsChars=277  fallbackVerifies=true
size=120  steps=1191  worstVarsChars=484  fallbackVerifies=true
size=200  steps=2143  worstVarsChars=761  fallbackVerifies=false
```

`inputParsers.ts:9` sets `MAX_INPUT_ITEMS = 200`. **The input that breaks it is exactly the
largest input the application accepts**, and the crossover sits somewhere between 120 and 200
elements. The eight default presets are all safe — the largest, Dijkstra, peaks at 413
characters — which is why the suite is green.

### Why this is worse than the defect R17b fixed

R17's defect needed a local advisory model, and this environment has no usable WebGPU adapter,
so it could not be reproduced here. This one needs **no model at all**: `callOptionalAgent`
returns the deterministic fallback, and the fallback fails. A user with a large array who asks
about the current step reads "The current-step explanation could not be verified. The workspace
was not changed."

### Whose error this is

Mine. R17b's Option A says the `Data` slot should require "that every variable the trace
reports at this step is mentioned with its committed value". Sole implemented that sentence
exactly. The route asserted an invariant — the fallback must always pass — and then specified a
rule that contradicts it for large inputs, and did not notice that the oracle truncates. The
handoff is not at fault for following the route.

## Turn

- Route id: `R17c`
- Base: `0712c05` (`route(R17b): reconcile and reopen`)
- Holder: `sole`
- Expected size: 2–4 files, 2 commits (`route(R17c): close`, `handoff(H17c): record`)

## Expected Files

| Path | Why |
|---|---|
| `src/services/titan/titanPipeline.ts` | The `Data` comparison |
| `src/services/titan/titanPipeline.test.ts` | Follows its module |
| `src/services/titanEngine.ts` | Only if the truncation itself is what moves |
| `docs/titan/handoffs/H17c-*.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no route, no
protocol file.

## Invariants

- **The oracle rule is absolute now.** For every algorithm the registry supports, at every step,
  at the maximum legal input size, `deterministicFiveLens` output must verify in EN and TR. This
  route exists because that was asserted and not tested at scale.
- **R17b's `Code` and `Time` are untouched.** Single-integer comparison, ambiguity rejection,
  `N/M` parsing — all stay, with their tests unchanged.
- **All existing rejections survive.** Wrong line, wrong step index, ambiguous line, unlabelled
  answer, and R17b's six accepted phrasings keep their current verdicts.
- **No similarity scoring.** A value either equals the committed value or it does not.
- **Do not raise the 700 slice to "fix" this.** That moves the crossover, it does not remove it.
  If the slice is the thing that should change, remove the mismatch, do not enlarge it.
- `adapt-input` (R15), the array templates (R16), and `model-authored` (R18) keep their verify
  behaviour exactly.
- Determinism: no `Math.random`, no wall-clock branching.

## The decision

**Option A — verify only what the answer claims.** Every `key: value` binding found in the
`Data` lens must agree with the committed `vars`; keys the answer does not mention are not
required. Require at least one binding so an empty or contentless `Data` slot still fails. A
truncated fallback then passes, because everything it does say is true.

Costs: an answer that mentions one variable correctly and silently omits nine is accepted. The
check becomes "says nothing false" rather than "says everything true". That is a real weakening
and the handoff must state it in those words.

**Option B — make the universe match the oracle.** Keep "every variable", but compare against
the same bounded set the fallback prints: parse the keys present in the first 700 characters of
`JSON.stringify(vars)` and require exactly those. The oracle passes by construction at any size.

Costs: the verifier now depends on a serialization detail of an unrelated function; the two must
stay in sync forever, and nothing enforces it. It also still demands JSON-exact rendering for
whichever keys are in range, which is the R17 defect surviving in miniature for large inputs.

**Option C — drop `Data` from the verified set.** `Code` and `Time` remain verified and both
are sound. `Data` joins `Visual` and `Reasoning` as a required-but-unverified slot. R17b's route
already named this as an acceptable outcome: two verified slots that mean what they say beat
three that do not.

Costs: the variable values a tutor states become unchecked, which is the slot most likely to
carry a confidently wrong number.

**T0's reading, not binding:** A, with C as the fallback if A cannot be made to reject a
contradicting value reliably. A keeps a real guarantee — no stated variable value disagrees with
the trace — and that guarantee is exactly what protects the user from a confidently wrong
number, which is the failure this whole R17 line exists to prevent. B is rejected: coupling the
verifier to another function's `.slice(0, 700)` is a trap for whoever changes that number next,
and this route was caused by exactly that kind of hidden coupling. If the handoff finds A's
binding regex cannot distinguish "mentions `i` as 2" from incidental text, take C and say so in
the first sentence.

## Acceptance Criteria

1. **A test runs the oracle at scale.** For every algorithm the registry supports, at the
   maximum legal input size for its input kind, every step's deterministic five-lens answer
   verifies in EN and TR. Report the largest `JSON.stringify(vars)` length encountered. This is
   the test whose absence caused both R17b and this route.
2. **The 200-element Merge Sort case verifies.** Named explicitly, with the measured
   `worstVarsChars`, so the regression has a reproduction that outlives this turn.
3. **A test proves a contradicting value is still rejected** — an answer whose `Data` lens
   states `i` as a value the trace does not hold. If Option C was taken, this criterion is
   answered by stating that it can no longer be rejected, in the handoff summary's first
   sentence.
4. R17b's six accepted phrasings, its ambiguity rejection, and R17's wrong-line, wrong-step, and
   unlabelled rejections all keep their verdicts. Same tests, unchanged.
5. The handoff states, per slot, what is compared and what can still slip past — in the same
   plain form H16 used for its ceiling.
6. `adapt-input`, the array templates, and `model-authored` are untouched. Name the R15, R16,
   and R18 tests that prove it.
7. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`.
8. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
   Claude's to close.
9. Two commits, in order: `route(R17c): close`, then `handoff(H17c): record`, both signed `-s`
   after verifying `git config user.email` returns `iyott131@gmail.com`.

**(T0)** The `AGENTS.md` wording for the `discuss-current-step` verify is Claude's, in
`## T0 reconciliation`, and stays unwritten until this route closes.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "0712c05..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'slice\(0, 700\)'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The fourth must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```
