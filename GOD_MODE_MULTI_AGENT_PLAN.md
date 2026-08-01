# CodeXRay God Mode Multi-Agent Update Plan

Plan revision: `GM-1`

Status: `IMPLEMENTED AND VERIFIED`

Review record:

- Gemini approved revision `GM-1` without blocking findings.
- Codex accepts the review and approves the same revision.
- During implementation, the existing budget/cancellation coverage in Section
  13 must include explicit malicious infinite-loop/call-stack rejection and
  failed-or-cancelled agent handoff cleanup tests.
- Gemini's WebGPU sub-status and hypothetical-simulation suggestions remain
  optional improvements and do not change this revision.

Implementation record:

- Serkan authorized implementation of revision `GM-1`.
- The implementation lives on `codex/god-mode-multi-agent`; the pre-update
  recovery point remains available as tag `v2.0.0`.
- The local model now runs specialist roles through one serialized WebLLM
  scheduler. Structured generation uses a strict schema first and a bounded
  JSON-object repair pass when a model/runtime cannot compile the full grammar.
- Custom source, input, trace, visualization, checkpoints, and analysis are
  compiled from one validated SimLangV1 package and applied atomically.
- Final verification passed 95 unit tests, the production TypeScript/Vite
  build, and 18 Chrome end-to-end scenarios, including the three mandatory
  God Mode flows. Lint exits successfully; its remaining messages are existing
  warnings in `scratch/search_yt.js`.

## 1. Product Outcome

Bilgic Dede will become a local, workspace-aware orchestration system instead
of a single chat completion. In God Mode it must be able to:

- open an existing algorithm immediately from natural Turkish or English;
- inspect the current code, input, trace, visual state, and panel state;
- create a compatible custom algorithm and input as one unit;
- compile that unit into a deterministic simulation and apply it atomically;
- run, pause, resume, step, rewind, tour, and discuss the real trace;
- identify high-value discussion points and pause there in guided mode;
- explain a step through five synchronized views;
- control approved CodeXRay UI surfaces, including focus, panel state, theme,
  radio, and workspace layout;
- decompose a request into specialist-agent jobs and expose the entire queue in
  a real progress interface.

The following requests are mandatory acceptance scenarios:

1. `DFS ile ilgili sayfayi ac` loads the DFS preset immediately.
2. `Bu kod icin inputlari duzenle` inspects the current program, creates a
   compatible input, validates it, applies it, and regenerates the trace.
3. `Bana iki yonlu BFS yaz` creates the code, graph input, deterministic
   simulation, visualization, tests, checkpoints, and teaching tour.

This is not another action-block prompt revision. It replaces the one-model,
one-answer architecture with an observable task orchestrator.

## 2. Governance and Review Gate

- Codex owns the implementation and final integration.
- Gemini is an independent read-only architecture reviewer for this revision.
- Gemini must not edit production files or implement an alternative during the
  review.
- Gemini must review the actual repository and this exact revision, not only
  the concept described in a chat message.
- `APPROVED WITH REQUIRED CHANGES` is not approval. Codex must incorporate all
  blocking findings into a new numbered revision and send it back for review.
- Implementation begins only when Gemini and Codex approve the same revision
  and Serkan explicitly tells Codex to implement it.
- The existing `v2.0.0` recovery point and unrelated working-tree changes must
  be preserved before implementation.

### Required contract change before implementation

The current `AGENTS.md` contract limits AI-authored actions to timeline control
and forbids source/input mutation. That conflicts directly with the requested
God Mode. After plan approval, Phase 0 must replace only that obsolete clause
with a bounded application-level God Mode contract:

- God Mode may atomically apply validated source, input, simulation program,
  and CodeXRay UI actions requested by the user.
- Model output never executes directly. Every artifact is schema-validated,
  compiled/interpreted by application code, and applied through typed commands.
- Filesystem, operating-system, credential, and arbitrary network authority
  remain outside God Mode because they are unnecessary for CodeXRay workspace
  control.
- Every applied workspace transaction has an audit record, pre-apply snapshot,
  undo operation, and automatic rollback on failure.

This is reliability engineering, not a reduction of the requested authority.
God Mode remains autonomous inside the CodeXRay application once enabled; it
does not require a confirmation dialog for every queued operation.

## 3. Why the Current Architecture Fails

The current dual-call design still treats the task as one plan completion plus
one conversation completion. It has four structural limitations:

1. A narrow action union cannot represent code creation, input synthesis,
   compilation, testing, trace analysis, or UI direction.
