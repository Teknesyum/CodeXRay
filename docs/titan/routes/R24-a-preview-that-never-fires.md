# R24 — a preview that never fires

## Özet

R23'ün bulduğu üretim kusuru. `AiAssistant.tsx`'in `previewSource` geri çağrısı, kendisine
gelen `runId` o an izlediği tutamacın kimliği değilse hiçbir şey yapmadan dönüyor. İzlediği
kimlik **pipeline'ın** kimliği (`titan-pipeline-<uuid>`); motor ise kendi kimliğiyle
(`gm-<...>`) çağırıyor. `startArrayTemplatePipeline` geri çağrıyı olduğu gibi geçirdiği için
ikisi hiç eşleşmiyor.

Sonuç: dört dizi şablonunda kaynak yazma animasyonu **R16'dan beri hiç oynamadı**. Kimse fark
etmedi çünkü o dört şablonun e2e'si yalnız `apply`'ın yazdığı son `.code-display` içeriğini
denetliyor.

R23 dokuz şablon için doğrusunu yaptı (`titanPipeline.ts:723-724`), dördü açıkta kaldı —
bilerek: çalışan bir yolu dokuz yeni yol bağlarken değiştirmek kırmızı testi belirsizleştirirdi.

İkinci, ucuz kalem: `translation-provenance.spec.ts` iki tur üst üste tam paralel yükte
strict-mode ihlaliyle düştü, ikisinde de tek başına yeşil. Aynı locator iki turda iki kez artık
gürültü değil.

## Objective

Make the four array templates preview their source again, and stop the same class of mistake
from reaching a fifth pipeline entry point.

### The measurement

Verified at `1f178b0` by reading the four sites, not by taking R23's report:

```
titanEngine.ts:104-105    const createRunId = (): string =>
                            `gm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
titanPipeline.ts          const runId = `titan-pipeline-${crypto.randomUUID()}`;
AiAssistant.tsx:958       sourcePreviewRunRef.current = run.runId;
AiAssistant.tsx:870       if (!mountedRef.current || sourcePreviewRunRef.current !== runId) return;
```

`startArrayTemplatePipeline`'s `produce` spreads `...options` and hands `previewSource` to the
engine untouched, so the engine invokes it with `gm-…` while the ref holds
`titan-pipeline-…`. The guard returns early, every time, on every run of `jump-game-dp`,
`jump-game-greedy`, `lis-quadratic-dp` and `lis-binary-search`.

`startDeterministicTemplatePipeline` (R23) wraps it:

```
titanPipeline.ts:723-724   previewSource: options.previewSource
                             ? (code, title) => options.previewSource!(code, title, runId)
                             : undefined,
