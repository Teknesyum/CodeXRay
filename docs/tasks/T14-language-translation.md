# T14 Verified Language Translation Contract

## Objective

Translate C++, Java, or Python source into compact SimLang-Lite artifacts that
are schema-validated, deterministically executed, and test-gated before any
package can be applied.

## Scope

- Add `services/titan/translate.ts` and focused tests.
- Accept function-sized SimLang-Lite fragments and merge them deterministically.
- Permit one initial attempt and at most two repair attempts with exact parser
  or compiler feedback.
- Compile the accepted program through the existing SimLang interpreter and
  package test gate.
- Attach original-language/source provenance and expose it in CodeEditor.

## Invariants

- Original C++, Java, and Python source is data and is never executed.
- Model text is never treated as source code or trace.
- Trace always comes from the SimLang interpreter.
- Invalid Lite, duplicate functions, missing entry, input mismatch, empty
  deterministic trace, or failed package tests reject the candidate.
- A rejected candidate cannot mutate the workspace.
- Translation provenance distinguishes original source from verified generated
  SimLang.

## Acceptance Criteria

1. C++, Java, and Python inputs each produce a verified package from valid Lite.
2. Multiple function fragments merge in deterministic order.
3. Malformed output receives line-number feedback and at most two repairs.
4. Three failed attempts return every reason and no package.
5. Package steps are interpreter output and tests pass before success.
6. The UI displays an EN/TR translated-and-verified provenance badge.
7. `npm run lint`, `npm run test`, and `npm run build` pass.
8. T14 is committed separately before T15 begins.