2. Natural-language routing is too brittle for phrases such as `DFS ile ilgili
   sayfayi ac`, so valid commands can become silent chat-only requests.
3. A language model can write plausible source text without producing a trace
   that actually corresponds to that source.
4. The user cannot see which specialist is working, what artifact it produced,
   whether validation passed, or where a failure occurred.

Prompt engineering alone cannot fix those architectural gaps.

## 4. Core Design Decision: Executable Simulation Package

Arbitrary model-authored JavaScript must not be passed to `eval` or
`new Function`. Those mechanisms are not needed to deliver God Mode and would
make failures nondeterministic and impossible to explain reliably.

Custom algorithms will use a versioned, deterministic intermediate language,
`SimLangV1`. The AI writes a structured program; application code validates and
interprets it. A deterministic source renderer generates the code shown in the
editor and a line map from the same program. Therefore the visible code, live
variables, visual state, and timeline cannot silently drift apart.

### `CustomSimulationPackageV1`

An atomic package contains:

- stable package ID, title, locale, and algorithm metadata;
- `ProgramSpecV1`: validated `SimLangV1` abstract syntax tree;
- `RenderedSourceV1`: editor text plus source-to-instruction line map;
- `InputContractV1`: accepted input kind, schema, constraints, and normalized
  value;
- `VisualizationContractV1`: array, string, tree, graph, or variables mapping;
- deterministic `SimulationStep[]` generated by the interpreter;
- complexity notes, invariants, and expected termination conditions;
- package tests and their results;
- `DiscussionCheckpoint[]` for the guided teaching tour.

The entire package is validated before one workspace transaction applies it.
If any part fails, none of the source, input, trace, or selected algorithm is
changed.

### `SimLangV1` minimum language surface

The first production version must support the structures needed by the current
algorithm library and bidirectional BFS:

- typed scalars, arrays, strings, records, sets, maps, stacks, queues, heaps,
  graphs, and trees;
- assignment, comparison, arithmetic, branching, bounded loops, function calls,
  return, and deterministic recursion with a depth limit;
- graph neighbor iteration with deterministic ordering;
- explicit trace events for source line, variables, visual state, explanation,
  invariant, and importance;
- configurable instruction, trace-step, memory, and recursion budgets;
- structured runtime errors with the failing instruction and source line.

Unknown operators, unbounded constructs, invalid types, and budget violations
must fail compilation or execution visibly. These checks prevent broken output;
they do not narrow the in-app capabilities requested by the user.

### Manual editor changes

The rendered editor code is initially derived from `ProgramSpecV1`. If a user
manually changes that source, the package is marked out of sync. A compile
action asks the Code Author agent to convert the new text into a fresh program,
then validates and tests it before replacing the active package. The simulator
must never pretend to execute stale or unrelated source.

## 5. Multi-Agent Orchestration

The browser still uses one optional local WebLLM engine. “Multiple agents” are
specialized, isolated inference jobs scheduled sequentially through that engine
so WebGPU memory is not duplicated. Each job receives only the artifacts and
workspace slice it needs.

### Agent roles

1. **Manager / Orchestrator**
   Classifies intent, creates `ManagerPlanV1`, builds the dependency graph,
   selects specialists, assigns budgets, and owns cancellation/retry decisions.
2. **Workspace Scout**
   Captures the latest code, input, active package, selected step, trace,
   visualization, playback state, locale, and relevant UI state.
3. **Algorithm Architect**
   Defines the algorithm, invariants, data structures, visualization needs,
   input contract, and termination conditions.
4. **Code Author**
   Produces or revises `ProgramSpecV1`; it does not directly mutate React state.
5. **Input Engineer**
   Parses the user's data, creates compatible defaults or edge cases, and emits
   an `InputContractV1` value that the program accepts.
6. **Simulation Compiler**
   Deterministic application code, not an LLM role. It validates SimLang,
   renders source/line maps, runs the interpreter, and produces the trace.
7. **Test and Critic Agent**
   Reviews algorithm correctness and generates focused package tests. At most
   two bounded repair cycles may return work to Code Author or Input Engineer.
8. **Trace Analyst**
   Reviews the real compiled trace and emits high-value discussion checkpoints,
   never invented step numbers.
9. **Five-Lens Tutor**
   Explains the committed current step using the five synchronized lenses in
   Section 9. It has no mutation authority.
10. **UI Director**
    Emits typed CodeXRay UI commands only when they help fulfill the request.

Specialists do not recursively spawn unlimited jobs. The Manager schedules a
bounded dependency graph, with configurable per-role timeout, token budget,
retry count, and a global run budget.

