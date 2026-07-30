<div align="center">
  <img src="public/favicon.svg" alt="CodeXRay logo" width="120" />
  <h1>CodeXRay ⚡</h1>
  <p><strong>See algorithms execute, one state change at a time.</strong></p>
</div>

CodeXRay is a bilingual English/Turkish browser-based algorithm visualizer built
with React, TypeScript, and Vite. Its simulations are deterministic and local:
source code and input are never sent to an API.

## Features

- 60 deterministic simulators covering traversal, shortest paths, MST, SCC,
  max flow, matching, graph structure, sorting, array/DP techniques, Manacher,
  string searching, tree traversal/LCA, number theory, and linked lists.
- Algorithm-specific compound inputs for patterns, targets, window sizes,
  interval pairs, knapsack values/capacity, coin amounts, and cycle entries.
- Complete structured Variables & Trace data without hidden or truncated items.
- Array, string, tree, and graph inputs with validation and examples.
- A visual tree/graph builder with draggable nodes, editable node IDs and labels,
  drag-to-connect handles, directed/weighted edges, root/start/target selection,
  and JSON import/export.
- Binary-tree import from level-order JSON such as `[1,2,3,null,4]`.
- Timeline playback, line highlighting, graph states, paths, arrows, and weights.
- Optional private, on-device Qwen-family assistant powered by WebLLM/WebGPU,
  with bounded local conversation memory and live code/input/trace context.
  Its Turkish persona is **Bilgiç Dede**; English keeps **Master Coder**.
- The assistant can safely control timeline playback: jump to a requested step,
  play, pause, move one step, or build an eight-stop guided tour of important
  deterministic trace moments. It cannot silently edit source code or input.
- Model choices range from the fast Qwen2.5 Coder 0.5B to Qwen3.5 9B for
  16 GB-class GPUs. Cached models initialize automatically on later visits and
  each stored model can be removed independently from Settings.
- A click-to-load CodeXRay Radio using the requested YouTube Music playlist,
  with a direct playlist fallback when a track disallows embedding.
- Browser autosave for the current input workspace.
- Instant English/Turkish switching, including existing simulation explanations.
- The graph/tree builder uses the large visualization panel and can switch back
  to the running simulation without losing input.
- Resizable desktop boundaries and collapsible code, trace, visualization,
  assistant, and control panels; preferences persist locally.
- Right-column splitters resize only their adjacent panel pair. The compact
  Controls panel starts between 96 and 120 px, panel minimums are enforced without
  flex-shrinking unrelated regions, and saved sizes are clamped after a viewport
  change.
- Persistent variable pins that stay at the top of Variables & Trace and mirror
  live values in a horizontally scrollable visualization watch strip.

The local model does not train on the conversation. CodeXRay restores up to 24
messages from browser storage and sends a bounded recent subset with each
question. The newest workspace snapshot—current code, input, progress, selected
line, complete current visual state, and nearby trace—always overrides older
chat. Conversation memory can be cleared from the assistant header.

## Development

Use Node.js 22 or newer:

```bash
npm ci
npm run dev
```

Quality commands:

```bash
npm run lint
npm run test
npm run test:coverage
npm run build
npm run test:e2e
```

Playwright needs a one-time local browser install:

```bash
npx playwright install chromium
```

## Input formats

Arrays accept JSON or comma-separated numbers:

```text
[8, 3, 5, 1]
8, 3, 5, 1
```

Strings accept plain, quoted, or assigned values:

```text
AABAABAAZ
"AABAABAAZ"
s = "AABAABAAZ"
```

Trees can be built manually or imported in level order:

```json
[1, 2, 3, null, 4]
```

Graphs and general trees use the versioned `GraphDocumentV1` format exposed by
the builder’s export panel. Node positions are percentages from 0 to 100. Click
a node to edit its ID or label; renaming an ID updates every edge and
root/start/target reference. New numeric IDs reuse the first available gap.

## Local AI

Open Settings and load one of:

- `Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC` — default and faster.
- `Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC` — larger enhanced option.
- `Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC` — ultra option, approximately 5.1 GB
  of GPU memory and significantly heavier initialization.

Model weights prefer the browser’s private OPFS storage with Cache API fallback,
and CodeXRay requests persistent origin storage. A cached model does not need to
be downloaded again, although every page visit must still initialize it into GPU
memory. Browser security intentionally prevents the site from retaining an
arbitrary Windows folder path. The visualizer remains fully functional when
WebGPU is unavailable.

Short questions such as complexity queries receive focused source-code context
instead of the complete execution trace. Decoding penalties and deterministic
response cleanup prevent small models from repeating the same paragraph until
the output limit.

Timeline requests can be phrased naturally, for example `go to step 30 and
explain it`, `30. hamleye sar`, `pause here`, or `walk me through the important
steps`. Navigation is bounded to the existing deterministic trace. Guided-tour
buttons remain visible below the assistant so each selected checkpoint can be
revisited and explained with its exact live state.

Response budgets scale with the selected model: 520 tokens for the fast 0.5B
profile, 640 for 1.5B, 760 for 7B, and 900 for 9B, with one bounded automatic
continuation when WebLLM reports `finish_reason: length`. All current packaged
profiles still share a 4096-token context window, so parameter count does not
silently expand prompt memory. Qwen3.5 9B additionally exposes an explicit
experimental 8192-token override in Settings. Selecting it reloads the engine
with a larger KV cache and expands source/history budgets; 4K remains the stable
default because 8K uses more GPU memory and may fail on device-specific WebGPU
limits.

The selected cached model is detected and initialized automatically after a
return visit. Settings lists every model stored in this origin’s OPFS/cache and
offers an explicit delete action. Deleting a model removes its browser-managed
files; using it again requires a fresh download.

Settings also provides a scoped site reset. It removes only `codexray.*`
local/session storage state—workspace input, chat, pins, locale, layout, and AI
preferences—then reloads the app. It deliberately leaves OPFS/Cache API model
files and unrelated storage belonging to the parent portfolio origin untouched.
The neighboring **Reset interface** action is narrower: it removes only layout
v1/v2, restoring panel sizes and collapse state while preserving workspace
input, pins, chat, locale, AI preferences, and downloaded models.

Workspace layout preferences use `codexray.layout.v2`; the version change
intentionally discards the older unbalanced right-column defaults. The Examples
menu renders above the assistant stacking layer and remains scrollable rather
than being clipped by the Controls panel.

## Publish to serkanozel.me

The production app is hosted at:

```text
https://serkanozel.me/codexray/
```

Preview the publication without changing the website repository:

```powershell
npm run publish:site -- --target "C:\Users\serkan\git\serkanozelme" --dry-run
```

Build, test, copy, validate, commit, push, and wait for Cloudflare with:

```powershell
npm run publish:site -- --target "C:\Users\serkan\git\serkanozelme"
```

Use `--no-push` to create and validate the target commit without pushing it.
The command refuses dirty, divergent, or unexpected repositories and stages
only `blog/public/codexray/**`.
