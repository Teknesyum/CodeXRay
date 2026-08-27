# R17 — three of the five lenses assert facts the trace already decides

## Özet

R16 bu rotayı "yazılamaz" diye erteledi: serbest model metninden denetlenebilir bir iddia
çıkarmak araştırma problemiydi. Çağrı yolu bunu çürüttü. Cevap serbest metin değil, **sabit
şemalı** bir metin: Kod / Veri / Görsel / Mantık / Zaman. Bu beş etiketin üçü trace'in
belirlediği olguları söylüyor — satır numarası, değişken değerleri, adım indeksi. İddia tanımı
aranmıyordu; prompt'un kendisinde duruyordu.

## Objective

`discuss-current-step` is the last intent whose `verify` is a shape check. It asks that the
selected step exists and that the answer is non-empty — `titanPipeline.ts:255`. It cannot
reject a confidently wrong explanation, and R15 named that limit the day it was written.

### Why R16 deferred this, and why that reasoning no longer holds

R16 wrote: the tutor answer comes from `callOptionalAgent`, so on a machine with a local model
the text is model prose; verifying it means extracting checkable claims from free text, which
is a research problem, not a turn. That was a correct reading of `titanEngine.ts:780` and an
incorrect reading of what the model is asked to produce.

The prompt is not open-ended:

```
titanEngine.ts:782  'Explain the selected committed step under five short labels:
                     Code, Data, Visual, Reasoning, Time.'
```

And the deterministic fallback handed to the same call — `deterministicFiveLens` at
`titanEngine.ts:573` — fills those five labels from the trace:

```
Code:      `Active source line ${step.lineNumber ?? 'result step'}.`
Data:      `Live variables ${JSON.stringify(step.visualData.vars).slice(0, 700)}.`
Visual:    `The ${step.visualData.type} view reflects the committed state.`
Reasoning: step.explanation
Time:      `Step ${current + 1}/${total}; ...`
```

**Code, Data, and Time are not opinions.** Each names a value the deterministic trace already
decides: `step.lineNumber`, `step.visualData.vars`, and `currentIndex + 1` out of
`steps.length`. `Visual` names `step.visualData.type`, which is also decided, though it appears
inside a sentence rather than as a bare value. Only `Reasoning` is genuinely prose.

So the checkable claim was never hiding in the prose. It is the labelled slot, and the slot
exists because the prompt demands it and the fallback demonstrates it.

### What is actually at risk today

With no local model, `callOptionalAgent` returns the deterministic fallback, which is generated
from the trace and therefore trivially consistent with it. **The failure mode only exists when a
model is present** — precisely the configuration this machine cannot currently exercise (H18:
`test:e2e:ai` skipped, no WebGPU adapter). A model that names line 14 when the selected step is
line 9, or says "step 3 of 7" when the timeline is at 5 of 12, produces a confidently wrong
tutor answer that the current `verify` accepts.

That is the whole route. Not "is the explanation good" — that is unanswerable and out of scope.
**Does the answer's factual slots agree with the trace they claim to describe.**

## Turn

- Route id: `R17`
- Base: `c26fe77` (`route(R18): reconcile and close`)
- Holder: `sole`
- Expected size: 4–8 files, 2 commits (`route(R17): close`, `handoff(H17): record`)

**On the number.** R17 opens after R18 closed. Pairing decides the active route, never
numbering — `docs/titan/AGENTS.md` says so, and this is the case it was written for.

## Expected Files

| Path | Why |
|---|---|
| `src/services/titan/titanPipeline.ts` | The `discuss-current-step` verify |
| `src/services/titan/titanPipeline.test.ts` | Follows its module |
| `src/services/titanEngine.ts` | Only if the lens contract needs a shared extractor |
| `src/services/titanEngine.test.ts` | Follows its module |
| `src/i18n/translations.ts` | Any new EN/TR strings |
| `e2e/**` | A spec driving a stubbed agent that returns a divergent answer |
| `docs/titan/handoffs/H17-*.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

**Forecast, not gate.** Write what the criteria require inside your own ownership; justify
extras in `## Deviations`. Frozen and T0-owned paths stay absolute — no `AGENTS.md`, no route,
no protocol file.

## Invariants

