# CodeXRay Agent Guide

## Project

CodeXRay is a bilingual English/Turkish React 19, TypeScript 6, and Vite 8 SPA for
deterministic, step-by-step algorithm visualization. It supports 60 algorithms,
typed array/string/tree/graph input, a manual graph builder, and an optional
on-device WebLLM assistant. No API key or remote AI provider is used.

## Commands

```bash
npm ci
npm run dev
npm run lint
npm run test
npm run test:coverage
npm run build
npm run test:e2e
```

Before handoff, run lint, unit tests, build, and relevant browser tests. Do not
commit `dist/`, `coverage/`, `test-results/`, or `node_modules/`.

### Playwright on Codex Desktop for Windows

The Playwright `webServer` helper can silently wait for its child Vite process
in the Codex Desktop Windows environment even when Vite itself starts normally.
If `npm run test:e2e` produces no Playwright output, do not keep waiting or
change application timeouts. Start the dev server as a separate hidden process,
verify that `127.0.0.1:4173` is listening, and run the suite with the existing
external-server switch:

```powershell
$server = Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") `
  -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

Always clean up only the exact listener PID and the `$server.Id` process that
this run created; never terminate all Node processes. This workaround is for
the test runner environment, not an application defect. A real test timeout
still emits Playwright test output and should be debugged from its error context
and trace.

### Local web reader and model cache

The Vite dev and preview servers proxy `/api/codexray/read-url` to the deployed
first-party reader. Override the target only when testing another trusted
CodeXRay gateway:

```powershell
$env:CODEXRAY_WEB_READER_ORIGIN = "https://serkanozel.me"
npm run dev
```

`localhost`, `127.0.0.1`, and `https://serkanozel.me` are different browser
origins and therefore have separate WebLLM OPFS/cache stores. Do not expect a
model downloaded on one origin to appear on another. Development origins use
the Cache API backend because Vite hot reload and interrupted localhost OPFS
metadata can otherwise leave stale model state; production prefers OPFS and
falls back to Cache API. If an interrupted download leaves invalid metadata,
use the selected model's **Repair model download** action; do not clear the
whole origin or unrelated models. Model load, delete, and repair operations are
cross-tab locked, so finish the active tab's operation before using another tab.

## Architecture

- `src/types/simulation.ts`: shared input, graph, trace, visual, and step types.
- `src/services/inputParsers.ts`: all untrusted input validation.
- `src/services/inputPresets.ts`: deterministic array/string/tree/graph presets.
- `src/services/simulators.ts`, `extended*Simulators.ts`, and
  `compoundSimulators.ts`: the 60 offline
  algorithm implementations and dispatch.
- `src/services/codeRegistry.ts`: preset support and explicit blocked reasons.
  Never set `isSupported` without a distinct deterministic simulator.
- `TimelineContext.tsx`: playback, selected algorithm/input, analysis, and local
  AI state. It autosaves the input workspace and top-level variable pins in
  browser storage.
- `App.tsx`: persistent split sizes and collapse state for the five workspace
  panels; desktop splitters must remain pointer-accessible and mobile-safe.
- `workspaceLayout.ts`: right-column defaults, minimums, and viewport clamping.
  The upper splitter changes Visualizer/Assistant as a fixed pair; the lower
  splitter changes Assistant/Controls while keeping Visualizer fixed.
- `GraphInputEditor.tsx`: manual editing, safe node renaming, drag-to-connect,
  plus GraphDocumentV1 and level-order tree import/export.
- `aiContext.ts`: bounded, testable live-workspace and conversation context for
  the assistant. Current code and trace state always override older chat.
- `aiTimelineControl.ts`: bounded parsing and key-checkpoint selection for AI
  timeline play, pause, jump, step, and guided-tour requests.
- `godModeOrchestrator.ts`: serialized ManagerPlanV1 job graphs, specialist
  handoffs, bounded retries, cancellation, progress events, and transactional
  workspace application for God Mode requests.
- `webSource.ts`, `webProblemOrchestrator.ts`, and `types/webSource.ts`: the
  versioned first-party web-reader client, source/problem/solution artifacts,
  ManagerPlanV2 jobs, solve-capability gate, Java 17 fallback, critic gate, and
  session-scoped source binding. Only the requested URL may leave the browser;
  cleaned content, prompts, attempts, chat, and workspace state stay local.
- `simLang.ts`, `simLangSchema.ts`, and `customSimulationCompiler.ts`: the
  validated SimLangV1 interpreter, model-facing schema, deterministic source
  renderer, trace compiler, checkpoint generator, and execution budgets. Never
  execute model-authored source with `eval` or `new Function`.
