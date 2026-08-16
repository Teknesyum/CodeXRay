# T13 Titan Naming and Localization Contract

## Objective

Replace user-facing God Mode terminology and active implementation identifiers
with Titan Mode while preserving complete English/Turkish localization and all
runtime behavior.

## Scope

- Rename active services, components, types, events, storage helpers, CSS
  selectors, tests, and translation keys from God Mode to Titan Mode.
- Update every user-facing English and Turkish label.
- Preserve storage migration from legacy persisted plans and preferences.
- Preserve the radio component byte-for-byte and preserve the protected
  `robustnessFuzz.test.ts` byte-for-byte as explicitly required.

## Invariants

- No radio source edit is permitted.
- No protected regression test edit is permitted.
- The old UI event compatibility module remains only for the untouched radio;
  active Titan code uses Titan identifiers.
- Existing saved plans remain readable and clearable.
- English and Turkish key sets remain identical.

## Acceptance Criteria

1. All active product UI says Titan Mode in English and Turkish.
2. Active implementation modules and identifiers use Titan naming.
3. Translation completeness tests pass.
4. A source grep has no legacy matches outside the two immutable files and the
   compatibility shim required by them; every exception is enumerated.
5. Radio and `robustnessFuzz.test.ts` hashes are unchanged from the T12 commit.
6. `npm run lint`, `npm run test`, and `npm run build` pass.
7. T13 is committed separately before T14 begins.
