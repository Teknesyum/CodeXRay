# H22 — adapt-input has no way to say no

## Turn

- Route: `docs/titan/routes/R22-adapt-input-has-no-way-to-say-no.md`
- Base: `ff9071d` (`docs(R21): record advisory provenance and the fail-closed critic`)
- Head: `1adf406` (`route(R22): close`) plus this handoff commit
- Status: `closed`
- Next holder: Claude (T0)
- Option taken: **A** — both halves. Item 2 measured smaller than the estimate:
  `applyInputPatches` already accepts a graph op against a synthetic contract, so the
  package-less branch is the same seven lines the `set-param` path already had.

## Özet

Option A alındı. `adaptSimulationInputFromRequest`'in zaten döndürdüğü `origin` ayrımını artık
`isUnderstoodInputAdaptation` okuyor; kullanıcının girdisi varken hiçbir yamalayıcı isteği
anlamadıysa `adapt-input` koşusu EN/TR bir redle düşüyor ve çalışma alanı hiç değişmiyor.

İkinci yarı da kapandı: anlamsal dizi işlemleri ve dört grafik işlemi aktif paket olmadan da
`applyInputPatches` üzerinden uygulanıyor, ve reddedilen bir grafik isteği artık yalnız kabul
edilenin uygulanacağı koşullarda turu düşürüyor.

`graphRequestEdits.ts:25`'teki İngilizce `a` artikeli düzeltildi — item 2 onu üretime açtığı
için aynı turda yapıldı, `## Deviations`'a bırakılmadı.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `src/services/inputRequestAdapter.ts:80-83` | the explicit "not understood" outcome, reading the `origin` discriminant the adapter already returned | added |
| `src/services/titanEngine.ts:41` | import `isUnderstoodInputAdaptation` | edited |
| `src/services/titanEngine.ts:860-889` | `packagelessContract` helper; the semantic array op applies without an active package | edited |
| `src/services/titanEngine.ts:891-938` | the `set-param` fallback now uses `packagelessContract`; the four graph ops apply without an active package; a rejected graph request throws only when an accepted one would have applied | edited |
| `src/services/titanEngine.ts:957-961` | the EN/TR refusal, thrown when the request was not understood and the workspace already had an input | added |
| `src/services/graphRequestEdits.ts:25-27` | the English article `a` is no longer a node count; `add a node` / `a node add` still count as one | edited |
| `src/services/inputRequestAdapter.test.ts:2` | import the new predicate | edited |
| `src/services/inputRequestAdapter.test.ts:71-117` | the four measured sentences, the no-current-input case, the understood branches | added |
| `src/services/titanEngine.test.ts:6` | import `createInputPreset` | edited |
| `src/services/titanEngine.test.ts:859-958` | `adapt-input without an active package`: four refusals, the TR refusal, the preset case, the package-less array op, the package-less graph op, the package-less rejected graph op | added |
| `src/services/graphRequestEdits.test.ts:166-189` | `A düğümünü sil` plans exactly one `graph-remove`; `add a node` still counts one | added |

## Commits

```
1adf40672631ce0b645515f7c63fae595e63d495 route(R22): close
```

Plus this `handoff(H22): record` commit. No `fix(R22)` commit was needed; nothing was pushed
during the turn, so no published evidence forced a correction.

## Gate output

`npm run lint`, exit 0:

```
> codexray@2.3.4 lint
> oxlint
```

`npm run test`, exit 0. Before the turn (at `ff9071d`, `git checkout ff9071d -- src/`):

```
 Test Files  119 passed (119)
      Tests  850 passed (850)
```

After the turn:

```
 RUN  v4.1.10 C:/Users/Administrator/Desktop/Projeler/CodeXray


 Test Files  119 passed (119)
      Tests  867 passed (867)
   Start at  18:27:29
   Duration  24.01s (transform 14.60s, setup 28.89s, import 21.85s, tests 47.75s, environment 184.40s)
```

Delta: **+17 tests**, 0 new files — all three test files already existed.

`npm run build`, exit 0:

