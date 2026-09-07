# H24 — a preview that never fires

## Turn

- Route: `docs/titan/routes/R24-a-preview-that-never-fires.md`
- Base SHA: `1f178b0`
- End SHA: `b261c60733ab1f120dff8a168a4094a836807685`
- Status: `closed`
- Next holder: Claude (T0)
- Option taken: **A**

## Özet

Dört dizi şablonunun kaynak yazma önizlemesi motorun kimliğine değil pipeline'ın kimliğine
bağlandı; hata artık derlenmiyor, çünkü pipeline'a bakan `previewSource` markalı bir
`PipelineRunId` alıyor ve `...options` düz geçişi tip hatası veriyor.

Yeni e2e `1f178b0`'da `.titan-mode-code-typing` bulunamadığı için düştü, düzeltmeyle geçti;
tam metin aşağıda.

Flaky locator sekiz tam takım koşusunda üretilemedi, hiçbir şey değiştirilmedi.

## What changed

| path:line-range | intent | kind |
|---|---|---|
| `src/services/titan/titanPipeline.ts:115-142` | `PipelineRunId` brand, `createPipelineRunId`, `TitanPipelineHostOptions`, `PipelineSourcePreviewForm`, `engineOptionsForPipeline` | added |
| `src/services/titan/titanPipeline.ts:144-163` | four pipeline option interfaces now extend `TitanPipelineHostOptions` | edited |
| `src/services/titan/titanPipeline.ts:365,426,495,572,735` | `const runId = createPipelineRunId();` replaces the inline template literal | edited |
| `src/services/titan/titanPipeline.ts:400-404` | `startDiscussCurrentStepPipeline` engine options via helper, `no-source-to-preview`, `deferApply: false` | edited |
| `src/services/titan/titanPipeline.ts:461-465` | `startAdaptInputPipeline` engine options via helper, `no-source-to-preview`, `deferApply: true` | edited |
| `src/services/titan/titanPipeline.ts:533-537` | `startArrayTemplatePipeline` engine options via helper, `remap-to-pipeline-run` — **the fix** | edited |
| `src/services/titan/titanPipeline.ts:610-614` | `startModelAuthoredPipeline` engine options via helper, `replay-inside-apply` | edited |
| `src/services/titan/titanPipeline.ts:653` | `DeterministicTemplatePipelineOptions extends TitanPipelineHostOptions` | edited |
| `src/services/titan/titanPipeline.ts:745-749` | `startDeterministicTemplatePipeline` engine options via helper, `remap-to-pipeline-run` | edited |
| `src/services/titan/titanPipeline.test.ts:466-504` | new test: array-template preview callback carries the pipeline run id | added |
| `e2e/array-template-source-preview.spec.ts:1-27` | new spec: typing element visible during `produce` for `jump-game-dp` | added |

## Commits

```
b261c60 route(R24): bind the array-template source preview to the pipeline run id
```

## Gate output

### `npm run lint`

```
> codexray@2.3.4 lint
> oxlint

LINT_EXIT=0
```

### `npm run test`

```
> codexray@2.3.4 test
> vitest run


 RUN  v4.1.10 C:/Users/Administrator/Desktop/Projeler/CodeXray


 Test Files  119 passed (119)
      Tests  883 passed (883)
   Start at  19:40:05
   Duration  19.40s (transform 13.26s, setup 22.45s, import 20.07s, tests 42.95s, environment 149.21s)

TEST_EXIT=0
```

Count before the turn (H23): `Tests  882 passed (882)`. Count after: `Tests  883 passed (883)`. Delta `+1`,
the array-template run-id test.

### `npm run build`

```
dist/assets/DynamicVisualizer-C2F93Rk8.js             29.18 kB │ gzip:   8.89 kB
dist/assets/simulators-graph-CEaCKz4x.js              36.19 kB │ gzip:  10.77 kB
dist/assets/AiAssistant-G2AcNk2A.js                   43.88 kB │ gzip:  14.48 kB
dist/assets/customSimulationCompiler-YI85GfrF.js      44.31 kB │ gzip:  13.94 kB
dist/assets/recompileSimulationInput-rDSYxmwj.js      81.54 kB │ gzip:  23.50 kB
dist/assets/titanPipeline-C7zWUp95.js                 93.19 kB │ gzip:  25.83 kB
dist/assets/index-BXggEeX6.js                        427.17 kB │ gzip: 131.73 kB

✓ built in 394ms
Initial JavaScript: 417.2 / 420.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
BUILD_EXIT=0
```

