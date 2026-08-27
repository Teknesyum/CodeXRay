# CodeXRay Agent Guide

## Read order

1. This file.
2. `docs/titan/PROTOCOL.md` — the canonical turn protocol, single source of truth.
3. The active route: the file directly in `docs/titan/routes/` that has **no** matching
   `docs/titan/handoffs/H<id>-*.md`. Exactly one route is ever in that state, and numbering
   does not decide it — a retry `R<n>b` opens after higher-numbered routes have closed.
   `docs/titan/routes/queued/**` holds drafted future routes — planning material, never an
   instruction to write code.

Nothing else. Do not scan the repository before reading these three. Archived material in
`docs/legacy/**` and `docs/tasks/**` is historical record, not instruction.

## Turn protocol (binding)

- One branch, one working directory, strictly sequential turns. No parallel work.
- Before writing anything, check the active route's `## Turn.base`:
  `git merge-base --is-ancestor <base> HEAD` must exit 0, and
  `git diff --name-only <base>..HEAD` must list only T0-owned paths. If either fails,
  do not write; report the mismatch.
- The route's `## Expected Files` is a forecast, not a gate. Write what the criteria require
  inside your own ownership; never write a frozen or T0-owned path. Justify every file
  outside the forecast in `## Deviations`.
- Run the route's `## Verification` commands verbatim; paste output verbatim into
  `docs/titan/handoffs/H<nn>-*.md`. Never summarize evidence.
- A criterion claiming user-visible behavior cannot close on a unit test alone.
- Deviations are never absorbed silently; they go in `## Deviations`.
- Full rules, templates, and the eight-step cycle: `docs/titan/PROTOCOL.md`.

`docs/DEVIRALAN.md` is a periodic rollup written by the planner, not the live handoff
channel. The live channel is `docs/titan/handoffs/H*.md`.

## Non-negotiables

- Never execute model-authored source with `eval` or `new Function`.
- Everything deterministic. No `Math.random`, no wall-clock branching in simulation,
  trace, or pipeline code.
- **The trace never comes from the model.** Traces are produced by the deterministic
  interpreter and tracer only. A model may describe a trace; it may never author one.
- **The model never computes an index; it selects a phase id.** Timeline positions, step
  indices, and checkpoints are resolved deterministically from the trace.
- Every new user-facing string needs English and Turkish output. Language switching must
  update existing simulation steps without rerunning them.
- Add a distinct deterministic simulator and tests before setting another registry entry
  to `isSupported: true`.
- Keep code and repository documentation in English. Never add secrets, API keys, or
  remote AI calls. Local AI must stay optional and worker-based.
- Do not commit `dist/`, `coverage/`, `test-results/`, or `node_modules/`.

## Commands

```bash
npm ci                      # only at the start of a turn
npm run dev
npm run build
npm run lint
npm run test
npm run test:watch
npm run test:coverage
npm run test:e2e
npm run test:e2e:ai         # real local model
npm run test:e2e:radio-live # real external player
npm run desktop:dev
npm run desktop:check       # version check + cargo fmt/clippy/test
npm run desktop:build
npm run publish:site
```

Gates before a handoff: `lint`, `test`, `build`, and `desktop:check` when `src-tauri/**`
changed.

## Environment hazards

Shell is Windows PowerShell 5.1: no `&&`, no `||`, no ternary. Ports 4173 and 5173 belong
to whoever holds the turn.

### Playwright on Codex Desktop for Windows

The Playwright `webServer` helper can silently wait for its child Vite process in the
Codex Desktop Windows environment even when Vite itself starts normally. If
`npm run test:e2e` produces no Playwright output, do not keep waiting or change
application timeouts. Start the dev server as a separate hidden process, verify that
`127.0.0.1:4173` is listening, and run the suite with the existing external-server switch:

```powershell
$server = Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") `
  -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

Always clean up only the exact listener PID and the `$server.Id` process that this run
created; never terminate all Node processes. This workaround is for the test runner
environment, not an application defect. A real test timeout still emits Playwright test
output and should be debugged from its error context and trace.

