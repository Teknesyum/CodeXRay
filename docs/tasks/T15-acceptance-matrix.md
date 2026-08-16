# T15 Acceptance Matrix and Auditor Gate Contract

## Objective

Bind every Titan roadmap acceptance family to executable unit, native, build,
or browser evidence and complete the final regression audit without weakening
existing tests.

## Scope

- Add an English executable-evidence matrix under `docs/`.
- Update browser acceptance naming and persisted preference setup to Titan Mode.
- Add a focused Titan browser smoke for naming and deterministic operation.
- Audit legacy preference migration discovered by the renamed browser suite.
- Run lint, all unit tests, build budgets, desktop checks, and Playwright.

## Invariants

- Protected pedagogical, randomized regression, and robustness fuzz tests are
  unchanged.
- Radio source and real-radio acceptance are unchanged.
- A skipped or unavailable real-model test is recorded, never counted as pass.
- Browser tests do not fabricate model trace.
- Existing thresholds and timeouts are not relaxed to obtain a pass.

## Acceptance Criteria

1. Every roadmap test-matrix row maps to at least one existing executable file.
2. Titan naming and deterministic navigation are browser-verified.
3. Legacy Titan-enable preference migration is tested.
4. `npm run lint`, `npm run test`, `npm run build`, and
   `npm run desktop:check` pass.
5. The full non-real Playwright suite passes using the documented external
   server procedure; any environment-only retry is reported explicitly.
6. Protected file hashes remain unchanged.
7. T15 is committed separately before T16 begins.
