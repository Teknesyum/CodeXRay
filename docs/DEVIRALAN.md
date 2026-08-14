# CodeXRay Handoff Snapshot

Last updated: 2026-08-14

## Repository state

- Titan Mode packages T1 and T2 are complete. Their contracts are
  `docs/tasks/T1-repository-hygiene.md` and
  `docs/tasks/T2-titan-type-module.md`.
- Root-only local artifacts `page.html`, `ytInitialData.json`,
  `vite-debug-error.log`, `vite-debug.log`, `test-results/`, and `scratch/`
  were removed. Existing `.gitignore` rules already cover every required
  artifact family, and none of the removed paths was tracked.
- T1 did not modify the radio feature or the protected `pedagogical*`,
  `randomizedRegression`, and `robustnessFuzz` regression suites.
- T1 verification on 2026-08-14: `npm run lint` passed; `npm run test` passed
  105 files / 654 tests. The package must remain a dedicated commit before T2.
- T2 mechanically renamed `src/types/godMode.ts` to `src/types/titan.ts` and
  updated all 47 importing source/test modules. The old and new module blob
  hashes matched exactly, so exported contracts and runtime behavior did not
  change. `rg "types/godMode" src` returns no matches.
- T2 verification on 2026-08-14: `npm run lint` passed; `npm run test` passed
  105 files / 654 tests. Radio code and the protected regression suites were
  not modified.
- A production TypeScript build later exposed two same-directory imports that
  the original T2 search pattern missed: `src/types/events.ts` and
  `src/types/webSource.ts` still targeted `./godMode`. Commit `7570885` fixes
  both and strengthens the T2 contract search. The corrected gate passed
  project TypeScript compilation, lint, and 107 files / 694 tests.
- T3 is in progress and uncommitted. Its contract is
  `docs/tasks/T3-tracer-core.md`. `acorn` and `acorn-walk` were added as runtime
  dependencies. `src/services/trace/` now contains the raw contracts, Acorn
  parser/forbidden-API gate, closed AST interpreter, synchronous tracer facade,
  Worker client, and focused tests; `src/workers/tracer.worker.ts` removes the
  network/script-loading surface before processing requests.
- The interpreter currently covers declarations/assignment, required control
  flow including labels, functions/closures/arrows/recursion, arrays/objects,
  destructuring/spread/templates, Map/Set, the roadmap array/string methods,
  JSON/Math/console, and try/catch/finally/throw. It uses seeded xorshift32,
  fixed `Date.now()`, the 200,000-step / 100,000-node / 3,000-ms defaults,
  partial traces on budget exhaustion, and visible runtime/source errors. It
  never executes source via `eval` or `new Function`.
- T3 focused acceptance currently passes 40/40, including 20 real LeetCode-style
  JavaScript solutions, forbidden API cases, ten-run seeded determinism,
  200-frame recursion, heap/step budgets, partial runtime errors, and the core
  phase-one syntax families. The full suite passes 107 files / 694 tests; lint,
  project TypeScript compilation, `git diff --check`, and production build pass.
  The build remains at 619.9/620 KiB initial JavaScript, so Acorn did not enter
  the initial bundle.
- T3 was committed as `fe5ba6d` after its corrected acceptance gate passed.
- The user directed work to complete T3 and then proceed to T4. The two
  repository conflicts were therefore resolved without fabricated evidence.
  The roadmap requires comparing tracer counts for the 60
  curated algorithms' JavaScript source, but `src/services/codeRegistry.ts`
  stores those curated sources primarily as C++ (the first DFS entry begins
  `void DFS(int v)`, for example), which Acorn correctly cannot parse; the T3
  contract now records the 20-real-JS acceptance instead. The
  roadmap also requires a separately emitted lazy tracer chunk during T3, but
  the first production consumer is assigned to T4; Vite tree-shakes the unused
  Worker client and therefore emits no tracer chunk yet. T3 proves source-level
  Worker isolation and unchanged initial bundle size; T4 must prove the emitted
  lazy Worker chunk when it adds the real fallback consumer.
- T4 is complete pending its dedicated commit. Its contract is
  `docs/tasks/T4-trace-adapter.md`. Unknown custom JavaScript now routes from the
  asynchronous application-facing generation API through a lazy
  `customSimulation` module and `tracer.worker.ts`; curated simulator dispatch
  remains synchronous and unchanged. `RawTrace` is converted one-for-one to
  variable-based `SimulationStep[]`, with structured scopes, mutations, call
  depth, console output, return value, budget data, truncation, and runtime or
  parse errors preserved visibly.
- The legacy unmatched-custom-code placeholder branch and runtime translation
  strings were removed. Historical validation notes were reworded without
  changing their evidence. Structural trace explanations currently use stable
  machine terms (`assign`, `loop-iter`, `execution-budget-exceeded`); their
  English/Turkish presentation mapping belongs to the planned T13 i18n package
  and remains explicitly pending.
- T4 focused tests pass 18/18 and the full suite passes 109 files / 699 tests.
  Lint and production build pass. The build emits `tracer.worker` separately at
  141.0/150.0 KiB, keeps all ordinary lazy chunks at or below 100 KiB, and keeps
  initial JavaScript at 620.0/620.0 KiB. The general thresholds were not raised;
  only the measured Acorn-backed tracer Worker received its roadmap-authorized
  dedicated 150 KiB budget.
- T4 was committed as `6ae2194` after all gates passed.
- T5 is complete pending its dedicated commit. Its contract is
  `docs/tasks/T5-trace-intelligence.md`. Structural event/kind weights, numeric
  mutation deltas, same-line/event repetition penalties, deterministic phase
  construction/ID resolution, a 40-row bounded model outline, and the closed
  `first`/`last`/`nth`/`max`/`min`/`line`/`error` query language are implemented
  under `src/services/trace/`.
- T5's synthetic 520-step acceptance selects the structural result at index 259
  without any explanation-text input. Focused tests pass 3/3; lint, project
  TypeScript compilation, the full 110-file / 702-test suite, and production
  build pass at the unchanged T4 size budgets.
- T5 was committed as `e25a4b1` after all gates passed.
- T6 is complete pending its dedicated commit. Its contract is
  `docs/tasks/T6-deterministic-semantics.md`. Typed scope heuristics now select
  rectangular matrices before flat arrays, validated adjacency objects as
  deterministic radial graphs, and flat arrays with two or more in-range
  numeric variables as pointer visuals. Ambiguous, empty, ragged, or invalid
  values remain variables. Tracer metadata is excluded from semantic candidates
  but remains present in visual variables.
- T6 focused tests pass 7/7; lint, project TypeScript compilation, the full
  111-file / 706-test suite, and production build pass with unchanged bundle
  budgets. No model or explanation text participates in semantic selection.