### Orchestrator state machine

`routing -> decomposing -> scouting -> architecting -> authoring -> input-building
-> compiling -> testing -> repairing? -> applying -> simulating -> trace-review
-> teaching -> completed`

Every state can also transition to `cancelled`, `failed`, or `rolled-back`.
State transitions and artifacts are persisted under a run ID so the progress UI
and recovery behavior are deterministic.

### Core versioned artifacts

- `ManagerPlanV1`
- `WorkspaceSnapshotV1`
- `AlgorithmDesignV1`
- `ProgramSpecV1`
- `InputContractV1`
- `CustomSimulationPackageV1`
- `PackageTestReportV1`
- `TraceReviewV1`
- `UiActionV1[]`
- `AgentRunEventV1`

Every artifact has a closed JSON schema, runtime validator, schema version,
producer role, run ID, timestamps, and bounded size. Invalid artifacts never
enter the shared artifact store.

## 6. Intent Routing and Task Decomposition

Routing uses three layers:

1. **Deterministic fast path:** high-confidence preset and direct timeline
   commands execute without waiting for the model.
2. **Manager classification:** compound/custom requests become an explicit job
   graph.
3. **Conversation path:** knowledge-only questions are answered without
   changing the workspace.

The deterministic router must normalize Turkish casing, diacritics, polite
suffixes, filler words, and common word-order variants while preserving tokens
such as `A*`. It must use canonical algorithm IDs and explicit aliases, not
display-name substring matching.

Required command families include:

- `DFS ile ilgili sayfayi ac`, `DFS sayfasini acar misin`, `DFS kodunu goster`;
- `bu kod icin inputlari duzenle`, `bu algoritmaya uygun girdi olustur`;
- `iki yonlu BFS yaz`, `bu kodu simulasyona donustur`;
- `oynat`, `durdur`, `12. adima git`, `kritik yere sar`, `bunu tartisalim`;
- panel, focus, theme, radio, and layout requests.

Questions such as `DFS nedir?` and `DFS ile BFS farki nedir?` remain
conversational unless the same request also contains an explicit workspace
operation. Compound requests may intentionally create both action jobs and a
final explanation job.

## 7. Local Worker and Scheduling Architecture

`localAi.worker.ts` becomes the owner of a serialized inference scheduler. New
worker protocol messages include:

- `orchestrate`
- `agent-run`
- `agent-repair`
- `agent-cancel`
- `agent-event`
- `agent-result`
- `agent-error`

The worker loads one selected model and executes logical agent jobs one at a
time. It supports priority, cancellation, timeout, bounded retry, and progress
events. Each role has a compact role prompt, strict response schema, model
options, and context budget driven by `localAiModels.ts`.

The Manager never sends the complete conversation to every specialist. It
passes current artifacts plus deterministic summaries. Large traces are sliced
around requested/current/checkpoint steps while the complete structured trace
remains in application state.

If the planner or a specialist fails, the run remains inspectable. The Manager
may retry the failed job, choose a deterministic fallback, or stop without
claiming success. Chat remains usable after a failed run.

## 8. God Mode Command and Transaction Layer

Model-produced artifacts and commands pass through runtime validation, then a
typed application command bus. The initial command surface is:

- `load_preset`
- `apply_simulation_package`
- `replace_input`
- `compile_package`
- `run`, `play`, `pause`, `stop`, `jump`, `next`, `previous`, `tour`
- `set_guided_mode`
- `focus_panel`, `collapse_panel`, `expand_panel`, `maximize_panel`
- `set_theme`, `set_radio_state`, `set_workspace_layout`
- `undo_workspace_transaction`, `redo_workspace_transaction`

`apply_simulation_package` is atomic. It updates algorithm metadata, source,
input, steps, analysis, visual mapping, current index, and active package ID in
one reducer transaction. A transaction journal retains the before/after state,
originating run, validation report, and undo data.

God Mode is an explicit user setting with a persistent visible indicator. Once
enabled, jobs inside the listed CodeXRay command surface execute autonomously.
Disabling it cancels queued mutation jobs but preserves conversation and the
last committed workspace.

## 9. Trace Awareness and Five-Lens Teaching

The assistant context is rebuilt after every committed navigation or package
transaction. It includes the true current step, source line, input, variables,
visual state, call stack/queue state, playback state, and nearby checkpoints.

The five synchronized explanation lenses are:

