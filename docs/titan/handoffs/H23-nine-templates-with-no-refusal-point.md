# H23 — nine templates with no refusal point

## Turn

- Route: `docs/titan/routes/R23-nine-templates-with-no-refusal-point.md`
- Base SHA: `c1528ee`
- End SHA (the commit `## Verification` reports): `aacbcb6630bce83d3e1269d6db2294f4432fbaf2`
- Status: `closed`
- Next holder: Claude (T0)
- Option taken: **A** — one new entry point, nine templates, a declared answer-key table.

## Özet

Dokuz `create-algorithm` şablonu artık `startDeterministicTemplatePipeline` üzerinden beş fazlı
pipeline'a giriyor; `AiAssistant.tsx` dokuzunu da oraya yönlendiriyor ve `apply` yalnız `verify`
ok döndükten sonra çalışıyor. Cevap anahtarı tablosu dokuz satır olarak elle yazıldı ve
`Record<DeterministicTemplateId, string>` tipiyle eksiksizliği derleme zamanında zorunlu.

`verify` dokuzunun da gerçek derlenmiş paketiyle geçiyor: testler geçti, iz boş değil,
`teachingPlan.checkpoints` boş değil ve son adımın `visualData.vars`'ında o şablonun beyan
edilen anahtarı var. Eksik anahtarlı el ile bozulmuş paket reddediliyor ve çalışma alanı
değişmiyor.

Bir de üretim hatası bulundu ve düzeltildi: motor `previewSource`'u kendi `runId`'siyle
çağırıyor, `AiAssistant` ise pipeline'ın `runId`'sini bekliyor — bu yüzden pipeline'lı bir
şablonda kaynak yazımı sessizce hiç görünmüyordu. Yeni giriş noktası `runId`'yi yeniden
eşliyor; ayrıntı `## Discovered`'da.

## What changed

| path:line-range | intent | added, edited or deleted |
|---|---|---|
| `src/services/titan/titanPipeline.ts:3` | import `TitanModeIntent` for the template-id derivation | edited |
| `src/services/titan/titanPipeline.ts:611-615` | `DeterministicTemplateId` — the nine, derived from the intent union by excluding the four array templates and `model-authored` | added |
| `src/services/titan/titanPipeline.ts:616-627` | `deterministicTemplateAnswerKeys` — the nine keys written out literally, typed `Record<DeterministicTemplateId, string>` | added |
| `src/services/titan/titanPipeline.ts:629-632` | `DeterministicTemplatePipelineOptions` | added |
| `src/services/titan/titanPipeline.ts:633-644` | `deterministicTemplateOf`, `isDeterministicTemplateCreationIntent` | added |
| `src/services/titan/titanPipeline.ts:646-668` | `verifyDeterministicTemplateArtifact` — tests passed, non-empty trace, non-empty `teachingPlan.checkpoints`, declared answer key present; fails closed | added |
| `src/services/titan/titanPipeline.ts:670-704` | `createStagePlanPublisher` — the stage-to-`ManagerPlanV1` publisher, extracted for the new entry point only | added |
| `src/services/titan/titanPipeline.ts:706-750` | `startDeterministicTemplatePipeline` — `deferApply: true`, `previewSource` runId remapping, verify, apply | added |
| `src/components/AiAssistant.tsx:839,843` | import the new predicate and entry point | edited |
| `src/components/AiAssistant.tsx:961-966` | dispatch the nine to the new pipeline; `startTitanModeRun` remains only as the tail fallback | edited |
| `src/services/titan/titanPipeline.test.ts:14-21` | import the new symbols, `startTitanModeRun`, and the fixture types | edited |
| `src/services/titan/titanPipeline.test.ts:754-919` | `describe('deterministic template pipeline')` — 15 new tests | added |
| `e2e/deterministic-template-pipeline.spec.ts:1-55` | two e2e tests: the five visible stages plus apply, and a refusal that leaves the workspace unchanged | added |

## Commits

```
aacbcb6630bce83d3e1269d6db2294f4432fbaf2 route(R23): close
7e4f0a352431fc63cf8b5c8baf9fbf26f49c610b route(R23): open
```

No `fix(R23): ...` commit was needed.

## Gate output

### `npm run lint`

```
> codexray@2.3.4 lint
> oxlint


exit=0
```

### `npm run test`

```
> codexray@2.3.4 test
> vitest run


 RUN  v4.1.10 C:/Users/Administrator/Desktop/Projeler/CodeXray


 Test Files  119 passed (119)
      Tests  882 passed (882)
   Start at  19:09:12
   Duration  19.81s (transform 8.96s, setup 27.22s, import 17.50s, tests 42.06s, environment 152.15s)

exit=0
```

Test counts, measured separately:

- **Before the turn**, at `c1528ee` in a throwaway `git worktree` (`npx vitest run`):

  ```
   RUN  v4.1.10 C:/Users/Administrator/AppData/Local/Temp/r23base


   Test Files  119 passed (119)
        Tests  867 passed (867)
     Start at  19:02:36
     Duration  21.50s (transform 10.54s, setup 27.47s, import 22.83s, tests 46.04s, environment 177.05s)
  ```

- **After the turn**: 882.
- Delta: **+15**, all in `src/services/titan/titanPipeline.test.ts`. The worktree was removed
  after the measurement.

### `npm run build`

