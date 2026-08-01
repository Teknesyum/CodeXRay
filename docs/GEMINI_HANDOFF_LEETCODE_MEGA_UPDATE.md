# CodeXRay Gemini Handoff Prompt — Universal LeetCode Simulation Update

Copy the entire prompt below into Gemini before continuing development.

---

## Prompt for Gemini

You are taking over active development of **CodeXRay** for Serkan. Work from the
latest `main` branch of the following repository:

- Repository: `https://github.com/srknzl/CodeXRay.git`
- Local project used during the previous development session:
  `C:\Users\Administrator\Desktop\Projeler\CodeXRay_Serkan`
- Application: `http://localhost:5173/`

Start with `git pull origin main`, read `AGENTS.md` completely, inspect the live
code, and read these documents before proposing or changing architecture:

1. `docs/PRODUCT_REQUIREMENTS.tr.md`
2. `docs/TEST_COVERAGE_GAPS.md`
3. `docs/GEMINI_HANDOFF_LEETCODE_MEGA_UPDATE.md`

Do not overwrite working behavior with an older plan. Do not assume an earlier
Gemini/Antigravity implementation is still authoritative when the current source
and tests say otherwise.

## Product vision

Serkan is pursuing a very large update: a user should be able to name or paste a
LeetCode-style problem, provide a custom input, and ask CodeXRay God Mode to:

1. understand the exact problem and constraints;
2. decompose the work into visible specialist-agent jobs;
3. design the correct algorithm and state model;
4. type the source code into the real editor with the God Mode typing effect;
5. generate and validate a suitable input contract;
6. compile a deterministic trace tied to the authored source;
7. create an algorithm-specific visualization rather than reusing an unrelated
   preset visualization;
8. let the user play, pause, step, rewind, jump, tour, and discuss any state;
9. explain Code, Data, Visual, Reasoning, and Time from the exact committed
   snapshot;
10. verify the final answer and explain how it follows from the trace.

The target is not merely a large preset library. The long-term goal is a
**general LeetCode simulation compiler** that supports whole algorithm families.
Do not falsely claim universal coverage until the contracts, compiler,
visualization, and verification gates actually support it.

## Current stack and non-negotiable constraints

- React 19, TypeScript 6, Vite 8.
- Vanilla CSS only. Never introduce Tailwind or another CSS framework.
- Icons use `lucide-react`.
- AI runs locally with `@mlc-ai/web-llm`; no API keys or remote AI provider.
- The UI supports Turkish and English.
- Visual language: neon, cyberpunk, glassmorphism, gradients, shadows,
  translucent surfaces, and restrained micro-animations.
- Never execute model-authored JavaScript through `eval`, `new Function`, or an
  equivalent escape hatch.
- Every model artifact must be schema validated before application.
- God Mode may change validated code, input, trace, visualization, timeline, and
  UI state, but never gains filesystem, OS, credential, arbitrary-network, or
  raw-JavaScript authority.
- Workspace application must remain transactional with audit state, undo, redo,
  and rollback.
- Generated trace collections must remain structured and must never be silently
  truncated.
- `SimulationStep.lineNumber` is 1-based or `null`.
- Current workspace state always overrides older conversation history.
- New visible strings require complete Turkish and English translations.
- All panels remain collapsible; desktop resize and mobile stacking must remain
  safe.
- Do not mark a registry preset supported without its own deterministic
  simulator.

## Current architecture you must preserve and extend

Important files and responsibilities:

- `src/context/TimelineContext.tsx`: committed workspace, playback, transactions,
  simulation input, trace, analysis, AI/model state, radio and theme state.
- `src/components/AiAssistant.tsx`: chat, deterministic routing, God Mode start,
  source preview typing, transactional application, teaching output, cancellation.
- `src/components/GodModeProgress.tsx`: compact single-line agent queue, status
  icons, controls, and custom neon tooltips.
- `src/services/godModeRouting.ts`: deterministic intent routing and supported
  request recognition.
- `src/services/godModeOrchestrator.ts`: serialized ManagerPlanV1 job graph,
  specialist handoffs, retries, package application, teaching stages, and cancel.
- `src/services/localAiService.ts`: worker bridge and local-agent lifecycle.
- `src/workers/localAi.worker.ts`: serialized WebLLM inference queue.
- `src/services/simLang.ts`, `simLangSchema.ts`,
  `customSimulationCompiler.ts`: validated SimLangV1 program and deterministic
  trace compilation.
- `src/services/dpTemplateCompiler.ts`: deterministic DP-family packages,
  including 2D and space-optimized variants.
