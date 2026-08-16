# T12 Titan Progress and Capability UI Contract

## Objective

Expose the five real Titan stages, model capability evidence, output-budget
risk, and independent narrative/command model selection without implying that
an unavailable model path succeeded.

## Scope

- Add `components/TitanProgress.tsx` and focused tests.
- Use Titan progress for Titan runs while retaining the existing web-problem
  progress component until T13 naming consolidation.
- Add narrative and command profile selectors to desktop local-AI settings.
- Display structured-output mode, reasoning overhead, usable output, and an
  actionable warning below 250 usable tokens.
- Display deterministic-only command status when no command profile is chosen.

## Invariants

- Exactly five Titan stage rows are rendered in pipeline order.
- Skipped stages are visually and textually distinct from completed stages.
- Capability labels reflect measured probe data only.
- No command-model selection is inferred from the narrative model.
- All new UI text has English and Turkish output.
- Radio UI and behavior are untouched.

## Acceptance Criteria

1. Waiting, running, completed, skipped, failed, and cancelled stages render.
2. Cancel, dismiss, undo, redo, and retry remain keyboard accessible.
3. Narrative and command profile choices persist independently.
4. Missing command profile visibly states deterministic-only behavior.
5. Capability badges expose structured mode and measured token values.
6. Usable output below 250 renders the 2048/non-reasoning recommendation.
7. `npm run lint`, `npm run test`, and `npm run build` pass.
8. T12 is committed separately before T13 begins.
