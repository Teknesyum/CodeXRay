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