```
dist/assets/AiAssistant-2ZgD8IhJ.js                   43.88 kB │ gzip:  14.48 kB
dist/assets/customSimulationCompiler-YI85GfrF.js      44.31 kB │ gzip:  13.94 kB
dist/assets/recompileSimulationInput-rDSYxmwj.js      81.54 kB │ gzip:  23.50 kB
dist/assets/titanPipeline-Bx4AuvZr.js                 93.17 kB │ gzip:  25.74 kB
dist/assets/index-BKhQhGJN.js                        427.17 kB │ gzip: 131.74 kB

✓ built in 416ms
Initial JavaScript: 417.2 / 420.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
exit=0
```

### `npm run desktop:check`

Not run: `git diff --name-only c1528ee..HEAD` lists no `src-tauri/**` path.

## Verification output

Run verbatim from the route's `## Verification` block, PowerShell 5.1.

### 1. `git log -1 --format=%H`

```
aacbcb6630bce83d3e1269d6db2294f4432fbaf2
```

### 2. `git config user.email`

```
iyott131@gmail.com
```

### 3. `git diff --name-only "c1528ee..HEAD"`

```
docs/titan/routes/R23-nine-templates-with-no-refusal-point.md
e2e/deterministic-template-pipeline.spec.ts
src/components/AiAssistant.tsx
src/services/titan/titanPipeline.test.ts
src/services/titan/titanPipeline.ts
```

### 4. `git diff --stat "c1528ee..HEAD"`

```
 .../R23-nine-templates-with-no-refusal-point.md    | 243 +++++++++++++++++++++
 e2e/deterministic-template-pipeline.spec.ts        |  55 +++++
 src/components/AiAssistant.tsx                     |   9 +-
 src/services/titan/titanPipeline.test.ts           | 179 ++++++++++++++-
 src/services/titan/titanPipeline.ts                | 142 +++++++++++-
 5 files changed, 625 insertions(+), 3 deletions(-)
```

### 5. `Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'startTitanModeRun\('`

At HEAD:

```
src\components\AiAssistant.tsx:966:                  : startTitanModeRun(orchestratorOptions);
src\services\titan\titanPipeline.test.ts:818:        return startTitanModeRun({ ...options, agentRunner: templateAgent });
src\services\titanEngine.test.ts:84:      const result = await startTitanModeRun({
src\services\titanEngine.test.ts:177:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:212:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:233:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:291:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:340:    const result = await startTitanModeRun({
src\services\titanEngine.test.ts:415:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:456:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:479:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:508:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:545:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:618:    const result = await startTitanModeRun({
src\services\titanEngine.test.ts:640:    const created = await startTitanModeRun({
src\services\titanEngine.test.ts:661:    await startTitanModeRun({
src\services\titanEngine.test.ts:687:    await startTitanModeRun({
src\services\titanEngine.test.ts:712:    await expect(startTitanModeRun({
src\services\titanEngine.test.ts:735:    const result = await startTitanModeRun({
src\services\titanEngine.test.ts:759:    await startTitanModeRun({
src\services\titanEngine.test.ts:773:    const result = await startTitanModeRun({
src\services\titanEngine.test.ts:796:    const result = await startTitanModeRun({
src\services\titanEngine.test.ts:823:    await expect(startTitanModeRun({
src\services\titanEngine.test.ts:839:    const activePackage = (await startTitanModeRun({
src\services\titanEngine.test.ts:848:    await startTitanModeRun({
src\services\titanEngine.test.ts:873:  const run = (overrides: Record<string, unknown>) => startTitanModeRun({
src\services\titanEntry.test.ts:34:    const result = await startTitanModeRun({
```

At `c1528ee`, in the throwaway worktree:

```
src\components\AiAssistant.tsx:959:                : startTitanModeRun(orchestratorOptions);
src\services\titanEngine.test.ts:84:      const result = await startTitanModeRun({
src\services\titanEngine.test.ts:177:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:212:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:233:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:291:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:340:    const result = await startTitanModeRun({
src\services\titanEngine.test.ts:415:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:456:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:479:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:508:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:545:    const run = startTitanModeRun({
src\services\titanEngine.test.ts:618:    const result = await startTitanModeRun({
src\services\titanEngine.test.ts:640:    const created = await startTitanModeRun({
src\services\titanEngine.test.ts:661:    await startTitanModeRun({
src\services\titanEngine.test.ts:687:    await startTitanModeRun({
src\services\titanEngine.test.ts:712:    await expect(startTitanModeRun({
src\services\titanEngine.test.ts:735:    const result = await startTitanModeRun({
src\services\titanEngine.test.ts:759:    await startTitanModeRun({
src\services\titanEngine.test.ts:773:    const result = await startTitanModeRun({
src\services\titanEngine.test.ts:796:    const result = await startTitanModeRun({
src\services\titanEngine.test.ts:823:    await expect(startTitanModeRun({
src\services\titanEngine.test.ts:839:    const activePackage = (await startTitanModeRun({
src\services\titanEngine.test.ts:848:    await startTitanModeRun({
src\services\titanEngine.test.ts:873:  const run = (overrides: Record<string, unknown>) => startTitanModeRun({
src\services\titanEntry.test.ts:34:    const result = await startTitanModeRun({
```

**Delta.** Production call sites are unchanged in count: one, in `AiAssistant.tsx`, moved from
line 959 to 966 by the two inserted dispatch lines. What changed is what reaches it. At the base
it was the tail of a four-way chain and every one of the nine templates fell into it. At HEAD it
is the tail of a five-way chain whose fourth arm is `isDeterministicTemplateCreationIntent`, so
the nine no longer reach it; the only intent that still does is `create-catalog-problem` when
`preflightCatalogProblem` did not rewrite it into `model-authored`. One test call site is added
(`titanPipeline.test.ts:818`), where the new pipeline's injected `startRun` drives the real
engine to compile real packages.