```
dist/assets/AiAssistant-z9Fz0DO2.js                   43.56 kB │ gzip:  14.45 kB
dist/assets/customSimulationCompiler-YI85GfrF.js      44.31 kB │ gzip:  13.94 kB
dist/assets/recompileSimulationInput-rDSYxmwj.js      81.54 kB │ gzip:  23.50 kB
dist/assets/titanPipeline-DtFrzc7g.js                 91.11 kB │ gzip:  25.42 kB
dist/assets/index-Ddw0onjp.js                        427.17 kB │ gzip: 131.74 kB

✓ built in 388ms
Initial JavaScript: 417.2 / 420.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
```

`npm run desktop:check` was **not run**: `git diff --name-only "ff9071d..HEAD"` lists no
`src-tauri/**` path.

## e2e

Local external-server procedure from `AGENTS.md`. Final run at `1adf406`:

```
  74 passed (1.2m)

Running 2 tests using 1 worker

TIMELINE_MEASUREMENTS {"playwright":{"min":875.5735999999997,"median":965.7744,"max":992.1612000000005},"inPage":{"min":164.0999999642372,"median":166.4500000178814,"max":167.60000002384186},"handler":{"min":0.800000011920929,"median":1.0000000596046448,"max":1.3000001907348633},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":3044.8317,"catalogMs":293.99559999999974,"simulationMs":74.27030000000013,"dpMs":2524.2893000000004}
  ok 1 [chromium] › e2e\performance-budget.spec.ts:23:1 › keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets @performance (27.8s)
  ok 2 [chromium] › e2e\performance-budget.spec.ts:123:1 › survives repeated cross-subsystem use without stale state, overflow, or locked controls @performance (9.8s)

  2 passed (39.0s)
```

The **first** full e2e run of the turn had one failure. It is recorded here rather than
summarized away, because it is a flake this route did not cause and someone will meet it again:

```
  1 failed
    [chromium] › e2e\translation-provenance.spec.ts:155:1 › shows a refused Java fallback without changing workspace or persisted bound source
```

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Translation verification failed/)
Expected: visible
Error: strict mode violation: getByText(/Translation verification failed/) resolved to 2 elements:
    1) <span class="agent-summary" title="Translation verification failed: Line 2: Expected budgets header.">Translation verification failed: Line 2: Expected…</span> aka getByTitle('Translation verification')
    2) <p>Translation verification failed: Line 2: Expected…</p> aka getByRole('paragraph').filter({ hasText: 'Translation verification' })
```

It is a strict-mode ambiguity, not a missing message: the expected text was present twice —
once in the still-rendered job summary span, once in the chat paragraph. Measured both ways:

```
# base src (git checkout ff9071d -- src/), spec alone
  ok 2 [chromium] › e2e\translation-provenance.spec.ts:155:1 › shows a refused Java fallback without changing workspace or persisted bound source (2.0s)
  ok 1 [chromium] › e2e\translation-provenance.spec.ts:3:1 › translates a reviewed Java web solution into a verified simulation badge (2.3s)

  2 passed (2.7s)
```

```
# R22 src, spec alone
  ok 2 [chromium] › e2e\translation-provenance.spec.ts:155:1 › shows a refused Java fallback without changing workspace or persisted bound source (987ms)
  ok 1 [chromium] › e2e\translation-provenance.spec.ts:3:1 › translates a reviewed Java web solution into a verified simulation badge (2.3s)

  2 passed (2.7s)
```

```
# R22 src, full suite, second run
  74 passed (1.0m)
```

The spec passes on R22 source alone and in the full suite; it is timing-dependent under
parallel load. Its locator is not scoped to the chat panel — see `## Discovered`.

## Acceptance

Criteria copied verbatim from the route.

1. **An `adapt-input` request that no patcher understands, on a workspace that already has an
   input, does not change the workspace and does not report success. A unit test reproduces
   all four measured sentences.** — met.
   `src/services/titanEngine.test.ts:884` (`refuses %s and leaves the workspace untouched`,
   `it.each` over `diziyi karıştır`, `sort the array`, `diziyi ters çevir`,
   `make it interesting`; asserts the run rejects and that neither `applyInput` nor
   `applyPackage` was called). Production call site: `src/services/titanEngine.ts:957`.
2. **The refusal message exists in EN and TR and names the fact that the input was left
   unchanged.** — met. `src/services/titanEngine.ts:959-961`; asserted in both locales by
   `src/services/titanEngine.test.ts:884` (EN, `not understood`) and
   `src/services/titanEngine.test.ts:899` (TR, `değiştirilmeden bırakıldı`).