### `npm run desktop:check`

Not run. `git diff --name-only 1f178b0..HEAD` lists no `src-tauri/**` path.

### `npm run test:e2e`

```
E2E_EXIT=0

  ok  9 [chromium] › e2e\array-template-source-preview.spec.ts:13:1 › types the Jump Game DP source into the editor whi
le the array-template pipeline produces it (6.2s)
  77 passed (1.1m)
  2 passed (32.8s)
```

Pass 1 count before the turn: 76. After: 77. Delta `+1`.

## Verification block, verbatim

### `git log -1 --format=%H`

```
b261c60733ab1f120dff8a168a4094a836807685
```

### `git config user.email`

```
iyott131@gmail.com
```

### `git diff --name-only "1f178b0..HEAD"`

```
docs/titan/routes/R24-a-preview-that-never-fires.md
e2e/array-template-source-preview.spec.ts
src/services/titan/titanPipeline.test.ts
src/services/titan/titanPipeline.ts
```

### `git diff --stat "1f178b0..HEAD"`

```
 .../titan/routes/R24-a-preview-that-never-fires.md | 223 +++++++++++++++++++++
 e2e/array-template-source-preview.spec.ts          |  27 +++
 src/services/titan/titanPipeline.test.ts           |  40 ++++
 src/services/titan/titanPipeline.ts                |  99 +++++----
 4 files changed, 350 insertions(+), 39 deletions(-)
```

### `Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'previewSource'`

```
src\components\AiAssistant.tsx:868:          previewSource: async (draftCode, title, runId) => {
src\services\titan\titanPipeline.test.ts:490:      previewSource: (code, title, previewRunId) => { previewed.push({ code, title, runId: previewRunId }); },
src\services\titan\titanPipeline.test.ts:495:        options.previewSource?.(packageValue.source.code, packageValue.title, 'engine-array');
src\services\titan\titanPipeline.test.ts:509:    const previewSource = vi.fn(() => { ordering.push('preview'); });
src\services\titan\titanPipeline.test.ts:526:      previewSource,
src\services\titan\titanPipeline.test.ts:532:        expect(options.previewSource).toBeUndefined();
src\services\titan\titanPipeline.test.ts:539:    expect(previewSource).toHaveBeenCalledWith(packageValue.source.code, packageValue.title, run.runId);
src\services\titan\titanPipeline.test.ts:540:    expect(previewSource).toHaveBeenCalledOnce();
src\services\titan\titanPipeline.test.ts:650:    const previewSource = vi.fn();
src\services\titan\titanPipeline.test.ts:659:      previewSource,
src\services\titan\titanPipeline.test.ts:664:        expect(options.previewSource).toBeUndefined();
src\services\titan\titanPipeline.test.ts:680:    expect(previewSource).not.toHaveBeenCalled();
src\services\titan\titanPipeline.test.ts:899:      previewSource: (code, _title, previewRunId) => { previewed.push({ code, runId: previewRunId }); },
src\services\titan\titanPipeline.ts:122:export interface TitanPipelineHostOptions extends Omit<TitanModeOrchestratorOptions, 'previewSource'> {
src\services\titan\titanPipeline.ts:123:  previewSource?: (code: string, title: string, runId: PipelineRunId) => Promise<void> | void;
src\services\titan\titanPipeline.ts:137:  previewSource: settings.preview === 'remap-to-pipeline-run' && options.previewSource
src\services\titan\titanPipeline.ts:138:    ? (code, title) => options.previewSource!(code, title, settings.runId)
src\services\titan\titanPipeline.ts:620:      await options.previewSource?.(result.package.source.code, result.package.title, runId);
src\services\titanEngine.test.ts:172:    const previewSource = vi.fn((code: string) => {
src\services\titanEngine.test.ts:184:      previewSource,
src\services\titanEngine.test.ts:199:    expect(previewSource).toHaveBeenCalledTimes(1);
src\services\titanEngine.test.ts:232:    const previewSource = vi.fn();
src\services\titanEngine.test.ts:240:      previewSource,
src\services\titanEngine.test.ts:252:    expect(previewSource).toHaveBeenCalledOnce();
src\services\titanEngine.ts:86:  previewSource?: (code: string, title: string, runId: string) => Promise<void> | void;
src\services\titanEngine.ts:1099:          await options.previewSource?.(preparedPackage.source.code, preparedPackage.title, runId);
src\services\titanEngine.ts:1192:          await options.previewSource?.(preparedPackage.source.code, preparedPackage.title, runId);
src\services\titanEngine.ts:1276:          await options.previewSource?.(preparedPackage.source.code, preparedPackage.title, runId);
src\services\titanEngine.ts:1419:          await options.previewSource?.(renderProgramSource(authoredProgram).code, design.title, runId);
src\services\titanEngine.ts:1468:              await options.previewSource?.(renderProgramSource(validation.program).code, design.title, runId);
src\services\titanEntry.test.ts:31:    const previewSource = vi.fn();
src\services\titanEntry.test.ts:41:      previewSource,
src\services\titanEntry.test.ts:49:    expect(previewSource).toHaveBeenCalledOnce();
src\services\titanEntry.ts:130:        await options.previewSource?.(compiled.source.code, compiled.title, runId);
```

