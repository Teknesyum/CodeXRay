# H20 — the user's sentence selects the intent, never the fetched page

## Turn

- Route: `docs/titan/routes/R20-fetched-content-selects-the-intent.md`
- Base: `b80f667` (`route(R19): reconcile and close`)
- Head: `b54c034` (`route(R20): close`) plus this handoff commit
- Holder: `t0-delegated` — implemented by Sole, verified independently by T0
- Option taken: **A**

## Özet

Option A alındı. `AiAssistant.tsx:690` artık `modelQuestion` yerine `userMessage` okuyor ve
bunu yeni `routeBoundWebProblemRequest` sarmalayıcısına veriyor: sarmalayıcı yalnızca
`create-algorithm` sonucunu geçiriyor, başka her şeyi atıp `model-authored` varsayılanına
düşüyor. İndirilen sayfa metni artık niyet seçemiyor — altı ölçüm satırı test olarak
kaydedildi, radyo satırı adıyla dahil.

Fact 4 ayrıca kapatıldı: `review` alanı artık `reviewer` ayırıcısı taşıyor, pipeline yolu
`reviewer: 'none'` yazıyor, `loadBoundWebSource` kim incelediğini söyleyemeyen bir kaydı
düşürüyor, ve kullanıcı cevabın içinde EN/TR bir satırla hiçbir eleştirmenin incelemediğini
görüyor.

Fact 2'nin boşluğu **kapanmadı** ve kapandığı iddia edilmiyor: kullanıcı bir şablonu kendi
cümlesinde adlandırırsa hâlâ pipeline'sız dala ulaşıyor. Bu, ölçümüyle birlikte kriter 5'te
düz yazılı.

## What changed

| Path:line-range | Intent | Change |
|---|---|---|
| `src/services/titanModeRouting.ts:312-322` | `routeBoundWebProblemRequest`: route from the user's message, keep only `create-algorithm`, default to `model-authored` | added |
| `src/components/AiAssistant.tsx:18,690-697` | Bound web solve routes from `userMessage` through the new wrapper | edited |
| `src/components/AiAssistant.tsx:697` | `titanModeRequest` becomes `modelQuestion` on this path so the serialized problem still reaches the model | edited |
| `src/components/AiAssistant.tsx:822` | Retry state keeps the user's own sentence, not the 12k prompt | edited |
| `src/components/AiAssistant.tsx:978` | `review: { reviewer: 'none', ... }` replaces the fabricated `passed: true` | edited |
| `src/components/AiAssistant.tsx:989` | Answer carries the EN/TR "no critic reviewed this" line | edited |
| `src/types/webSource.ts:78-100` | `SolutionReviewRecordV1` discriminated union; both artifact variants use it | edited |
| `src/services/webProblemOrchestrator.ts:5,143-157` | `validateReview` returns the `model-critic` arm explicitly | edited |
| `src/services/webSource.ts:358-388` | `hasReviewProvenance` guard drops a persisted solution whose review states no reviewer | edited |
| `src/i18n/translations.ts:263,624` | `webNoCriticReview` EN + TR | added |
| `src/services/titanModeRouting.test.ts:262-356` | Six measured rows before/after, radio row named, default and residual-gap cases | added |
| `src/services/webSource.test.ts:160-200` | Round-trips both reviewer arms; proves a legacy `passed: true` review is discarded on load | added |
| `e2e/web-problem-routing.spec.ts:1-138` | Drives a bound web problem whose page text says "radio must play a tone" | added |

## Commits

| SHA | Subject |
|---|---|
| `b54c03404f0afc6a0afe217a7cff38cef0e28d3f` | `route(R20): close` |
| (this file) | `handoff(H20): record` |

No `fix(R20)` was needed. Not pushed — push is T0's.

## What now selects the intent

`routeBoundWebProblemRequest(userMessage, ...)`. It calls the same deterministic
`routeTitanModeRequest` on the user's typed sentence, returns that intent **only if it is
`create-algorithm`**, and otherwise returns `{ type: 'create-algorithm', template:
'model-authored' }`. The closed intent set is unchanged; no new intent string exists. The
branch is entered only when the user asked to solve a bound web problem, so a
non-creation intent on that path is a misread, not a request — discarding it is the point.