### 6. `Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'executeTitanPipeline'`

At HEAD:

```
src\services\titan\titanPipeline.test.ts:3:  executeTitanPipeline,
src\services\titan\titanPipeline.test.ts:120:    const result = await executeTitanPipeline({
src\services\titan\titanPipeline.test.ts:142:    await expect(executeTitanPipeline({
src\services\titan\titanPipeline.test.ts:155:    await expect(executeTitanPipeline({
src\services\titan\titanPipeline.test.ts:164:    await expect(executeTitanPipeline({
src\services\titan\titanPipeline.test.ts:185:    await expect(executeTitanPipeline({
src\services\titan\titanPipeline.ts:38:export const executeTitanPipeline = async <Route, Artifact>(
src\services\titan\titanPipeline.ts:368:  const promise = executeTitanPipeline({
src\services\titan\titanPipeline.ts:429:  const promise = executeTitanPipeline({
src\services\titan\titanPipeline.ts:499:  const promise = executeTitanPipeline({
src\services\titan\titanPipeline.ts:577:  const promise = executeTitanPipeline({
src\services\titan\titanPipeline.ts:714:  const promise = executeTitanPipeline({
src\services\titan\titanPipeline.ts:800:  const promise = executeTitanPipeline({
```

At `c1528ee`, in the throwaway worktree:

```
src\services\titan\titanPipeline.test.ts:3:  executeTitanPipeline,
src\services\titan\titanPipeline.test.ts:113:    const result = await executeTitanPipeline({
src\services\titan\titanPipeline.test.ts:135:    await expect(executeTitanPipeline({
src\services\titan\titanPipeline.test.ts:148:    await expect(executeTitanPipeline({
src\services\titan\titanPipeline.test.ts:157:    await expect(executeTitanPipeline({
src\services\titan\titanPipeline.test.ts:178:    await expect(executeTitanPipeline({
src\services\titan\titanPipeline.ts:38:export const executeTitanPipeline = async <Route, Artifact>(
src\services\titan\titanPipeline.ts:368:  const promise = executeTitanPipeline({
src\services\titan\titanPipeline.ts:429:  const promise = executeTitanPipeline({
src\services\titan\titanPipeline.ts:499:  const promise = executeTitanPipeline({
src\services\titan\titanPipeline.ts:577:  const promise = executeTitanPipeline({
src\services\titan\titanPipeline.ts:660:  const promise = executeTitanPipeline({
```

**Delta.** Five `executeTitanPipeline` call sites in `titanPipeline.ts` become **six**. The added
one is `startDeterministicTemplatePipeline` at line 714; the existing five keep their bodies and
their first four keep their line numbers exactly (368, 429, 499, 577), while the web-fallback one
moves 660 → 800 because the new block was inserted above it.

### 7. `Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'`

```
src\components\AiAssistant.tsx:1180:      ? (['lcs', 'edit', 'knapsack'] as const)[Math.floor(Math.random() * 3)]
src\components\AiAssistant.tsx:1183:      ? Math.floor(Date.now() + Math.random() * 1_000_000)
src\services\trace\interpreter.ts:163:    math.random = native('Math.random', () => this.nextRandom());
src\services\trace\jsTracer.test.ts:114:    const source = `function solve() { return [Math.random(), Math.random()]; }`;
src\services\algorithmCatalog.ts:90:  return filtered[Math.floor(Math.random() * filtered.length)];
src\services\titanEngine.ts:105:  `gm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\titanEntry.ts:67:  const runId = `gm-catalog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\webProblemOrchestrator.ts:196:    runId: `web-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
```

All eight pre-date this turn; `git diff c1528ee..HEAD` adds none. None is in simulation, trace, or
pipeline code: they are run-id generation, a clarification-dialog shuffle, a catalog picker, a
seeded interpreter native, and a test fixture.

### 8. `Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'new Function|eval\('`

```
src\services\trace\jsTracer.test.ts:136:    ['eval("1 + 1")', 'Dynamic code execution'],
src\services\trace\jsTracer.test.ts:137:    ['new Function("return 1")', 'Function constructor'],
src\services\trace\traceIntelligence.test.ts:51:    expect(() => queryTrace(trace, 'eval(i)')).toThrow('Unsupported trace query');
```

Three matches, all test strings asserting that these constructs are **rejected**. No production
match, and this turn adds none.

### e2e

`AGENTS.md` external-server procedure. Started one hidden `npm run dev` on `127.0.0.1:4173`,
recorded its PID, set `PLAYWRIGHT_EXTERNAL_SERVER=1`, ran `npm run test:e2e`, then stopped exactly
that PID and the port-4173 listener PID it spawned. Nothing else was killed.

```
> codexray@2.3.4 test:e2e
> node scripts/run-e2e.mjs