3. **A request with no current input still receives a preset. A test asserts it.** — met.
   `src/services/titanEngine.test.ts:907` (`still presets when the workspace has no input of
   the required kind`) asserts `applyInput` was called once with an `array` input.
4. **Requests that are understood today keep working unchanged — the six existing
   `inputRequestAdapter.test.ts` cases pass without modification.** — met. The diff of that
   file adds only an import symbol and a new `describe` block; no existing assertion changed.
   `git diff "ff9071d..HEAD" -- src/services/inputRequestAdapter.test.ts` shows hunks
   `@@ -1,5 +1,5 @@` (import) and `@@ -67,3 +67,51 @@` (append only).
5. **(Option A or C) With no active package, a semantic array op and a graph op produce the
   same input change they produce with one. A test asserts at least one of each.** — met.
   Array: `src/services/titanEngine.test.ts:918` (`applies a semantic array op with no active
   package`, `sort-array` desc on `[9, 4, 7, 1, 3]` → `[9, 7, 4, 3, 1]`). Graph:
   `src/services/titanEngine.test.ts:931` (`applies a structural graph op with no active
   package`). Production call sites: `src/services/titanEngine.ts:885` and
   `src/services/titanEngine.ts:934`.
6. **(Option A or C) A rejected graph request fails the run only under the conditions in which
   an accepted one would have been applied. A test asserts the package-less rejected case.** —
   met. `src/services/titanEngine.test.ts:948` (`fails a rejected graph request with no active
   package`). Both the throw at `src/services/titanEngine.ts:917` and the application at
   `src/services/titanEngine.ts:918` are now gated on exactly `current` (and, upstream at
   `:914-916`, on `current.graph && !visualOnly`); `options.activePackage` no longer appears in
   either gate.
7. **`src/services/requestLiterals.ts` is unchanged, and no new quote convention or seed
   inference was added. Show the file's diff is empty.** — met.
   `git diff "ff9071d..HEAD" -- src/services/requestLiterals.ts` produced no output — the fifth
   verification command, below.
8. **`npm run lint`, `npm run test`, `npm run build` pass. `npm run desktop:check` if
   `src-tauri/**` changed.** — met; `## Gate output`. No `src-tauri/**` path changed.
9. **e2e passes. If an existing e2e spec depended on the preset fallback, say which and how it
   was resolved.** — met; `## e2e`. **No existing e2e spec depended on the preset fallback.**
   No spec was modified; `git diff --name-only "ff9071d..HEAD"` lists no `e2e/**` path.
10. **(T0) The handoff states how many of the eleven `inputPatch.ts` ops are reachable from
    production without an active package, before and after this turn, as counted numbers.** —
    stated below in `## The op count`.
11. **No frozen or T0-owned path is written.** — met; `## Untouched`.
12. **Every commit is DCO-signed as `Mustafa Özel <iyott131@gmail.com>`; confirm
    `git config user.email` before the first commit.** — met. `git config user.email` returned
    `iyott131@gmail.com` before the first commit and again in the verification block.

## The op count

Criterion 10 asks for eleven ops. **`InputPatchV1` has thirteen members**, not eleven
(`src/services/input/inputPatch.ts:10-23`). The count is given against the actual union and
the discrepancy is reported in `## Discovered` rather than papered over.

Reachable from the production `adapt-input` path **without** an active package:

| op | before | after | how, after |
|---|---|---|---|
| `set-array` | yes | yes | `createInputReplacementPatch` → `applyInputPatch` with the synthetic contract at `titanEngine.ts:969` |
| `set-matrix` | yes | yes | same |
| `set-graph` | yes | yes | same |
| `set-text` | yes | yes | same |
| `load-preset-input` | yes | yes | same (the replacement fallback in `inputPatch.ts`) |
| `set-param` | yes | yes | `createSemanticParameterPatches` → `applyInputPatches`, `titanEngine.ts:908` |
| `resize-array` | **no** | yes | `createSemanticArrayPatch` → `applyInputPatches`, `titanEngine.ts:885` |
| `sort-array` | **no** | yes | same |
| `shuffle-array` | **no** | yes | same |
| `set-target` | **no** | yes | `createStructuralGraphPatches` → `applyInputPatches`, `titanEngine.ts:934` |
| `graph-add-node` | **no** | yes | same |
| `graph-add-edge` | **no** | yes | same |
| `graph-remove` | **no** | yes | same |

