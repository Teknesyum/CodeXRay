# CodeXRay Mega AI Update Plan

> **Superseded for the next AI milestone.** This document describes the
> security-first timeline-control update that is already present in the working
> tree. It does not satisfy the requested God Mode capabilities. The proposed
> replacement architecture is `GOD_MODE_MULTI_AGENT_PLAN.md`; no implementation
> of that replacement begins until its review protocol is complete.

Status: Approved by Gemini and Codex, implemented on `codex/mega-ai-update`, and
verified with lint, 74 unit tests, a production build, and 16 browser tests.

## 1. Objective

Make Bilgic Dede reliably perform explicit, safe workspace commands such as
"DFS sayfasini ac" while keeping normal questions such as "DFS nedir?" purely
conversational. The local model must never be trusted to mutate source code,
simulation input, files, network state, or arbitrary UI state.

This document is a review candidate. No implementation starts until both Codex
and Gemini approve the same revision and the user explicitly authorizes Codex
to proceed.

## 2. Ownership and Review Protocol

- Codex is the implementation owner and final technical integrator.
- Gemini is an independent reviewer. It may inspect the repository and propose
  changes to this plan, but it must not edit project files during plan review.
- A conditional approval is not a final approval. Every blocking change must be
  incorporated into a new plan revision and reviewed again.
- Implementation begins only after both reviewers state `APPROVED` for the same
  plan revision and the user tells Codex to proceed.
- Before implementation, Codex will record the exact working-tree state and
  protect the existing v2.0.0 recovery point. Unrelated user changes will not be
  overwritten.

## 3. Verified Problems in the Current Implementation

1. Deterministic preset routing emits a canonical preset ID, but the executor
   searches that ID inside the display name. Commands such as "DFS ac" therefore
   produce a silent no-op while the assistant may speak as if the action worked.
2. Unsafe legacy action types remain in `TimelineAction` and in the executor,
   including source/input mutation and unrelated UI controls.
3. A planner-created `tour` contains no checkpoints, and the executor does not
   calculate them.
4. Planner hardening is incomplete: thinking is not explicitly disabled, the
   schema is not closed to additional properties, and validation partially
   accepts malformed plans instead of rejecting the whole response.
5. Conversational continuation text still references the obsolete
   `CODEXRAY_ACTION` protocol.
6. The full unit-test suite is not currently green, and existing AI tests do not
   cover the broken preset execution path.
7. Action execution and the following explanation can observe inconsistent
   playback state or stale workspace data.

## 4. Target Architecture

### 4.1 Separate Intent Types by Trust Boundary

Use three distinct types instead of one broad action union:

- `DeterministicWorkspaceCommand`: created only by local application code after
  an explicit user command. It may load an existing registry preset and control
  the timeline.
- `PlannedTimelineAction`: created from local-model JSON. It may only perform
  bounded timeline navigation: play, pause, jump, next, previous,
  next-important, and tour.
- `ConversationRequest`: produces text only and has no execution capability.

There must be no `set_code`, `set_input`, `run_custom_simulator`, theme, radio,
panel-resize, variable-pin, filesystem, or network action in the model-authored
type or executor.

### 4.2 Deterministic Command Router

The router runs before any model request and handles high-confidence commands:

1. Normalize Turkish/English casing, whitespace, punctuation, and common polite
   suffixes without destroying algorithm tokens such as `A*`.
2. Require an explicit action verb for workspace mutation, such as `ac`,
   `yukle`, `goster`, `open`, `load`, or `show`.
3. Resolve the algorithm through a canonical registry index and an explicit
   alias table. Never use substring matching against display names.
4. Return no command for explanatory questions such as "DFS nedir?", "DFS nasil
   calisir?", or "DFS ile BFS farki nedir?".
5. Treat "bana DFS kodunu goster" and "DFS sayfasini ac" as explicit preset-load
   commands. They load the existing deterministic DFS preset; they do not ask a
   model to generate source code.
