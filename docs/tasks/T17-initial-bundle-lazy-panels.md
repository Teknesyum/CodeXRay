# T17 Initial Bundle and Lazy Panel Contract

## Objective

Complete the binding T6B requirement by moving the four remaining heavyweight
workspace components behind application-level dynamic imports and reducing the
enforced initial JavaScript budget to the new measured value.

## Scope

- Load `CodeEditor`, `DynamicVisualizer`, `AiAssistant`, and `PlaylistRadio`
  through `React.lazy` in `App.tsx`.
- Wrap each boundary in `Suspense` with a visible localized loading state.
- Keep panel dimensions owned by the existing layout regions so fallback and
  resolved content occupy the same geometry without layout shifts.
- Change only the radio component's loading boundary; preserve its source and
  behavior.
- Measure the production initial JavaScript and lower
  `initialJavaScript` in `scripts/check-build-size.mjs` to a value no greater
  than 480 KiB with a small explicit regression margin above the measurement.

## Invariants

- Trace, simulation, panel, and radio behavior remain unchanged after loading.
- Every lazy import failure remains visible through React's existing error
  surface; no silent fallback is added.
- The loading shells are accessible in English and Turkish and do not alter
  persisted panel sizing or collapse state.
- Protected pedagogical, randomized regression, and robustness fuzz tests are
  unchanged.

## Acceptance Criteria

1. The four named components have no static value imports in `App.tsx`.
2. Each component has a visible `Suspense` fallback that fills its existing
   layout region without changing that region's dimensions.
3. Production initial JavaScript is at most 480 KiB and the build-size budget is
   lowered to the measured post-change ceiling.
4. `npm run lint`, all 747 unit tests, and `npm run build` pass.
5. Relevant layout and browser panel-opening acceptance passes with no visual
   geometry regression.
6. T17 is committed separately before T18 begins.