**Before this turn: 6 of 13. After this turn: 13 of 13.** The seven that moved are exactly the
seven the route named.

The `AGENTS.md` sentence "Every op and every parameter key is reachable from production as of
R14 — 11/11 ops, 11/11 keys" is **T0's to correct**; this turn did not touch `AGENTS.md`. As of
this turn the qualification it was missing is no longer needed for ops — every op is now
reachable with or without an active package. The sentence's *arithmetic* is still wrong
independently of that: the union has thirteen members.

## Verification

Run verbatim from `docs/titan/routes/R22-adapt-input-has-no-way-to-say-no.md`, PowerShell 5.1.

```
PS> git log -1 --format=%H
1adf40672631ce0b645515f7c63fae595e63d495

PS> git config user.email
iyott131@gmail.com

PS> git diff --name-only "ff9071d..HEAD"
docs/titan/routes/R22-adapt-input-has-no-way-to-say-no.md
src/services/graphRequestEdits.test.ts
src/services/graphRequestEdits.ts
src/services/inputRequestAdapter.test.ts
src/services/inputRequestAdapter.ts
src/services/titanEngine.test.ts
src/services/titanEngine.ts

PS> git diff --stat "ff9071d..HEAD"
 .../routes/R22-adapt-input-has-no-way-to-say-no.md | 270 +++++++++++++++++++++
 src/services/graphRequestEdits.test.ts             |  25 ++
 src/services/graphRequestEdits.ts                  |   4 +-
 src/services/inputRequestAdapter.test.ts           |  50 +++-
 src/services/inputRequestAdapter.ts                |   5 +
 src/services/titanEngine.test.ts                   | 102 ++++++++
 src/services/titanEngine.ts                        | 103 +++++---
 7 files changed, 517 insertions(+), 42 deletions(-)

PS> git diff "ff9071d..HEAD" -- src/services/requestLiterals.ts

PS> Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern "origin === 'preset'"

src\services\inputRequestAdapter.ts:83:): boolean => !(result.origin === 'preset' && Boolean(current));

PS> Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'options\.activePackage'

src\services\input\inputPatch.ts:412:  const applied = applyInputPatches(options.currentInput, options.patches, options.activePackage.input, {
src\services\input\inputPatch.ts:415:  if (applied.ok === false) return { ...applied, package: options.activePackage };
src\services\input\inputPatch.ts:418:      activePackage: options.activePackage,
src\services\input\inputPatch.ts:428:      package: options.activePackage,
src\services\titanEngine.ts:840:        const visualOnly = Boolean(options.activePackage?.input.value.graph)
src\services\titanEngine.ts:844:          const kind = options.activePackage?.input.kind
src\services\titanEngine.ts:846:          const isMatrixPackage = options.activePackage?.program.id === 'spiral_matrix';
src\services\titanEngine.ts:872:            if (options.activePackage) {
src\services\titanEngine.ts:874:                activePackage: options.activePackage,
src\services\titanEngine.ts:896:            if (options.activePackage) {
src\services\titanEngine.ts:898:                activePackage: options.activePackage,
src\services\titanEngine.ts:922:            if (options.activePackage) {
src\services\titanEngine.ts:924:                activePackage: options.activePackage,
src\services\titanEngine.ts:947:            activeProgramId: options.activePackage?.program.id,
src\services\titanEngine.ts:949:          if (options.activePackage?.program.id === 'predict_winner_interval_dp') {
src\services\titanEngine.ts:957:          if (options.activePackage?.program.id !== 'predict_winner_interval_dp'
src\services\titanEngine.ts:967:            matrix: options.activePackage?.program.id === 'spiral_matrix',
src\services\titanEngine.ts:969:          const contract = options.activePackage?.input ?? {
src\services\titanEngine.ts:991:          const parsed = options.activePackage?.program.id === 'spiral_matrix'
src\services\titanEngine.ts:995:          if (options.activePackage) {
src\services\titanEngine.ts:996:            if (options.activePackage.program.id === 'predict_winner_interval_dp') {
src\services\titanEngine.ts:998:                id: `${options.activePackage.id}-input-${Date.now().toString(36)}`,
src\services\titanEngine.ts:1004:              updatedPackage = patchPackageGraphLayout(options.activePackage, parsed.input.graph);
src\services\titanEngine.ts:1007:                activePackage: options.activePackage,

PS> Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

src\components\AiAssistant.tsx:1173:      ? (['lcs', 'edit', 'knapsack'] as const)[Math.floor(Math.random() * 3)]
src\components\AiAssistant.tsx:1176:      ? Math.floor(Date.now() + Math.random() * 1_000_000)
src\services\trace\interpreter.ts:163:    math.random = native('Math.random', () => this.nextRandom());
src\services\trace\jsTracer.test.ts:114:    const source = `function solve() { return [Math.random(), Math.random()]; }`;
src\services\algorithmCatalog.ts:90:  return filtered[Math.floor(Math.random() * filtered.length)];
src\services\titanEngine.ts:105:  `gm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\titanEntry.ts:67:  const runId = `gm-catalog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\webProblemOrchestrator.ts:196:    runId: `web-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,

