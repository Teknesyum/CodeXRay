# T19 Isolated Performance E2E Contract

## Objective

Make the Playwright performance gate reproducible without weakening its product
thresholds by isolating it from unrelated parallel browser workloads.

## Decision

Keep every existing timing threshold, including the one-second budget for ten
timeline commits. Mark both tests in `performance-budget.spec.ts` with the
`@performance` tag. The standard E2E runner executes non-performance scenarios
in its normal parallel phase, then executes the tagged performance phase with
exactly one worker.

Raising the threshold was rejected because the observed 1.193-second result
occurred only while eight independent browser workers competed for the same CPU;
the unchanged test repeatedly passed when isolated. A dedicated phase measures
the application rather than runner contention and keeps regression sensitivity.

## Scope

- Add only Playwright metadata to the two existing performance tests.
- Split the standard non-real E2E runner into a parallel non-performance phase
  and a one-worker performance phase.
- Preserve the separate real-AI and real-radio commands and their environment
  boundaries.

## Invariants

- No performance threshold, application timeout, assertion, or test body is
  changed.
- A failure in either phase produces a failing command exit code.
- Real-model and real-radio suites remain separately selected and are never
  included in the deterministic default gate.

## Acceptance Criteria

1. `npm run test:e2e` runs all non-real scenarios and reports both phases.
2. Tagged performance tests run with `--workers=1`; all other tests retain the
   configured parallelism.
3. The one-second timeline threshold remains unchanged and passes in the
   isolated phase.
4. `npm run lint` and all 747 unit tests pass before the dedicated T19 commit.
5. T19 is committed separately and the handoff report records the final result.