- **The deterministic fallback must always pass its own verification.** If
  `deterministicFiveLens` output can be rejected, the extractor is wrong, not the answer. This
  is the cheapest available oracle — use it as one.
- **Fail closed, and fail usefully.** An answer whose slots cannot be extracted is not verified
  by default. Decide what happens instead — reject, or substitute the deterministic answer — and
  say which. Silently accepting an unparseable answer is the defect this route exists to remove.
- **Both languages.** The labels are `Kod/Veri/Görsel/Mantık/Zaman` in Turkish and
  `Code/Data/Visual/Reasoning/Time` in English. An extractor that only works in English is a
  half-built gate, and language switching must not change the verdict for the same step.
- **`Reasoning` is not verified.** Do not build a similarity score, a keyword matcher, or an
  entailment heuristic over it and call it verification. R16's array check was honest about its
  ceiling; this one must be too.
- `adapt-input` (R15), the array templates (R16), and `model-authored` (R18) keep their verify
  behaviour exactly. Do not refactor the three into a shared abstraction in this turn.
- Determinism: no `Math.random`, no wall-clock branching. The trace never comes from the model.
- Do not regress the five-bar progress display, and do not change what the user reads when the
  answer is correct.

## The decision

**Option A — verify the factual slots, reject on disagreement.** Extract line number, step
index, and total from the labelled slots; compare against
`workspace.steps[workspace.currentIndex]` and `steps.length`. Disagreement fails `verify`, the
run reports failure, nothing is applied.

Costs: a model that is right about the algorithm but sloppy about a number loses its whole
answer, and the user sees a failed run instead of a slightly wrong sentence. Extraction must be
robust across two languages and the model's formatting freedom, and every extraction miss
becomes a user-visible failure.

**Option B — verify the factual slots, repair on disagreement.** Same extraction. On
disagreement, `verify` passes but `apply` commits the deterministic answer for the failing
lenses instead of the model's, and the user is told which lenses were corrected.

Costs: the pipeline's `verify` stops being a gate and becomes a filter, which is a real
departure from what `verify` means for the other three intents. The user gets a mixed answer
whose provenance is split. Harder to reason about, harder to test.

**T0's reading, not binding:** A. The reason is consistency of meaning: `verify` rejects in
this system, and the one place it does something else should not be the place with the weakest
artifact. B's user experience is better on a sloppy model and worse on a broken one, and the
route cannot tell which it will meet. But A is only defensible if extraction is genuinely
robust — if the handoff finds that the labels are unreliable enough that A would fail on
correct answers, B with a clearly reported correction is the better outcome and this route
prefers it to a gate that cries wolf. Say which, with the measurement that decided it.

## Acceptance Criteria

1. The handoff names the option taken, the exact slots verified, and — one sentence each — what
   each slot's independent source of truth is. `Reasoning` is named as unverified.
2. **A test proves rejection (or repair) on a divergent answer.** Stub the agent so it returns a
   well-formed five-lens answer naming the wrong line number, and separately the wrong step
   index. Both must be caught. A test that only proves a correct answer passes does not meet
   this criterion.
3. **The deterministic fallback passes verification in both locales.** Drive
   `deterministicFiveLens` output through the new check for EN and TR on the same step and show
   both verdicts.
4. **Unparseable is not accepted.** A test proves an answer with no recognizable labels does not
   verify. State what the user sees.
5. Language switching does not change the verdict for a fixed step. One test, both locales.
6. A user-visible e2e spec drives a stubbed agent worker returning a divergent answer and shows
   what the user gets. The `model-authored-titan-mode.spec.ts` stub is the working pattern for
   this — reuse its shape rather than inventing one. **This criterion may not close on a unit
   test.**
7. `adapt-input`, the array templates, and `model-authored` are untouched. Name the R15, R16,
   and R18 tests that prove it.
8. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`.
9. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
   Claude's to close.
10. Two commits, in order: `route(R17): close`, then `handoff(H17): record`, both signed `-s`
    after verifying `git config user.email` returns `iyott131@gmail.com`. An optional published
    `fix(R17)` between them is permitted.

**(T0)** The `AGENTS.md` wording for the `discuss-current-step` verify and the five-lens
contract is Claude's, in `## T0 reconciliation`.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "c26fe77..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'deterministicFiveLens'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third command is criterion 3's evidence — run it against the base first and report the
delta. The fourth must show no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```