6. Keep bounded deterministic timeline commands such as "30. adima git",
   "oynat", and "durdur" local and immediate.
7. If an algorithm name or command is ambiguous, do not mutate the workspace.
   Continue to the planner/conversation path or ask one focused clarification.

The router result must contain a canonical preset ID. The executor must resolve
that exact ID through `resolveAlgorithmPresetById` and fail visibly if it cannot
be found.

### 4.3 Strict Local Planner

The planner is used only when deterministic routing did not resolve a command
and the local model is ready.

- It receives a small, explicit snapshot containing timeline length, current
  step, playback state, locale, and the user request.
- It returns exactly `{ "actions": [...] }` through WebLLM JSON schema mode.
- Completion options include `temperature: 0`, `enable_thinking: false`, and a
  small bounded output budget.
- JSON schemas use `additionalProperties: false` at every object level,
  `maxItems: 3`, action-specific required fields, and bounded integer values.
- An empty action array is the correct result for a normal knowledge question.
- Runtime validation is independent of schema enforcement. It rejects the
  entire plan on unknown keys, unknown action types, missing/extra fields,
  invalid indexes, more than three actions, or non-plain objects. It never
  truncates, repairs, or partially accepts a malformed plan.
- Planner failure, invalid JSON, timeout, or unsupported schema mode results in
  no action and falls back to conversation without breaking the chat.

### 4.4 Exhaustive Safe Executors

Create separate exhaustive executors for deterministic commands and planned
timeline actions.

- Preset loading resolves the canonical ID, updates algorithm name, code, input,
  generated steps, current index, and analysis as one awaited transaction.
- Timeline `tour` checkpoints are calculated before execution using the current
  steps and remain bounded.
- Jump indexes are clamped exactly once at validation/execution boundaries.
- Sequential action state is derived from the last executed action, not from
  `Array.some` checks.
- An action reports success only after the intended state is observable. A
  missing preset or failed simulation produces a localized visible failure and
  must not generate a false success explanation.
- Exhaustive TypeScript switches use a `never` guard so newly added action types
  cannot silently inherit execution authority.

### 4.5 Fresh Snapshot Before Conversation

After successful actions, rebuild the assistant workspace snapshot from the
committed React state/transaction result before asking for an explanation.

- The conversational model receives the destination step, current code, current
  input, current trace state, and true playback state.
- It is told which deterministic action actually succeeded, not merely which
  action was requested.
- On action failure, it receives the failure result and must not claim that the
  workspace changed.
- Conversation prompts and continuation prompts contain no `CODEXRAY_ACTION`,
  tool, JSON, or hidden-action instructions.
- Existing bounded context, repetition cleanup, localization, and one-time
  continuation limits remain intact.

### 4.6 User Feedback

- Show a compact localized action-status item in the assistant: pending,
  completed, or failed.
- For a preset load, display the resolved algorithm name, not a raw canonical ID.
- Keep queue animation bounded and do not block the input after an exception.
- Preserve the current neon/glass visual language and all three themes using
  vanilla CSS only.

## 5. Implementation Phases

### Phase A: Baseline and Recovery

1. Capture `git status`, current diff, current commit, and existing v2.0.0 tag.
2. Create a dedicated `codex/mega-ai-update` branch only after user approval.
3. Separate pre-existing test failures from update regressions and document the
   baseline before changing production code.

### Phase B: Types, Registry, and Router

1. Split the broad action union into the three trust-boundary types.
2. Remove every prohibited legacy action and executor branch.
3. Add canonical preset lookup by ID and explicit normalized aliases.
4. Implement deterministic Turkish/English command parsing and negative guards.
5. Add focused unit tests before integrating the router into the assistant.

### Phase C: Planner and Validation