```

`startModelAuthoredPipeline` passes `previewSource: undefined` into the engine and replays the
preview inside `apply` with the pipeline's own `runId` (`titanPipeline.ts:586`, `:595`). So of
the five entry points that could preview, two are correct by remapping, one is correct by
deferral, one has no source to preview, and one is silently broken.

**There are three valid options and one broken one, and the broken one is what you get by
writing the obvious code.** That is the part worth fixing structurally, not just the four
templates.

### Why the e2e did not catch it

`e2e/usage-scenarios.spec.ts:24`, `:34`, `:39` assert `.code-display` contains a substring.
`.code-display` is written by `apply`, after `verify`, so it is populated whether or not the
preview ran. `dp-family-titan-mode.spec.ts` does assert the typing element is visible during
`produce` — but until R23 the DP family was not pipelined, so it was exercising the engine's own
run id against itself and could not have caught this.

## Turn

- `Turn.holder`: T0-delegated implementer
- `Turn.base`: `1f178b0`
- `Turn.branch`: `main`

Before writing anything: `git merge-base --is-ancestor 1f178b0 HEAD` must exit 0, and
`git diff --name-only 1f178b0..HEAD` must list only T0-owned paths.

## Expected Files

A forecast, not a gate.

- `src/services/titan/titanPipeline.ts` — the remap, and whatever makes the mistake unwritable.
- `src/services/titan/titanPipeline.test.ts` — the run-id assertion.
- One e2e spec for the array templates' typing element.
- `e2e/translation-provenance.spec.ts` — the scoped locator.

## Invariants

- No `eval`, no `new Function`, no `Math.random`, no wall-clock branching.
- Phases are never reordered; `apply` runs only after `verify` returns ok.
- Do not change **when** any pipeline previews. `model-authored` keeps replaying inside `apply`;
  the deterministic templates keep previewing during `produce`. This route fixes *which id* the
  callback is invoked with, not the ordering. `AGENTS.md` records that trade and it is not being
  re-decided here.
- Do not touch `startAdaptInputPipeline`, `startDiscussCurrentStepPipeline`, or
  `startWebProblemFallbackPipeline`.
- No new user-facing string is expected. If one becomes necessary, it ships EN and TR.
- No frozen or T0-owned path is written: `.claude/**`, `.agents/AGENTS.md`, `docs/tasks/**`,
  `docs/legacy/**`, `CodeXray-readme-neon.svg`, `docs/TITAN_MODE_YOL_HARITASI.md`,
  `docs/titan/routes/**`, `AGENTS.md`.

## The decision

**Option A — fix the four, and make the mistake unwritable.** Remap in
`startArrayTemplatePipeline` exactly as R23 does, then factor the choice so that a new entry
point cannot pass `previewSource` through by accident: one helper that takes the pipeline's
`runId` and returns either a remapped callback or `undefined`, and no entry point constructs the
engine options with a bare `previewSource` again. If the type system can make the pass-through
form fail to compile, do that instead of a convention.

Cost: two or three lines of real change, one shared helper, one unit test asserting the id the
engine receives, one e2e asserting the typing element for an array template. Plus the flaky
locator below.

**Option B — fix the four only.** Remap in `startArrayTemplatePipeline` and stop. One line and
one test. Leaves the sixth entry point free to repeat this exactly, which is how it got here.

**Option C — remove the run-id guard in `AiAssistant.tsx` instead.** Do not take this without
measuring what the guard protects. It exists to stop a cancelled or superseded run from typing
into the editor of a later one, which is a real hazard on a path where the user can send a
second request mid-run. Listed only so nobody proposes it as the simple fix.

**T0 reading, not binding: A.** The four-template fix is nearly free; the structural half is the
reason this is a route rather than a one-line commit.

### Second item, cheap: the flaky locator

`e2e/translation-provenance.spec.ts` failed once at H22 and once at H23 under full-suite
parallelism with a strict-mode violation — two elements matching — and passed in isolation and
on re-runs both times. Zero sightings on CI across every run in this line.

Several assertions in that file are page-wide: `:143` and `:286`
(`getByText('Translated from JAVA · deterministically verified')`), `:147`
(`getByText(stage, { exact: true })` in a loop), `:285`
(`getByText(/Translation verification failed/)`). Any of these matches a second element if the
same phrase renders in both the chat panel and a badge or status line.

**Reproduce it before you change it.** Run the full suite until you get the violation and paste
Playwright's own error, naming the line and both matched elements. Then scope that assertion to
the panel it belongs to. Do not scope all four on suspicion — a locator narrowed without a
failure to justify it is a guess wearing a fix's clothes, and this repository has spent four
routes on exactly that shape. If it will not reproduce in a reasonable number of runs, say so
with the count and change nothing.

## Acceptance Criteria

1. On an array-template run, the engine receives `previewSource` bound to the **pipeline's**
   `runId`. Assert the id the callback is invoked with, not that a preview happened.
2. An e2e test asserts the source-typing element is visible during `produce` for at least one
   array template. `.code-display` does not exist before the first run — read `.code-textarea`
   on a cold start.
3. That e2e test **fails at the base**. Show it: run it against `1f178b0` and paste the failure,
   then against the fix and paste the pass. A regression test that would have passed before the
   fix is not evidence.
4. `startModelAuthoredPipeline` and `startDeterministicTemplatePipeline` are behaviourally
   unchanged; their tests pass unmodified.
5. (Option A) A new pipeline entry point cannot pass `previewSource` through unremapped by
   accident. Say in the handoff whether this is enforced by the type system or by a convention
   plus a test, and which you chose.
6. The flaky locator: either a reproduced strict-mode failure with Playwright's verbatim error
   and a scoped fix, **or** a statement of how many full-suite runs were attempted without
   reproducing it and no change. Both outcomes close this criterion; a speculative narrowing
   does not.
7. `npm run lint`, `npm run test`, `npm run build` pass. `npm run desktop:check` if
   `src-tauri/**` changed.
8. e2e passes.
9. (T0) The handoff states how many pipeline entry points invoke `previewSource`, and for each,
   which of the three valid forms it uses — remapped, deferred to `apply`, or not applicable.
10. No frozen or T0-owned path is written. `git diff --name-only 1f178b0..HEAD` proves it.
11. Every commit is DCO-signed as `Mustafa Özel <iyott131@gmail.com>`.

## Verification

PowerShell 5.1. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git config user.email

git diff --name-only "1f178b0..HEAD"

git diff --stat "1f178b0..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'previewSource'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'sourcePreviewRunRef'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

npm run lint

npm run test

npm run build
```

Run the fifth against the base as well and report the delta — that is criterion 9's evidence.
Grep for assertion text, never for a line range.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## Still deferred after this route

- `webSource.ts:298` — the trailing `\b` after an alternative ending in `]` means
  `int solve(int[][] nums)` is declared SimLang-compatible while `int solve(int[][]nums)` is
  not. Needs a signature parser, not a wider regex.
- Structural trace intelligence inert across all 50 catalog algorithms: `sigIsZero=17`,
  `singlePhase=44`, kinds only `mutate`/`statement`, events `none`. Those indices reach the
  model prompt through `aiContext.ts:223` labelled as important steps. Fixing it means emitting
  events from 60 simulators.
- `src/services/trace/traceQuery.ts` has no production consumer; its only caller is
  `traceIntelligence.test.ts`.
- `inputRequestAdapter.test.ts:31` has a name describing production behaviour it no longer has,
  since R22 made the engine refuse what the adapter still returns. A rename, whenever that file
  is next opened.