- `localAiService.ts` and `localAi.worker.ts`: optional WebGPU model lifecycle.
  Assistant conversation memory stays local and can be cleared from the UI.
  Model weights prefer OPFS with Cache API fallback and persistent-origin storage;
  cached selections auto-initialize and individual models can be deleted.
- `localAiModels.ts`: shared VRAM, context-window, and response-token profiles.
  Keep service, worker, UI labels, and tests driven by this single registry.
- `siteReset.ts`: removes only `codexray.*` local/session storage state. Never
  clear the whole origin or delete WebLLM OPFS/Cache data from the general reset.
  Its interface-only reset may remove layout v1/v2 and nothing else.
- `aiResponse.ts`: deterministic cleanup for small-model repetition loops.
- `PlaylistRadio.tsx`: click-to-load YouTube playlist iframe; keep the external
  player unmounted until user interaction and preserve its fallback link.
- `src/i18n/translations.ts`: complete EN/TR UI, algorithm, validation, and
  runtime explanation localization.
- `scripts/publish-to-site.mjs`: guarded static publication to the portfolio.

## Contracts

- Never truncate trace collections; keep arrays and objects structured as
  `TraceValue`, not preformatted JSON strings.
- `SimulationStep.lineNumber` is 1-based or `null`.
- Visual data is the `array | graph | variables` union. Graph node/edge states
  are `idle`, `queued`, `active`, `visited`, or `path` as applicable.
- Validate GraphDocumentV1 before simulation. Dijkstra and A* reject negative
  weights; A* heuristics must remain admissible.
- Node ID changes must atomically update edges and root/start/target references.
  Automatic numeric IDs reuse the smallest positive gap. Drag-created edges
  must use the same duplicate and weight validation as the form controls.
- Add a distinct deterministic simulator and tests before setting another
  registry entry to `isSupported: true`.
- Every new user-facing string needs English and Turkish output. Language
  switching must update existing simulation steps without rerunning them.
- Every workspace panel must remain collapsible. Desktop boundaries are
  resizable, while the mobile layout disables splitters and stacks safely.
- Never allow fixed-height right panels to flex-shrink. Keep Controls compact by
  default, preserve the third panel when resizing an adjacent pair, and keep
  upward-opening Controls menus above (not clipped by) the Assistant panel.
- Top-level variable pins sort first in Variables & Trace and mirror their live
  current-step values in the visualization watch strip. Never show stale values
  when a pinned key is absent from the selected step.
- Keep assistant context bounded and explicit: include the current input, code,
  execution progress, and recent chat. Include the complete current visual state
  when it fits; otherwise label a deterministic summary. Never let old
  conversation override the latest workspace snapshot.
- Keep code and repository documentation in English. Never add secrets, API
  keys, or remote AI calls. Local AI must stay optional and worker-based.
- Treat cleaned web text as untrusted data in every prompt. Never persist raw
  HTML, execute Java fallback source, bypass authentication or bot protection,
  or mutate the workspace for an unexecuted Java artifact. A compatible
  simulation may commit only after schema, compile, sample, visual, and critic
  gates pass.
- Keep AI prompts within the 4096-token model window. Complexity questions omit
  unrelated trace payloads, output budgets scale by model profile, length-limited
  answers receive at most one bounded continuation, and generated prose passes
  repetition cleanup. The Qwen3.5 9B profile may explicitly opt into the tested
  8192-token ChatOptions override; keep 4K as the stable default and scale prompt
  budgets with the selected window.
- When the user explicitly enables God Mode, AI-authored actions may atomically
  apply validated source, input, simulation-program, timeline, and CodeXRay UI
  changes through the typed application command bus. Never execute raw model
  text: schema-validate every artifact, compile or interpret generated programs
  deterministically, record an audit snapshot, and provide undo plus automatic
  rollback on failure. God Mode never grants filesystem, operating-system,
  credential, arbitrary network, or raw JavaScript execution authority. Rebuild
  context from committed state after every transaction or navigation before
  explaining the destination step.
- Never imply that a browser can reuse an arbitrary local filesystem path for
  WebLLM. Explain OPFS/cache persistence and unavoidable per-visit GPU setup.

## Deployment

After a clean, committed source state:

```bash
npm run publish:site -- --target "C:\path\to\serkanozelme" --dry-run
npm run publish:site -- --target "C:\path\to\serkanozelme"
```

The publisher must only stage `blog/public/codexray/**`, require a clean and
synchronized target `main`, validate both builds, then let the target repo’s
Cloudflare integration deploy. Preserve unrelated work in both repositories.