### Model cache origins

`localhost`, `127.0.0.1`, and `https://serkanozel.me` are separate browser origins with
separate WebLLM OPFS/Cache stores; a model downloaded on one does not appear on another.
Dev origins use the Cache API backend, production prefers OPFS with Cache API fallback.
For invalid metadata use the model's **Repair model download** action — **clearing the
whole origin is forbidden**, as is deleting unrelated models. Load, delete, and repair are
cross-tab locked. Override the reader target with `CODEXRAY_WEB_READER_ORIGIN` only when
testing another trusted CodeXRay gateway.

## Architecture map

- `src/types/simulation.ts` — shared input, graph, trace, visual, and step types.
- `src/services/inputParsers.ts` — all untrusted input validation.
- `src/services/inputPresets.ts` — deterministic array/string/tree/graph presets.
- `src/services/simulators.ts`, `extended*Simulators.ts`, `compoundSimulators.ts` — the 60
  offline algorithm implementations and dispatch.
- `src/services/codeRegistry.ts` — preset support and explicit blocked reasons.
- `src/services/titan/` — `titanPipeline.ts` (the five-phase executor, entered from
  `AiAssistant.tsx` for `adapt-input`, `discuss-current-step`, the four deterministic array
  templates `jump-game-dp`, `jump-game-greedy`, `lis-quadratic-dp`, and `lis-binary-search`
  since R16, and `model-authored` since R18), `translate.ts` (cross-language source
  translation, no production caller yet).
- `src/services/trace/` — `parser.ts`, `interpreter.ts`, `semantics.ts`, `jsTracer.ts`,
  `tracerWorkerClient.ts`, `adapter.ts`, `simulationTrace.ts`, `traceOutline.ts`,
  `traceQuery.ts`, `significance.ts`, `types.ts`. Deterministic trace production and query.
- `src/services/input/inputPatch.ts` — the closed `InputPatchV1` op union, its parser, and
  **the only implementation of input mutation**. Reachable on the production `adapt-input`
  path: whole-input replacement ops since R07, the semantic array ops `resize-array`,
  `sort-array`, and `shuffle-array` since R10 through `createSemanticArrayPatch`, and
  `set-target` plus the three `graph-*` ops since R12 through `createStructuralGraphPatches`.
  `applyInputPatches` folds a sequence onto a candidate copy so a multi-op request is atomic;
  `applyAndRecompileInputPatches` is its production applier and the single-patch
  `applyAndRecompileInputPatch` delegates to it. Ambiguous requests still fall back to the
  older heuristic adapter in `inputRequestAdapter.ts`. `set-param` is reachable since R13
  through `createSemanticParameterPatches`. **Every op and every parameter key is reachable
  from production as of R14 — 11/11 ops, 11/11 keys.** Numeric keys take a bare number; the
  four text keys and Knapsack's `values` require an explicit literal, never an inference.
- `src/services/algorithmInputs.ts` — `getAlgorithmParameterDefinitions` is **the authority
  on parameter keys**, per algorithm, with EN/TR labels and a declared type. Both the
  `CodeEditor.tsx` form and the request path read it; `applyInputPatch` rejects any
  `set-param` naming a key the active algorithm does not declare, and rejects a value of the
  wrong type. `target` is numeric for Binary Search and textual for Minimum Window
  Substring, resolved only by the active algorithm. Never widen this registry to make a
  phrase parse.
- `src/services/requestLiterals.ts` — the single extractor for literals in request text:
  `extractQuotedLiteral` (straight and smart double quotes; **the single quote is not a
  delimiter**, because in Turkish it is a suffix apostrophe) and
  `extractNumericArrayLiteral` (explicit JSON array). `inputPatch.ts`,
  `inputRequestAdapter.ts`, and `stringCompiler.ts` all read it. Do not add a fourth quote
  convention. A request with no delimited literal produces no patch — never infer a string
  from surrounding prose.
