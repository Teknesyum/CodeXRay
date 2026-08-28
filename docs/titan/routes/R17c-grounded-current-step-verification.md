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

## T0 reconciliation

**Verdict: closed.** Option A, plus the oracle fix the route left open under "if the slice is
the thing that should change". Head `2e75780`, CI run `33163494298`, all three jobs green.

### Remote gate (criterion 8)

```
72 passed (5.3m)
2 passed (48.0s)
TIMELINE_MEASUREMENTS {"playwright":{"min":1181.116785000002,"median":1285.2400480000006,"max":1375.6903650000022},"inPage":{"min":171.30000000004657,"median":221,"max":349.19999999995343},"handler":{"min":0.9999999997671694,"median":1.2999999998719431,"max":1.7999999999301508},"deliberateDelayMs":0}
```

Zero flaky.

### The regression, re-measured on my own harness

Not by re-reading H17c's test. The same script that produced R17b's failure table, run against
`9cf3610`:

```
size=20   steps=147   worstVarsChars=136  fallbackVerifies=true
size=60   steps=535   worstVarsChars=277  fallbackVerifies=true
size=120  steps=1191  worstVarsChars=484  fallbackVerifies=true
size=200  steps=2143  worstVarsChars=761  fallbackVerifies=true
```

The last row was `false` before this turn. Fixed, independently confirmed. (H17c reports 764
for the same case; the three-character difference is different array contents, not a
disagreement.)

### The fix is in the right place

The route forbade enlarging the slice, and it was not enlarged. `deterministicFiveLens` now
selects whole `key: value` bindings, smallest-serialization first with a `localeCompare`
tiebreak, until 700 characters — so it emits **valid JSON of a subset** instead of a string cut
mid-token. Deterministic, no clock, no randomness. The verifier no longer needs to know the
number 700, which is exactly why Option B was rejected: the two sides are decoupled rather than
kept in sync by hand.

### Two limits I found that the handoff's ceiling table does not name

Both measured against the shipped code, neither reachable through any simulator the registry
supports today, and neither reopens the route.

**The oracle can still emit `{}`.** If every variable at a step is individually larger than 700
characters serialized, nothing is selected and both locales print `Live variables {}.` /
`Canlı değişkenler {}.`, which the verifier rejects — `entries.length > 0` fails. Not reachable
in practice, and the reason is the fix's own smallest-first ordering: I found a real step whose
widest single binding is 1611 characters (Merge Sort, 200 wide-valued elements) and all 2143
steps still verified in EN and TR, because a small scalar always rides along. It needs a step
whose *every* variable is oversized. If a future simulator emits one large collection and
nothing else, this fires.

**A non-JSON brace pair rejects an otherwise correct answer.** The `Data` check takes the first
`{` to the last `}` and hard-fails on a parse error, before the binding scan ever runs:

```
plain correct bindings                  verifies=true
exact json blob                         verifies=true
prose set braces plus correct binding   verifies=false   <- "The visited set {A, B} is tracked and i = 2."
correct binding with a stray open brace verifies=true
```

Fail-closed, so it is within the route's invariant, and it can only bite when a real model is
answering — the configuration this machine still cannot exercise. Recorded because it is the
most likely source of a future "verification cries wolf" report.

### The handoff's ceiling table is the right artifact

`Data` is described as "says nothing false, not says everything true", in those words, as the
route required. `Visual` and `Reasoning` are listed as required-slot-only with "all content can
be wrong". That is the standard set by H16 and it is now met on the intent that started this
whole line.

### The R17 line, closed

Three turns: `R17` compared a fixed sentence rather than a fact; `R17b` compared facts but was
defeated by its oracle's truncation; `R17c` fixed the oracle and narrowed the claim to one that
holds. **The route text was wrong in both retries, not the implementation** — R17's Option A
described the sentence it wanted matched, R17b's Option A required every variable without
noticing the truncation. Sole implemented both sentences exactly.

The correction that ends the line is not a comparison rule. It is criterion 1: run the oracle
over every supported algorithm at the maximum legal input size in both locales. Largest
`JSON.stringify(vars)` encountered: **21,204 characters**. Every earlier fixture set was drawn
from the same small, well-behaved region, which is why two green suites sat on top of two live
defects.

### Architecture map

`AGENTS.md`'s `discuss-current-step` line is rewritten in this commit to describe the settled
behaviour: which slots are verified, what each is compared against, and — named, not implied —
that `Visual` and `Reasoning` are required slots that are never verified.