- `docs/TITAN_MODE_YOL_HARITASI.md` is pre-existing untracked user work and was
  deliberately preserved outside the T1 commit.

- Branch: `main`; synchronized base before this scope: `c287e76`.
- The current scope fixes the active-stream timeout reported after 715.4 seconds
  and produces the 2.3.4 Windows delivery. The pre-existing untracked
  `opencode.json` remains untouched.
- Package version: `2.3.4`.
- Catalog-title simulation requests preflight exact deterministic support.
  Exact entries use the fast compiler; other catalog entries fall through to
  local model-authored SimLang generation with title/category/tag metadata.
  Downstream cancelled jobs no longer show the misleading
  `Blocked by an earlier failed job` message.
- The minimized radio now preloads its hidden YouTube player/API during app
  startup while leaving audio paused. The first explicit play gesture reuses
  the ready player instead of waiting for iframe/API initialization.
- The OpenAI-compatible desktop provider is now presented explicitly as
  `LM Studio / OpenAI-compatible` and defaults to LM Studio's loopback endpoint
  `http://127.0.0.1:1234/v1`; the URL remains editable for llama.cpp/Unsloth
  and other compatible local servers.
- The provider selector now spells out that its OpenAI-compatible option covers
  LM Studio and similar local apps. The accepted icon keeps the original
  CodeXRay open-face geometry instead of the filled generated variant: only the
  pale upper outlines change to cool blue-gray, while the textured purple base
  retains its palette. `icon-blue-outline-v2.png` is the
  transparent edit source. A single 512px canonical canvas now produces every
  tracked Tauri PNG and ICO frame by plain Lanczos scaling only; no size-specific
  crop, contrast, sharpening, or alternate micro artwork remains. The window
  explicitly applies the bundled icon at runtime.
- The OpenAI-compatible provider help exposes one-click bilingual endpoint
  chips for LM Studio (`1234/v1`), llama.cpp (`8080/v1`), and the retained
  Unsloth profile (`8001/v1`). Applying a chip uses the normal profile update
  path, invalidating stale capability results while leaving the URL editable.
  The three chips occupy one compact, non-wrapping row with no explanatory
  card or duplicated URL text; the editable endpoint field below is the sole
  visible URL display.
- External-provider settings use a dedicated single-column, content-height grid
  instead of inheriting WebLLM's seven-row desktop layout. This removes the
  large reserved blank area below the loopback privacy note.
- The repository uses runtime catalog shards under `public/data/catalog/` so the
  22,027-record multi-platform database does not enter JavaScript bundles.
- `src-tauri` now packages the Vite app as a Tauri 2 Windows x64 application.
  The renderer has only core IPC permission; native commands are limited to
  loopback model discovery/probe/completion/cancel, the fixed first-party reader,
  and validated HTTPS external-link opening.
- The provider-neutral AI facade preserves WebLLM and adds Ollama plus generic
  OpenAI-compatible streaming. Profiles persist without Bearer tokens, capability
  probes gate advanced workflows, and a provider-generation guard discards late
  responses after switching.
- Windows CI validates frontend/Rust/Tauri builds. `v*` tags publish renamed
  setup/portable executables and `SHA256SUMS.txt`.

## Current catalog and God Mode behavior

- `src/data/algorithmCatalog.json` contains 22,027 records across LeetCode,
  CSES, Codeforces, and AtCoder. Platform shards are generated by
  `scripts/split_catalog.mjs` during `prebuild`.
- `docs/ALGORITHM_EXPANSION_CANDIDATES.md` is the ranked post-60 expansion
  backlog. It derives fifteen five-item batches (61–135) from current catalog
  demand and missing teaching metaphors. All 75 candidates have separate 1–100
  visualization-suitability and implementation-complexity scores plus a plain
  bullet judgment, priority, metaphor, and typed behavior. Five delivery waves
  distinguish reusable foundations from specialist showcases, and duplicate or
  nondeterministic presets are explicitly rejected. Candidate 61 is DSU/Union-Find.
- `src/data/leetcodeCategoryValidation.json` retains all 3,236 LeetCode titles,
  37 detailed categories, per-problem attempts, and category markers.
- Every category currently has one representative that passed exact source,
  input, deterministic trace, semantic visual, and grounded-result gates.
- `catalogSupportRegistry.ts` uses strict `source:id` keys. The catalog drawer
  sends the same identity to God Mode.
- The catalog UI is now an internal development tool. Its trigger, JavaScript,
  and CSS are included only in development builds on `localhost`, `127.0.0.1`,
  or the IPv6 loopback host; production builds do not expose or ship the drawer.
  It is titled `Examples` / `Örnekler` because it spans four
  platforms. It runtime-loads only the selected platform, supports title/ID/tag
  search plus difficulty and derived-category filters, paginates at 50 rows,
  and exposes a selectable metadata detail panel for every record. Only exact,
  registered simulations receive a green check. Verified entries use the exact
  `source:id` route; unverified entries send their canonical problem URL through
  the first-party web-source solve pipeline and never claim exact support.
- `catalogProblemDetails.ts` gives all 22,027 records a canonical source URL and
  loads only the selected problem's cleaned content. The detail pane renders the
  statement, signature, input/output formats, examples, constraints, and notes.
  Generic CSES/Codeforces segments are sectionized deterministically and known
  page chrome is excluded. Missing source values are never inferred.
- Catalog problem prose now uses a safe React math renderer. Codeforces
  `$$$...$$$`, standard `$...$` / `$$...$$`, escaped inline/block math,
  powers, subscripts, fractions, inequalities, and common LaTeX operators render
  typographically without leaking delimiters. A narrowly scoped fallback also
  repairs powers flattened by cleaned Codeforces pages (for example `10 9` back
  to `10^9`). The near-full-screen drawer gives the detail reader roughly 70%
  of desktop width and pairs input/output sections to reduce vertical scrolling.
- Function signatures, examples, and source-provided hints/notes are native,
  keyboard-accessible disclosure sections that start collapsed. Their neon
  chevrons and content animate on open, reducing the initial reading height
  without hiding the statement, input/output contract, or constraints.
- The complete content audit is in `docs/CATALOG_CONTENT_AUDIT.md`. AtCoder URLs
  are correct, but the official site currently returns HTTP 403 to the deployed
  reader; the UI exposes that failure and retry control instead of presenting
  metadata as a complete statement.
- `godModeOrchestrator.ts` atomically applies only registered exact packages.
  Unknown/source-required catalog records fail without previewing source or
  mutating input, timeline, or workspace.
- Exact compiler families cover DP, arrays, strings, matrix, backtracking,
  linked lists, graph algorithms, trees, trie, and segment tree. Large matrix,
  advanced graph, and advanced structure compilers are lazy-loaded.