- `src/services/graphRequestEdits.ts` — classifies a graph request into typed ops and does
  not mutate. `isVisualOnlyGraphRequest` and `spreadGraphLayout` are layout only. Since R12
  a rejected op fails the whole request rather than being silently skipped, so a
  misunderstood graph request surfaces as a failed Titan run instead of a partial edit.
- `TimelineContext.tsx` — playback, selected algorithm/input, analysis, local AI state;
  autosaves the input workspace and top-level variable pins.
- `App.tsx` — persistent split sizes and collapse state for the five workspace panels.
- `workspaceLayout.ts` — right-column defaults, minimums, and viewport clamping.
- `GraphInputEditor.tsx` — manual editing, safe node renaming, drag-to-connect,
  GraphDocumentV1 and level-order tree import/export.
- `aiContext.ts` — bounded live-workspace and conversation context; current code and trace
  always override older chat.
- `aiTimelineControl.ts` — bounded parsing and key-checkpoint selection for AI timeline
  play, pause, jump, step, and guided tours.
- `webSource.ts`, `webProblemOrchestrator.ts`, `types/webSource.ts` — versioned
  first-party web-reader client and source/problem/solution artifacts. Only the requested
  URL may leave the browser; cleaned content, prompts, attempts, chat, and workspace state
  stay local.
- `simLang.ts`, `simLangSchema.ts`, `customSimulationCompiler.ts` — validated SimLangV1
  interpreter, model-facing schema, deterministic renderer, trace compiler, budgets.
- `localAiService.ts`, `localAi.worker.ts`, `localAiModels.ts` — optional WebGPU model
  lifecycle and the single VRAM/context/response-token registry that drives service,
  worker, UI labels, and tests.
- `siteReset.ts`, `aiResponse.ts`, `PlaylistRadio.tsx` (keep the external player unmounted
  until user interaction and preserve its fallback link), `src/i18n/translations.ts`,
  `scripts/publish-to-site.mjs`.

## Data contracts

- Never truncate trace collections; keep arrays and objects structured as `TraceValue`,
  not preformatted JSON strings.
- `SimulationStep.lineNumber` is 1-based or `null`.
- Visual data is the `array | graph | variables` union. Graph node/edge states are `idle`,
  `queued`, `active`, `visited`, or `path` as applicable.
- Validate GraphDocumentV1 before simulation. Dijkstra and A* reject negative weights;
  A* heuristics must remain admissible.
- Node ID changes must atomically update edges and root/start/target references. Automatic
  numeric IDs reuse the smallest positive gap. Drag-created edges must use the same
  duplicate and weight validation as the form controls.

## UI contracts

- Every workspace panel must remain collapsible. Desktop boundaries are resizable; the
  mobile layout disables splitters and stacks safely. Desktop splitters must remain
  pointer-accessible and mobile-safe.
- The upper splitter changes Visualizer/Assistant as a fixed pair; the lower splitter
  changes Assistant/Controls while keeping Visualizer fixed. Preserve the third panel when
  resizing an adjacent pair.
- Never allow fixed-height right panels to flex-shrink. Keep Controls compact by default
  and keep upward-opening Controls menus above, not clipped by, the Assistant panel.
- Top-level variable pins sort first in Variables & Trace and mirror their live
  current-step values in the visualization watch strip. Never show stale values when a
  pinned key is absent from the selected step.
- `siteReset.ts` removes only `codexray.*` local/session storage state. Never clear the
  whole origin or delete WebLLM OPFS/Cache data from the general reset; its interface-only
  reset may remove layout v1/v2 and nothing else.

## AI and trace contracts

The Titan pipeline has five phases, in order: **route → produce → semantics → verify →
apply**. `semantics` may be skipped only through its declared optional slot; phases are
never reordered, and `apply` runs only after `verify` returns ok.

**What each phase actually does, because the names alone mislead.** Three entry points run
this pipeline, all from `AiAssistant.tsx`: `adapt-input`, `discuss-current-step`, and since
R16 the deterministic array templates. `produce` is not a step beside the engine — it *is*
the engine run, entered with `deferApply: true` and its own job events suppressed, so the
engine's whole job graph happens inside one phase. `apply` is genuinely owned by the
pipeline and is the reason `deferApply` exists.