Running 76 tests using 8 workers

  ok  5 [chromium] › e2e\ai-actions.spec.ts:24:1 › loads DFS deterministically with a mocked on-device model bridge (3.0s)
  ok  1 [chromium] › e2e\accessibility-contract.spec.ts:3:1 › keeps names, focus, keyboard resizing, semantic cues, and reduced motion usable (3.8s)
  ok  8 [chromium] › e2e\accessibility-axe.spec.ts:61:1 › reflows like 200 and 400 percent zoom without losing core controls (4.1s)
  ok  3 [chromium] › e2e\ai-routing-interruption.spec.ts:3:1 › separates BFS questions from commands and discards interrupted narration (5.1s)
  ok  9 [chromium] › e2e\desktop-provider-settings.spec.ts:3:1 › shows desktop AI providers and the Ollama connection form (3.3s)
  ok  2 [chromium] › e2e\ai-actions.spec.ts:3:1 › loads DFS in Titan Mode without waiting for a local model (6.9s)
  ok 10 [chromium] › e2e\deterministic-template-pipeline.spec.ts:13:1 › runs a deterministic DP template through the five visible pipeline stages and applies it (4.7s)
  ok  7 [chromium] › e2e\accessibility-axe.spec.ts:46:1 › keeps dialogs, graph semantics, radio shell, and mobile stacking axe-clean (8.6s)
  ok 11 [chromium] › e2e\deterministic-template-pipeline.spec.ts:34:1 › refuses a deterministic template whose declared answer key is missing and leaves the workspace unchanged (6.3s)
  ok 12 [chromium] › e2e\dp-family-titan-mode.spec.ts:25:1 › authors, visualizes, and teaches a 1D House Robber DP recurrence (8.6s)
  ok  4 [chromium] › e2e\ai-actions.spec.ts:112:1 › builds and applies bidirectional BFS through the visible Titan Mode queue (15.7s)
  ok  6 [chromium] › e2e\accessibility-axe.spec.ts:37:1 › has no serious WCAG A/AA violations across themes and languages (16.3s)
  ok 15 [chromium] › e2e\dp-family-titan-mode.spec.ts:80:1 › authors and simulates the exact Java Coin Change contract (9.0s)
  ok 14 [chromium] › e2e\dp-family-titan-mode.spec.ts:64:1 › turns the committed LCS into a space-optimized 1D follow-up without overflowing context (10.9s)
  ok 13 [chromium] › e2e\dp-family-titan-mode.spec.ts:42:1 › authors a rectangular LCS table and exposes exact dependencies (12.1s)
  ok 20 [chromium] › e2e\error-isolation.spec.ts:3:1 › isolates corrupt layout, invalid input, AI, radio, and Titan Mode failures without reset (5.5s)
  ok 16 [chromium] › e2e\dp-family-titan-mode.spec.ts:94:1 › authors and simulates the exact Java Edit Distance contract as a 2D table (13.3s)
  ok 21 [chromium] › e2e\graph-builder-daily.spec.ts:19:1 › supports gap reuse, atomic rename, duplicate rejection, and topology-safe dragging (4.5s)
  ok 19 [chromium] › e2e\dp-family-titan-mode.spec.ts:136:1 › routes the exact Turkish palindrome request through agents, types source, then teaches the trace (6.6s)
  ok 22 [chromium] › e2e\graph-negative-recovery.spec.ts:10:1 › rejects a negative Dijkstra edge without replacing the valid timeline and recovers (4.9s)
  ok 18 [chromium] › e2e\dp-family-titan-mode.spec.ts:122:1 › authors an interval-palindrome table and preserves diagonal fill semantics (9.9s)
  ok 17 [chromium] › e2e\dp-family-titan-mode.spec.ts:108:1 › authors and simulates the exact Java 0/1 Knapsack contract without item reuse (13.6s)
  ok 28 [chromium] › e2e\privacy-network.spec.ts:3:1 › keeps source, input, and chat payloads out of external network requests (3.6s)
  ok 23 [chromium] › e2e\graph-workflow.spec.ts:65:1 › keeps unusual IDs, cycles, equal paths, and unreachable nodes correct in Dijkstra and A* (8.7s)
  ok 26 [chromium] › e2e\markdown-resilience.spec.ts:25:1 › keeps hostile model Markdown inert, contained, copyable, and allows the next turn (5.3s)
  ok 29 [chromium] › e2e\radio-autoplay.spec.ts:3:1 › confirms autoplay, routes Demons to its embeddable upload, and surfaces player errors (4.0s)
  ok 27 [chromium] › e2e\model-authored-titan-mode.spec.ts:3:1 › commits a validated model-authored algorithm and keeps its queue, source, input, trace, and teaching grounded (5.7s)
  ok 25 [chromium] › e2e\learning-journey.spec.ts:11:1 › keeps source, visual data, variables, and pins synchronized while navigating unknown input (6.4s)
  ok 31 [chromium] › e2e\reasoning-disclosure.spec.ts:3:1 › renders model reasoning as a collapsed, expandable companion to the answer (2.4s)
  ok 32 [chromium] › e2e\responsive-layout.spec.ts:12:1 › completes simulation, AI command, settings, and radio flows at 390px without page overflow (3.8s)
  ok 24 [chromium] › e2e\interval-dp-titan-mode.spec.ts:15:1 › authors and simulates LeetCode 486 as a dependency-grounded 2D interval-DP table (9.9s)
  ok 35 [chromium] › e2e\search-theme-state.spec.ts:17:1 › compares found and missing user search targets without stale result state (5.4s)
  ok 36 [chromium] › e2e\search-theme-state.spec.ts:44:1 › changes language and every theme mid-run without regenerating timeline semantics (5.3s)
  ok 30 [chromium] › e2e\radio-controller.spec.ts:3:1 › honors confirmed playback, transport, audio, loop, and minimize contracts (9.8s)
  ok 34 [chromium] › e2e\responsive-layout.spec.ts:59:1 › persists keyboard resizing and collapse state across reload (6.4s)
  ok 37 [chromium] › e2e\smoke.spec.ts:17:1 › runs DFS and exposes the complete visited trace (5.2s)
  ok 38 [chromium] › e2e\smoke.spec.ts:32:1 › runs graph and compound-input algorithms (3.2s)
  ok 39 [chromium] › e2e\smoke.spec.ts:57:1 › renames graph nodes and creates edges by dragging node handles (4.1s)
  ok 41 [chromium] › e2e\smoke.spec.ts:125:1 › switches the visible interface to Turkish instantly (3.4s)
  ok 44 [chromium] › e2e\smoke.spec.ts:182:1 › accepts custom array input for a sorting algorithm (3.5s)
  ok 40 [chromium] › e2e\smoke.spec.ts:85:1 › graph edit popovers do not move the canvas and edges can be edited in place (4.2s)
  ok 43 [chromium] › e2e\smoke.spec.ts:199:1 › resizes and collapses workspace panels (3.6s)
  ok 45 [chromium] › e2e\smoke.spec.ts:218:1 › keeps collapsed panel controls clickable after the language controls moved to settings (3.5s)
  ok 42 [chromium] › e2e\smoke.spec.ts:139:1 › reads a public problem through the bounded gateway and keeps the cleaned source in session scope (4.4s)
  ok 47 [chromium] › e2e\smoke.spec.ts:281:1 › allows the assistant to shrink while the graph input builder is open (2.2s)
  ok 48 [chromium] › e2e\smoke.spec.ts:310:1 › stops the lower splitter at its boundary without growing another panel (2.0s)
  ok 46 [chromium] › e2e\smoke.spec.ts:229:1 › resizes only adjacent right panels and starts with compact controls (3.7s)
  ok 49 [chromium] › e2e\smoke.spec.ts:363:1 › shows the questions menu above the assistant instead of behind it (2.3s)
  ok 33 [chromium] › e2e\release-tour.spec.ts:3:1 › completes the fifteen-step release tour in one browser profile (14.3s)
  ok 50 [chromium] › e2e\smoke.spec.ts:386:1 › opens the playlist radio without loading it before user interaction (4.6s)
  ok 52 [chromium] › e2e\smoke.spec.ts:426:1 › resets CodeXRay state without clearing unrelated origin storage (4.1s)
  ok 51 [chromium] › e2e\smoke.spec.ts:401:1 › offers experimental extended context profiles for every local model (4.5s)
  ok 53 [chromium] › e2e\smoke.spec.ts:452:1 › resets only interface layout while preserving user workspace state (3.7s)
  ok 54 [chromium] › e2e\theme-contrast.spec.ts:89:1 › keeps visible text readable across neon, dark, and light themes (5.6s)
  ok 56 [chromium] › e2e\titan-mode-clarification.spec.ts:33:1 › offers deterministic template, random, unique, and custom paths for a generic 2D DP request (5.4s)
  ok 60 [chromium] › e2e\titan-mode.spec.ts:3:1 › shows Titan naming and keeps deterministic navigation model-independent (3.2s)
  ok 58 [chromium] › e2e\titan-mode-failures.spec.ts:116:1 › shows the failing specialist after bounded SimLang retries and preserves the committed workspace (4.2s)
  ok 57 [chromium] › e2e\titan-mode-failures.spec.ts:3:1 › cancels the visible Titan Mode queue and ignores a late specialist response (4.7s)
