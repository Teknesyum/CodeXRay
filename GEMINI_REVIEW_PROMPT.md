# Prompt for Gemini: Independent Mega AI Update Plan Review

You are the independent senior architecture and security reviewer for the
CodeXRay project. Respond in Turkish.

## Governance

- Codex is the implementation owner and final technical integrator.
- You are the plan reviewer, not the implementer in this review cycle.
- Do not edit, create, delete, format, or rewrite any project file.
- Do not run commands that mutate the working tree, dependencies, caches, Git
  history, branches, or application state.
- Read-only inspection and read-only tests are allowed.
- Do not declare the work implemented. Review only the proposed plan against the
  current repository.
- Implementation may begin only after you and Codex approve the exact same plan
  revision and Serkan explicitly tells Codex to proceed.

## Repository

`C:\Users\Administrator\Desktop\Projeler\CodeXRay_Serkan`

Read these files first:

1. `AGENTS.md`
2. `MEGA_AI_UPDATE_PLAN.md`
3. `src/components/AiAssistant.tsx`
4. `src/services/aiTimelineControl.ts`
5. `src/services/aiTimelineControl.test.ts`
6. `src/services/aiContext.ts`
7. `src/services/localAiService.ts`
8. `src/workers/localAi.worker.ts`
9. `src/services/codeRegistry.ts`
10. `src/services/localAiModels.ts`
11. Relevant TimelineContext and assistant tests you discover

## Current Evidence to Verify Independently

- Deterministic preset routing currently emits a canonical ID, while the
  executor appears to search it inside a display name.
- Legacy source/input and unrelated UI actions appear to remain in the shared
  action type and executor.
- Planner-created tours may have empty checkpoints.
- Planner options appear to omit `enable_thinking: false`.
- Validator/schema strictness and obsolete `CODEXRAY_ACTION` continuation text
  may not match the claimed security design.
- The production build passes, but the latest independent run reported 11 of 64
  unit tests failing. Determine whether these are baseline failures, update
  regressions, or both; do not hide them by weakening tests.

Do not trust this list blindly. Confirm or refute each item from the actual code
and report exact file/line evidence.

## Review Questions

1. Does the proposed trust boundary correctly distinguish explicit
   deterministic user commands from model-authored timeline plans?
2. Can any local-model output, malformed plan, stale legacy parser, or broad
   TypeScript union still reach source, input, filesystem, network, theme,
   radio, layout, or arbitrary execution mutation?
3. Is deterministic Turkish/English command routing sufficiently precise to
   execute commands such as `DFS sayfasini ac` while leaving `DFS nedir?`
   conversational?
4. Are canonical registry IDs and aliases designed without fuzzy false
   positives or silent no-ops?
5. Is the WebLLM JSON schema/`enable_thinking` strategy compatible with the
   installed `@mlc-ai/web-llm` types and current model registry?
6. Does the proposed validator reject the entire malformed plan rather than
   truncating, repairing, or partially accepting it?
7. Can React state, refs, async queues, unmounts, or play/pause ordering cause
   the conversational answer to describe stale or uncommitted state?
8. Are localization, context-window limits, continuation behavior, optional
   on-device operation, and current UI/layout contracts preserved?
9. Does the test matrix prove real workspace effects and non-effects instead of
   only testing parser return values?
10. Are any implementation phases missing, incorrectly ordered, or too broad?

## Required Response Format

Use exactly these sections:

### Verdict

Choose exactly one:

- `APPROVED`
- `APPROVED WITH REQUIRED CHANGES`
- `REJECTED`

### Confirmed Findings

List independently verified findings with severity (`P0`, `P1`, `P2`, or `P3`),
exact file paths, and tight line references.

### Required Plan Changes

For every blocking issue, name the exact section of
`MEGA_AI_UPDATE_PLAN.md` that must change and provide replacement or additional
wording. Do not patch production code.

### Missing Acceptance Tests

List only tests that are absent from the plan and necessary for approval.

### Optional Improvements

List non-blocking improvements separately so they cannot be confused with
approval requirements.

### Final Approval Statement

If and only if there are no blocking changes, write:

`Gemini, MEGA_AI_UPDATE_PLAN.md dosyasinin bu revizyonunu uygulama icin onayliyor.`

Otherwise write:

`Gemini bu revizyonu henuz onaylamiyor; Required Plan Changes tamamlanmalidir.`

After your review, Serkan will send the complete response back to Codex. Codex
will evaluate every finding, revise the plan if necessary, and request another
review. Do not begin implementation yourself.
