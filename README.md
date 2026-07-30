<div align="center">
  <img src="public/favicon.svg" alt="CodeXRay logo" width="120" />
  <h1>CodeXRay ⚡</h1>
  <p><strong>See algorithms execute, one state change at a time.</strong></p>
</div>

CodeXRay is a bilingual English/Turkish browser-based algorithm visualizer built
with React, TypeScript, and Vite. Its simulations are deterministic and local:
source code and input are never sent to an API.

## Features

- 13 real simulators: DFS, BFS, Dijkstra, A*, Z Algorithm, Quick Sort, Merge
  Sort, Heap Sort, Radix Sort, Counting Sort, Bubble Sort, Insertion Sort, and
  Selection Sort.
- Complete structured Variables & Trace data without hidden or truncated items.
- Array, string, tree, and graph inputs with validation and examples.
- A visual tree/graph builder with draggable nodes, editable node IDs and labels,
  drag-to-connect handles, directed/weighted edges, root/start/target selection,
  and JSON import/export.
- Binary-tree import from level-order JSON such as `[1,2,3,null,4]`.
- Timeline playback, line highlighting, graph states, paths, arrows, and weights.
- Optional private, on-device Qwen2.5 Coder assistant powered by WebLLM/WebGPU,
  with bounded local conversation memory and live code/input/trace context.
  Its Turkish persona is **Bilgiç Dede**; English keeps **Master Coder**.
- A click-to-load CodeXRay Radio using the requested YouTube Music playlist,
  with a direct playlist fallback when a track disallows embedding.
- Browser autosave for the current input workspace.
- Instant English/Turkish switching, including existing simulation explanations.
- The graph/tree builder uses the large visualization panel and can switch back
  to the running simulation without losing input.
- Resizable desktop boundaries and collapsible code, trace, visualization,
  assistant, and control panels; preferences persist locally.
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