CLARIFICATION_PIPELINE_MS 4313
  ok 55 [chromium] › e2e\titan-mode-clarification.spec.ts:3:1 › asks for missing algorithm requirements without mutation and resumes with a concrete request (7.7s)
  ok 61 [chromium] › e2e\titan-mode.spec.ts:22:1 › shows the five-stage pipeline and a grounded current-step answer (4.8s)
  ok 63 [chromium] › e2e\titan-pipeline-verification.spec.ts:3:1 › shows verification failure and preserves the visible workspace on a mismatched trace (2.6s)
  ok 62 [chromium] › e2e\titan-mode.spec.ts:46:1 › rejects a model answer whose current-step line disagrees with the committed trace (2.8s)
  ok 66 [chromium] › e2e\tree-input-resilience.spec.ts:10:1 › imports a sparse tree and keeps it after a cyclic document is rejected (2.9s)
  ok 65 [chromium] › e2e\translation-provenance.spec.ts:155:1 › shows a refused Java fallback without changing workspace or persisted bound source (3.1s)
  ok 64 [chromium] › e2e\translation-provenance.spec.ts:3:1 › translates a reviewed Java web solution into a verified simulation badge (3.8s)
  ok 70 [chromium] › e2e\usage-scenarios.spec.ts:13:1 › changes Jump Game from quadratic DP to linear greedy (3.8s)
  ok 71 [chromium] › e2e\usage-scenarios.spec.ts:28:1 › changes LIS from quadratic DP to n-log-n binary search (3.7s)
  ok 59 [chromium] › e2e\titan-mode-user-graph.spec.ts:25:1 › requires a missing target, then builds on the exact user graph without replacing it (10.7s)
  ok 72 [chromium] › e2e\usage-scenarios.spec.ts:43:1 › edits, expands, and recompiles the active input from natural commands (3.9s)
  ok 74 [chromium] › e2e\usage-scenarios.spec.ts:86:1 › changes a numeric algorithm parameter and rebuilds its trace from a natural command (2.8s)
  ok 69 [chromium] › e2e\unicode-and-catalog.spec.ts:42:1 › clears incompatible timeline and analysis while touring catalog families (7.0s)
  ok 68 [chromium] › e2e\unicode-and-catalog.spec.ts:17:1 › finds and then clears Unicode KMP results without replacing user text (7.8s)
  ok 75 [chromium] › e2e\usage-scenarios.spec.ts:106:1 › changes a text algorithm parameter and rebuilds its trace from a quoted command (2.3s)
  ok 76 [chromium] › e2e\web-problem-routing.spec.ts:3:1 › a fetched page cannot select the intent of a bound web solve (2.3s)
  ok 73 [chromium] › e2e\usage-scenarios.spec.ts:71:1 › resizes a true matrix simulation to a rectangular 8 by 15 grid (6.1s)
  ok 67 [chromium] › e2e\tree-input-resilience.spec.ts:55:1 › renames, adds, traverses, exports, reimports, and deletes a sparse-tree child (8.8s)

  76 passed (57.4s)

