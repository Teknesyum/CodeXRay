# CodeXRay Agent Guide

## Read order

1. This file.
2. `docs/titan/PROTOCOL.md` — the canonical turn protocol, single source of truth.
3. The active route: the highest-numbered `docs/titan/routes/R<nn>-*.md`, directly in that
   folder. `docs/titan/routes/queued/**` holds drafted future routes — planning material,
   never an instruction to write code.

Nothing else. Do not scan the repository before reading these three. Archived material in
`docs/legacy/**` and `docs/tasks/**` is historical record, not instruction.

## Turn protocol (binding)

- One branch, one working directory, strictly sequential turns. No parallel work.
- Before writing anything, check the active route's `## Turn.base`:
  `git merge-base --is-ancestor <base> HEAD` must exit 0, and
  `git diff --name-only <base>..HEAD` must list only T0-owned paths. If either fails,
  do not write; report the mismatch.
- Touch only the paths listed in the route's `## Owned Files`.
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
- `src/services/titan/` — `titanRouter.ts` (intent routing), `titanPipeline.ts` (the
  five-phase executor), `translate.ts` (cross-language source translation).
- `src/services/trace/` — `parser.ts`, `interpreter.ts`, `semantics.ts`, `jsTracer.ts`,
  `tracerWorkerClient.ts`, `adapter.ts`, `simulationTrace.ts`, `traceOutline.ts`,
  `traceQuery.ts`, `significance.ts`, `types.ts`. Deterministic trace production and query.
- `src/services/input/inputPatch.ts` — validated workspace input mutation.
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

Intents are a closed set — no free-form intent strings: `navigate`, `edit-input`,
`explain`, `trace-code`, `translate-code`, `load-preset`, `ui-control`, `unclear`.
Anything the deterministic router cannot classify is `unclear`.

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