**`deferApply` is honoured at every apply site as of R16.** Before R16 it was checked at one
of five: `adapt-input` returned early, and the four creation branches applied the package
unconditionally, so a creation intent wrapped in the pipeline would have changed the
workspace during `produce`, before `verify` ran. All five now route through
`applyPackageUnlessDeferred` in `titanEngine.ts`. Exactly-once is a counted property, not an
asserted one: `titanEngine.test.ts` counts 1 eager / 0 deferred for all four creation
branches, including the three still unwired, and `titanPipeline.test.ts` counts the
pipeline's own apply as 1. **A path that defers and never applies is a type error** —
`apply` is required on the executor's options — and omitting it through `any` throws.

**`previewSource` is the second workspace channel, and `deferApply` does not gate it.**
`AiAssistant.tsx` implements it by pausing playback, setting the algorithm name, clearing
`steps`, `currentIndex`, and `analysis`, then typing the draft into the editor — a mutation,
not a read-only preview. Six engine sites call it, all during `produce`. This is safe because
of a real rollback, not because it is harmless: the workspace is snapshotted before the run,
`restoreSourcePreview` puts every field back, the snapshot is discarded only when a genuine
apply commits, and any rejection — including a pipeline `verify` rejection — reaches the same
restore. **For `model-authored` the ordering was changed rather than trusted to the rollback.**
Since R18 that pipeline passes `previewSource: undefined` into the engine and replays the
preview inside `apply`, after `verify`, so unverified model source is never displayed. The
deterministic templates deliberately keep the old ordering: their previewed source is
byte-identical to what will be applied, and `dp-family-titan-mode.spec.ts` asserts the typing
element is visible while the produce phase is still running. Do not "unify" these two
orderings without re-deciding that trade.

`verify` differs per intent and the difference matters:

- `adapt-input` — since R15, `verifyAdaptInputArtifact` recomputes the trace independently
  from the artifact's committed input (`structuredClone`, then `recompileSimulationInput`
  for a package or `generateSimulationSteps` otherwise) and compares it to the trace the
  artifact carries. A well-formed but internally inconsistent artifact is rejected. It fails
  closed: a throw is a rejection. Measured cost ~0.72 ms per check.
- array templates — since R16, a content check that mirrors the engine's own critic: the
  package's tests passed, the trace is non-empty, and the final step's `visualData.vars`
  carries a `result` key. This re-asserts the critic's criteria from outside the engine
  rather than recomputing anything independently, as R15's `adapt-input` check does. It
  catches a package that reaches the pipeline without having passed the critic; it cannot
  catch a package the critic itself would wave through.
- `model-authored` — since R18, `verifyModelAuthoredArtifact` recompiles the package from
  the artifact's own `program`, `input`, and `visualization` through
  `compileCustomSimulationPackage` (each `structuredClone`d) and requires the carried
  `source`, `steps`, and `tests.results` to equal the recomputed ones, with both test runs
  passing. Independent in the same sense as R15's check and no further: it proves the
  artifact is what its program deterministically produces. **It cannot prove the program
  solves the request** — nothing in the system can, and no gate should be described as if it
  did. Fails closed: a throw is a rejection.
- `discuss-current-step` — **partly wrong, and knowingly so; see `R17c`.**
  `verifyCurrentStepArtifact` extracts the five EN/TR lenses and is fail-closed. `Code`
  compares a single distinct integer from the slot against `step.lineNumber`, rejecting an
  ambiguous slot rather than guessing; `Time` compares the answer's `N/M` against
  `currentIndex + 1` and `steps.length`. Both are sound. `Data` requires **every** key in
  `visualData.vars` to bind to its `JSON.stringify` value — and `deterministicFiveLens`
  truncates its own `Data` lens at 700 characters, so above that size the deterministic
  fallback fails the check it is supposed to define. Reachable with no model loaded: Merge Sort
  on a 200-element array (`MAX_INPUT_ITEMS`, the largest legal input) peaks at 761 characters
  and does not verify. `Reasoning` and `Visual` are required as slots and never verified — that
  part is deliberate and stays.