Running 2 tests using 1 worker

TIMELINE_MEASUREMENTS {"playwright":{"min":735.3394000000008,"median":804.5996000000014,"max":895.2080000000005},"inPage":{"min":159.79999995231628,"median":166.69999998807907,"max":199.39999997615814},"handler":{"min":0.3999999165534973,"median":0.6500000357627869,"max":1.0999999642372131},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1446.1323,"catalogMs":257.79930000000013,"simulationMs":75.31999999999971,"dpMs":2453.644199999999}
  ok 1 [chromium] › e2e\performance-budget.spec.ts:23:1 › keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets @performance (23.2s)
  ok 2 [chromium] › e2e\performance-budget.spec.ts:123:1 › survives repeated cross-subsystem use without stale state, overflow, or locked controls @performance (8.8s)

  2 passed (33.1s)
```

Exit code 0. The `(node:NNNNN) Warning: The 'NO_COLOR' env is ignored...` lines that the runner
emits once per worker are the only lines omitted above; they carry no test result.

An earlier full-suite run in this turn had one failure, reported in `## Discovered` rather than
hidden here.

## Acceptance

Criteria copied verbatim from the route.

1. **All nine templates enter `executeTitanPipeline`. A test asserts, per template, that the
   phases ran in order `route → produce → semantics → verify → apply` (or with `semantics`
   skipped through its declared optional slot).**
   **Met.** `src/services/titan/titanPipeline.test.ts:836` —
   `it.each(nineTemplates)('carries %s through five ordered stages and applies its verified package once')`
   asserts the final published plan is exactly
   `['titan-route:completed', 'titan-produce:completed', 'titan-semantics:completed', 'titan-verify:completed', 'titan-apply:completed']`
   for each of the nine. Production call site: `src/components/AiAssistant.tsx:962`.

2. **For each of the nine, the workspace is not mutated when `verify` rejects. Assert it for at
   least `bidirectional-bfs` and one DP template, by counting applies as `titanEngine.test.ts`
   already does — 1 eager / 0 deferred.**
   **Met.** `src/services/titan/titanPipeline.test.ts:873` —
   `it.each([...])('rejects %s when its declared %s key is missing and leaves the workspace untouched')`
   covers `bidirectional-bfs`, `house-robber-1d-dp` and `predict-winner-interval-dp`: it asserts
   the engine was entered with `deferApply: true`, that the run rejects, and that `applyPackage`
   was never called. The unmodified 1-eager / 0-deferred counting at
   `src/services/titanEngine.test.ts:81` still covers `predict-winner-interval-dp`,
   `house-robber-1d-dp` and `bidirectional-bfs`.

3. **The expected answer key per template is written out literally, and a test asserts the table
   has exactly nine entries matching the nine template ids. If a tenth template is added later
   without a key, that test must fail.**
   **Met.** Table: `src/services/titan/titanPipeline.ts:616-627`, nine literal entries, no
   derivation from any package. Test: `src/services/titan/titanPipeline.test.ts:825` — the key set
   equals the nine ids and has length 9. A tenth template also fails **at compile time**: the
   table is typed `Record<DeterministicTemplateId, string>` and `DeterministicTemplateId` is
   derived from the `TitanModeIntent` `create-algorithm` union by excluding the five already
   pipelined, so a new member without a key is a `tsc` error in `npm run build`.

4. **A package missing its declared key is rejected. Assert with a hand-mutated package, not by
   breaking a compiler.**
   **Met.** `src/services/titan/titanPipeline.test.ts:873` compiles the real package through the
   engine, `structuredClone`s it, `delete`s the declared key from the final step's
   `visualData.vars`, and asserts both the bare verify and the whole pipeline reject. No compiler
   was altered.

5. **The verify does not reject any of the nine on their real compiled packages. Assert all nine
   pass — this is the criterion the measurement table exists to protect.**
   **Met.** `src/services/titan/titanPipeline.test.ts:836` runs the real engine per template
   (`startRun` injects `startTitanModeRun` with the `successfulAgent`-shaped fixture) and asserts
   `verifyDeterministicTemplateArtifact(result, template, ...)` equals `{ ok: true }` for all
   nine, plus that the final step's `vars` actually contains the declared key.

6. **`previewSource` ordering is stated in the handoff, with the reason.**
   **Met.** See `## previewSource ordering` below.