1. **Code:** active source line, control flow, and why that branch runs.
2. **Data:** live variables, queues/stacks/sets/maps, and what changed.
3. **Visual:** nodes, edges, frontiers, array cells, or other visible states.
4. **Reasoning:** invariant, correctness argument, and complexity consequence.
5. **Time:** what led here, why this is worth pausing on, and what can happen
   next.

`TraceReviewV1` contains `DiscussionCheckpoint[]` with real step indexes,
category, priority, reason, suggested lenses, and optional auto-pause flag.
Guided mode pauses only at validated checkpoints. A manual `bunu tartisalim`
request freezes playback first, refreshes the current snapshot, then calls the
Tutor so the answer cannot describe a stale step.

## 10. Visible Agent Queue and Progress UI

The existing action progress surface becomes a glass/neon orchestration panel.
It displays:

- overall run status and progress;
- every specialist job and dependency;
- `waiting`, `running`, `retrying`, `completed`, `failed`, `cancelled`, or
  `rolled-back` state;
- current agent label, elapsed time, and concise status text;
- produced artifact preview and validation/test outcome;
- cancel, retry-failed-step, inspect, undo, and rollback controls.

Progress is computed from weighted completed jobs in `ManagerPlanV1`; it is not
a fake timer. The queue remains responsive while the worker runs, survives
panel minimize/maximize, and uses bilingual strings plus vanilla CSS across
dark, light, and neon themes.

## 11. Required End-to-End Flows

### Existing DFS preset

1. Router recognizes `DFS ile ilgili sayfayi ac` as an explicit preset command.
2. Canonical DFS ID is resolved.
3. Preset code, compatible input, and deterministic trace are applied.
4. Assistant reports success only after observing the committed state.

Target: visible workspace change begins without a model planner round trip.

### Adapt input to current code

1. Manager creates Scout -> Input Engineer -> Compiler -> Test -> Apply jobs.
2. Scout snapshots the actual current code/package and input.
3. Input Engineer emits a compatible normalized input and edge cases.
4. Compiler executes the active program with that input.
5. Tests pass, then one transaction applies input and regenerated trace.

Target: no silent no-op and no input that the active program cannot simulate.

### Generate bidirectional BFS

1. Manager creates Architect, Code Author, Input Engineer, Compiler, Critic,
   Trace Analyst, Apply, and Tutor jobs with dependencies.
2. Architect defines two frontiers, parent maps, meeting condition, path
   reconstruction, and graph input constraints.
3. Code Author produces `ProgramSpecV1`; Input Engineer creates a compatible
   start/target graph.
4. Compiler renders visible source and generates a real trace.
5. Critic verifies frontier expansion, intersection, reconstructed shortest
   path, unreachable target behavior, and termination.
6. After at most two repair cycles, the valid package is applied atomically.
7. Trace Analyst marks frontier expansion, meeting, and reconstruction points.
8. Guided playback and Five-Lens Tutor let the user move through and discuss
   the new algorithm.

Target: the editor, input, visualization, trace, and explanation all represent
the same generated algorithm.

## 12. Implementation Phases

### Phase 0 - Contract, baseline, and recovery

1. Record commit, branch, tag, worktree, tests, and existing user changes.
2. Preserve `v2.0.0` and create a new `codex/god-mode-multi-agent` branch from
   the agreed source state.
3. Apply the approved `AGENTS.md` contract change described in Section 2.
4. Document baseline failures without weakening existing tests.

### Phase 1 - Schemas and orchestration store

1. Add versioned artifact and event types with closed runtime schemas.
2. Add `GodModeRun` reducer/store, persistence, cancellation, and audit events.
3. Add bilingual state/error strings and unit tests.

### Phase 2 - SimLang compiler and interpreter

1. Implement the minimum language, validator, source renderer, line map, and
   deterministic interpreter.
2. Convert a small representative set of existing algorithms into golden
   packages to prove parity with current simulators.
3. Enforce execution budgets and structured diagnostics.

### Phase 3 - Worker scheduler and specialist agents

1. Implement serialized job scheduling and event streaming in the local worker.
2. Add role prompts, strict schemas, context budgets, timeout, cancel, and retry.
3. Use mocked worker completions in automated tests; never download a model in
   CI.

### Phase 4 - Router, Manager, and command bus

1. Expand deterministic Turkish/English routing and canonical resolution.
2. Implement Manager task graphs and dependency execution.
3. Implement exhaustive typed commands, God Mode switch, and failure reporting.

### Phase 5 - Code/input creation and transactions

1. Integrate Architect, Code Author, Input Engineer, Compiler, and Critic.
2. Implement package validation, atomic apply, transaction journal, undo/redo,
   and automatic rollback.