PS> Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'new Function|eval\('

src\services\trace\jsTracer.test.ts:136:    ['eval("1 + 1")', 'Dynamic code execution'],
src\services\trace\jsTracer.test.ts:137:    ['new Function("return 1")', 'Function constructor'],
src\services\trace\traceIntelligence.test.ts:51:    expect(() => queryTrace(trace, 'eval(i)')).toThrow('Unsupported trace query');
```

`npm run lint`, `npm run test`, `npm run build` output is in `## Gate output`.

### The fifth command

Produced no output. That is criterion 7.

### Sixth and seventh against the base, and the delta

The same commands run against `ff9071d` (`git checkout ff9071d -- src/`, restored afterwards
with `git checkout HEAD -- src/`):

```
PS> Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern "origin === 'preset'"

PS> Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'options\.activePackage'

src\services\input\inputPatch.ts:412:  const applied = applyInputPatches(options.currentInput, options.patches, options.activePackage.input, {
src\services\input\inputPatch.ts:415:  if (applied.ok === false) return { ...applied, package: options.activePackage };
src\services\input\inputPatch.ts:418:      activePackage: options.activePackage,
src\services\input\inputPatch.ts:428:      package: options.activePackage,
src\services\titanEngine.ts:840:        const visualOnly = Boolean(options.activePackage?.input.value.graph)
src\services\titanEngine.ts:844:          const kind = options.activePackage?.input.kind
src\services\titanEngine.ts:846:          const isMatrixPackage = options.activePackage?.program.id === 'spiral_matrix';
src\services\titanEngine.ts:860:          if (semanticPatch && options.activePackage && current) {
src\services\titanEngine.ts:862:              activePackage: options.activePackage,
src\services\titanEngine.ts:881:            if (options.activePackage) {
src\services\titanEngine.ts:883:                activePackage: options.activePackage,
src\services\titanEngine.ts:908:          if (graphPatches?.patches.length && options.activePackage && current) {
src\services\titanEngine.ts:910:              activePackage: options.activePackage,
src\services\titanEngine.ts:930:            activeProgramId: options.activePackage?.program.id,
src\services\titanEngine.ts:932:          if (options.activePackage?.program.id === 'predict_winner_interval_dp') {
src\services\titanEngine.ts:944:            matrix: options.activePackage?.program.id === 'spiral_matrix',
src\services\titanEngine.ts:946:          const contract = options.activePackage?.input ?? {
src\services\titanEngine.ts:968:          const parsed = options.activePackage?.program.id === 'spiral_matrix'
src\services\titanEngine.ts:972:          if (options.activePackage) {
src\services\titanEngine.ts:973:            if (options.activePackage.program.id === 'predict_winner_interval_dp') {
src\services\titanEngine.ts:975:                id: `${options.activePackage.id}-input-${Date.now().toString(36)}`,
src\services\titanEngine.ts:981:              updatedPackage = patchPackageGraphLayout(options.activePackage, parsed.input.graph);
src\services\titanEngine.ts:984:                activePackage: options.activePackage,

PS> (Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'options\.activePackage').Count
23
```