- The exact registry now contains 32 strict LeetCode `source:id` contracts.
  LeetCode 55 defaults to a source-mapped quadratic Jump Game DP package and can
  switch on demand to a linear/O(1) greedy package. LeetCode 300 defaults to a
  quadratic LIS DP package and can switch to an O(n log n) `tails`/binary-search
  package. Both paths keep the current problem identity and atomically replace
  source, input, trace, analysis, and teaching checkpoints.
- Advanced graph compiler nodes now use deterministic percentage-based radial
  coordinates inside a reserved safe viewport. LeetCode 847 and the other
  advanced graph packages no longer interpret pixel-like values as percentages,
  so nodes and their active glow remain visible above the graph legend.
- The exact request `bana coin exchange problemi yaz ve simüle et` is a
  deterministic alias for the registered LeetCode 322 Coin Change compiler. It
  bypasses model planning, authors the Java contract, supplies `[1,2,5]` with
  `amount=11` when no input is given, and produces the complete 1D-DP trace and
  grounded result `3` through the God Mode queue.
- Generic requests such as `interval dp sorusu yaz ve simüle et` and their
  English equivalent deterministically select the verified LeetCode 486
  Predict the Winner package. The architect, code, visual, and tutor queue jobs
  use the registered contract directly, so a truncated or unavailable local
  model cannot block source preview, the richer `[8,15,3,7,10,2]` input, the 2D
  interval table, the 23-step trace, or the grounded winner result.
- The source/input strip now exposes a bilingual neon **Save input** action.
  Editing an active God Mode package marks it out of sync; saving validates the
  exact user value and atomically recompiles the matching deterministic DP,
  array, string, backtracking, BFS graph, linked-list, or SimLang package. The
  code, input, trace, matrix/graph, teaching plan, and result therefore remain
  synchronized. Unsupported fixed packages fail without changing the existing
  simulation. The adapt-input agent uses the same compiler dispatcher and now
  recognizes explicit arrays, quoted strings, and common numeric parameters.
- Natural input requests are executable transactions rather than advisory
  prose. `inputu düzenle` selects a fresh compatible teaching input, `inputu
  genişlet` grows the active input, and program-specific constraints keep Jump
  Game/House Robber non-negative, Coin/Knapsack positive, and binary-search
  families sorted. True matrix packages accept rectangular dimensions such as
  `gridi 8*15 yap`; Spiral Matrix emits all 120 cells in a 122-step trace.
  Square interval-DP sizing remains governed by its own semantic contract.
- Model-authored teaching inputs are intentionally richer: ordinary arrays use
  14 elements, strings use longer repeated/overlapping patterns, backtracking
  remains bounded at five elements, graph/tree inputs retain their structured
  multi-branch presets, and exact interval DP uses six values.
- Referential size follow-ups now deterministically adapt the active interval-DP
  package. Requests such as `bunu 10*10 luk bir inputla simule eder misin`,
  `simulasyonu 10*10 yapar misin`, `inputu 10*10 yap`, `girdiyi 10x10 yapabilir
  misin`, `10×10`, `10x10`, and `10 elemanlı` bypass
  ordinary chat, generate a bounded teaching array, and atomically rebuild the
  square matrix and trace. Natural resize verbs such as `yap`, `boyutuna cikar`,
  `buyut`, and `uyarla` are recognized when they target the current simulation.
  Predict
  the Winner is capped at 14 items; a 10-item request produces a 10x10 matrix,
  55 valid upper-triangle DP states, and 57 total trace steps. This exact path
  skips advisory model calls because routing, input generation, compilation,
  validation, and the first-step explanation are all deterministic.
- Algorithm/complexity analysis no longer replaces the assistant's system
  message or masquerades as a conversation turn. It renders in its own neon
  outlined card with structured label/value rows and a dedicated close action.
  The header trash action now remains enabled when analysis is the only
  removable content and clears analysis together with conversation/run state.
  User and assistant turns have separate outlined surfaces and layout isolation
  so long formulas and Markdown cannot visually merge adjacent messages.
- God Mode source authoring and the ordinary editable/execution code views now
  share one neon syntax surface, identical font metrics, and identical overflow
  behavior. The typewriter state preserves syntax tokens and adds glow only to
  the newest words. Source preview no longer forces `focus-code` or resets to a
  balanced layout afterward, so panel widths, heights, and collapse state stay
  stable throughout authoring. The default left split now gives 68% of viewport
  height to Source Code, reducing the former Variables & Trace share by 20% and
  migrating saved pre-v7 layouts to that new default.
- Simulation visuals now pass through a shared responsive auto-fit viewport.
  Intrinsic matrix, array, and variable views preserve aspect ratio and scale
  down only when their measured natural bounds exceed the available panel;
  percentage-positioned graphs continue to fill the safe viewport. ResizeObserver
  recomputes the scale after splitter or window changes, while content that fits
  returns to natural `1.000` scale instead of being enlarged.
- Simulation View now has its own neon maximize/restore control matching the AI
  panel interaction. Maximizing it gives the visualizer the available right
  column, hides the assistant, keeps the compact Controls panel accessible, and
  removes both adjacent splitters until the view is restored. AI and simulation
  maximization are mutually exclusive; collapsing the visualizer exits its
  maximized state.
- DeepSeek R1 and Qwen3.5 attempts on LC1 remain failed evidence. Models may
  review or teach; they are not credited as deterministic compilers.

The detailed evidence and model findings are in
`docs/LEETCODE_CATEGORY_VALIDATION_REPORT.md`.

## Latest verification

Desktop lifecycle cleanup on 2026-08-11:

- The Tauri window now starts maximized while retaining normal window controls.
- Closing the desktop window cancels every registered native completion token;
  React unmount also cancels the interactive response and active God Mode/web
  handles. A stale waiting/running/retrying God Mode plan is discarded on the
  next launch, while completed/failed audit behavior remains unchanged.
- Automatic startup reconnect for a previously verified OpenAI-compatible
  profile now restores the session immediately without model discovery or the
  former chat/JSON inference probes. Manual Connect still performs the complete
  compatibility probe. CodeXRay does not load or unload the model owned by LM
  Studio; the first real request is left to the already-running endpoint.
- The visualizer's unloaded-model banner now offers Load, Hide, and Settings.
  Its loading notice names the selected model. External Load/Connect activates
  the selected LM Studio/OpenAI-compatible session immediately and no longer
  runs synthetic chat/JSON inference probes; endpoint failures surface on the
  first actual request. The desktop shortcut targets the packaged release exe
  directly instead of launching the Vite/Tauri development command.
- Focused lifecycle/provider tests passed 11/11; lint and Rust desktop checks
  passed, including 6/6 Rust tests. The production build passed at the existing
  strict size limits after the final compact implementation.
