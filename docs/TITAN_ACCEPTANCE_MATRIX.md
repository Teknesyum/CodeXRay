# Titan Mode Acceptance Matrix

| Area | Executable evidence | Gate |
|---|---|---|
| JavaScript tracer syntax, budgets, forbidden APIs, seeded determinism | `src/services/trace/jsTracer.test.ts`, `src/services/trace/leetcodeAcceptance.test.ts`, `src/services/trace/tracerWorkerClient.test.ts` | Vitest |
| Worker trace adaptation and visible failures | `src/services/customTraceFallback.test.ts`, `src/services/trace/adapter.test.ts` | Vitest |
| Structural significance, 500+ steps, locale independence, 40 EN + 40 TR navigation | `src/services/trace/traceIntelligence.test.ts`, `src/services/titan/titanRouter.test.ts` | Vitest |
| Closed input patches and atomic recompilation | `src/services/input/inputPatch.test.ts` | Vitest |
| Structured-output none, prompt-only, native and tolerant extraction | `src/services/ai/commandOutput.test.ts`, `src/services/ai/tolerantJson.test.ts` | Vitest |
| 4,200-token prompt ceiling and no complete trace | `src/services/aiContext.test.ts` | Vitest |
| Five-stage gates, skipped stage, cancellation, atomic apply | `src/services/titan/titanPipeline.test.ts` | Vitest |
| C++/Java/Python translation, repairs, deterministic trace provenance | `src/services/titan/translate.test.ts` | Vitest |
| EN/TR key parity and Titan UI | `src/i18n/translations.test.ts`, `src/components/TitanProgress.test.tsx`, `src/components/TitanModeProgress.test.tsx` | Vitest |
| Protected regression network | `src/services/pedagogical*.test.ts`, `src/services/randomizedRegression.test.ts`, `src/services/robustnessFuzz.test.ts` | Vitest |
| Desktop probe parsing, loopback boundary, reasoning usage | `src-tauri/src/lib.rs` | Cargo test / Clippy |
| Titan naming and deterministic browser workflow | `e2e/titan-mode.spec.ts`, renamed existing non-real suites | Playwright |
| Initial/lazy/worker/style budgets | `scripts/check-build-size.mjs` | Production build |

Real WebLLM scenarios require cached multi-gigabyte weights on the exact browser
origin and are excluded from the non-real gate. They must be reported as not
run unless that cache and `CODEXRAY_REAL_AI=1` are explicitly available.