7. **The four existing pipeline entry points are behaviourally unchanged. Show their tests pass
   unmodified.**
   **Met.** `git diff c1528ee..HEAD -- src/services/titan/titanPipeline.ts` touches only the
   import line and the inserted block; the bodies of `startDiscussCurrentStepPipeline`,
   `startAdaptInputPipeline`, `startArrayTemplatePipeline`, `startModelAuthoredPipeline` and
   `startWebProblemFallbackPipeline` are untouched, and their `executeTitanPipeline` call sites
   still sit at lines 368, 429, 499 and 577. Their tests are unedited — the only change to
   `titanPipeline.test.ts` is the import line and the appended `describe` block at line 754 — and
   all 50 tests in that file pass, 35 of them pre-existing.

8. **`npm run lint`, `npm run test`, `npm run build` pass. `npm run desktop:check` if
   `src-tauri/**` changed.**
   **Met.** All three exit 0; see `## Gate output`. No `src-tauri/**` path is in the diff, so
   `desktop:check` was not required.

9. **e2e passes. A criterion claiming user-visible behavior cannot close on a unit test alone: at
   least one of the nine must be exercised end to end, showing the run completes and applies.**
   **Met.** `e2e/deterministic-template-pipeline.spec.ts:13` —
   `runs a deterministic DP template through the five visible pipeline stages and applies it`
   sends the House Robber request through the real UI, asserts the visible Titan queue shows
   exactly `Route, Produce, Semantics, Verify, Apply`, then asserts the applied execution
   (`LeetCode 198 — House Robber execution`), the applied source, and `100%`. Its sibling at line
   34 patches the verify guard in the served module and asserts the EN refusal message with an
   unchanged editor. Production call site: `src/components/AiAssistant.tsx:962`. Full suite:
   76 + 2 passed.

10. **(T0) The handoff states, as a count, how many `create-algorithm` templates enter the
    pipeline before and after this turn, out of how many total.**
    **Met.** See `## Criterion 10 — the count`.

11. **No frozen or T0-owned path is written. `git diff --name-only c1528ee..HEAD` proves it.**
    **Met.** See `## Untouched`.

12. **Every commit is DCO-signed as `Mustafa Özel <iyott131@gmail.com>`.**
    **Met.** `git config user.email` returns `iyott131@gmail.com`; `aacbcb6` carries
    `Signed-off-by: Mustafa Ozel <iyott131@gmail.com>`.

## Criterion 10 — the count

The `create-algorithm` intent has **14** templates: the seven `DpTemplateId` values, the four
array templates, `bidirectional-bfs`, `predict-winner-interval-dp`, and `model-authored`.

| | enter the five-phase pipeline | do not |
|---|---|---|
| before this turn (`c1528ee`) | **5 / 14** — the four array templates (R16) and `model-authored` (R18) | 9 |
| after this turn (`aacbcb6`) | **14 / 14** | 0 |

Every `create-algorithm` template now has a point at which an external caller can refuse before
the workspace is touched. This does **not** mean every Titan intent is pipelined:
`create-catalog-problem`, `clarify-algorithm`, `ui-control` and `deterministic` still are not, and
the route explicitly puts them out of scope because none of them compiles a package.

## previewSource ordering

**Chosen: preview during `produce`, the deterministic-template ordering — not `model-authored`'s
replay inside `apply`.**

Reason: all nine sources are deterministic compilations of first-party code, and the previewed
bytes are the applied bytes. For the seven DP templates, `predict-winner-interval-dp`, and the
array templates the engine previews `preparedPackage.source.code` and then applies that same
`preparedPackage` object (`titanEngine.ts:1099` / `:1146`, `:1192` / `:1228`, `:1276` / `:1315`).
For `bidirectional-bfs` it previews `renderProgramSource(createBidirectionalBfsProgram(locale))`
at `titanEngine.ts:1419`, which is the program the package is compiled from. No model text is on
screen at any point, so the R18 argument for deferring the preview does not apply — and deferring
it would have made the visible source-typing land during `apply`, changing behaviour four DP
templates already ship.

What the preview does display before `verify` is a *correct* draft that may still be discarded:
on a rejection `AiAssistant.tsx`'s `restoreSourcePreview` puts every workspace field back from the
snapshot, which `e2e/deterministic-template-pipeline.spec.ts:34` asserts against the real editor.

Test pointer: `src/services/titan/titanPipeline.test.ts:856` asserts the preview fires exactly
once, with `package.source.code`, and with the pipeline's own `runId`.

## Diff scope

```
 .../R23-nine-templates-with-no-refusal-point.md    | 243 +++++++++++++++++++++
 e2e/deterministic-template-pipeline.spec.ts        |  55 +++++
 src/components/AiAssistant.tsx                     |   9 +-
 src/services/titan/titanPipeline.test.ts           | 179 ++++++++++++++-
 src/services/titan/titanPipeline.ts                | 142 +++++++++++-
 5 files changed, 625 insertions(+), 3 deletions(-)
```

Against `## Expected Files`: `titanPipeline.ts`, `AiAssistant.tsx`, `titanPipeline.test.ts` and one
e2e spec were all forecast. `src/i18n/translations.ts` was forecast as possible and was **not**
touched — `titanCreationVerificationFailed` already existed in EN and TR and was the right
message, exactly as the route guessed. `src/services/titanEngine.test.ts` was forecast and was
**not** touched; see `## Deviations`. `R23-...md` is the route commit that opened the turn, not
this turn's work.

## Deviations

1. **`src/services/titanEngine.test.ts` was forecast but not written.** Criterion 2 asks for the
   1-eager / 0-deferred counting "as `titanEngine.test.ts` already does", and that file's
   `it.each` at line 81 already covers `predict-winner-interval-dp`, `house-robber-1d-dp` and
   `bidirectional-bfs` — the two the criterion names plus one. Adding rows would have duplicated a
   passing assertion, and leaving the file untouched is also the cleanest evidence for criterion 7.
   The new pipeline-level rejection test at `titanPipeline.test.ts:873` covers the part that file
   cannot: that the *pipeline* refuses and never calls `applyPackage`.