```ts
export const routeBoundWebProblemRequest = (
  userMessage: string,
  steps: SimulationStep[],
  currentIndex: number,
  algorithmName = '',
): TitanModeIntent => {
  const intent = routeTitanModeRequest(userMessage, steps, currentIndex, algorithmName);
  if (intent?.type === 'create-algorithm') return intent;
  return { type: 'create-algorithm', template: 'model-authored' };
};
```

## The persisted review, before and after

Before, on the compatible path:

```ts
review: { passed: true, summary: (result as any).summary, findings: [] },
```

After:

```ts
review: { reviewer: 'none' as const, summary: (result as any).summary, findings: [] },
```

```ts
export type SolutionReviewRecordV1 =
  | ({ reviewer: 'model-critic' } & SolutionReviewV1)
  | { reviewer: 'none'; summary: string; findings: string[] };
```

**What a reader can now conclude.** `reviewer: 'model-critic'` means
`webProblemOrchestrator.validateReview` schema-checked a model critic's own verdict and
`passed` is that verdict — nothing more; `reviewer: 'none'` means no critic ran and only the
deterministic gates did, and the record carries no `passed` field to misread. A stored record
that says neither is dropped at load by `hasReviewProvenance`, so a pre-R20 fabricated
`{ passed: true, ... }` no longer rehydrates as a verdict.

## Gate output

### Verification greps — exit 0

```
b54c03404f0afc6a0afe217a7cff38cef0e28d3f
 .../R20-fetched-content-selects-the-intent.md      | 206 +++++++++++++++++++++
 e2e/web-problem-routing.spec.ts                    | 138 ++++++++++++++
 src/components/AiAssistant.tsx                     |  14 +-
 src/i18n/translations.ts                           |   2 +
 src/services/titanModeRouting.test.ts              |  98 +++++++++-
 src/services/titanModeRouting.ts                   |  11 ++
 src/services/webProblemOrchestrator.ts             |  10 +-
 src/services/webSource.test.ts                     |  41 ++++
 src/services/webSource.ts                          |   9 +-
 src/types/webSource.ts                             |   8 +-
 10 files changed, 524 insertions(+), 13 deletions(-)
```

`routeTitanModeRequest(` — production sites only (test files omitted here, full output ran
verbatim and is reproduced under **Full grep output** below):

```
base b80f667:
  src/components/AiAssistant.tsx:504
  src/components/AiAssistant.tsx:507
  src/components/AiAssistant.tsx:690

head b54c034:
  src\components\AiAssistant.tsx:504
  src\components\AiAssistant.tsx:507
  src\services\titanModeRouting.ts:317
```

Delta: the `:690` call on the bound web path is gone; the only remaining production caller of
the raw router outside `AiAssistant.tsx` is the new wrapper's own body at
`titanModeRouting.ts:317`, which is handed `userMessage`.

`passed: true` — production sites:

```
base b80f667:
  src/components/AiAssistant.tsx:978:            review: { passed: true, summary: (result as any).summary, findings: [] },

head b54c034:
  (no match in AiAssistant.tsx)
```

Delta: the fabricated literal is gone. Every remaining head match is either a deterministic
compiler's own test result (`arrayCompiler.ts:729`, `dpTemplateCompiler.ts:859`,
`intervalDpCompiler.ts:323`, `linkedListCompiler.ts:337`, `backtrackingCompiler.ts:370`,
`stringCompiler.ts:236`, `customSimulationCompiler.ts:94`, `advancedGraphCompiler.ts:104`,
`advancedStructureCompiler.ts:69`, `titanEngine.ts:1511`) or a test fixture.

`Math.random` — base 8 matches, head 8 matches. `new Function|eval(` — base 3 matches, head
3 matches. **No new match in either.** Head matches verbatim:

