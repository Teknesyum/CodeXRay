# Titan orchestration
## STATUS: NOT WIRED
`titanRouter.ts` and `executeTitanPipeline` here are **not called in production**. The live path
is still `src/services/titanModeRouting.ts` with `titanEntry.ts` / `titanEngine.ts`. Route R02
connects them. Until then these are unreferenced modules: green unit tests here prove nothing
about product behaviour.
## Files
- `titanRouter.ts` maps a user request to one intent plus a deterministic decision.
- `titanPipeline.ts` `executeTitanPipeline`, the five stages, re-exports of the live engine.
- `translate.ts` cpp/java/python source into a verified custom simulation package.
## Rules
- Five phases, in order: route -> produce -> semantics -> verify -> apply.
- Closed intent set: `create-algorithm`, `create-catalog-problem`, `clarify-algorithm`,
  `adapt-input`, `discuss-current-step`, `ui-control`, `deterministic`. No eighth intent
  without a route; unclassified requests return `null` and remain ordinary chat.
- **A trace never comes from the model.** Traces are produced by `src/services/trace`.
- **The model never computes an index.** It picks a phase identity; resolution happens in
  `trace/traceOutline.ts` and `trace/significance.ts`.
