# Titan orchestration
## STATUS: one seam live
`executeTitanPipeline` carries production traffic for `discuss-current-step` since R04; the
entry is in `AiAssistant.tsx`. Every other request still routes through
`src/services/titanModeRouting.ts` with `titanEntry.ts` / `titanEngine.ts`. `translate.ts`
has no production caller, so green unit tests there prove nothing about product behaviour.
## Files
- `titanPipeline.ts` `executeTitanPipeline`, the five phases, re-exports of the live engine.
- `translate.ts` cpp/java/python source into a verified custom simulation package. Not wired.
## Rules
- Five phases, in order: route -> produce -> semantics -> verify -> apply.
- Closed intent set: `create-algorithm`, `create-catalog-problem`, `clarify-algorithm`,
  `adapt-input`, `discuss-current-step`, `ui-control`, `deterministic`. No eighth intent
  without a route; unclassified requests return `null` and remain ordinary chat.
- **A trace never comes from the model.** Traces are produced by `src/services/trace`.
- **The model never computes an index.** It picks a phase identity; resolution happens in
  `trace/traceOutline.ts` and `trace/significance.ts`.