**Sixth, delta: 0 to 1.** No file in `src/**` read the `origin` discriminant at the base. After
the turn exactly one does, `src/services/inputRequestAdapter.ts:83`, and
`src/services/titanEngine.ts:958` is its only caller. The route's claim that
`agentInputGenerator.ts:86` was an existing reader of `origin === 'preset'` **does not hold** —
the base grep is empty; see `## Discovered`.

**Seventh, delta: 23 to 24 matches, but the two that matter both disappeared.** At the base,
`titanEngine.ts:860` (`if (semanticPatch && options.activePackage && current)`) and
`titanEngine.ts:908` (`if (graphPatches?.patches.length && options.activePackage && current)`)
gated *application* on an active package. Neither line exists after the turn: the six
`options.activePackage` occurrences inside the adapt-input patch block are now three
`if (options.activePackage)` branch selectors at `:872`, `:896`, `:922` and their three
argument uses, each of which has a package-less `else` beside it. The one new occurrence is
`:957`, the `predict_winner_interval_dp` exclusion on the refusal.

**Eighth and ninth: no new match.** Base counts, taken by the same pipeline with `.Count`:

```
PS> (Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random').Count
8
PS> (Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'new Function|eval\(').Count
3
```

8 and 3 at the base, 8 and 3 after, and the listings above are identical to the base listings.
None of the eight `Math.random` lines or the three `new Function|eval(` lines is in a file this
turn touched.

## Diff scope

```
 .../routes/R22-adapt-input-has-no-way-to-say-no.md | 270 +++++++++++++++++++++
 src/services/graphRequestEdits.test.ts             |  25 ++
 src/services/graphRequestEdits.ts                  |   4 +-
 src/services/inputRequestAdapter.test.ts           |  50 +++-
 src/services/inputRequestAdapter.ts                |   5 +
 src/services/titanEngine.test.ts                   | 102 ++++++++
 src/services/titanEngine.ts                        | 103 +++++---
 7 files changed, 517 insertions(+), 42 deletions(-)
```

The route file itself is T0's own opening commit inside the range, not a write by this turn.

## Deviations

1. **`src/i18n/translations.ts` was forecast and not touched.** The route's `## Expected Files`
   listed it for the EN/TR refusal message. The refusal is thrown from
   `src/services/titanEngine.ts:959-961` as a locale ternary instead, because that is what the
   adjacent throws and every job summary in the same function already do, and because a thrown
   message reaches the user through `AiAssistant.tsx`'s catch, which passes it to
   `translateRuntimeText` — a no-op for a string already written in the target locale. Adding a
   `t()` key would have required importing the i18n layer into the engine for one string and
   would have left two conventions in one function. Criterion 2 is satisfied either way and is
   asserted in both locales.

2. **`src/services/graphRequestEdits.ts` and `src/services/graphRequestEdits.test.ts` are
   outside `## Expected Files`.** Required by the route's own instruction under
   `## Deferred, deliberately`: item 2 makes the four graph ops reachable without an active
   package, which makes the `graphRequestEdits.ts:25` article bug live in production. The route
   allowed either fixing it in the same turn or recording it as now live; it was fixed.
   `"A düğümünü sil"` planned `[graph-remove A, graph-add-node 1, graph-add-edge G-1]` at the
   base and now plans exactly `[{ op: 'graph-remove', id: 'A' }]`
   (`src/services/graphRequestEdits.test.ts:178`). The English article now counts as one node
   only in `add a node` / `a node add`, where an add verb is present
   (`src/services/graphRequestEdits.test.ts:184`); `bir` and `one` are unchanged.

3. **The close commit was amended once, before the handoff was written and before anything was
   pushed.** The first version of `isUnderstoodInputAdaptation` was written
   `result.origin !== 'preset' || !current`, which is behaviourally identical but does not
   match the route's sixth verification pattern `origin === 'preset'`. Since that grep is the
   route's designated evidence that the discriminant is now read, the predicate was rewritten
   as `!(result.origin === 'preset' && Boolean(current))` so the evidence command actually
   finds the reader. The amend touched one line of one file, no commit had been published, and
   the amended SHA `1adf406` is the only SHA this handoff quotes. `lint` and the two affected
   test files were re-run before the amend; the full gate block above was run afterwards.