- Catalog taxonomy questions now bypass every AI route. Queries such as
  `2d dp nelerin var?`, `LCS kaç soru biliyon?`, and broad problem-tree/category
  requests load the local catalog shards, build a deterministic text tree, and
  return exact counts plus examples. The live 22,027-record audit reports 204
  direct 2D-DP matches and 11 title/tag LCS matches. The taxonomy code is lazy
  (3.6 KiB) and cached after first use. Graphify was evaluated but not embedded:
  it is a Python/tree-sitter codebase knowledge-graph CLI rather than a browser
  problem-taxonomy runtime; CodeXRay keeps the useful explainable-tree concept
  without adding that process/dependency.
- Taxonomy output is now a lazy, theme-native interactive tree rather than an
  ASCII fenced block (the former `TEXT` language badge is gone). Category chips
  expose exact counts, expand groups, and reveal up to forty question nodes for
  the selected branch. A normalized alias router selects LCS, grid/matrix DP,
  edit distance, interval/knapsack/tree/bitmask/game DP, graph families, array
  patterns, and structure families before AI starts. If an unmatched request
  reaches AI, the combined request/answer is resolved against the same bounded
  node index and the matching branch becomes selected; raw model text never
  mutates the tree directly.
- Taxonomy branch results retain catalog difficulty, sort titles
  alphabetically, and paginate every record in forty-item pages instead of
  truncating with a `+N more` label. Direct 2D-DP wording selects and expands
  Dynamic Programming -> 2D DP. Problem buttons use difficulty-colored outlines
  and dots; clicking one copies only its title into the assistant composer and
  never submits it automatically.
- The assistant trash action now clears the taxonomy tree, pending DP chooser,
  and composer draft together with conversation, analysis, and run state; it
  also remains enabled when either interactive view is the only removable UI.
- Category catalog questions using conversational forms such as `grafik
  soruların var mı`, `graf sorusu biliyor musun`, and `graph problems do you
  have` now take the same model-free taxonomy path. The intent gate combines a
  known category stem with question/problem and inquiry wording, while generic
  graph/array/string/tree/backtracking aliases select their concrete local node.
- A newly created Tauri renderer session now starts with no prior chat,
  simulation input workspace, pinned trace variables, bound web source, or God
  Mode run records. A per-session marker prevents React remounts from erasing
  current work. Persistent preferences such as the local-AI profile/model,
  endpoint, theme, and panel layout are deliberately preserved; browser-mode
  workspace persistence is unchanged.
- Topological Sort now exposes deterministic Kahn layers as `wave` and
  `waveNodes`. The graph continues to peel and fade removed nodes/edges, while
  the current zero-indegree frontier pulses. A reserved lower stage renders the
  accumulated topological order as a fixed-length linear track; each newly
  emitted node drops into its next cell, and the wave number remains visible.
  Reduced-motion mode disables both animations. The output component is lazy so
  other algorithms do not pay its startup JavaScript cost.
- Selecting a taxonomy problem now retains its hidden `source:id` identity
  while placing only the readable title in the composer. If the user appends a
  simulate/simulation command, the assistant routes `Create catalog problem:
  source/id` directly into the catalog God Mode intent instead of asking the
  model to rediscover the problem. Editing away from the selected title clears
  the hidden binding, preventing stale selection reuse.
- A clean workspace now uses an empty array input instead of a generated preset,
  and `buildAssistantContext` omits the entire simulation-input block until code
  or a deterministic trace exists. `soru`, `sorular`, `soru havuzu`, and problem
  list/pool variants open the model-free taxonomy root. Pressing Enter on an
  unchanged selected problem title (or appending simulate/solve/run wording)
  creates the catalog intent directly even when the general God Mode toggle is
  off; editing away from the title still cancels the hidden identity.

Strict typed-visual continuation on 2026-08-11:

- `AlgorithmDesignV1` and the Architect JSON contract now carry an optional,
  fail-closed specialized visualization intent for matrix, aligned string,
  bars/water, intervals, and multi-row/heap/bucket teaching views.
- The visual designer preserves that mapping in `VisualizationContractV2`, and
  Code Author is explicitly required to declare/update every mapped trace
  variable. Graph/tree input remains graph-native even if a conflicting visual
  intent is supplied.
- Architecture validation rejects missing, mismatched, duplicate-row, empty,
  or unknown mapping fields. Existing compiler/interpreter validation remains
  the authoritative pre-commit gate.
- Focused orchestration/designer tests passed 35/35, including a complete
  Architect -> Code Author -> compiler -> `RowsVisualData` trace path. Full
  Vitest passed 88 files / 557 tests; lint and `git diff --check` passed; the
  production build passed at 616.3/620 KiB initial JavaScript, nine lazy chunks
  each <=100 KiB, 5930.8/6500 KiB worker, and 85.9/100 KiB styles.
- A central 60-entry pedagogical coverage contract now fails if the registry
  and audit manifest diverge, if an algorithm never emits its domain-specific
  visual metaphor, if its passive timeline has fewer than initialization/core/
  result phases, or if its final step lacks a grounded phase. This audit exposed
  and fixed missing Dijkstra/A* initialization/completion frames and the generic
  sorting completion phase.
- The strict independent edge-case audit now covers registry entries 1–10 in
  `pedagogicalEdgeCasesBatch01.test.ts` and `pedagogicalEdgeCasesBatch02.test.ts`.
  It exposed and fixed missing DFS/BFS completion frames plus misleading
  disconnected-graph completion claims in Kruskal and Prim. The new suites also
  cover unreachable nodes/pairs, negative edges and cycles, partial topological
  orders, isolated SCCs, directionality constraints, malformed graphs, and
  visualization-budget rejection. Full Vitest passed 90 files / 569 tests;
  the post-cleanup focused set passed 25/25, lint and `git diff --check` passed,
  and production build passed at 618.1/620 KiB initial JavaScript.
- Registry entries 11–15 are now covered by
  `pedagogicalEdgeCasesBatch03.test.ts`: isolated Tarjan components, zero-flow
  unreachable sinks in Edmonds-Karp/Dinic, free Hopcroft-Karp vertices, K4
  coloring, and invalid direction/capacity/bipartition/self-loop domains. This
  exposed and fixed missing final matching-edge emphasis in Hopcroft-Karp and a
  false successful Graph Coloring result for self-loops. Full verification now
  passes 91 Vitest files / 575 tests, lint, build, and `git diff --check`; initial
  JavaScript remains 618.1/620 KiB.