(Paths shown relative to the repository root; the command emits absolute paths.)

### `Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'sourcePreviewRunRef'`

```
src\components\AiAssistant.tsx:228:  const sourcePreviewRunRef = useRef<string | null>(null);
src\components\AiAssistant.tsx:279:      sourcePreviewRunRef.current = null;
src\components\AiAssistant.tsx:870:            if (!mountedRef.current || sourcePreviewRunRef.current !== runId) return;
src\components\AiAssistant.tsx:882:                if (!mountedRef.current || sourcePreviewRunRef.current !== runId) return;
src\components\AiAssistant.tsx:887:              if (mountedRef.current && sourcePreviewRunRef.current === runId) {
src\components\AiAssistant.tsx:968:        sourcePreviewRunRef.current = run.runId;
src\components\AiAssistant.tsx:971:        sourcePreviewRunRef.current = null;
src\components\AiAssistant.tsx:1102:      sourcePreviewRunRef.current = null;
src\components\AiAssistant.tsx:1338:              sourcePreviewRunRef.current = null;
src\components\AiAssistant.tsx:1449:            sourcePreviewRunRef.current = null;
src\components\AiAssistant.tsx:1710:              sourcePreviewRunRef.current = null;
```

Unchanged from the base. The guard of Option C was not touched.

### `Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'`

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

Identical to the base list. No `Math.random` was added; the pipeline run id uses
`crypto.randomUUID()` as before.

## Criterion 9 — the `previewSource` count, base versus HEAD

The fifth verification command run against `1f178b0` returns **31** matching lines under
`src/`; against `HEAD` it returns **34**. The three added lines are all in the new unit test
(`titanPipeline.test.ts:490`, `:495`, plus the interface/helper reshuffle inside
`titanPipeline.ts`). Within `titanPipeline.ts` itself the base has four matches
(`:586`, `:595`, `:723`, `:724`) and HEAD has five (`:122`, `:123`, `:137`, `:138`, `:620`):
two bare per-entry-point remaps became one shared helper plus the host-facing type.

**Pipeline entry points that could invoke `previewSource`: six.** Their forms at HEAD, each
stated explicitly at the call site as a `PipelineSourcePreviewForm`:

| Entry point | Form | Site |
|---|---|---|
| `startDiscussCurrentStepPipeline` | not applicable — `no-source-to-preview` | `titanPipeline.ts:402` |
| `startAdaptInputPipeline` | not applicable — `no-source-to-preview` | `titanPipeline.ts:463` |
| `startArrayTemplatePipeline` | **remapped** — `remap-to-pipeline-run` | `titanPipeline.ts:535` |
| `startModelAuthoredPipeline` | deferred to `apply` — `replay-inside-apply`, replayed at `titanPipeline.ts:620` | `titanPipeline.ts:612` |
| `startDeterministicTemplatePipeline` | **remapped** — `remap-to-pipeline-run` | `titanPipeline.ts:747` |
| `startWebProblemFallbackPipeline` | not applicable — `WebProblemFallbackPipelineOptions` declares no `previewSource` | `titanPipeline.ts:780` |

So: 2 remapped, 1 deferred to `apply`, 3 not applicable. At the base the array-template row
read "pass-through", which is none of the three valid forms.

The non-pipelined direct engine run (`startTitanModeRun(orchestratorOptions)` at
`AiAssistant.tsx:966`) is not a pipeline entry point; it hands the callback to the engine
whose own `runId` is the handle's `runId`, so `sourcePreviewRunRef` matches by construction.

## Acceptance

