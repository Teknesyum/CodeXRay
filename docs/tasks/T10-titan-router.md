# T10 Deterministic-First Titan Router Contract

## Objective

Replace explanation-keyword navigation and legacy God Mode routing with one
Titan intent router whose first decision is deterministic and whose navigation
targets come exclusively from T5 structural trace scoring, outlines, and
queries.

## Scope

- Add `src/services/titan/titanRouter.ts` and focused tests.
- Add a deterministic `SimulationStep[]` to `RawTrace` structural projection.
- Remove `IMPORTANT_EXPLANATION` and `findImportantStepIndices` from
  `aiTimelineControl.ts`.
- Route `navigate`, `edit-input`, `explain`, `trace-code`, `translate-code`,
  `load-preset`, `ui-control`, and `unclear` intents.
- Permit validated model intent only after deterministic routing is attempted;
  invalid output retains the deterministic decision with a visible notice.

## Invariants

- Explanation text and locale never affect structural checkpoint indices.
- Trace and target indices never come from a model.
- Model output cannot introduce an operation outside the closed intent schema.
- A model cannot override a non-unclear deterministic route.
- Navigation query expressions execute only through the closed T5 query
  language and are range-checked.
- Missing or unusable command models produce explicit deterministic status.

## Acceptance Criteria

1. Emptying or translating every explanation preserves all key indices.
2. A synthetic 500+ step trace resolves the structurally significant index.
3. Forty Turkish and forty English navigation expressions resolve the expected
   deterministic action or phase.
4. Model-off, invalid JSON, `none`, `prompt-only`, and `native` paths are tested.
5. `IMPORTANT_EXPLANATION` and `findImportantStepIndices` have zero source
   matches after migration.
6. Existing timeline plan validation remains closed and bounded.
7. `npm run lint`, `npm run test`, and `npm run build` pass.
8. T10 is committed separately before T11 begins.