3. Support rendered-source resynchronization after manual editor changes.

### Phase 6 - Trace review and teaching

1. Add deterministic snapshot rebuilding and `TraceReviewV1` checkpoints.
2. Add guided auto-pause and Five-Lens Tutor responses.
3. Prove that explanations follow committed current state after every jump.

### Phase 7 - UI Director and progress experience

1. Add bounded UI command adapters for panels, layout, themes, and radio.
2. Build the queue/progress/artifact inspector with vanilla CSS.
3. Verify responsive panel behavior and all three themes.

### Phase 8 - Migration, verification, and handoff

1. Migrate or retire the old single planner/action executor without leaving a
   second competing mutation path.
2. Run lint, all unit tests, build, and browser tests.
3. Manually test a real selected WebLLM model, including failure and cancel
   paths, without adding remote AI or API keys.
4. Review the final diff, documentation, recovery procedure, and performance.

## 13. Required Test Matrix

### Routing

- Turkish/English command variants, polite suffixes, diacritics, and word order.
- `DFS ile ilgili sayfayi ac` and equivalent variants mutate immediately.
- `DFS nedir?` and comparison questions do not mutate.
- Compound command plus explanation requests do both in the correct order.

### Artifact and interpreter correctness

- Every schema rejects unknown keys, versions, types, and oversized artifacts.
- SimLang tests cover collections, graph traversal, branches, loops, recursion,
  line maps, trace events, budgets, and diagnostics.
- Golden parity tests compare selected existing simulators with equivalent
  packages.
- Bidirectional BFS golden traces cover meeting in the middle, direct edge,
  same start/target, cycles, disconnected graphs, and path reconstruction.

### Orchestration

- Dependency ordering, independent job sequencing, cancellation, timeout,
  bounded retries, two-repair maximum, resume, and visible failure state.
- Specialist context isolation and artifact handoff.
- Progress is monotonic by completed job weight and never falsely reaches 100%.
- Unmount/reset/model failure never leaves the UI locked.

### Transactions and state

- Package apply is all-or-nothing.
- Compile, test, or apply failure preserves the previous workspace.
- Undo/redo restores source, input, steps, index, analysis, and active package.
- Navigation and guided pauses rebuild assistant context from the actual step.
- Manual source edits mark the package out of sync.

### Five-Lens and UI control

- Tutor output is grounded in the selected step and all five lenses.
- Checkpoint indexes exist in the real trace and auto-pause only in guided mode.
- UI actions preserve layout minimums, collapse contracts, themes, and radio
  behavior.
- New strings work in Turkish and English.

### End-to-end

- The three mandatory scenarios in Section 1 run through the UI with a mocked
  local worker and assert actual workspace results, queue events, and errors.
- A separate manual smoke matrix uses the supported local model profiles.
- Existing unit and browser suites remain green.

## 14. Performance Budgets

- Deterministic preset commands begin applying within 100 ms on a warm UI.
- Only one WebLLM inference runs at a time.
- Each specialist has an explicit context/output budget derived from the active
  model profile and selected 4K/8K window.
- The Manager prefers the smallest job graph that fulfills the request.
- Trace context uses deterministic windows/summaries without truncating the
  stored structured trace.
- Progress events are throttled enough to avoid React render storms.

## 15. Definition of Done

The update is complete only when:

1. All three mandatory user scenarios work without silent no-ops.
2. A generated algorithm's editor source, input, simulation, visualization, and
   explanations originate from the same validated package.
3. The visible queue proves which agents ran, what they produced, and whether
   the result was applied or rolled back.
4. Guided playback pauses on real, validated discussion checkpoints.
5. The Tutor can explain any selected step through all five lenses.
6. God Mode can autonomously use the documented CodeXRay command surface while
   enabled, including source/input package application and UI control.
7. No raw model text reaches an execution primitive or React state setter.
8. Cancellation, retry, failure, undo, and rollback are verified.
9. Existing bilingual, layout, radio, theme, persistence, and optional local-AI
   behavior remain intact.
10. Lint, full unit tests, production build, and relevant browser tests pass.

## 16. Explicit Non-Goals

- Remote AI providers, API keys, cloud orchestration, or server execution.
- Filesystem, shell, browser-origin escape, credential, or arbitrary network
  authority.
- Pretending arbitrary C++ text can execute natively inside the browser.
- Unlimited recursive agents or unbounded autonomous loops.

These non-goals do not restrict the requested CodeXRay God Mode. They make its
code, input, simulation, timeline, teaching, UI, and multi-agent behavior
deterministic enough to work repeatedly.