2. **One production behaviour changed beyond wiring: the `previewSource` runId remap at
   `titanPipeline.ts:717-719`.** The route's scope is "wires callers; it does not have to touch
   the apply path", and this is neither the apply path nor one of the four frozen entry points —
   but it is more than a dispatch line, so it is declared here. Without it, moving these nine
   behind the pipeline would have silently removed the visible source-typing from all nine, and
   `e2e/dp-family-titan-mode.spec.ts:136` would have failed. Cause and blast radius in
   `## Discovered`.

## Discovered

1. **The engine's `previewSource` runId does not match what `AiAssistant` accepts, so a pipelined
   template's source-typing is suppressed.** `AiAssistant.tsx:864` guards the preview with
   `sourcePreviewRunRef.current !== runId`, and that ref is set to the **pipeline** handle's
   `runId` at line 971. But `startTitanEngineRun` mints its own `gm-...` id
   (`titanEngine.ts:104-105`) and passes that to `options.previewSource`, so on any pipeline that
   forwards `previewSource` straight through, every preview call returns immediately and the
   `.titan-mode-code-typing` element never appears.

   Found by writing the criterion 9 e2e test first: the run completed and applied, but
   `.titan-mode-code-typing` was never found in 15 s.

   Fixed for the new entry point by wrapping the callback so the engine's id is replaced with the
   pipeline's:

   ```ts
   previewSource: options.previewSource
     ? (code, title) => options.previewSource!(code, title, runId)
     : undefined,
   ```

   **`startArrayTemplatePipeline` has the same defect and this turn did not touch it** — the route
   forbids changing its behaviour. So since R16, the four array templates
   (`jump-game-dp`, `jump-game-greedy`, `lis-quadratic-dp`, `lis-binary-search`) have shipped with
   their source-typing silently suppressed in production. Nothing caught it because
   `dp-family-titan-mode.spec.ts:148` asserts typing only for the Turkish palindrome request,
   which is `longest-palindrome-interval-dp` — non-pipelined until today. `AGENTS.md`'s claim that
   "`dp-family-titan-mode.spec.ts` asserts the typing element is visible while the produce phase
   is still running" was therefore true of a non-pipelined path, not of R16's work. That spec now
   exercises the new pipeline and passes, because of the remap above. **A one-line route for T0.**

2. **`e2e/translation-provenance.spec.ts:155` failed once under full parallel load, then passed
   twice.** Verbatim:

   ```
   Error: expect(locator).toBeVisible() failed

   Locator: getByText(/Translation verification failed/)
   Expected: visible
   Error: strict mode violation: getByText(/Translation verification failed/) resolved to 2 elements:
       1) <span class="agent-summary" title="Translation verification failed: Line 2: Expected budgets header.">Translation verification failed: Line 2: Expected…</span> aka getByTitle('Translation verification')
       2) <p>Translation verification failed: Line 2: Expected…</p> aka getByRole('paragraph').filter({ hasText: 'Translation verification' })
   ```

   Not a timeout, so it is a different animal from the five sightings the route already tracks: it
   is a strict-mode race between the failed job card, which carries the reason in
   `.agent-summary`, and the chat paragraph that carries the same sentence. Whether both are on
   screen at the assertion depends on machine load. The path is `startWebProblemFallbackPipeline`,
   untouched by this turn; the spec passed alone (`2 passed (2.7s)`) and in two subsequent full
   suites. The fix is a more specific locator in that spec, not an application change.

3. **`.code-display` does not exist before the first run.** `CodeEditor.tsx:380` renders it only
   outside edit mode; on a fresh load the editor is a `.code-textarea`. Any future spec asserting
   "workspace unchanged" from a cold start must read the textarea's value, as
   `deterministic-template-pipeline.spec.ts:43` does.

4. **What the new verify does and does not establish.** It re-asserts the engine's own two
   deterministic gates (`tests.passed`, non-empty `teachingPlan.checkpoints`) from outside, adds a
   non-empty trace, and adds the one thing the engine does not check: that the final step binds
   the key this algorithm answers under. It is **not** independent recomputation in the sense of
   R15's `adapt-input` or R18's `model-authored` checks — nothing is recompiled and compared. It
   proves the package computed *an* answer under the right name. It cannot prove the answer is
   correct, and no gate in this system can.

## Untouched

```powershell
git diff --name-only c1528ee..HEAD -- ".claude" ".agents/AGENTS.md" "docs/tasks" "docs/legacy" "CodeXray-readme-neon.svg" "docs/TITAN_MODE_YOL_HARITASI.md" "AGENTS.md"
```

```
```

Empty. No frozen or T0-owned path was written. `docs/titan/routes/**` appears in the full
`--name-only` output only as `R23-...md`, which is T0's own `route(R23): open` commit inside the
range, not a write by this turn — `git diff --name-only 7e4f0a3..HEAD` lists only the four source
and test paths.

## Blockers

None.

## For the human

1. Finding 1 in `## Discovered` is a live production defect in the four array templates from R16:
   their AI-authored source-typing animation never plays. One-line fix, but it is inside a
   function this route froze, so it needs its own route.
2. Finding 2 is a flaky e2e locator in `translation-provenance.spec.ts`, unrelated to this turn's
   code.
