# T6 Deterministic Trace Semantics Contract

## Objective

Infer safe visual semantics from structured runtime scopes before any model is
considered, covering arrays, two-dimensional matrices, adjacency structures,
and paired-index pointer patterns.

## Scope

- Add `src/services/trace/semantics.ts` and focused tests.
- Integrate semantics into the T4 adapter without changing raw trace data.
- Preserve the variables fallback when no heuristic proves a compatible visual.
- Record verification and commit T6 separately.

## Invariants

- Heuristics inspect typed values and mutation structure, never explanation text.
- No model call is required or allowed in T6.
- A heuristic may only emit a visual contract whose required data validates.
- Original scope values remain present in `visualData.vars`.
- Node/edge identity and array values are never invented.
- Do not modify radio or protected regression tests.

## Acceptance Criteria

1. A flat primitive array maps to an array visual.
2. A rectangular primitive 2D array maps to a matrix visual.
3. A valid adjacency object maps to a deterministic graph visual.
4. Two or more in-range numeric index variables map to array pointers.
5. Invalid/ragged/ambiguous structures fall back visibly to variables.
6. Explanation text changes do not affect semantic selection.
7. `npm run lint`, `npm run test`, and `npm run build` pass.
8. T6 is committed separately before T7 begins.