- Registry entries 16–30 now have three additional independent edge-case suites.
  They exposed and fixed invalid Euler-trail acceptance, stale failed-Hamilton
  result highlighting, parallel-edge low-link handling, incomplete astral
  Unicode handling in Manacher/Trie, and the literal `root` trie-word collision.
  String collision/overlap/no-match cases, no-result pointer behavior, singleton
  prefix/window cases, disconnected Johnson matrices, and all relevant reject
  paths are fixed assertions. Full Vitest passed 94 files / 593 tests; the final
  focused cleanup passed 12/12, lint, build, and `git diff --check`; initial
  JavaScript remains 618.1/620 KiB.
- Registry entries 31–60 now complete the twelve-suite independent edge audit.
  The new oracles cover partition/window/interval boundaries, singleton sorting
  and search, DP base cases, Unicode LCS/Edit Distance, binary-tree arity,
  number-theory residues, linked-list boundaries, and all relevant reject paths.
  The audit added explicit singleton initialization to Bubble/Insertion/Selection,
  made LCS and Edit Distance code-point safe, rejects binary nodes with a third
  child, prevents duplicate Sieve crossings, and normalizes negative modular
  bases. Focused batch 09–12 verification passed 24/24, 24/24, 32/32, and 24/24.
- Final verification after all sixty edge oracles passed: lint is clean; Vitest
  passes 100 files / 632 tests; production build passes at 619.9/620 KiB initial
  JavaScript, nine lazy chunks each <=100 KiB, 5930.8/6500 KiB local-AI worker,
  and 85.9/100 KiB styles; `git diff --check` passes. The external-server
  Playwright run passes all 67 Chromium tests. Four obsolete browser assertions
  were aligned with intentional current contracts: the six-choice 2D-DP panel,
  manager-free optimized agent queue, collapsed reasoning disclosure whose copy
  action excludes reasoning, and graph labels separated from metric badges.

Algorithm-visualization audit, all 60 algorithms on 2026-08-11:

- `docs/ALGORITHM_VISUALIZATION_AUDIT.md` is the ordered 60-algorithm audit and
  implementation plan. It defines the teaching metaphor, deterministic phase
  contract, visual oracle, bilingual requirements, reduced-motion behavior,
  and typed/rollback-safe AI modification boundary for every five-item batch.
- DFS now distinguishes edge inspection, recursive descent, and backtracking;
  its visible recursion path grows and unwinds while accepted discovery edges
  remain identifiable. BFS exposes FIFO dequeue/discovery phases, discovery
  tree edges, and per-node distances.
- Dijkstra and A* expose select/relax/reject decisions. Failed relaxations are
  explicit trace steps and rejected edges use their own dashed red state;
  Dijkstra distance and A* f-score badges remain visible on graph nodes.
- Kruskal exposes sorted-edge, accept, reject-cycle, and completed-MST phases.
  Accepted MST edges persist as the path, rejected cycle edges have a distinct
  state, component identifiers appear on nodes, and total weight is traced.
- The graph visualizer has a compact phase/decision teaching HUD, node metric
  badges, a rejected-edge legend/marker, and reduced-motion coverage. The new
  visual state is part of the typed `EdgeState` contract rather than inferred
  from prose. Phase and decision text passes through the runtime localization
  layer, so the new teaching HUD follows the active English/Turkish locale.
- Focused simulator/visualizer/localization verification passed 26/26. Full
  verification passed: lint, 76 Vitest files / 489 tests, and production build
  (initial JavaScript 610.6/620 KiB; styles 82.4/100 KiB). The final bilingual
  HUD correction additionally passed 13/13 focused tests, lint, and build.
- In-app localhost acceptance selected Kruskal from the real preset UI, ran all
  8 steps, and visually confirmed persistent MST edges, component badges, the
  phase/decision HUD, and grounded total weight 13. The current Kruskal preset
  reaches an MST without a rejected edge; rejected-cycle rendering is covered
  by dedicated simulator and component tests, and a branch-richer preset is a
  recorded follow-up rather than an unverified UI claim.
- All twelve five-algorithm batches are implemented. Graph families now expose
  their structural decisions; string matching uses aligned text/pattern views;
  sorting uses partitions, buffers, heaps, buckets, frequency/prefix/output
  rows; DP uses labelled matrices and dependency cells; tree traversals expose
  recursive entry/descent/visit/return; Sieve renders every number from 2 to n
  and crosses composites individually; linked-list algorithms use real nodes,
  directed next edges, and pointer movement.
- New typed visual contracts cover string matches, bars/water, intervals, and
  multi-row teaching layouts. The main visualizer renders each contract with
  localized phase/decision state, while graph nodes/edges additionally support
  removed/rejected states, badges, labels, and teaching HUD data.
- Twelve focused pedagogical suites cover the ordered 60-entry registry in
  five-item batches. The full registry test runs three presets per algorithm
  and checks source-line bounds plus bilingual explanations; the independent
  final oracle continues to cover all supported algorithms.
- Static simulator chunk groups keep the new deterministic teaching logic out
  of the initial bundle. The latest production build passed at 607.1/620 KiB
  initial JavaScript, nine lazy chunks each <=100 KiB, 5930.6/6500 KiB worker,
  and 85.9/100 KiB styles.
- In-app browser acceptance was attempted against the verified local Vite
  listener, but localhost navigation was rejected by the browser's URL safety
  policy. No policy workaround or alternate browser surface was used. DOM and
  visual behavior remain covered by focused component and simulator tests.

Generic 2D-DP fast-path run on 2026-08-11:

- Ambiguous 2D-DP requests now pause before model-authored generation and offer
  compact LCS, edit-distance, knapsack, random-template, unique-generation, and
  user-authored choices. Explicit `6*11`, `6x11`, and `6×11` dimensions are
  parsed deterministically and carried into the selected teaching input.
- `benzersiz/özgün input` is now distinct from `özgün problem`: it no longer
  forces model-authored routing. The app creates the requested bounded input
  locally and passes the concrete value to a selected deterministic template;
  the model is not asked to reinterpret dimensions or propose a default input.
- Validated DP templates bypass the Manager, Architect, and Tutor model calls;
  the queue keeps its auditable stages but resolves them from deterministic
  contracts and the grounded package tour. Unique generation remains available
  as an explicit user choice.
- DFlash was investigated but not exposed as a CodeXRay toggle: it requires a
  compatible draft/target setup managed by the local inference server, and the
  active Muse Glimmer profile does not advertise a controllable draft model.
- Focused routing/orchestrator/assistant tests passed 73/73. `npm run lint`
  passed after removing obsolete contract variables, and `npm run build` passed
  (initial JavaScript 605.2/620 KiB; styles 81.4/100 KiB).

Aggressive input-editing run on 2026-08-11:

- Natural-language input transactions now handle numbered node removal,
  add-below-anchor with an atomic edge, and bounded `2x complexity` expansion
  for graph, array, and string inputs. Node removal also removes incident edges
  and repairs root/start/target references; tree children are reattached to the
  removed node's parent when possible.
