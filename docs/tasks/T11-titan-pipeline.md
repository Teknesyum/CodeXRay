# T11 Five-Stage Titan Pipeline Contract

## Objective

Replace the God Mode entry/orchestrator surface with a five-stage Titan
pipeline: route, produce, semantics, verify, and apply.

## Scope

- Add `src/services/titan/titanPipeline.ts` and focused tests.
- Delete `godModeOrchestrator.ts` and `godModeEntry.ts`; redirect the live
  assistant to the Titan entry point.
- Publish only five real stage states, including explicit skipped states.
- Preserve existing deterministic catalog/compiler capabilities behind the
  new pipeline while their legacy type names are migrated in T13.

## Invariants

- Route is deterministic-first.
- Produce must return an artifact with a real deterministic trace.
- Semantics is skipped visibly when deterministic semantics are already
  sufficient.
- Verify runs before apply and must pass schema, compile, sample, visual, and
  critic gates represented by the producer.
- Apply is the only mutating stage and is atomic. A failed gate or apply keeps
  the previously committed package.
- Model-authored source or trace is never executed directly.
- Cancellation and every failure are visible.

## Acceptance Criteria

1. Success emits exactly five ordered stages and applies once.
2. Unneeded semantics is reported as skipped.
3. Route, produce, verify, and apply failures prevent later mutation.
4. Verification failure preserves the previous committed package.
5. Cancellation is exposed and prevents apply.
6. The live assistant imports `titanPipeline`; old entry/orchestrator files no
   longer exist.
7. `npm run lint`, `npm run test`, and `npm run build` pass.
8. T11 is committed separately before T12 begins.