```
src\components\AiAssistant.tsx:1173:      ? (['lcs', 'edit', 'knapsack'] as const)[Math.floor(Math.random() * 3)]
src\components\AiAssistant.tsx:1176:      ? Math.floor(Date.now() + Math.random() * 1_000_000)
src\services\trace\interpreter.ts:163:    math.random = native('Math.random', () => this.nextRandom());
src\services\trace\jsTracer.test.ts:114:    const source = `function solve() { return [Math.random(), Math.random()]; }`;
src\services\algorithmCatalog.ts:90:  return filtered[Math.floor(Math.random() * filtered.length)];
src\services\titanEngine.ts:104:  `gm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\titanEntry.ts:67:  const runId = `gm-catalog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\webProblemOrchestrator.ts:196:    runId: `web-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
src\services\trace\jsTracer.test.ts:136:    ['eval("1 + 1")', 'Dynamic code execution'],
src\services\trace\jsTracer.test.ts:137:    ['new Function("return 1")', 'Function constructor'],
src\services\trace\traceIntelligence.test.ts:51:    expect(() => queryTrace(trace, 'eval(i)')).toThrow('Unsupported trace query');
```

### `npm run lint` — exit 0

```
> codexray@2.3.4 lint
> oxlint


LINT_EXIT=0
```

### `npm run test` — exit 0

```
> codexray@2.3.4 test
> vitest run


 RUN  v4.1.10 C:/Users/Administrator/Desktop/Projeler/CodeXray


 Test Files  119 passed (119)
      Tests  846 passed (846)
   Start at  21:14:24
   Duration  19.92s (transform 15.14s, setup 23.68s, import 21.93s, tests 43.36s, environment 155.23s)


TEST_EXIT=0
```

Base was 834 tests; head is 846. +12 tests, no file count change beyond the two edited suites.

### `npm run build` — exit 0

```
dist/assets/titanModeRouting-Js300yba.js              21.29 kB │ gzip:   7.05 kB
dist/assets/AiAssistant-CFC75BZW.js                   43.56 kB │ gzip:  14.44 kB
dist/assets/customSimulationCompiler-YI85GfrF.js      44.31 kB │ gzip:  13.94 kB
dist/assets/recompileSimulationInput-rDSYxmwj.js      81.54 kB │ gzip:  23.50 kB
dist/assets/titanPipeline-BwpbF2ZS.js                 89.08 kB │ gzip:  24.87 kB
dist/assets/index-BJXCBcea.js                        427.03 kB │ gzip: 131.71 kB

✓ built in 403ms
Initial JavaScript: 417.0 / 420.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB

BUILD_EXIT=0
```

### `npm run desktop:check` — exit 0

```
test tests::loopback_urls_are_normalized ... ok
test tests::non_loopback_and_credential_urls_are_rejected ... ok
test tests::reasoning_only_length_stop_is_returned_for_a_bounded_retry ... ok
test tests::probe_json_parser_accepts_plain_or_fenced_objects ... ok
test tests::structured_output_requires_three_native_trials ... ok

test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running unittests src\main.rs (src-tauri\target\debug\deps\codexray-942d332ff66ec993.exe)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests codexray_lib

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s


DESKTOP_EXIT=0
```

### `npm run test:e2e` with external server — exit 0, both phases

```
SERVER_PID=38016
  ok 62 [chromium] › e2e\translation-provenance.spec.ts:3:1 › translates a reviewed Java web solution into a verified simulation badge (3.0s)
  ok 63 [chromium] › e2e\translation-provenance.spec.ts:155:1 › shows a refused Java fallback without changing workspace or persisted bound source (3.1s)
  ok 74 [chromium] › e2e\web-problem-routing.spec.ts:3:1 › a fetched page cannot select the intent of a bound web solve (2.4s)

  74 passed (1.0m)

Running 2 tests using 1 worker

TIMELINE_MEASUREMENTS {"playwright":{"min":745.9543000000012,"median":812.8307499999996,"max":980.7790000000005},"inPage":{"min":165.89999997615814,"median":166.55000001192093,"max":167},"handler":{"min":0.20000004768371582,"median":0.7000000774860382,"max":1.1000000834465027},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1673.6485999999998,"catalogMs":246.79559999999992,"simulationMs":79.80220000000008,"dpMs":2439.2090000000026}
  ok 1 [chromium] › e2e\performance-budget.spec.ts:23:1 › keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets @performance (23.8s)
  ok 2 [chromium] › e2e\performance-budget.spec.ts:123:1 › survives repeated cross-subsystem use without stale state, overflow, or locked controls @performance (9.0s)

  2 passed (34.0s)