- Input adaptation no longer calls Input Engineer, Critic, or Tutor models.
  Parsing, compatibility normalization, trace regeneration, validation, apply,
  and undo remain typed deterministic application transactions.
- Focused graph/input/routing/orchestrator tests passed 84/84. Lint and the
  production build passed (initial JavaScript 605.7/620 KiB; styles 81.4/100
  KiB).

LM Studio labeling and purple desktop-icon scope run on 2026-08-11:

- `npm run lint`: passed.
- `npm run test -- --run`: 75 files, 473/473 passed.
- `npm run build`: passed; initial JavaScript 601.0/620 KiB, every lazy chunk
  <=100 KiB, worker 5930.4/6500 KiB, styles 79.8/100 KiB.
- `git diff --check`: passed.
- After the small Windows-icon/runtime assignment correction,
  `cargo fmt --check` and `cargo check` passed (208 crates checked); the Tauri
  dev watcher restarted the application with the rebuilt executable.
- After the one-click external endpoint presets, lint passed, focused provider/
  lifecycle/translation tests passed 15/15, the production build passed
  (initial JavaScript 601.9/620 KiB; styles 80.7/100 KiB), and
  `git diff --check` passed.
- After compacting the endpoint presets to one row, lint passed, focused
  provider/translation tests passed 11/11, the production build passed
  (initial JavaScript 601.2/620 KiB; styles 80.3/100 KiB), and
  `git diff --check` passed.
- After removing the external-provider grid gap, lint passed, the focused
  ControlBar lifecycle suite passed 4/4, the production build passed (initial
  JavaScript 601.2/620 KiB; styles 80.5/100 KiB), and `git diff --check` passed.
- The generated filled/stacked icon was replaced with a deterministic recolor
  of the repository's original transparent logo. Every PNG and every 16-256px
  ICO frame was regenerated from that single canvas, `cargo build` passed, and
  the Windows desktop shortcut now references the unified v3 ICO.
- The external local-provider settings view now uses an explicit full-width
  flex column at desktop sizes, preventing the former empty right-hand grid
  column. Lint, the focused ControlBar suite (2/2), and `git diff --check`
  passed after the layout correction.
- Assistant messages now have additional bottom inset from their border. Chat
  auto-scroll follows streaming output only while the viewport is within 32px
  of the bottom; scrolling upward suspends follow mode until the user returns
  to the bottom. Lint, all focused AiAssistant suites (13/13), and the production
  build passed after this change.
- Active God Mode job timers now ignore stale `durationMs` snapshots and derive
  elapsed time from `startedAt`. Their 250ms clock is keyed by stable run/job
  identity, so frequent reasoning/token plan refreshes no longer restart the
  interval before it can tick. This applies to running and retrying manager and
  specialist jobs. The focused progress suite passed 4/4, lint passed, and the
  production build passed.
- Model-backed God Mode stages now expose compact context usage directly in
  each agent chip (for example `≈1.2K/32K`) and include the full token figures
  in the chip tooltip. The configured context window is exact; prompt use is a
  deterministic character-based estimate because WebLLM and some compatible
  endpoints do not report prompt usage until completion. Reported completion
  tokens are added when available. Focused progress/orchestrator tests passed
  22/22, lint passed, and the production build passed.

Desktop/local-provider scope run on 2026-08-11:

- `npm run lint`: passed.
- `npm run test -- --run`: 74 files, 462/462 passed, including the new
  provider-profile/desktop-boundary coverage.
- `npm run build`: passed; initial JavaScript 592.1/620 KiB, every lazy chunk
  <=100 KiB, worker 5929.9/6500 KiB, styles 76.3/100 KiB.
- `npm run desktop:check`: passed; version sync, rustfmt, clippy with warnings as
  errors, and 3/3 Rust unit tests.
- `npm run desktop:build`: passed and produced the Windows x64 executable plus
  `CodeXRay_2.2.0_x64-setup.exe`.
- Renamed local deliverables and hashes are under ignored `release-artifacts/`.
  Portable process smoke passed: the app stayed responsive and exposed the
  `CodeXRay` main window before its exact PID was closed.
- Real Ollama/Unsloth model quality smoke, controlled full HTTP fixture coverage,
  NSIS install/uninstall, and clean Windows 11 VM acceptance were not run. Do not
  present the successful protocol/build checks as those external-runtime proofs.
- The Windows external-server E2E runner incorrectly spawned a second Vite
  process even when `PLAYWRIGHT_EXTERNAL_SERVER=1`; it now honors the switch.
  A focused desktop-provider Playwright acceptance passed 1/1 in 13.1 seconds,
  proving the provider selector, enabled Ollama/OpenAI-compatible options,
  Ollama preset URL, and connect action. The full suite was not rerun afterward.
- A reported desktop window without the provider selector exposed two release
  issues: the new feature had reused installed version `2.1.2`, and runtime
  detection used an obsolete private global. Version is now `2.2.0` and desktop
  detection uses the Tauri API's `isTauri()` function. The rebuilt 2.2.0
  portable process opened a responsive `CodeXRay` window.
- The remaining invisible selector was a desktop CSS-grid collision: provider
  and WebLLM model cards both occupied the `model` area, so the latter painted
  over the former. The provider now occupies a distinct full-width `provider`
  row. Focused Playwright acceptance additionally compares both controls'
  bounding boxes and passed 1/1 in 11.5 seconds, proving they do not overlap.
- After this UI fix, focused Vitest passed 13/13, lint passed, and
  `npm run desktop:build` produced a fresh 2.2.0 portable executable and NSIS
  installer. The ignored `release-artifacts/SHA256SUMS.txt` contains the hashes
  for these rebuilt deliverables.
- Authenticated real-runtime smoke against the user's loopback OpenAI-compatible
  service at port 8888 discovered `Muse-Glimmer-30B-UD-Q4_K_XL`, returned HTTP
  200 for non-streaming, SSE streaming with `[DONE]`, and native JSON-object
  responses. The supplied credential was used only in process memory and was
  not written to the repository or application storage.
- That smoke exposed a reasoning-model compatibility issue: the old 64-token
  synthetic probe exhausted its budget in `reasoning_content` and returned no
  visible answer. At 512 tokens the same model returned `OK` after 101 completion
  tokens and valid `{"ok":true}` after 148 tokens. The bounded probe now uses
  256–512 tokens. Tauri string rejections are converted to visible errors, with
  an actionable and bilingual HTTP 401 message.