1. **On an array-template run, the engine receives `previewSource` bound to the pipeline's
   `runId`. Assert the id the callback is invoked with, not that a preview happened.** — met.
   `src/services/titan/titanPipeline.test.ts:466` "binds the array-template preview callback
   to the pipeline run id, not the engine run id"; the fake `startRun` invokes
   `options.previewSource` with the literal `'engine-array'` and the test asserts the host
   received `run.runId` instead. Production site: `src/services/titan/titanPipeline.ts:535`.

2. **An e2e test asserts the source-typing element is visible during `produce` for at least
   one array template.** — met. `e2e/array-template-source-preview.spec.ts:13`, asserting
   `.titan-mode-code-typing` is visible after the request and before the applied
   `.code-display`. The cold-start read is `.code-textarea` at `:15-16`, as the route
   specified. Production call site: `src/services/titan/titanPipeline.ts:535`.

3. **That e2e test fails at the base.** — met. Verbatim, with
   `src/services/titan/titanPipeline.ts` checked out at `1f178b0` and everything else at the
   fix:

   ```
     1) [chromium] › e2e\array-template-source-preview.spec.ts:13:1 › types the Jump Game DP source into the editor while the array-template pipeline produces it

       Error: expect(locator).toBeVisible() failed

       Locator: locator('.titan-mode-code-typing')
       Expected: visible
       Timeout: 15000ms
       Error: element(s) not found

       Call log:
         - Expect "toBeVisible" with timeout 15000ms
         - waiting for locator('.titan-mode-code-typing')


         21 |
         22 |   const typingSource = page.locator('.titan-mode-code-typing');
       > 23 |   await expect(typingSource).toBeVisible();
            |                              ^
         24 |
         25 |   await expect(page.getByLabel(/LeetCode 55 — Jump Game \(DP\).*execution/)).toBeVisible();
         26 |   await expect(page.locator('.code-display')).toContainText('reachable');
           at C:\Users\Administrator\Desktop\Projeler\CodeXray\e2e\array-template-source-preview.spec.ts:23:30

       attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
       test-results\array-template-source-prev-c9e02-mplate-pipeline-produces-it-chromium\test-failed-1.png
       ────────────────────────────────────────────────────────────────────────────────────────────────

       Error Context: test-results\array-template-source-prev-c9e02-mplate-pipeline-produces-it-chromium\error-context.md

       attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
       test-results\array-template-source-prev-c9e02-mplate-pipeline-produces-it-chromium\trace.zip
       Usage:

           npx playwright show-trace test-results\array-template-source-prev-c9e02-mplate-pipeline-produces-it-chromium\trace.zip

       ────────────────────────────────────────────────────────────────────────────────────────────────

     1 failed
       [chromium] › e2e\array-template-source-preview.spec.ts:13:1 › types the Jump Game DP source into the editor while the array-template pipeline produces it
   ```

   With the fix restored, verbatim:

   ```
   Running 1 test using 1 worker

   (node:26956) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
   (Use `node --trace-warnings ...` to show where the warning was created)
     ok 1 [chromium] › e2e\array-template-source-preview.spec.ts:13:1 › types the Jump Game DP source into the editor while the array-template pipeline produces it (4.2s)

     1 passed (4.6s)
   ```

   The failure is `element(s) not found` on the typing element itself, not on a downstream
   content assertion: at the base the preview never runs, so the element is never rendered.

4. **`startModelAuthoredPipeline` and `startDeterministicTemplatePipeline` are behaviourally
   unchanged; their tests pass unmodified.** — met. `git diff 1f178b0..HEAD -- src/services/titan/titanPipeline.test.ts`
   is purely additive (40 insertions, 0 deletions per `--stat`); no existing assertion was
   edited. Their two ordering tests still pass: `titanPipeline.test.ts:506` "independently
   verifies a model-authored package before previewing and applying it exactly once"
   (`ordering` equals `['produce', 'preview', 'apply']`, engine receives
   `options.previewSource === undefined`) and `titanPipeline.test.ts:896` "previews the
   deterministic source during produce because it is byte-identical to the applied package".
   E2E `deterministic-template-pipeline.spec.ts` and `model-authored-titan-mode.spec.ts` pass
   in the green suite above.