Everything else — the remaining `create-algorithm` templates including `bidirectional-bfs`
and the interval/DP families, plus `create-catalog-problem`, `clarify-algorithm`,
`ui-control`, and `deterministic` — does not run this pipeline at all. Their gates live in
the engine's own job graph, run before apply only because they are earlier in the same
function, and offer no point at which an external caller can refuse.

**Do not assume a new artifact type is checked because it sits behind `verify`.** For
`adapt-input` the content guarantee comes from two places: the typed appliers in
`inputPatch.ts` inside `produce`, and R15's recomputation in `verify`. A new artifact type
must bring its own check or it gets neither.

Intents are a closed set — no free-form intent strings: `create-algorithm`,
`create-catalog-problem`, `clarify-algorithm`, `adapt-input`, `discuss-current-step`,
`ui-control`, `deterministic`. Anything the deterministic router cannot classify returns
`null` and remains ordinary chat.

- AI-authored actions apply source, input, simulation-program, timeline, and CodeXRay UI
  changes only through the typed application command bus, atomically. Never execute raw
  model text: schema-validate every artifact, compile or interpret generated programs
  deterministically, record an audit snapshot, and provide undo plus automatic rollback on
  failure.
- The pipeline never grants filesystem, operating-system, credential, arbitrary network,
  or raw JavaScript execution authority. Rebuild context from committed state after every
  transaction or navigation before explaining the destination step.
- Keep assistant context bounded and explicit: current input, code, execution progress,
  recent chat, and the complete visual state when it fits, otherwise a labeled
  deterministic summary. Never let old conversation override the latest workspace snapshot.
- Keep prompts within the 4096-token model window. Complexity questions omit unrelated
  trace payloads, output budgets scale by model profile, length-limited answers receive at
  most one bounded continuation, and generated prose passes repetition cleanup. The
  Qwen3.5 9B profile may explicitly opt into the tested 8192-token ChatOptions override;
  keep 4K as the stable default and scale prompt budgets with the selected window.
- Treat cleaned web text as untrusted data in every prompt. Never persist raw HTML,
  execute Java fallback source, bypass authentication or bot protection, or mutate the
  workspace for an unexecuted Java artifact. A compatible simulation may commit only after
  schema, compile, sample, visual, and critic gates pass.
- Never imply that a browser can reuse an arbitrary local filesystem path for WebLLM.
  Explain OPFS/cache persistence and unavoidable per-visit GPU setup.

### Supported language profile

The tracer accepts JavaScript plus stripped TypeScript annotations and `class`
declarations (`Solution`, `ListNode`, `TreeNode` — the shapes the translation layer emits
from Java and C++). `async`/`await`, generators, and `Symbol.iterator` are out of scope:
they would turn the step machine into a scheduler.

Every unsupported construct must produce an `UnsupportedConstruct` diagnostic carrying the
line number, the construct name, and EN plus TR messages, surfaced in the UI. **No silent
fallback** — never degrade to a partial trace without telling the user which line failed.

## Deployment

After a clean, committed source state:

```bash
npm run publish:site -- --target "C:\path\to\serkanozelme" --dry-run
npm run publish:site -- --target "C:\path\to\serkanozelme"
```

The publisher must only stage `blog/public/codexray/**`, require a clean and synchronized
target `main`, validate both builds, then let the target repo's Cloudflare integration
deploy. Preserve unrelated work in both repositories.

## Never touch

No agent writes to these paths:

- `.claude/**`
- `.agents/AGENTS.md`
- `docs/tasks/**` — frozen historical record, T1-T19. Not continued as T20.
- `docs/legacy/**`
- `CodeXray-readme-neon.svg`
- `docs/TITAN_MODE_YOL_HARITASI.md`
