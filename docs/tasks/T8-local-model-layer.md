# T8 Measured Local-Model Layer Contract

## Objective

Rebuild local-model command support around the measured LM Studio constraints:
8,192 context tokens, 1,024 configured output tokens, unenforced JSON schema,
and approximately 456–604 reasoning tokens that cannot be disabled.

## Scope

- Add tolerant structured-output extraction under `src/services/ai/`.
- Enforce deterministic-first routing and visible fallback for every command
  role.
- Add role budgets for route, navigate, edit-input, explain, and translate.
- Bound assistant context to 4,200 estimated prompt tokens; never send full
  traces.
- Extend capability probing with actual schema-conformance trials,
  `reasoningOverhead`, and `usableOutputTokens`.
- Separate narrative and command model profile selections.
- Record the llama.cpp GBNF investigation result without claiming unsupported
  behavior as implemented.

## Invariants

- Model output is never trusted or applied without tolerant extraction, schema
  validation, and the relevant deterministic gate.
- Trace never comes from a model.
- Deterministic routing/querying is always attempted first and remains the final
  fallback when model extraction fails.
- Fallback is visible to the user; silent degradation is forbidden.
- Full traces, secrets, filesystem state, and non-loopback data never enter a
  model prompt.
- `usableOutputTokens = maxOutputTokens - reasoningOverhead`; role requests add
  measured reasoning overhead to their usable-output budget within profile
  limits.
- Do not modify radio or protected regression tests.

## Acceptance Criteria

1. Tolerant JSON removes reasoning blocks/code fences, extracts the first
   balanced object, repairs single quotes and trailing commas, and validates it.
2. `none`, `prompt-only`, and `native` capability paths have controlled tests.
3. Probe classification depends on actual output validity across three trials,
   not response-format acceptance.
4. Reasoning overhead and usable output are persisted and exposed; usable
   output below 250 produces an actionable visible warning.
5. Narrative and command model selections persist independently; an absent
   command model produces an explicit deterministic-only status.
6. Prompt construction cannot exceed 4,200 estimated tokens and includes no
   complete trace payload.
7. Role budgets match roadmap section 8.6.
8. GBNF feasibility is documented from real evidence; absence of a live server
   is recorded as skipped, not passed.
9. `npm run lint`, `npm run test`, and `npm run build` pass.
10. T8 is committed separately before T9 begins.

## GBNF Investigation

No live llama.cpp server with a controllable GBNF endpoint was available in
the repository or current local environment. The GBNF trial is therefore
recorded as skipped, not passed. Native classification remains exclusively
based on three real schema-conformance completions. The permanent prompt-only
and deterministic paths do not depend on grammar support.
