# H17b — Current-step facts, not fallback wording

## Turn

- Route: R17b
- Base SHA: `f531938`
- End SHA: `081d2ccfa252b7c537c7554271f2070cf01fe146`
- Status: `closed locally; T0 remote and reconciliation pending`
- Next holder: Claude (T0)

## Özet

Code artık fallback cümlesini değil trace’in tekil satır numarasını, Data ise her committed
değişkenin açık anahtar/değer bağını doğruluyor; Time’ın gerçek sayı karşılaştırması korundu.
EN/TR’de farklı ifadeli altı cevap kabul edildi, belirsiz iki-sayılı Code reddedildi.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `src/services/titan/titanPipeline.ts:228-273` | compare current-step Code/Data facts instead of fallback wording | edited |
| `src/services/titan/titanPipeline.test.ts:201-238` | three non-fallback variants per verified slot in EN and TR | added |
| `src/services/titan/titanPipeline.test.ts:240-257` | reject ambiguous Code integers | added |

## Slot contract and limits

- **Code:** all standalone integers are extracted. A numeric `lineNumber` passes only when
  there is exactly one distinct integer and it equals the trace line. A null line passes only
  with no integer and an EN/TR result/final-step phrase. A semantically false sentence that
  happens to contain only the correct line number can still pass; two distinct integers fail
  even if one is correct.
- **Data:** every key in `step.visualData.vars` must occur with its committed JSON value through
  an explicit `:`, `=`, `is`, `value`, or `değeri` binding. Scalar formatting can vary, as the
  six EN/TR variants prove. Empty vars pass vacuously. Unknown extra claims are not checked;
  a correct binding followed by a second contradictory binding can slip through. Complex
  array/object values still require their deterministic JSON serialization and are therefore
  less prose-flexible than scalars.
- **Time:** unchanged. The first `current/total` pair is parsed and both integers are compared
  with `currentIndex + 1` and `steps.length`. A later contradictory pair is not inspected.
- **Visual and Reasoning:** required slots, deliberately not fact-verified, unchanged from R17.

No similarity score, model cooperation, or fallback sentence is used by Code/Data verification.

## Preserved tests

- R17 wrong line, wrong step index, and no-label rejection cases are unchanged at
  `titanPipeline.test.ts:166-183`.
- R17 deterministic EN/TR oracle is unchanged at `titanPipeline.test.ts:185-199`.
- R15: `rejects a well-formed artifact whose carried trace disagrees with independent recomputation`.
- R16: `defers the deterministic array engine apply and applies its verified package exactly once`.
- R18: `independently verifies a model-authored package before previewing and applying it exactly once`.

## Commits

- `081d2ccfa252b7c537c7554271f2070cf01fe146 route(R17b): close`
- `handoff(H17b): record` — this commit

Both are signed after `git config user.email` returned `iyott131@gmail.com`.

## Gate output

```text
lint: exit code 0 — > oxlint
test: exit code 0 — Test Files 119 passed (119) | Tests 828 passed (828)
test count before: 821
test count after: 828
build: exit code 0 — Initial JavaScript: 416.8 / 420.0 KiB
desktop:check: exit code 0 — test result: ok. 7 passed; 0 failed
local e2e: exit code 0 — 72 passed (1.3m) | 2 passed (34.9s), zero flaky
```

Performance output, verbatim:

```text
TIMELINE_MEASUREMENTS {"playwright":{"min":825.8014999999978,"median":867.4237500000002,"max":916.1044999999995},"inPage":{"min":165.30000000447035,"median":166.69999999552965,"max":167.90000000596046},"handler":{"min":0.4000000059604645,"median":0.7000000104308128,"max":0.9999999925494194},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1508.5417,"catalogMs":239.53859999999986,"simulationMs":72.35390000000007,"dpMs":2460.9714999999997}
```

## Verification output

```text
081d2ccfa252b7c537c7554271f2070cf01fe146
 .../R17b-grounded-current-step-verification.md     | 203 +++++++++++++++++++++
 src/services/titan/titanPipeline.test.ts           |  38 ++++
 src/services/titan/titanPipeline.ts                |  28 ++-
 3 files changed, 264 insertions(+), 5 deletions(-)

src\services\titan\titanPipeline.test.ts:140: tutorAnswer: 'Code: Active source line 9.\nData: Live variables {"i":2}.\nVisual: array.\nReasoning: Selected step.\nTime: Step 1/1.',
src\services\titan\titanPipeline.test.ts:167: ['wrong source line', 'Code: Active source line 14.\nData: Live variables {"i":2}.\nVisual: array.\nReasoning: prose is not checked.\nTime: Step 2/3.'],
src\services\titan\titanPipeline.test.ts:168: ['wrong step index', 'Code: Active source line 9.\nData: Live variables {"i":2}.\nVisual: array.\nReasoning: prose is not checked.\nTime: Step 1/3.'],
src\services\teachingPlan.ts:103: code: current.lineNumber === null ? 'Sonuç checkpointi; aktif kaynak satırı yok.' : `Kaynak kodun ${current.lineNumber}. satırı aktif.`,
src\services\titanEngine.ts:585: `Kod: Aktif kaynak satırı ${step.lineNumber ?? 'sonuç adımı'}.`,
src\services\titanEngine.ts:592: `Code: Active source line ${step.lineNumber ?? 'result step'}.`,
```

