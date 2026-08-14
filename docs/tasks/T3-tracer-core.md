# T3 Deterministic JavaScript Tracer Core Contract

## Objective

Implement a deterministic, bounded JavaScript tracer that parses and interprets
user code without `eval` or `new Function`, runs behind a dedicated Worker
boundary, and derives every trace step from real interpreter execution.

## Owned Files

- `src/services/trace/types.ts`
- `src/services/trace/jsTracer.ts`
- Supporting modules under `src/services/trace/`
- `src/workers/tracer.worker.ts`
- Focused tracer and Worker tests
- Parser dependencies and the tracer-specific lazy build chunk configuration
- Build-size thresholds only where measured tracer chunk evidence requires it

## Public Contract

`traceJavaScript(source, entry, options)` returns a `RawTrace` whose steps use
1-based source lines, flattened visible scopes, changed-variable names,
deterministic console output, return value, explicit runtime error, truncation
state, and measured budget usage as specified in the Titan roadmap.

## Required Language Surface

The interpreter must support every phase-one item in roadmap section 4.2:
declarations, assignments, required operators and control flow, labelled
break/continue, functions, recursion, arrow functions, closures, arrays,
objects, Map, Set, templates, destructuring, spread, the listed array/string
methods and safe standard functions, plus try/catch/finally and throw.

Phase-two syntax is outside T3. Async operations, modules, dynamic code
execution, network/browser/process/file APIs, and timers must be rejected with
a visible, actionable reason rather than ignored or silently approximated.

## Determinism and Isolation

- Parse with `acorn` and use `acorn-walk` where structural validation benefits.
- Never execute user source with `eval`, `new Function`, script injection, DOM
  execution, or host module loading.
- Interpret the AST in a closed environment owned by CodeXRay.
- Execute through `src/workers/tracer.worker.ts`; remove or shadow Worker network
  and script-loading capabilities before accepting a trace request.
- Replace `Math.random` with seeded xorshift32 and make `Date.now()` return `0`.
- Defaults: 200,000 steps, 100,000 heap nodes, and 3,000 ms wall time.
- Budget exhaustion returns a valid partial trace with `truncated: true`.
- Runtime failure returns the valid partial trace with a populated error and a
  final throw step; it must not crash the Worker or discard earlier steps.

## Trace Integrity

- Trace data never comes from a model.
- Every step corresponds to an interpreter action at an actual source location.
- `TraceValue` remains structured and trace collections are never truncated by
  presentation limits.
- Identical source, entry arguments, options, and seed produce identical
  semantic traces.

## Acceptance Criteria

1. Unit coverage exists for every required language feature and every forbidden
   API family listed in roadmap section 4.2.
2. Recursion depth 200, nested loops, and labelled break are covered.
3. Infinite loops truncate safely; runtime errors preserve partial traces.
4. Ten repeated seeded-random runs produce identical traces.
5. Twenty real LeetCode JavaScript solutions execute without tracer failure.
6. Twenty real JavaScript solutions execute successfully. The roadmap's
   additional 60-source comparison cannot be run against the live registry:
   its curated display sources are C++, not JavaScript. T3 must record this
   evidence and must not fabricate translated fixtures or feed C++ to Acorn.
7. Worker loading is isolated behind `tracerWorkerClient.ts`, and the production
   initial bundle does not absorb Acorn. Because T4 owns the first production
   consumer, T4 must additionally prove that Vite emits the Worker as a separate
   chunk when the fallback is connected.
8. `npm run lint`, `npm run test`, and `npm run build` pass.
9. T3 is committed as one dedicated commit only after all criteria pass.

## Verification

```powershell
npm run lint
npm run test
npm run build
git diff --check
```

## Out of Scope

- Adapting `RawTrace` to `SimulationStep[]` or removing the simulator fallback
  branch; those belong to T4.
- Structural event scoring, outlines, and navigation queries; those belong to
  T5.
- Visual semantics, model routing, input patches, Titan pipeline, and UI work.
