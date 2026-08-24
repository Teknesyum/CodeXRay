# Tracer layer
Turns user JavaScript into a deterministic step trace. Nothing here calls a model.
## Files
- `parser.ts` acorn parse + AST helpers; `interpreter.ts` the step machine (all semantics live here).
- `jsTracer.ts` thin entry: parse, run, return `RawTrace`.
- `tracerWorkerClient.ts` posts to `src/workers/tracer.worker.ts`, resolves by request id.
- `adapter.ts` / `simulationTrace.ts` `RawTrace` <-> `SimulationStep` conversion.
- `significance.ts`, `traceOutline.ts`, `traceQuery.ts` ranking, phase outline, lookup for Titan.
- `semantics.ts` event labels; `customSimulation.ts` custom-code entry.
- `types.ts` `RawTrace`, `TraceBudget`, worker message contract, `DEFAULT_TRACE_BUDGET`.
## Invariants
- `eval` and `new Function` are forbidden anywhere in this folder.
- Same source + same input must give an identical trace; the seed comes from `TraceBudget`.
- `TraceValue` is never truncated; truncation is a rendering concern.
- `lineNumber` is 1-based or `null`. Never 0, never an offset.
- Budgets are enforced, not advisory: exceeding `maxSteps` / `maxHeapNodes` / `maxElapsedMs`
  sets `truncated` rather than failing silently.
- The worker scope disables `fetch`, `XMLHttpRequest` and `importScripts`. Keep it that way.