The first three matches are unchanged oracle/rejection fixtures; `titanEngine.ts` is the
unchanged deterministic fallback. `teachingPlan.ts` is a pre-existing, case-insensitive base
match outside this verifier. The verifier itself has zero fixed-phrase matches.

The `Math.random` scan, verbatim, contains only base matches:

```text
src\components\AiAssistant.tsx:1138:      ? (['lcs', 'edit', 'knapsack'] as const)[Math.floor(Math.random() * 3)]
src\components\AiAssistant.tsx:1141:      ? Math.floor(Date.now() + Math.random() * 1_000_000)
src\services\trace\interpreter.ts:163:    math.random = native('Math.random', () => this.nextRandom());
src\services\trace\jsTracer.test.ts:114:    const source = `function solve() { return [Math.random(), Math.random()]; }`;
src\services\algorithmCatalog.ts:90:  return filtered[Math.floor(Math.random() * filtered.length)];
src\services\titanEngine.ts:104:  `gm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\titanEntry.ts:67:  const runId = `gm-catalog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\webProblemOrchestrator.ts:190:    runId: `web-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
```

## Acceptance

1. **Met** — “A test proves a correctly-worded-but-differently-phrased answer is accepted. At
   minimum three variants per verified slot, none of them using the deterministic fallback's
   sentence forms, in both EN and TR. This is the criterion R17 lacked and the reason this
   route exists.” Evidence: `titanPipeline.test.ts:201`.
2. **Met** — “R17's three rejection cases still fail: wrong line, wrong step index, no labels.
   Same tests, unchanged.” Evidence: `titanPipeline.test.ts:166`.
3. **Met** — “The deterministic fallback still verifies in EN and TR. Same test, unchanged.”
   Evidence: `titanPipeline.test.ts:185`.
4. **Met** — “The handoff states, per slot, exactly what is compared and what an attacker or a
   sloppy model could still slip past. If `Data` was dropped from the verified set, say so in
   the first sentence of the handoff summary, not in a later section.” Evidence: `H17b / Slot contract and limits`.
5. **Met** — “A test proves ambiguity is a rejection, not a guess — an answer whose `Code` slot
   contains two different integers does not verify.” Evidence: `titanPipeline.test.ts:240`.
6. **Met** — “`adapt-input`, the array templates, and `model-authored` are untouched. Name the
   R15, R16, and R18 tests that prove it.” Evidence: `H17b / Preserved tests`.
7. **Met** — “All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
   `npm run desktop:check`.” Evidence: `H17b / Gate output`.
8. **Met locally / T0 remote pending** — “`npm run test:e2e` passes locally, both phases.
   (T0) The remote `browser` job is Claude's to close.” Evidence: `e2e/titan-mode.spec.ts:46` + `src/components/AiAssistant.tsx:897`.
9. **Met locally** — “Two commits, in order: `route(R17b): close`, then
   `handoff(H17b): record`, both signed `-s` after verifying `git config user.email` returns
   `iyott131@gmail.com`.” Evidence: `H17b / Commits`.

## Diff scope

```text
docs/titan/routes/R17b-grounded-current-step-verification.md | 203 +++++++++++++++++++++
src/services/titan/titanPipeline.test.ts                      |  38 ++++
src/services/titan/titanPipeline.ts                           |  28 ++-
3 files changed, 264 insertions(+), 5 deletions(-)
```

Both implementation files match Expected Files. The route is the T0-authored opening commit.

## Deviations

none

## Discovered

- The route's case-insensitive verification pattern also matches the pre-existing Turkish
  teaching-plan phrase at `src/services/teachingPlan.ts:103`; base-to-head adds no such line.

## Untouched

Filtered product diff contains only `titanPipeline.ts` and its test. R15 adapt-input, R16 array,
R18 model-authored, engine, UI dispatch, e2e, frozen, and T0-owned paths are unchanged by Sole.

## Blockers

none locally. T0 owns remote browser evidence and AGENTS reconciliation.

## For the human

none
