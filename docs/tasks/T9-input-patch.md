# T9 InputPatchV1 Contract

## Objective

Provide a closed, deterministic input-edit language that validates every model
or user-authored patch against the active `InputContractV1` before any
simulation package is recompiled.

## Scope

- Add `src/services/input/inputPatch.ts` and focused tests.
- Implement every roadmap `InputPatchV1` operation.
- Preserve the active input kind, source program, and package identity.
- Return explicit rejection reasons without coercion or partial mutation.
- Provide a recompile helper that resets the selected timeline index to zero
  only after patch application and package recompilation both succeed.

## Invariants

- The operation union is closed and runtime-validated.
- Patch input is untrusted; no model output is applied directly.
- Array numbers and graph weights are finite.
- Graph documents pass the existing `GraphDocumentV1` validator after each
  mutation; node references are never left dangling.
- Seeded shuffle and seeded resize are reproducible.
- A failed patch or recompile preserves the previous input and package and
  exposes a reason.
- No source code is changed and no trace is supplied by a model.

## Acceptance Criteria

1. Every operation has a valid and invalid test.
2. Array resize, descending sort, target selection, weighted edge addition,
   and text replacement match the roadmap examples.
3. Contract kind and stated non-negative constraints are enforced.
4. Runtime parsing and graph validation run before success is returned.
5. Recompile success returns index zero and preserves program/source identity;
   failure returns the previous package unchanged with an explicit reason.
6. `npm run lint`, `npm run test`, and `npm run build` pass.
7. T9 is committed separately before T10 begins.