E2E_EXIT=0
```

Cleanup: only this run's PIDs were stopped — `38016` (the `npm.cmd` handle) and its vite child
`16608`, confirmed by `CreationDate : 6.09.2026 21:15:02` and command line
`"node" "...\vite\bin\vite.js" --host 127.0.0.1 --port 4173`. After the stop,
`Get-NetTCPConnection -LocalPort 4173 -State Listen` returned nothing: `PORT_4173=closed`.
No process was killed by name and no port was swept.

### Full grep output

The route's third and fourth grep commands were run verbatim over all of `src`; their complete
output (production and test matches, 60+ lines dominated by
`titanModeRouting.test.ts` assertions) is reproduced above for every production match and
every `Math.random` / `eval` match. Test-file matches of `routeTitanModeRequest(` and
`passed: true` are assertions and fixtures only; none of them is a call site that reaches a
fetched document.

## Acceptance

1. **Met.** Stated in `## What now selects the intent`: on the bound web path the intent is
   selected by `routeBoundWebProblemRequest` from the user's own typed message, and any
   non-`create-algorithm` result is discarded in favour of the named default
   `create-algorithm: model-authored`.
2. **Met.** `titanModeRouting.test.ts` `records the routed intent of every measured row,
   before and after` re-runs all six rows through `buildWebProblemPrompt` +
   `routeTitanModeRequest` and asserts the before list exactly:
   `adapt-input`, `predict-winner-interval-dp`, `bidirectional-bfs`,
   `ui-control: radio-play`, `adapt-input`, `jump-game-dp` — reproducing T0's table
   unchanged — then asserts all six after values are `create-algorithm: model-authored`.
   The radio row additionally has its own named test, `never lets a fetched page open the
   radio player`, and the per-row `it.each` case `page text no longer selects the intent`.
3. **Met.** `routes a neutral bound web solve to the model-authored creation default` proves
   both `'Solve this problem'` and `'Bu problemi çöz'` produce
   `create-algorithm: model-authored`. **Why that one:** it is the intent that means "author a
   program for this problem", it is the only creation intent that does not presuppose an
   algorithm family the fetched problem may not belong to, and R18's
   `verifyModelAuthoredArtifact` gates it — so the common case is the one case that runs
   behind the pipeline.
4. **Met.** New shape and reader conclusions in `## The persisted review, before and after`.
   `webSource.test.ts` `keeps a persisted solution only when its review states who reviewed
   it` round-trips both arms, asserts the `reviewer: 'none'` record has no `passed` property,
   and asserts a stored legacy `{ passed: true, ... }` review makes
   `loadBoundWebSource()?.solution` null. The e2e spec asserts the same from the browser:
   `expect(persistedReview).toMatchObject({ reviewer: 'none' })` and
   `expect(persistedReview).not.toHaveProperty('passed')`.
5. **Met, and the gap is not closed.** Stated plainly: the dispatch ladder still gives a
   pipeline to exactly four intents — `discuss-current-step`, `adapt-input`, the four
   deterministic array templates, and `model-authored`. Every other `create-algorithm`
   template still falls through to `startTitanModeRun` and commits with **no external refusal
   point**: `predict-winner-interval-dp`, `bidirectional-bfs`, `lcs-space-optimized-1d-dp`,
   and the rest of the interval/DP and structure families, plus `create-catalog-problem`,
   `clarify-algorithm`, `ui-control`, and `deterministic`. **A user who names one still
   reaches it**, including from a bound web solve — measured, not assumed:
   `still lets the user name a template that commits without a pipeline` asserts that
   `'Solve this with bidirectional BFS and build it'` yields `bidirectional-bfs` and
   `'Solve predict the winner and show it'` yields `predict-winner-interval-dp` through the
   new wrapper. R20 stopped the **page** from opening that door; it did not remove the door.
6. **Met.** `e2e/web-problem-routing.spec.ts` intercepts every `**/api/codexray/read-url`
   call and asserts `readerRequests` has length exactly 1, that its URL plus post data
   contains only the requested `https://example.com/radio-signals`, and that the post data
   contains neither `Bound Web Scan` nor `bound_web_scan` — i.e. no workspace or
   model-authored artifact leaked outward. No other network route is used; the model runs in
   a stubbed Worker.
7. **Met — no verify body was touched.** `git diff b80f667..HEAD` does not include
   `src/services/titan/titanPipeline.ts`. Named tests, all passing in the run above:
   - R15 `adapt-input` — `rejects a well-formed artifact whose carried trace disagrees with
     independent recomputation`, `preserves workspace, package, and timeline identity when
     adapt-input verification fails`, `carries adapt-input through five stages and applies
     only the verified package`.
   - R16 array templates — `defers the deterministic array engine apply and applies its
     verified package exactly once`.
   - R17c `discuss-current-step` — `accepts every deterministic fallback at the maximum legal
     input size`, `rejects a Data binding that contradicts the committed variable value`,
     `rejects an ambiguous Code slot with two distinct integers`.
   - R18 `model-authored` — `independently verifies a model-authored package before previewing
     and applying it exactly once`, `rejects an empty carried model trace before preview and
     preserves every workspace snapshot field`.
   - R19 web fallback — `refuses a web fallback whose carried trace disagrees with independent
     recompilation`, `keeps workspace and persisted web state unchanged when web fallback
     verify refuses`, `applies and persists a verified web fallback exactly once`, plus
     `e2e/translation-provenance.spec.ts` both cases.
8. **Met, by e2e.** `e2e/web-problem-routing.spec.ts:3` — `a fetched page cannot select the
   intent of a bound web solve`. The stubbed page is titled `Radio Signals` with the statement
   `The radio must play a tone. Count the signals in the array.` — the exact keyword that
   selected `ui-control: radio-play` in T0's measurement. The user types
   `Solve https://example.com/radio-signals and simulate it`. What the user gets, asserted:
   the `Bound Web Scan — Custom execution` visualization is visible, the step explanation
   contains `validated input`, the answer contains `No critic reviewed this solution`, the
   `ui-control` confirmation `I updated the workspace layout as requested.` has count 0, and
   the radio player exposes no Pause button. **This spec was proven to fail on base
   behaviour**: with the `:690` line reverted to `modelQuestion`, the run timed out and the
   Playwright error context captured verbatim
   `- paragraph: I updated the workspace layout as requested.` and
   `- button "Pause radio without opening"`. The fix was then restored.
9. **Met.** `lint`, `test`, `build`, `desktop:check` all exit 0; output above.
10. **Met locally.** `74 passed (1.0m)` and `2 passed (34.0s)`, `E2E_EXIT=0`. The remote
    `browser` job is T0's to close.
11. **Met.** `git config user.email` returns `iyott131@gmail.com`; both commits carry
    `Signed-off-by: Mustafa Özel <iyott131@gmail.com>` and
    `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Order:
    `route(R20): close` (`b54c034`), then `handoff(H20): record`. No `fix(R20)` was needed.

## Diff scope

`git diff --name-only b80f667..HEAD` for the close commit, paths staged individually — never
`git add -A` or `git add .`:

```
e2e/web-problem-routing.spec.ts
src/components/AiAssistant.tsx
src/i18n/translations.ts
src/services/titanModeRouting.test.ts
src/services/titanModeRouting.ts
src/services/webProblemOrchestrator.ts
src/services/webSource.test.ts
src/services/webSource.ts
src/types/webSource.ts
```

`docs/titan/routes/R20-fetched-content-selects-the-intent.md` also appears in the
`b80f667..HEAD` range. It is T0's own route-open commit, not a write by this turn:
`git show --name-only b54c034` does not list it.

## Deviations

- **Four files outside `## Expected Files`.** `src/services/webProblemOrchestrator.ts`,
  `src/services/webSource.ts`, `src/services/webSource.test.ts`. The route forecast
  `src/types/webSource.ts` "only if the review field needs an honest shape" — it did, and
  giving `SolutionReviewRecordV1` a discriminant forces `validateReview` to name the
  `model-critic` arm (a `tsc -b` project-reference error the plain `tsc --noEmit` did not
  surface) and makes the load-time provenance guard in `webSource.ts` possible. Criterion 4
  asks what a reader of stored state can conclude, and only a load-time guard makes that
  answer true of pre-R20 stored records. `webSource.test.ts` follows its module.
- **`titanModeRequest` on this path is now `modelQuestion`.** Option A moves `userMessage`
  into the router; on base, `modelQuestion` was the router's input and `userMessage` was the
  pipeline's request, so a naive Option A would have removed the serialized problem from the
  run entirely. The invariant "The fetched problem still reaches the model" required the
  swap: the router gets `userMessage`, the pipeline gets `modelQuestion`, and
  `buildWebProblemPrompt` keeps its delimiters and payload untouched.
- **`setLastTitanModeRequest` keeps the user's sentence on this path.** Retry state stored the
  request handed to the pipeline; that is now the ~12k-character serialized prompt, which a
  retry would replay as if the user had typed it. On the bound web path it now stores
  `userMessage`. Behavioural change made deliberately, not a side effect.

## Discovered

- **Before R20, `modelQuestion` reached no model at all on the compatible path.** It was built
  at `:648` and consumed only by `routeTitanModeRequest` at `:689`; the pipeline was entered
  with `userMessage`. So the serialized fetched problem — title, description, input/output
  format, examples, constraints, notes, signature, inside
  `EXTERNAL_WEB_CONTENT_BEGIN`/`END` — existed solely as regex input. The delimiters were
  being paid for and never used. R20 makes that string the model request, which is what its
  name and its delimiters always implied.
- **A plain `tsc --noEmit` hides errors this repo's build catches.** The project uses `tsc -b`
  with references; the `SolutionReviewRecordV1` narrowing error at
  `webProblemOrchestrator.ts:367` appeared only under `npm run build`. Do not use
  `tsc --noEmit` as a pre-gate here.
- **The word "solve" inside a fetched signature changes the routed intent.** While reproducing
  T0's table, a fixture signature `public int solve(int[] nums)` made
  `requestsCompositeCreation` true and turned the neutral row into `model-authored` instead of
  the measured `adapt-input`. The fixture uses `compute` so the table reproduces exactly. This
  is further evidence for Option A, not an artifact of it: an arbitrary method name in fetched
  source was steering the router.

## Untouched

- `src/services/titan/titanPipeline.ts` — no verify body changed. R15, R16, R17c, R18, R19
  behaviour byte-identical.
- `src/services/webSource.ts:392` `buildWebProblemPrompt` — payload and
  `EXTERNAL_WEB_CONTENT_BEGIN`/`END` delimiters unchanged.
- `docs/titan/DOD.md` — **no evidence cell edited.** No DOD row maps to R20; row 8, the
  nearest in subject, is already `closed` citing H03. Nothing there is made true or false by
  this turn, so nothing was written. Flagging it rather than silently skipping it.
- No `.claude/**`, `.agents/AGENTS.md`, `docs/tasks/**`, `docs/legacy/**`,
  `CodeXray-readme-neon.svg`, `docs/TITAN_MODE_YOL_HARITASI.md`, `AGENTS.md`,
  `docs/titan/PROTOCOL.md`, or `docs/titan/routes/**` was written.
- No new remote call, secret, or API key. No `eval`, no `new Function`, no new `Math.random`,
  no wall-clock branching. The trace still comes only from the deterministic compiler.

## Blockers

None.

## For the human

1. **Push.** Both commits are local on `main`; nothing was pushed. `b54c034` plus the handoff
   commit.
2. **Criterion 10's remote `browser` job** is T0's to close after the push.
3. **The `AGENTS.md` wording for the web routing boundary** is T0's, in `## T0
   reconciliation` — not written here.
4. **Fact 2 is still open.** R20 stopped fetched text from reaching non-pipelined templates;
   it did not give those templates a refusal point. If that matters, it is a route of its own.