5. **(Option A) A new pipeline entry point cannot pass `previewSource` through unremapped by
   accident.** — met, **enforced by the type system**, not by convention.
   `TitanPipelineHostOptions` (`titanPipeline.ts:122`) omits the engine's `previewSource` and
   redeclares it over a branded `PipelineRunId` (`:115-117`). Under `strictFunctionTypes` a
   host callback taking `PipelineRunId` is not assignable to the engine's callback taking
   `string`, so `{ ...options, deferApply: true, ... }` handed to `startTitanEngineRun` no
   longer compiles. Measured by temporarily restoring the old pass-through form at
   `startArrayTemplatePipeline` and running `npx tsc -p tsconfig.app.json --noEmit`:

   ```
   src/services/titan/titanPipeline.ts(533,61): error TS2345: Argument of type '{ deferApply: true; onPlan: () => undefined; onEvent: undefined; verificationFailureMessage: string; startRun?: (options: TitanModeOrchestratorOptions) => TitanModeRunHandle; previewSource?: (code: string, title: string, runId: PipelineRunId) => Promise<void> | void; ... 9 more ...; agentRunner?: AgentRunner | undef...' is not assignable to parameter of type 'TitanModeOrchestratorOptions'.
     Types of property 'previewSource' are incompatible.
       Type '((code: string, title: string, runId: PipelineRunId) => void | Promise<void>) | undefined' is not assignable to type '((code: string, title: string, runId: string) => void | Promise<void>) | undefined'.
         Type '(code: string, title: string, runId: PipelineRunId) => void | Promise<void>' is not assignable to type '(code: string, title: string, runId: string) => void | Promise<void>'.
           Types of parameters 'runId' and 'runId' are incompatible.
             Type 'string' is not assignable to type 'PipelineRunId'.
               Type 'string' is not assignable to type '{ readonly [pipelineRunIdBrand]: true; }'.
   ```

   The pass-through was then reverted; `npx tsc -p tsconfig.app.json --noEmit` on the committed
   tree prints `TypeScript: No errors found`. The only way to build engine options from host
   options is `engineOptionsForPipeline`, which requires an explicit
   `PipelineSourcePreviewForm` — the author must name which of the three valid forms applies.
   `AiAssistant.tsx` needed no change: its callback declares `runId` as `string`, which is
   contravariantly assignable to the branded parameter.

6. **The flaky locator: reproduced failure with a scoped fix, or a run count and no change.**
   — met, second branch. **Eight full-suite `npm run test:e2e` runs were attempted. The
   strict-mode violation did not reproduce once.** `e2e/translation-provenance.spec.ts` passed
   both of its tests in all eight runs. Nothing in that file was changed; the diff
   (`git diff --name-only 1f178b0..HEAD`) does not list it. Two unrelated flakes appeared
   during the sweep and are recorded under `## Discovered`.

7. **`npm run lint`, `npm run test`, `npm run build` pass; `desktop:check` if `src-tauri/**`
   changed.** — met. Exit codes 0/0/0 in `## Gate output`. `src-tauri/**` unchanged, so
   `desktop:check` was not run.

8. **e2e passes.** — met. `E2E_EXIT=0`, `77 passed (1.1m)` and `2 passed (32.8s)` in
   `## Gate output`.

9. **(T0) The handoff states how many pipeline entry points invoke `previewSource`, and for
   each, which of the three valid forms it uses.** — met.
   `## Criterion 9 — the previewSource count, base versus HEAD`: six entry points, 2 remapped,
   1 deferred to `apply`, 3 not applicable; base-versus-HEAD grep counts 31 → 34.

10. **No frozen or T0-owned path is written.** — met. See `## Untouched`.

11. **Every commit is DCO-signed as `Mustafa Özel <iyott131@gmail.com>`.** — met.
    `git config user.email` returns `iyott131@gmail.com`; `git log -1 --format=%B b261c60`
    ends with `Signed-off-by: Mustafa Özel <iyott131@gmail.com>`.

## Diff scope

```
 .../titan/routes/R24-a-preview-that-never-fires.md | 223 +++++++++++++++++++++
 e2e/array-template-source-preview.spec.ts          |  27 +++
 src/services/titan/titanPipeline.test.ts           |  40 ++++
 src/services/titan/titanPipeline.ts                |  99 +++++----
 4 files changed, 350 insertions(+), 39 deletions(-)
```

Compared against `## Expected Files`: `titanPipeline.ts`, `titanPipeline.test.ts` and one new
array-template e2e spec were forecast and written. `e2e/translation-provenance.spec.ts` was
forecast but **not** written — criterion 6 closed on the no-reproduction branch. No file was
touched outside the forecast.

## Deviations

