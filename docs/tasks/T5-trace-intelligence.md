# T5 Structural Trace Intelligence Contract

## Objective

Build deterministic structural significance scoring, hierarchical trace
outlines, and a bounded trace-query language without using explanation text or
allowing a model to calculate timeline indices.

## Scope

- `src/services/trace/significance.ts`
- `src/services/trace/traceOutline.ts`
- `src/services/trace/traceQuery.ts`
- Focused structural, 500-step, text-independence, and query tests
- Handoff evidence and a dedicated T5 commit

## Invariants

- Scores use only typed trace structure, events, mutations, scopes, repetition,
  and numeric deltas; explanation text is never an input.
- A model may later choose a phase ID or query expression, but never an index.
- Phase IDs resolve to deterministic code-produced `keyIndex` values.
- Query syntax is closed to `first`, `last`, `nth`, `max`, `min`, `line`, and
  `error`; it cannot execute source or access host APIs.
- Full traces remain structured and untruncated.
- Do not modify radio or protected regression tests.

## Acceptance Criteria

1. Event weights and repetition penalties match roadmap section 5.3.
2. `buildTraceOutline`, `resolvePhaseId`, and bounded
   `renderOutlineForModel(..., 40)` are deterministic.
3. A 500+ step trace resolves its most important phase to the same index after
   all presentation explanations are removed.
4. The query language resolves supported expressions deterministically and
   rejects malformed or out-of-budget expressions visibly.
5. Model availability is irrelevant to every T5 operation.
6. `npm run lint`, `npm run test`, and `npm run build` pass.
7. T5 is committed separately before T6 begins.

## Out of Scope

- Natural-language navigation routing and model fallback (T10).
- Visual semantics (T6), SimLang-Lite (T7), and model context work (T8).