1. Define the closed JSON schema from the shared safe action registry.
2. Add strict planner completion options, including disabled thinking.
3. Implement fail-closed runtime validation with action-specific key checks.
4. Remove all obsolete action-block instructions and parsers.
5. Add worker/service tests with a mocked WebLLM engine; CI must not download a
   model.

### Phase D: Transactional Execution and Context Refresh

1. Implement separate exhaustive executors.
2. Fix preset loading by canonical ID and make it transactional.
3. Calculate tours and preserve correct sequential playback state.
4. Return structured execution results and rebuild the snapshot from them.
5. Ask the conversational model only after successful state synchronization.

### Phase E: UI Feedback and Localization

1. Add compact pending/success/failure feedback using existing component
   structure and vanilla CSS.
2. Add every new user-facing string in Turkish and English.
3. Verify dark, light, and neon themes and collapsed/maximized assistant states.

### Phase F: Verification and Handoff

1. Run `npm run lint` and resolve new warnings in touched files.
2. Run `npm run test` with all tests passing, or explicitly isolate and obtain
   user approval for a proven unrelated baseline failure before handoff.
3. Run `npm run build`.
4. Run relevant Playwright tests with a mocked local-model bridge.
5. Manually verify the acceptance matrix at `http://localhost:5173/` without
   requiring a real model download for deterministic commands.
6. Review the final diff for prohibited actions, action-block remnants, secrets,
   remote AI calls, and unrelated file changes.

## 6. Required Test Matrix

### Deterministic Success Cases

- `DFS sayfasini ac`
- `bana DFS kodunu gosterir misin`
- `BFS yukle`
- `open Dijkstra`
- `30. adima git`
- `oynat`, `durdur`, `sonraki adim`, `onceki adim`

Each preset case must assert the visible algorithm, source code, compatible
input, generated steps, and fresh assistant snapshot—not merely the router
return value.

### Non-Mutation Cases

- `DFS nedir?`
- `DFS nasil calisir?`
- `DFS ve BFS arasindaki farki anlat`
- `Dijkstra negatif agirliklarda neden sorunlu?`
- Ambiguous or unknown algorithm names

These must leave algorithm, code, input, trace, theme, radio, and layout
unchanged.

### Planner Security Cases

- Unknown action types
- More than three actions
- Extra object keys
- Missing or non-integer jump step
- Prototype-shaped/non-plain values
- Attempts to set code/input, run code, change theme/radio/layout, or access a
  file/network resource
- Malformed, truncated, fenced, or conversational JSON output

Every invalid plan must be rejected as a whole and conversation must continue.

### State and Failure Cases

- Preset ID not found
- Input validation or simulator failure
- Planner timeout/error
- Conversation generation error after a successful action
- Unmount/reset during planner, execution, and typewriter feedback
- Ordered combinations such as play then pause, jump then play, and tour

## 7. Acceptance Criteria

The update is complete only when all of the following are true:

1. `DFS sayfasini ac` changes the workspace immediately and correctly without
   waiting for the model planner.
2. `DFS nedir?` never changes workspace state.
3. No model-authored action can mutate code, input, presets, files, network,
   theme, radio, layout, or pins.
4. No `run_custom_simulator`, `new Function`, `eval`, `set_code`, `set_input`, or
   `CODEXRAY_ACTION` execution path remains.
5. Invalid plans fail closed and do not partially execute.
6. The assistant explains only state changes confirmed by the executor.
7. Turkish and English command tests and UI strings are complete.
8. Lint, full unit tests, production build, and relevant browser tests pass.
9. The implementation preserves optional, worker-based, fully on-device AI and
   introduces no API key or remote AI provider.
10. The final diff contains no unrelated generated artifacts or overwritten
    user work.

## 8. Explicitly Deferred Capabilities

AI-generated source edits, AI-generated inputs, custom simulator execution, and
general UI/radio/theme control are outside this update. A future version may add
user-reviewed previews for source or input changes, but it must use a separate
approval workflow and is not implied by this plan.