- External-provider context choices now extend through 64K and 128K. Maximum
  output is 16K, constrained below the selected context so prompt capacity stays
  reserved; Rust's request-body clamp matches the UI. Focused frontend tests
  passed 23/23, Rust fmt/clippy and 4/4 tests passed, and the expanded-settings
  Playwright acceptance passed 1/1 in 10.8 seconds. The corrected delivery is
  versioned 2.2.1 so it cannot be confused with the earlier 2.2.0 binary;
  desktop build and refreshed portable/NSIS artifacts completed successfully.
- Version 2.3.0 preserves OpenAI-compatible `reasoning_content` separately from
  the final answer. Bilgiç Dede renders it in a muted, collapsed-by-default
  disclosure with reasoning-token or elapsed-time metadata; expanding it does
  not merge the trace into the copyable final answer. `<think>`, `<analysis>`,
  and `<reasoning>` blocks emitted by WebLLM are separated through the same UI.
  The reasoning record remains in the existing local-only bounded chat history.
- Native streaming treats reasoning deltas as first-token/heartbeat activity.
  The former fixed 180-second absolute timeout now scales with requested output
  from roughly 5 to 20 minutes, while stream inactivity increases from 45 to 90
  seconds. This keeps bounded cancellation while avoiding premature termination
  for slower 30B reasoning models. Focused UI/service tests passed 42/42, Rust
  tests passed 5/5, production build passed, and reasoning/provider Playwright
  acceptance passed 2/2 in 10.8 seconds.
- Version 2.3.1 streams interactive output into the assistant while inference is
  still running. Native SSE `reasoning_content` and answer chunks travel as
  separate `reasoning-delta` / `answer-delta` channel events; the live reasoning
  disclosure remains open with a muted activity indicator while the final answer
  grows below it. WebLLM conversation output uses its async stream and the same
  UI callback contract. React updates are coalesced to 32 ms frames, cancellation
  clears the draft immediately, and only the validated final result enters chat
  history. Focused tests cover pre-completion reasoning/answer rendering and
  worker delta ordering. Lint, 43/43 focused frontend tests, production build,
  Rust fmt/clippy plus 5/5 tests, and the 2.3.1 Windows desktop build passed;
  refreshed portable/NSIS artifacts are under ignored `release-artifacts/`.
- Version 2.3.2 fixes reasoning-only God Mode failures. Native streaming now
  returns a typed `length` result when a model spends its complete budget in
  reasoning, allowing the provider facade to retry once with an explicit final
  JSON instruction instead of throwing `completed without visible content`.
  External structured-agent budgets scale with context: 2K through 16K,
  4K through 32K, 8K at 64K, and 16K at 128K; a reasoning-only retry can double
  those values within the selected profile limit. Choosing a larger context
  raises the recommended output budget, and the configurable output ceiling is
  now half the context up to 32K. External first-token/inactivity limits are 90
  seconds and absolute inference scales up to 30 minutes, while cancellation,
  prompt reservation, and response-size boundaries remain enforced. The new
  controlled fixture proves the reported 64K architect path retries 8K to 16K.
  Full frontend tests passed 471/471, lint and production build passed, and Rust
  fmt/clippy plus 6/6 tests passed. The 2.3.2 Windows desktop build passed; the
  refreshed portable/NSIS artifacts and their SHA-256 file are under ignored
  `release-artifacts/`.
- Version 2.3.3 keeps the provider selector interactive while WebLLM loads or an
  external endpoint probe is in flight. Switching provider cancels/reset the
  active runtime, invalidates late probe/model-load callbacks with generation
  guards, and leaves the newly selected pre-connection form visible. Tutor
  prompts no longer impose the arbitrary `under 450 tokens` instruction;
  response and continuation depth now scales with the selected model profile
  while context, output, cancellation, inactivity, and response-size safety
  bounds remain enforced. External reasoning deltas now flow through the
  provider-neutral agent progress contract into both ordinary and web-problem
  God Mode jobs. The active subagent's reasoning renders in a muted, live,
  collapsible session-only panel, batched to 32 ms and kept separate from final
  JSON/artifacts. Full frontend tests passed 473/473, the focused desktop-provider
  Playwright acceptance passed 1/1 in 11.1 seconds, lint/build passed, Rust
  fmt/clippy plus 6/6 tests passed, and the 2.3.3 Windows build completed. The
  refreshed portable/NSIS artifacts and hashes are under `release-artifacts/`.
- Version 2.3.4 corrects the external absolute-time formula exposed by a
  continuously active Code Author stream ending after 715.4 seconds. The former
  `300 + max_tokens / 16` seconds formula made a 6656-token profile terminate at
  roughly 716 seconds even while output was still arriving. Native and frontend
  external-agent limits now scale from 30 to 60 minutes. The independent
  90-second inactivity timeout, selected output limit, response-size boundary,
  cancellation, and loopback-only endpoint policy remain enforced. Full
  frontend tests passed 473/473, lint/build passed, Rust fmt/clippy plus 6/6
  tests passed, and the 2.3.4 Windows build completed. Refreshed portable/NSIS
  artifacts and hashes are under `release-artifacts/`.

Run on 2026-08-02 from the current working tree:

- `npm run lint`: passed, no warnings.
- `npm run test -- --run`: 72 files, 455/455 passed.
- Advanced graph acceptance now checks that every generated node has a unique
  position within the safe visual bounds. A live LeetCode 847 catalog run at
  `http://localhost:5173/` rendered 4/4 nodes fully inside the graph container.
- The first full interval-DP gate exposed a concurrently restored stale exact
  accessible-name assertion in `LeetCodeDrawer.test.tsx` and an insufficient
  TypeScript intent narrowing in the new test. Both were corrected; focused
  55/55 and final full 401/401 test reruns passed.
- Interactive localhost interval-DP smoke used the exact Turkish request above:
  the queue completed without a truncation message, wrote `predictTheWinner`,
  applied `[8,15,3,7,10,2]`, and rendered a 6x6 DP matrix. The input was then
  edited to `[4,9,2,11,6]`; Save input rebuilt a 5x5 matrix and fresh trace,
  retained the source, cleared the dirty indicator, and emitted no error.
- Interactive localhost sized-follow-up smoke started from that committed
  Predict the Winner package and submitted `bunu 10*10 luk bir inputla simule
  eder misin`. The run applied `[8,15,3,7,10,2,14,6,11,4]`, rendered 10 rows
  and 100 matrix cells, and rebuilt the guided timeline as 57 steps. A second
  live run through the model-free fast path completed within the 1.8-second
  observation window without showing the local-thinking state.
- Interactive localhost source-authoring continuity smoke measured the left
  column before, during, and after the typewriter animation: width stayed 460px,
  Source Code stayed 490px high, Variables & Trace stayed open at 224px, and the
  typing surface retained syntax plus neon-new-token spans before transitioning
  to the 146-token execution rendering.