- `src/services/codeRegistry.ts`: existing 60 supported preset algorithms.
- `src/services/inputParsers.ts` and `inputPresets.ts`: untrusted-input validation
  and deterministic examples.
- `src/components/DynamicVisualizer.tsx`: array, graph, matrix, variable, and
  package visual rendering.
- `src/components/CodeEditor.tsx`: editable source and syntax-highlighted God Mode
  source display.

WebLLM must remain a single serialized inference engine. “Multi-agent” means
isolated specialist requests scheduled sequentially over that one engine, not
multiple simultaneous models competing for VRAM.

## Work completed in the latest development cycle

Preserve all of the following:

### God Mode execution and DP support

- God Mode can route deterministic supported requests without waiting for the
  local model.
- The source-authoring phase types generated source visibly into the editor.
- DP template support includes Coin Change, LCS, Edit Distance, 0/1 Knapsack,
  Longest Palindromic Subsequence, Predict the Winner/interval DP, House Robber,
  and a space-optimized LCS variant.
- Space-optimized LCS uses a one-dimensional array whose size is based on the
  shorter string, preserves `diagonal` and `upper` before overwrite, and exposes
  every meaningful state transition.
- The exact input `text1 = "abcde"`, `text2 = "ace"` has been verified in the
  browser. It generates Java source, uses four DP cells, produces 17 trace steps,
  and returns LCS length `3`.
- Bidirectional BFS has custom source, input, dual-frontier node states, discovered
  edge states, meeting point, and result-path highlighting.

### Agent queue UX

- The God Mode queue is a 32 px single-line strip.
- Jobs use short labels such as Manager/Yönetici, Code/Kod, Input, Visual/Görsel,
  Test, Trace, Result/Sonuç.
- State text is not repeated inside chips; state is conveyed by icon and color.
- Overflow scrolls horizontally instead of creating a second row.
- Hover/focus feedback uses a custom neon glass tooltip, not the browser's native
  `title` bubble.
- Undo, redo, cancel, and retry controls use the same neon tooltip system.
- The active agent uses a centered neon gear; waiting is a static circle,
  completed is a green check, and failed/cancelled is a red blocked icon.

### Cancellation and stuck-run fixes

- The queue close button operates on pointer-down, with keyboard activation still
  supported.
- Cancelling immediately stops source typing, clears local UI busy states, closes
  the queue, and re-enables chat controls.
- A cancelled or late worker response cannot reopen the dismissed run or apply a
  stale package.
- In-progress plans restored after a browser refresh are not presented as live
  resumable runs. Failed plans may remain available for retry.
- `runLocalAgent.cancel()` now rejects and removes the local pending Promise
  immediately before sending `agent-cancel` to the worker.
- Local agents have an output-budget-scaled hard timeout between 30 and 120
  seconds. A worker that never settles can no longer leave Code Author running
  forever.
- Timeout, cancellation, and missing-model transport errors are not blindly
  retried as though they were invalid SimLang output.

### UI and theme work

- God Mode and default source code use syntax-token rendering.
- Light theme has a dedicated high-contrast syntax palette for keywords, types,
  functions, numbers, strings, comments, and operators.
- The local-thinking spinner was slowed from one second to 1.5 seconds.
- The radio has quick play/pause access, a two-second default auto-hide delay,
  and track-repeat behavior that seeks to the current track start instead of
  advancing.
- Workspace defaults give more room to source code while keeping variables and
  visualization usable.

## Current verified baseline

At handoff, the following passed:

- `npm run lint`
- `npm run test -- --run`: **255/255 tests**
- `npm run build`
- God Mode cancellation/failure Playwright tests
- Three-theme contrast Playwright test
- Browser verification of space-optimized LCS for `abcde` and `ace`

Rerun the complete required validation before every handoff:

```bash
npm run lint
npm run test -- --run
npm run build
npm run test:e2e
```

Do not commit `dist`, `coverage`, `test-results`, `playwright-report`, or
`node_modules`.

## Known limitations — do not hide these

1. Universal arbitrary LeetCode coverage does not exist yet. Current quality is
   strongest for registered algorithms and deterministic DP templates.
2. SimLangV1 cannot yet express every algorithm family or visual state cleanly.
3. Model-authored programs can still fail schema validation; a deterministic
   family compiler is preferable when the problem can be classified reliably.
4. A small local model is not reliable enough to be the sole source of problem
   classification, code, input, visualization, verification, and narration in
   one response.
5. Visual design for genuinely custom algorithms must be authored from a typed
   visual contract. Reusing a generic array/graph preset without semantic mapping
   is not acceptable.
