# Titan orchestration
## STATUS: three seams live
`executeTitanPipeline` carries production traffic for `discuss-current-step` since R04 and
`adapt-input` since R07; both entries are in `AiAssistant.tsx`.
`translateToVerifiedPackage` is called from the `solve-web-problem` flow since R06, through
`webProblemOrchestrator.ts`, and its provenance badge is what `CodeEditor.tsx` renders.
Every other request still routes through `src/services/titanModeRouting.ts` with
`titanEntry.ts` / `titanEngine.ts`.
## Files
- `titanPipeline.ts` `executeTitanPipeline`, the five phases, re-exports of the live engine.
- `translate.ts` cpp/java/python source into a verified custom simulation package. The model
  supplies SimLang-Lite fragments only; nothing foreign is ever executed.
## Rules
- Five phases, in order: route -> produce -> semantics -> verify -> apply.
- Closed intent set: `create-algorithm`, `create-catalog-problem`, `clarify-algorithm`,
  `adapt-input`, `discuss-current-step`, `ui-control`, `deterministic`. No eighth intent
  without a route; unclassified requests return `null` and remain ordinary chat.
- **A trace never comes from the model.** Traces are produced by `src/services/trace`.
- **The model never computes an index.** It picks a phase identity; resolution happens in
  `trace/traceOutline.ts` and `trace/significance.ts`.
