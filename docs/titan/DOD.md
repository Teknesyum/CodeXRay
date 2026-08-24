# Titan DoD — live table

## Özet

Yol haritasının 13. bölümündeki bitti tanımı buraya taşındı ve gerçek denetim sonucuyla işaretlendi.
Roadmap'in on kutusuna denetimde çıkan üç madde daha eklendi: SimLang-Lite korpusu, Windows 11 temiz kurulum, GBNF araştırması.
Durum 2026-08-24 itibarıyla: 5 closed, 7 open, 1 deferred.

| # | Claim | State | Evidence | Closed by |
|---|---|---|---|---|
| 1 | Any valid JS/TS code produces a simulation; no "no matching simulator" path remains | open | `src/services/trace/parser.ts:42` calls acorn with `sourceType: 'script'` and no TypeScript stripping layer; `src/services/trace/interpreter.ts:306`, `src/services/trace/interpreter.ts:444` throw "Unsupported" for `class`, `async/await`, generators, `Symbol.iterator`. Evidence volume is 20 LeetCode samples. Split decision lands in R03. | |
| 2 | In a 500+ step trace, "go to the most important step" lands on the right step from a deterministic index | closed | `src/services/trace/significance.ts`, `src/services/trace/traceOutline.ts`, `src/services/trace/traceQuery.ts`; test `src/services/trace/traceIntelligence.test.ts` | |
| 3 | With a live local model (LM Studio, `muse-glimmer-30b@q4_k_xl`) navigation and input editing work, and schema failure visibly falls back | open | `src/services/desktopAiService.test.ts` mocks `@tauri-apps/api/core`, so the network layer never runs; `e2e/real-ai.spec.ts` targets WebLLM only and is skipped unless `CODEXRAY_REAL_AI === '1'`. Depends on R06. | |
| 4 | With the model fully disabled, no core product function is lost | closed | every spec under `e2e/` except `real-*.spec.ts` runs model-free; `playwright.config.ts` `testIgnore` | |
| 5 | The radio feature works as it did before the migration | closed | `e2e/radio-controller.spec.ts`, `e2e/radio-autoplay.spec.ts` | |
| 6 | `godMode\|GodMode` grep returns 0 inside `src` | open | grep in `src` is genuinely 0, but six specs still carry the old name: `e2e/god-mode-clarification.spec.ts`, `e2e/god-mode-failures.spec.ts`, `e2e/god-mode-user-graph.spec.ts`, `e2e/model-authored-god-mode.spec.ts`, `e2e/interval-dp-god-mode.spec.ts`, `e2e/dp-family-god-mode.spec.ts`; `src/i18n/translations.ts:207-231` still defines `godAgent_*` keys. Closed in letter, open in spirit. | |
| 7 | All existing regression tests green; new test matrix complete | open | `docs/TITAN_ACCEPTANCE_MATRIX.md` cites files that do not exist. Two of the three ghost entries exist under other names (`src/services/trace/jsTracer.test.ts`, `src/services/trace/leetcodeAcceptance.test.ts`). Real gap is single: `src/services/trace/tracerWorkerClient.ts` has no test. Closes in R01. | |
| 8 | `npm run lint`, `npm run test`, `npm run build`, `npm run desktop:check` clean | closed | `.github/workflows/ci.yml`; local run 2026-08-24: lint clean, 119 test files / 747 tests passed, build within budget | |
| 9 | No stray MD/log/dev assets at repo root; README is English and current | closed | repo root listing; `README.md` | |
| 10 | Root and per-folder `CLAUDE.md` routers current | open | none — repository contains no `CLAUDE.md` at all. Closes in R01. | |
| 11 | SimLang-Lite 60-program round trip | open | `src/services/simLangLite.test.ts` covers canonical round-trip, size comparison and line-numbered errors, but the 60-program corpus does not exist. Depends on R05. | |
| 12 | Windows 11 clean install works | open | `.github/workflows/desktop-release.yml` packages NSIS but has no clean-machine install step, no WebView2 bootstrapper verification and no smoke test. Depends on R07. | |
| 13 | GBNF grammar-constrained decoding research | deferred | `docs/tasks/T8-local-model-layer.md:57-63` records the skip: no live llama.cpp endpoint was reachable. Reopen trigger: a reachable llama.cpp/LM Studio endpoint that advertises GBNF grammar support. Written up as `deferred-with-trigger` in R08. | |

## Deferred items

**13 — GBNF grammar-constrained decoding research.**

Why deferred: the research needed a live llama.cpp-class endpoint exposing GBNF grammar
support, and none was reachable during T8. `docs/tasks/T8-local-model-layer.md:57-63`
records the skip verbatim rather than claiming coverage.

Reopen condition: a reachable local endpoint (llama.cpp server or LM Studio build) that
advertises GBNF grammar support, on a machine where the target model weights are already
cached. Once that exists, the item returns to `open` and is routed through the normal
route/handoff cycle.

Asked of the human: stand up or point at such an endpoint, and confirm which model weights
are cached locally. Nothing else — no credentials or purchases are involved.

## How this table is updated

- Only Sole writes to this file, and only the `State`, `Evidence` and `Closed by` cells.
  Claim text and row numbering are fixed; a new claim is appended, never renumbered.
- The table is updated in the same commit as each `H<nn>` handoff report, as part of
  `route(R<n>): close`.
- Writing `closed` requires an evidence pointer in the same row: a `path:line` reference
  or a command line whose output is pasted verbatim into the handoff. Prose is not
  evidence. A row without a pointer stays `open`.
- `Evidence` is never left blank. If nothing exists, the cell reads `none`.
- `Closed by` carries the handoff number that closed the row and is written only at the
  moment `State` becomes `closed`.