- Interactive localhost auto-fit smoke rendered a 14x14 interval-DP matrix with
  all 196 cells. It fit both axes at scale `0.280`, then reacted to a 40px panel
  height reduction by recalculating to `0.233` while remaining fully visible.
  A 2x2 matrix returned to natural `1.000` scale when sufficient space was
  restored.
- The exact follow-up from the reported failure, `simulasyonu 10*10 yapar
  misin`, completed on localhost in the 1.7-second observation window with ten
  rows, 100 cells, the ten-value teaching input, a 57-step timeline, and `0.369`
  auto-fit scale. It never entered the local-thinking/model response path.
- The shorter exact command `inputu 10*10 yap` was then exercised on localhost
  against the same active package. It completed in about 1.4 seconds with ten
  rows, 100 cells, the same bounded ten-value input, 57 steps, and `0.369`
  auto-fit scale. The local-thinking state never appeared. A preceding
  `inputu 2*2 yap` check produced exactly four cells, confirming that the
  dimension is parsed rather than hard-coded.
- focused catalog/content coverage includes the complete 22,027-record URL
  audit, platform loading, detail normalization/cache, source failure handling,
  filters, verified/unverified dispatch, Escape, and focus.
- focused catalog/orchestrator acceptance: 79/79 passed.
- `npm run build`: passed. The internal catalog drawer produced no production
  JavaScript or CSS chunk.
  - initial JS 568.7/620 KiB;
  - every lazy JS chunk <=100 KiB;
  - local AI worker 5,929.9/6,500 KiB;
  - styles 76.2/100 KiB.
- Simulation-maximize verification: `App.layout.test.tsx` plus both
  `DynamicVisualizer` suites passed (7/7), the production build passed with
  initial JS 556.7/620 KiB and styles 93.4/100 KiB, and the live localhost
  smoke confirmed that maximizing removes the assistant while retaining
  Controls and that Restore brings the AI maximize action back.
- `npm run test:e2e` with the documented external-server switch completed one
  65/65 pass. A final high-load rerun reported four timing failures (two
  bidirectional-BFS 5-second waits, one timeline performance threshold, and the
  release-tour BFS wait) while the new scenarios still passed; the complete six
  tests from those affected specs then passed 6/6 in an isolated rerun. The new
  acceptance includes DP-to-greedy Jump Game, quadratic-to-binary-search LIS,
  natural input edit/expand, and rectangular 8x15 matrix behavior.
- Focused Playwright acceptance for the exact Turkish Coin Exchange request:
  1/1 passed, including God Mode dispatch, Java source application, timeline
  completion, and final result `3`.
- Interactive localhost smoke test: LeetCode 3 was selected from `Örnekler`,
  dispatched as exact `leetcode/3`, and completed with source, input, a
  14-step deterministic trace, final result, and tutor explanation.
- Interactive catalog typography smoke: Codeforces CF-1A rendered in an
  886-pixel detail pane beside a 354-pixel list, exposed `10^9` with a real
  superscript, leaked no dollar delimiters, and had no horizontal overflow.
- Interactive disclosure smoke: CF-1A Examples toggled closed/open correctly;
  LeetCode 1 exposed collapsed Function signature and Examples sections.
- `git diff --check`: rerun before commit; prior unrelated trailing whitespace
  was cleaned during this handoff.

The real WebLLM suite was not rerun because it requires cached multi-gigabyte
model weights on the exact browser origin. This is explicitly separate from the
deterministic acceptance result.

- Analysis-outline localization was extended so Turkish locale translates the
  structured State, Transition, Fill order, Time Complexity, and Space
  Complexity labels plus the common deterministic DP/visual-analysis prose,
  while preserving formulas and identifiers. Focused Vitest verification:
  `AiAssistant.analysis.test.tsx` + `translations.test.ts` = 7/7 passed;
  `npx tsc --noEmit` and `npm run build` passed.

- A concurrent orchestrator refactor had removed the bounded specialist job
  graph and disabled the normal create-algorithm path. The synchronized working
  implementation was restored, the typed `GodModeRunResult.status` contract was
  retained, and verified deterministic templates no longer wait on optional
  WebLLM advisory calls. Live localhost acceptance passed for `interval dp yaz
  simüle et` (LeetCode 486, 6x6 matrix, 23 steps) and exact `leetcode/54`
  (Spiral Matrix, 11 steps), with no unknown-job failure.
- Cancelling a God Mode run during source typewriter preview now restores the
  pre-run algorithm title, code, timeline, selected step, analysis, and input
  error instead of leaving partial generated source in the editor. The five
  previously failing E2E areas were rerun after updating the layout-v7 and
  dedicated-analysis-card assertions: 8/8 focused Playwright tests passed.
- Final verification after these repairs: lint passed without warnings, 72
  Vitest files / 455 tests passed, the Playwright result is recorded above, and
  the production build passed (initial JS 568.7/620 KiB; all lazy chunks <=100
  KiB; worker 5929.9/6500 KiB; styles 76.2/100 KiB).

## Known limits and next priorities

1. Add controlled Rust loopback fixture tests for fragmented SSE, redirects,
   cancellation, response limits, Bearer redaction, and model-list variants;
   current native tests cover URL normalization/rejection and JSON parsing only.
2. Run real Ollama and Unsloth/llama-server smoke tests, then install/uninstall
   NSIS and launch portable in a clean Windows 11 x64 VM. Code signing,
   auto-update, ARM64, macOS, and Linux desktop remain out of scope.
3. The `37/37` result proves one representative per category, not all 3,236
   LeetCode records. Untested titles remain in the persistent matrix.
4. Expand exact support one `source:id` at a time. Never infer support from tags
   or route an unsupported title to a generic family demo.
5. Replace the two retained legacy array comparison functions after the catalog
   migration is stable; LC209 and LC560 already use their exact implementations.
6. Continue per-title validation. The multi-path and natural-input flows now
   have committed Playwright coverage; extend it only with newly registered
   exact identities or source-specific regressions.
7. Rerun cached DeepSeek and Qwen real-model scenarios separately. Keep their
   planner/author failures visible and do not convert prose into pass evidence.
8. Before commit, review the desktop/provider scope together with the preserved
   catalog/input/multi-path scope and keep validation claims bounded by evidence.
9. Extend the deployed first-party reader with a lawful AtCoder ingestion path
   before claiming full AtCoder statement/example availability. Re-run the live
   source matrix afterward; never replace blocked source text with model output.

## Handoff commands

```powershell
git status --short --branch
npm run lint
npm run test -- --run
npm run build
npm run desktop:check
npm run desktop:build
```

For Playwright on Codex Desktop, use the external-server procedure documented in
`AGENTS.md`. Do not terminate unrelated Node processes.