1. **`startDiscussCurrentStepPipeline` and `startAdaptInputPipeline` were edited, although the
   route's `## Invariants` says not to touch them.** Required by criterion 5: branding the
   host-facing `previewSource` makes the bare `{ ...options }` spread a compile error
   everywhere, and leaving those two on the unbranded type would have left exactly the
   copy-pasteable shape the criterion exists to remove. The edit is mechanical and
   behaviour-preserving in both directions:
   - Each keeps its own `deferApply` — `false` for discuss (it never set the flag),
     `true` for adapt-input. The helper takes `deferApply` as an explicit argument for this
     reason rather than hard-coding `true`.
   - Each declares `no-source-to-preview`, so the engine now receives
     `previewSource: undefined` where it previously received the host callback. This cannot
     change behaviour: `titanEngine.ts` invokes `previewSource` only inside the creation
     branches (`:1099`, `:1192`, `:1276`, `:1419`, `:1468`), and both intents return earlier —
     `titanEngine.ts:796` for `discuss-current-step`, `titanEngine.ts:839` for `adapt-input`.
     At the base those two passed a callback the engine could never call, and it was bound to
     the wrong id anyway.
   - Their existing tests pass unmodified (`titanPipeline.test.ts` is additive only), and the
     e2e specs that traverse them — `titan-mode.spec.ts`, `usage-scenarios.spec.ts`,
     `titan-pipeline-verification.spec.ts` — are green.
   `startWebProblemFallbackPipeline` was genuinely not touched; its options type declares no
   `previewSource`.

2. **`DeterministicTemplatePipelineOptions` was moved onto `TitanPipelineHostOptions`
   (`titanPipeline.ts:653`) even though it compiled without the change.** An unbranded
   `(runId: string)` callback is contravariantly assignable to the branded parameter, so R23's
   type would have kept working — but it would also have kept the unbranded shape available to
   copy. Required by criterion 5 for the same reason as deviation 1. No behaviour change: the
   entry point already remapped, and it still does.

3. **No `previewSource` line was changed in `AiAssistant.tsx`.** The route forecast the remap
   only inside the pipeline, and the branded parameter is satisfied by the existing callback
   without an edit. The `sourcePreviewRunRef` grep above is byte-identical to the base.

## Discovered

- **Two unrelated e2e flakes surfaced during the eight-run sweep for criterion 6**, neither in
  `translation-provenance.spec.ts`, neither reproducing:
  - Run 3: `titan-mode-failures.spec.ts` — "cancels the visible Titan Mode queue and ignores a
    late specialist response", `expect(locator).toHaveCount(expected) failed`.
  - Run 4: `radio-controller.spec.ts` — "honors ... loop and minimize contracts".
  Both passed in the other seven runs and in the final recorded green run. Recording them
  because R24's own second item started as exactly this shape: one sighting is noise, two in
  two turns is not.
- **The route's measurement of `previewSource` sites is complete for pipelines but there is a
  seventh production invoker outside them**: `titanEntry.ts:130` calls
  `options.previewSource?.(...)` on the catalog-problem path, under a run id minted at
  `titanEntry.ts:67` (`gm-catalog-…`). That path is not pipelined, so the handle's `runId` is
  the same `gm-catalog-…` and the guard matches by construction — it is correct today for the
  same reason the direct engine run is. It is listed here because it is the one place a future
  pipeline wrapper could reintroduce this bug outside `titanPipeline.ts`, where the brand does
  not reach.
- **The array templates' English request phrasing had no e2e coverage before this turn.**
  `usage-scenarios.spec.ts` drives them only in Turkish. The new spec uses
  "Solve and simulate Jump Game with dynamic programming" against `titanModeRouting.ts:152-153`
  and is the first English exercise of that route.

## Untouched

```
> git diff --name-only "1f178b0..HEAD"
docs/titan/routes/R24-a-preview-that-never-fires.md
e2e/array-template-source-preview.spec.ts
src/services/titan/titanPipeline.test.ts
src/services/titan/titanPipeline.ts
```

Filtered against the frozen and T0-owned set:

```
> git diff --name-only "1f178b0..HEAD" -- ".claude" ".agents/AGENTS.md" "docs/tasks" "docs/legacy" "CodeXray-readme-neon.svg" "docs/TITAN_MODE_YOL_HARITASI.md" "AGENTS.md" "*/AGENTS.md" "CLAUDE.md" "*/CLAUDE.md" "docs/titan/PROTOCOL.md" "docs/titan/SOLE_BOOTSTRAP.md" "docs/DEVIRALAN.md" "docs/README.md"
(no output)
```

The single T0-owned path in the range, `docs/titan/routes/R24-*.md`, is T0's own route commit
that opened the turn; the close commit `b261c60` touches only Sole-owned paths.

## Blockers

None.

## For the human

None.