6. Source, trace, visual, and explanation can drift unless every one is compiled
   from the same validated intermediate representation.
7. A LeetCode number alone should only route deterministically when its metadata
   is present locally. Never hallucinate a problem statement from an unknown ID.

## Required universal architecture

Build the mega update around a validated compiler pipeline, not around longer
prompts.

### 1. ProblemSpecV2

Introduce a strict normalized problem contract containing at least:

- optional platform and problem ID;
- title and problem-family classification;
- complete user-supplied statement when available;
- function signature and source language;
- typed parameters and return type;
- constraints and allowed mutations;
- examples;
- edge cases;
- requested complexity target;
- requested visualization and teaching focus;
- confidence and provenance for every inferred field.

The problem analyst must distinguish confirmed facts from inference. Missing
critical fields must produce a concise clarification request or a local metadata
lookup, never an invented contract.

### 2. AlgorithmPlanV2

The architect should output a validated algorithm plan containing:

- chosen family and technique;
- state variables and invariants;
- transition rules;
- initialization, iteration order, and termination;
- source-level control-flow plan;
- expected time and space complexity;
- visualization primitives and semantic roles;
- trace checkpoints worth discussing;
- verification strategy and oracle.

### 3. SimLangV2 / Algorithm IR

Extend the deterministic intermediate representation by capability groups rather
than adding one-off problem hacks. It must eventually cover:

- arrays, prefix/suffix state, two pointers, sliding windows;
- maps, sets, stacks, queues, deques, heaps, and union-find;
- linked-list nodes and pointer rewiring;
- trees, recursion stacks, traversal, and subtree returns;
- graphs, weighted edges, multiple frontiers, paths, flows, and components;
- 1D, 2D, interval, grid, bitmask, state-machine, and compressed DP;
- recursion/backtracking decisions, pruning, choose/unchoose, and solution sets;
- greedy ordering and exchange decisions;
- tries and string automata;
- bit operations and bounded mathematical state.

Every IR operation needs validation, execution-budget accounting, deterministic
trace semantics, source-line mapping, and tests. Reject unsupported operations
explicitly.

### 4. Source renderers

Render Java first-class because Serkan frequently requests Java signatures. Keep
the IR language-neutral and add renderers incrementally for Python, C++,
JavaScript/TypeScript, and other languages. Source is a view of the validated IR;
it must not become a second, independent implementation.

### 5. VisualContractV2

Create a typed visual grammar capable of selecting and combining:

- arrays and multiple synchronized arrays;
- strings and character comparisons;
- matrices, grids, interval triangles, and compressed DP rows;
- graph/tree nodes and semantically grouped edges;
- linked-list pointers;
- stack/queue/heap views;
- recursion and decision trees;
- variable watches, invariants, candidate/result regions, and dependency arrows.

The Visual Designer agent must map algorithm semantics to this contract. It may
choose an existing renderer only when the semantic mapping is valid. Custom node
labels, positions, edge roles, and state colors must survive compilation and
timeline navigation.

### 6. Trace compiler and checkpoints

Each compiled step must include:

- exact source line;
- changed variables and structured values;
- visual delta and complete reconstructable visual state;
- transition reason;
- invariant status;
- dependency or predecessor cells/nodes;
- result contribution;
- whether the step is a discussion checkpoint.

The trace, visual, and explanation must derive from the same committed package.
Rewinding and replaying must be deterministic.

### 7. Verification pipeline

No generated package may commit until it passes all applicable gates:

1. schema and input-contract validation;
2. IR compile validation and execution budgets;
3. source-to-IR line mapping validation;
4. example-case assertions;
5. edge-case assertions;
6. deterministic reference-oracle comparison where available;
7. randomized differential/property tests for supported families;
8. final result and return-type validation;
9. trace replay determinism;
10. visual-state completeness and accessibility checks;
11. complexity claim consistency checks;
12. transactional apply/rollback test.

The Critic must return machine-readable findings. Invalid packages go to a
bounded repair job or fail visibly without changing the committed workspace.

### 8. Specialist job graph

Use explicit bounded jobs with visible progress:

1. Manager — classify and build the job graph.
2. Problem Analyst — normalize ProblemSpecV2.
3. Constraint Analyst — identify edge cases and complexity requirements.
4. Algorithm Architect — produce AlgorithmPlanV2.
5. Code Author — produce validated IR and source preview.
6. Input Engineer — parse/preserve user input and create teaching cases.
7. Visual Designer — produce VisualContractV2.
8. Compiler — compile deterministic trace and checkpoints.
9. Test/Critic — execute verification gates.
10. Result Analyst — verify the exact final output.
11. Trace Director — select meaningful stops and dependency explanations.
12. Five-Lens Tutor — narrate only committed snapshots.
13. UI Director — apply requested workspace layout or focus.