4. **The user-visible behaviour change the route asked to be stated.** A sentence that
   previously produced a fresh preset input now produces a visible refusal. Anyone using
   `"make it interesting"`, `"diziyi karıştır"`, `"sort the array"` or `"diziyi ters çevir"` as
   a way to get a new input will now see the refusal instead. Two of those four are legible
   requests the system genuinely cannot honour today: `shuffle-array` requires an explicit seed
   and `sort-array` requires an explicit direction, and `requestLiterals.ts` was left unchanged
   per the route's invariant, so neither is inferred. The refusal names the fact that the input
   was left unchanged and offers the explicit form.

## Discovered

1. **`InputPatchV1` has thirteen members, not eleven.** `src/services/input/inputPatch.ts:10-23`.
   Every one of the thirteen has a production producer; the count is in `## The op count`. The
   `AGENTS.md` sentence "11/11 ops, 11/11 keys" therefore has two problems and not one: the
   missing "with an active package" qualification the route already identified, and a count
   that does not match the union. T0 owns the correction.

2. **The route's claim that `agentInputGenerator.ts:86` reads `origin === 'preset'` does not
   hold at the base.** The base grep for that pattern over all of `src/**` is empty (pasted in
   `## Verification`). Whatever `agentInputGenerator.ts` does with `origin`, it is not that
   comparison. This does not change the route's finding — nobody read the discriminant, which
   was the point — but the cited line is wrong and should not be carried into a future route.

3. **`e2e/translation-provenance.spec.ts` uses an unscoped `getByText`.** The regex
   `/Translation verification failed/` matches both the Titan job-summary span and the chat
   paragraph, so the assertion is a strict-mode violation whenever the job panel has not yet
   cleared. It passed on both base and R22 source in isolation and failed once under full-suite
   parallel load. Scoping the locator to the chat panel, or using `.first()`, would remove the
   flake. Not fixed here: `e2e/**` is outside this route's criteria and the spec is unrelated
   to `adapt-input`.

4. **The existing adapter test named `chooses a fresh deterministic teaching preset for a vague
   edit request` (`src/services/inputRequestAdapter.test.ts:31`) now describes a path the
   engine refuses.** The assertion is still true and was not modified — the adapter still
   returns the preset; it is the caller that now declines to apply it. But `'inputu düzenle'`
   with a current input is, after this turn, a refusal in production. The test name is
   misleading rather than wrong. Left alone deliberately, because criterion 4 forbids touching
   those six cases.

5. **`predict_winner_interval_dp` is excluded from the refusal by program id.**
   `src/services/titanEngine.ts:957`. That branch replaces `generated` wholesale from
   `resolvePredictWinnerNumbers` immediately after the adapter runs, so the adapter's `origin`
   says nothing about whether the request was understood there. The exclusion is narrow and
   explicit, but it is a second convention in one function, and a future route that adds
   another post-adapter override will have to remember it.

## Untouched

```
PS> git diff --name-only "ff9071d..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$|^docs/titan/PROTOCOL\.md$|^docs/DEVIRALAN\.md$|^CLAUDE\.md$'
```

No output. The only `docs/titan/routes/**` path in the range is the route's own opening commit
by T0, not a write by this turn. `src/services/titan/titanPipeline.ts` and
`src/services/requestLiterals.ts` are both absent from `git diff --name-only`, as the route's
invariants require.

`git status --porcelain` after the turn shows only the three untracked frozen paths that were
already untracked at the base, plus this handoff before it was staged:

```
?? .claude/
?? CodeXray-readme-neon.svg
?? docs/TITAN_MODE_YOL_HARITASI.md
```

## Blockers

1. **`AGENTS.md`'s `inputPatch.ts` map entry.** The "11/11 ops, 11/11 keys" sentence needs both
   corrections from `## The op count` and `## Discovered` item 1. T0-owned; not written here.
2. **The parameter-key half of that sentence was not measured.** This turn counted ops, which
   is what criterion 10 asked for. Whether all eleven parameter keys are reachable without an
   active package was not measured; `set-param` had its package-less fallback before this turn,
   so the answer is probably yes for every key, but that is not evidence and is not claimed.
3. **The article fix landed in `graphRequestEdits.ts` without a route criterion covering it.**
   It is justified in `## Deviations` item 2 under the route's own instruction, but T0 should
   confirm the regex trade: `a` now counts as one node only next to an explicit add verb, which
   means `"a node"` alone in a longer English sentence no longer contributes a count. No test
   covered that phrasing before or after.

## For the human

none
