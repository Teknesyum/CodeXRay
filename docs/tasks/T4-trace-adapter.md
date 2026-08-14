# T4 Raw Trace Adapter and Custom-Code Fallback Contract

## Objective

Convert deterministic `RawTrace` execution into `SimulationStep[]` and route
unknown custom JavaScript through the tracer Worker while preserving the
existing synchronous curated simulators.

## Scope

- Add `src/services/trace/adapter.ts` for deterministic input-to-entry mapping
  and `RawTrace`-to-`SimulationStep[]` conversion.
- Remove the placeholder custom-code branch from `simulators.ts`.
- Keep curated simulator dispatch synchronous and behaviorally unchanged.
- Make the application-facing generation path asynchronous so only unknown
  custom code crosses the Worker boundary.
- Propagate the asynchronous contract through its production callers.
- Surface parser, forbidden-API, runtime, and budget outcomes as visible steps;
  never silently return an empty timeline.
- Prove that Vite emits the tracer Worker separately and Acorn remains outside
  the initial application bundle.

## Invariants

- Trace steps come only from actual interpreter execution, never from a model.
- User source runs only in `tracer.worker.ts`; production fallback must not call
  the synchronous tracer facade on the main thread.
- Curated simulator outputs and protected regression tests remain unchanged.
- `SimulationStep.lineNumber` is 1-based or `null`.
- Raw trace collections remain complete; the adapter does not truncate them.
- Runtime failure and budget exhaustion preserve all valid preceding steps and
  expose a visible final status.
- Do not modify the radio feature.

## Acceptance Criteria

1. Known curated algorithms still return their existing deterministic steps.
2. Unknown valid custom JavaScript produces non-empty `SimulationStep[]` through
   `traceJavaScriptInWorker`.
3. The former `No deterministic simulator matches this custom code yet.` text
   and its placeholder branch no longer exist in the codebase.
4. Forbidden source, parse failure, runtime failure, and budget truncation each
   produce an explicit user-visible reason.
5. Adapter output preserves every raw step, structured scope value, line number,
   mutation name, console output, return value, and runtime error information.
6. Production build emits a separate tracer Worker chunk; Acorn does not enter
   the initial JavaScript bundle.
7. `npm run lint`, `npm run test`, and `npm run build` pass.
8. T4 is committed in one dedicated commit before T5 begins.

## Out of Scope

- Structural event scoring, outline generation, and trace queries (T5).
- Domain-specific visual semantics (T6).
- Model routing, input patches, Titan pipeline, and Titan UI.