Do not ask one local-model call to perform all roles. Run these roles serially
with bounded context, timeouts, cancellation, retries, and deterministic
fallbacks.

## Algorithm-family rollout order

Prefer reusable family coverage in this order:

1. 1D/2D/grid/interval/compressed DP.
2. Arrays, hashing, prefix sums, two pointers, and sliding window.
3. Stack, monotonic stack, queue, deque, and heap.
4. Binary trees, BSTs, recursion, and tree DP.
5. Graph traversal, shortest path, MST, union-find, topological order, and flow.
6. Backtracking, subsets, permutations, combinations, pruning, and Sudoku-style
   constraint search.
7. Linked lists and pointer manipulation.
8. Tries, advanced strings, rolling hashes, and automata.
9. Greedy, intervals, scheduling, and sweep-line.
10. Bitmask DP, bit manipulation, and mathematical problems.

For each family, deliver the IR operations, compiler, visual contract, source
renderer, verifier, property tests, E2E scenarios, and documentation together.

## Mandatory acceptance scenarios

Keep these as permanent regression scenarios:

### Space-optimized LCS

Prompt:

`LCS ["abcde","ace"] için O(min(m,n)) bellek kullanan Java kodu yaz ve 1D DP statelerini adım adım simüle et`

Expected:

- Java signature `longestCommonSubsequence(String text1, String text2)`;
- shorter string used for DP columns;
- `int[] dp = new int[columns.length() + 1]`;
- correct diagonal/upper preservation;
- four memory cells;
- final result `3`;
- forward, backward, jump, replay, and Five-Lens explanation work.

### Predict the Winner / interval DP

Prompt includes:

`dp[i][j] = max(nums[i] - dp[i+1][j], nums[j] - dp[i][j-1])`

Expected:

- interval-length fill order;
- both dependency cells highlighted;
- each choice and score difference visible;
- correct final boolean result.

### Bidirectional BFS

Expected:

- source typed into the editor;
- user/custom graph preserved;
- two queues, visited sets, and parent maps;
- both node frontiers and traversed edges highlighted;
- meeting point and reconstructed shortest path shown;
- custom title and graph layout, not a generic BFS preset masquerading as custom.

### Core DP contracts

Maintain exact Java and simulation coverage for Coin Change, standard 2D LCS,
Edit Distance, 0/1 Knapsack, House Robber, and Longest Palindromic Subsequence.

### Failure behavior

- invalid problem contract: ask or fail without workspace mutation;
- invalid IR: bounded repair, then visible failure;
- WebGPU never settles: timeout and unlock UI;
- cancellation: queue closes immediately and late output is ignored;
- failed apply: atomic rollback;
- page reload: no fake live run is restored.

## Testing expectations

For every new family or IR operation, add:

- unit tests for schemas, parsers, compiler, interpreter, source renderer, and
  verifier;
- property/fuzz tests for input boundaries and deterministic replay;
- integration tests for the complete package transaction;
- E2E tests that type a realistic user prompt and inspect source, input, visual
  states, timeline controls, final result, cancellation, retry, and rollback;
- theme and accessibility checks for new visuals;
- a real-WebLLM smoke test where practical, kept separate from deterministic CI.

Tests must assert semantic state, not only that an element exists.

## UX expectations from Serkan

- The authored code must appear progressively in the real editor.
- New typed tokens use the neon typing effect and retain syntax highlighting
  afterward.
- The agent queue remains thin and closes when finished or cancelled.
- The AI answer area gets priority over oversized controls.
- Input and Simulation View switching remains always available.
- Teaching must show how states are filled, where each dependency came from, and
  why a checkpoint matters. A generic final paragraph is insufficient.
- The user must be able to stop at any state and ask hypothetical or comparative
  questions without the assistant inventing data outside the snapshot.

## Your first task after reading this prompt

1. Pull and audit the actual latest source.
2. Run the current tests and report the baseline without hiding failures.
3. Produce a concise gap analysis between SimLangV1/current DP templates and the
   universal architecture above.
4. Propose the smallest coherent first implementation slice. The recommended
   first slice is **ProblemSpecV2 + DP Family Contract V2 + verification gates**,
   because the current project already has strong DP foundations.
5. Discuss the slice with Serkan before broad changes, then implement it fully
   with tests rather than scattering partial interfaces across the repository.

Do not reduce God Mode back to navigation-only actions. The required product is
validated full-workspace authorship and deterministic simulation.

---

## End of Gemini prompt

