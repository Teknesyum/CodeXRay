# T7 SimLang-Lite Round-Trip Contract

## Objective

Provide a compact, deterministic text representation of every `ProgramSpecV1`
construct so local models never need to emit the substantially larger JSON AST.

## Scope

- Add `src/services/simLangLite.ts` and focused tests.
- Implement `parseLite(text) -> ProgramSpecV1` and
  `renderLite(program) -> string`.
- Cover every current expression and statement variant without lossy defaults.
- Validate parsed output with the authoritative `validateProgramSpec` gate.
- Record verification and commit T7 separately.

## Invariants

- Lite text is program source, never a trace; steps still come only from the
  deterministic SimLang interpreter.
- Parsing never uses `eval`, `new Function`, or executable host syntax.
- The grammar is closed, line-oriented, bounded, and reports exact line numbers.
- Renderer output is canonical: parse-render-parse is stable.
- IDs, metadata, trace annotations, budgets, and nested control flow round-trip.
- Do not modify radio or protected regression tests.

## Acceptance Criteria

1. Every `SimLangExpression` and `SimLangStatement` variant round-trips.
2. All curated `ProgramSpecV1` fixtures reachable in tests round-trip without
   semantic loss.
3. Malformed input reports a visible line-numbered error.
4. Parsed programs pass `validateProgramSpec`; invalid programs are rejected.
5. Canonical Lite output is materially smaller than canonical JSON for a
   representative non-trivial program.
6. `npm run lint`, `npm run test`, and `npm run build` pass.
7. T7 is committed separately before T8 begins.
