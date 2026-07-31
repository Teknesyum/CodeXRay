# CodeXRay Test Coverage Gaps and Agent Handoff

Last audited: 2026-08-01  
Requirements source: `docs/PRODUCT_REQUIREMENTS.tr.md`  
Audit baseline commits: `0eac45e`, `8d07225`, `ff65689`

## Honest status

The requirements document has **not** been converted into a complete automated
acceptance suite. The repository currently has a strong unit/integration base
and a useful deterministic browser suite, but the final product acceptance
sentence in section 18 of the requirements must not be signed yet.

Current verified baseline:

- 39 Vitest files and 171 passing unit/integration tests.
- 21 passing deterministic Playwright tests.
- One opt-in real-WebLLM Playwright test in `e2e/real-ai.spec.ts`.
- The real-WebLLM test has been exercised in bundled Chromium, which exposed
  `navigator.gpu` but returned `null` from `requestAdapter()`. The model download
  therefore has **not** been exercised on supported WebGPU hardware.
- The reported coverage percentage is scoped only to simulators and input
  parsers by `vitest.config.ts`; it is not whole-application coverage.

Manual browser checks performed during the audit are useful evidence but are
not counted as repeatable regression coverage. They included custom Quick Sort,
Unicode KMP, Dijkstra timeline boundaries, Graph Builder node creation,
settings focus, responsive layout, radio opening, and all three themes.

## Status legend

- **Covered**: the scenario's important acceptance conditions have repeatable
  automated coverage.
- **Partial**: some lower-level or browser coverage exists, but at least one
  important acceptance condition is not automated.
- **Missing**: no meaningful end-to-end acceptance coverage exists.
- **Manual gate**: automation helps, but hardware, browser policy, or human
  review is still required before release approval.

## Requirements scenario matrix

| Scenario | Status | Existing evidence | Work still required |
|---|---|---|---|
| 1. Learn an algorithm without AI | Partial | `randomizedRegression.test.ts`, `TimelineContext.test.tsx`, custom-array smoke test | One browser flow must use an unknown array, play/pause/back, pin a variable, and assert synchronized code, visual state, and variables. |
| 2. Random search input | Partial | Representative simulator tests | Add found/not-found browser cases with user input and assert that result/highlight state is cleared between runs. |
| 3. Unicode string | Partial | Seeded KMP/Rabin-Karp/Boyer-Moore tests; manual KMP check | Add E2E match/miss cases containing Turkish characters and emoji, including stale-result checks. |
| 4. Tree import/edit/traversal | Partial | Parser and representative traversal unit tests | Add full E2E level-order import, sparse child preservation, rename, child add/delete, traversal oracle, export/import round trip, and cycle rejection. |
| 5. User-drawn weighted graph | Partial | Graph editor tests, generated Dijkstra oracle, negative-weight unit checks | Add a 6–12-node E2E graph constructed through the UI; independently assert path/cost and that a rejected negative edit preserves the valid graph. Include A*. |
| 6. Daily Graph Builder editing | Partial | `GraphInputEditor.test.tsx` and graph smoke tests | Add UI coverage for deleting a middle numeric ID and reusing the gap, duplicate edges through both creation paths, and drag movement preserving topology. |
| 7. Random catalog tour | Partial | Every registered simulator executes; presets validate; representative E2E | Add independent mathematical oracles for every one of the 60 algorithms and a seeded catalog-family browser tour that checks stale code/input/analysis removal. |
| 8. Personalize panel layout | Partial | Layout unit tests and multiple resize/collapse E2Es | Add reload persistence, keyboard resizing for every splitter, maximize/restore, alignment, and all-five-panels reopen coverage. |
| 9. Change language and theme mid-run | Partial | Translation tests, theme contrast E2E, manual mid-run check | Automate index/trace identity before and after language/theme changes, theme persistence after reload, and graph-state semantic markers in every theme. |
| 10. First local model load | Partial / Manual gate | Mock worker tests, loading-notice tests, opt-in real model smoke | Run on real WebGPU; assert monotonic truthful progress, no early 100%, responsive deterministic UI during load, correct ready/error notice, and workspace-grounded answer. The real test now probes `requestAdapter()` because checking only `navigator.gpu` caused a false positive and a 19-minute wait. |
| 11. Return to cached model | Partial / Manual gate | Cache selection and worker de-duplication unit tests | Real browser reopen tests for auto-load on/off, no weight redownload, separate GPU initialization messaging, model deletion isolation, and persistent browser storage behavior. |
| 12. Normal AI question | Partial / Manual gate | Context, copy, clear-memory, and mocked bridge tests | Real-model flow for complexity and current-step queue questions; prove no workspace mutation and prove clear preserves code/input/trace/cache. |
| 13. Open preset through AI | Partial | DFS mocked E2E and routing tests | Extend one flow to `play` and then a grounded question, asserting DFS code/input/trace throughout. |
| 14. Separate commands from questions | Partial | Routing unit tests | Add visible E2E sequence for `BFS nedir?`, `BFS sayfasını aç`, and `BFS sayfasını aç ve anlat`, with before/after workspace snapshots. |
| 15. Complete custom bidirectional BFS | Partial | SimLang, orchestrator, GM-2 contract tests, mocked E2E | Cover the exact 10-node/two-alternative-path request, original graph proof, two non-color-only frontiers, meeting/path oracle, guided pauses, final report, and real-model behavior. |
| 16. Custom algorithm on user's graph | Partial | Intent routing only | Add E2E proving exact node/edge preservation, trace use of user IDs, and explicit handling of missing start/target. |
| 17. Ambiguous custom algorithm | Missing | No acceptance-level clarification flow | Assert a clarification response, zero workspace mutations, no success claim, and resumability after the user supplies missing constraints. |
| 18. Change only the custom visual | Partial | Graph edit, transaction, layout, and visualization unit tests | Add E2E snapshot assertions proving code/topology/trace length are unchanged while positions and non-color roles change. |
| 19. Add a node to a custom graph | Partial | Graph request edit and transaction unit tests | Add God Mode E2E for adding X and two edges, recompiling, using X in trace, and rolling back on compile failure. |
| 20. Guided teaching tour | Partial | Teaching-plan and checkpoint unit tests | Add UI flow for repeat/continue/previous checkpoint and assert all five lenses against actual adjacent trace snapshots. |
| 21. Interrupt narration | Missing | Worker/orchestrator cancellation exists below the UI | Add delayed-response E2E: interrupt narration, jump to step 7, reject the late response, and assert only step-7 context appears. |
| 22. Verify final report | Partial | Final-metric unit tests | Add browser assertions for path/cost/visit count/meeting step and an unreachable target that must not be reported as success. |
| 23. Watch and cancel agent queue | Partial | Orchestrator cancellation unit test; visible successful queue E2E | Add mid-run UI cancellation with queued/running/cancelled states, honest progress, no partial application, and unlocked controls/chat. |
| 24. Agent failure and rollback | Partial | Transaction rollback and bounded orchestration tests | Add visible compile-failure E2E with bounded retries, failed specialist identity/reason, atomic rollback, and no completed claim. |
| 25. Radio autoplay truth | Partial | Mocked autoplay/player-state E2E | Add blocked-autoplay and first-interaction retry cases; assert Pause and wave never claim playback before player confirmation. |
| 26. Radio loop and minimize | Partial | Mock natural track-end loop assertion; manual Demons reproduction | Add previous/next, shuffle, mute/volume, loop-off advancement, unchanged title/art, countdown timing, hover pause/restart policy, and `Never` behavior. Demons updates title/art/duration but remains paused; expose YouTube `onError` and `onAutoplayBlocked` before deciding whether the cause is media policy or an item-specific player error. |
| 27. Error storm | Missing | Individual error paths have scattered unit coverage | Build one fault-injection E2E combining invalid input, model inference failure, radio API failure, God Mode cancel, and corrupt layout state; prove isolation and recovery without reset. |
| 28. Narrow-screen real use | Partial | Manual 390px overflow/splitter check | Add mobile Playwright project and complete algorithm/timeline/AI/settings/radio flow; assert no horizontal overflow, clipped dialogs, or inaccessible composer/tracker. |
| 29. Reset boundary | Covered | `siteReset.test.ts` and two reset E2Es | Retain; optionally add OPFS/Cache API mocks that prove model assets are untouched by both reset modes. |
| 30. Full release tour | Missing / Manual gate | Individual pieces only | Create a serial, single-profile release suite covering all 15 listed steps. Real model, real WebGPU, YouTube/browser autoplay policy, and final human review remain release gates. |
| 31. No internal prompt leak during timeline command | Partial | Timeline parser and answer sanitizer unit tests | Add mocked and real-model E2E for `DFS'i 10. adıma kadar ilerlet`; assert real clamp/state change, concise answer, and forbidden-token absence. |
| 32. Long Markdown response layout | Partial | Markdown component tests and assistant resize E2E | Inject long code/table/list/URL content, resize to minimum and maximum, and assert page/card/table/code overflow boundaries, copy visibility, composer usability, and content persistence. |
| 33. Clean output from reasoning models | Partial / Manual gate | Sanitizer and worker bridge tests; opt-in real test checks basic tags | Add step, complexity, and God Mode cases with closed/unclosed/mixed reasoning blocks; prove copied text equals cleaned visible text and action state is applied first. |
| 34. Malformed or hostile Markdown | Partial | Safe-link/raw-HTML component tests | Add UI fuzz cases for unclosed fences, huge lines/URLs/tables, nested lists, HTML/script/event handlers, reasoning tags, and a successful next message after every case. |

## Cross-cutting acceptance gaps

These requirements are broader than one scenario and still need explicit work:

1. **All-60 correctness oracle:** execution and determinism are tested, but
   independent expected results, meaningful intermediate states, and code-line /
   visual synchronization are not proved for every algorithm.
2. **Trace completeness:** one 15-node DFS trace is protected, but large trace
   collections across algorithm families are not tested against truncation.
3. **Tree property testing:** random sparse trees, multiple depths, traversal
   oracles, edit preservation, and export/import identity are missing.
4. **Graph property testing:** current seeded coverage is connected, undirected,
   positively weighted Dijkstra only. Add disconnected, cyclic, directed,
   unusual IDs, multiple equal paths, A*, MST, SCC, flow, and unreachable cases.
5. **A* admissibility:** add direct validation tests proving invalid heuristic
   data is rejected and accepted heuristic data cannot overestimate the true
   remaining cost.
6. **Accessibility:** focus transfer and one keyboard splitter path are covered.
   Still test visible focus for all controls, keyboard operation of all splitters
   and graph actions, non-color state cues, accessible icon names, reduced
   motion, zoom, and screen-reader landmarks/status messages.
7. **Privacy/network:** add a browser network allowlist test proving algorithm,
   workspace, and chat data are not sent to a remote AI/API endpoint. YouTube and
   model-weight origins must be explicitly categorized rather than broadly
   allowed.
8. **Analysis freshness:** prove generated analysis always belongs to the latest
   algorithm/input and is cleared after incompatible workspace changes.
9. **Storage migration:** add versioned layout/workspace fixtures from older and
   corrupt schemas and assert safe migration without deleting unrelated data.
10. **Whole-app coverage reporting:** extend `vitest.config.ts` only after tests
    exist for the added files. Report per-domain coverage so the high simulator
    percentage is not mistaken for whole-product coverage.

## Known defects found during this audit

### KDEF-01 — Real WebLLM test waits on an unusable WebGPU surface

Bundled Chromium reports `navigator.gpu`, but on the audited machine
`navigator.gpu.requestAdapter()` returns `null`. The former test treated the API
property as sufficient, clicked **Load local model**, and waited almost 19
minutes for a ready state the application could never reach. The test now probes
an actual adapter and skips immediately when none can be acquired. A supported
Chrome/Edge GPU run is still required; a skip is not acceptance evidence.

### KDEF-02 — Demons selection does not enter confirmed playback

In a real interactive browser session, **Imitation** entered the playing state,
while selecting **Demons** changed the displayed title, artwork, and duration to
4:14 but left the control in **Play**. The YouTube oEmbed endpoint returned valid
metadata for video `SX69IjN7PLc`, so the item exists, but that does not prove it
can play in the current embedded-player/browser-policy combination.

`PlaylistRadio.tsx` registers `onReady` and `onStateChange` only. It does not
register `onError` or `onAutoplayBlocked`, so the application discards the event
needed to distinguish an embed restriction, unavailable media, playback error,
or browser autoplay block. Add both events, bilingual visible feedback, a retry
path through an explicit user gesture, and mocked regression cases before
claiming this defect fixed.

## Prioritized backlog for follow-up agents

### P0 — release blockers

- [ ] **TST-P0-01 — Real WebLLM lifecycle**
  - Extend `e2e/real-ai.spec.ts` for scenarios 10–12, 31, and 33.
  - Run with `npm run test:e2e:ai` on Chrome/Edge with WebGPU.
  - Keep the real-adapter preflight and add a bounded inactivity watchdog with
    progress-change diagnostics so a stalled download/compile cannot look hung.
  - Preserve downloaded model storage between serial tests; record browser,
    adapter, model ID, first-load duration, and cache-return duration.
- [ ] **TST-P0-02 — God Mode atomicity, cancellation, and late responses**
  - Add `e2e/god-mode-failures.spec.ts` for scenarios 16–24.
  - Use deterministic delayed/failing workers first; add real-model coverage as
    a separate tagged suite.
- [ ] **TST-P0-03 — Complete tree acceptance**
  - Add `src/services/randomTreeRegression.test.ts` and
    `e2e/tree-workflow.spec.ts`.
  - Use seeded generated level-order trees and independent recursive traversal
    oracles; log the seed and serialized tree in every assertion message.
- [ ] **TST-P0-04 — Complete graph acceptance**
  - Expand `randomizedRegression.test.ts` and add
    `e2e/graph-workflow.spec.ts`.
  - Cover directed/undirected, connected/disconnected, cycles, unusual IDs,
    weighted/unweighted, unreachable target, negative-edge rejection, and A*
    heuristic rules.
- [ ] **TST-P0-05 — Hostile AI output and layout safety**
  - Add `e2e/markdown-resilience.spec.ts` for scenarios 32–34.
  - Assert element scroll widths, page overflow, script non-execution, copy
    payload, composer usability, and recovery with a subsequent message.
- [ ] **TST-P0-06 — Integrated error storm**
  - Add `e2e/error-isolation.spec.ts` for scenario 27.
  - Every injected error needs a local visible status and must leave unrelated
    deterministic simulation controls usable.

### P1 — high-value regression gaps

- [ ] **TST-P1-01 — Independent oracle for all 60 algorithms**
  - Create table-driven family suites rather than one oversized test.
  - For every registry entry assert final result, meaningful start/result steps,
    line-number bounds, input non-mutation, deterministic replay, and at least
    one invariant specific to that algorithm.
- [ ] **TST-P1-02 — Stateful no-AI learning journey**
  - Add one serial E2E covering scenarios 1–3 and timeline/pin synchronization.
- [ ] **TST-P1-03 — Catalog/state isolation tour**
  - Seed algorithm selection across all families and prove no stale code, input,
    analysis, variables, highlights, or timeline state remains.
- [ ] **TST-P1-04 — Full radio controller contract**
  - Extend `radio-autoplay.spec.ts` for scenario 26 and API-load fallback.
  - First expose and test YouTube `onError` and `onAutoplayBlocked`; retain the
    external playlist fallback and never claim playback before state `1`.
- [ ] **TST-P1-05 — Mobile, keyboard, and reduced motion**
  - Add mobile and keyboard Playwright projects and a reduced-motion project.
  - Exercise the complete narrow-screen workflow rather than checking CSS alone.
- [ ] **TST-P1-06 — Panel persistence and migration**
  - Exercise every splitter by pointer and keyboard, all five collapse states,
    maximize/restore, reload persistence, viewport change, and old-state repair.

### P2 — completeness and reporting

- [ ] **TST-P2-01 — Full Markdown syntax/property fuzzing**
- [ ] **TST-P2-02 — Network/privacy allowlist assertions**
- [ ] **TST-P2-03 — Analysis freshness and invalidation**
- [ ] **TST-P2-04 — Whole-app and per-domain coverage configuration**
- [ ] **TST-P2-05 — Serial single-profile release tour**

## Test construction rules for follow-up agents

1. Prefer unit/property tests for parsers, algorithms, transactions, planners,
   and sanitizers. Use E2E only for browser integration and visible behavior.
2. Every randomized test must use a fixed seed and include the seed plus exact
   input in its failure message. Promote every discovered failure into a fixed
   regression fixture.
3. Never weaken an assertion to accept the current implementation. Derive the
   expected result independently from CodeXRay's simulator.
4. Mock WebLLM and YouTube for deterministic CI tests. Keep real WebLLM and real
   browser-policy checks in explicit, separately invoked suites.
5. Do not count skipped real-AI tests as passed acceptance.
6. Preserve complete trace collections and structured values in assertions.
7. Test both English and Turkish for every new user-visible error/status.
8. For God Mode, snapshot the full committed workspace before the request and
   compare it after cancel/failure. No partial title/code/input/trace application
   is acceptable.
9. Before handoff run `npm run lint`, `npm run test`, `npm run build`, and all
   relevant Playwright suites. Do not commit generated reports.

## Release approval gate

The section 18 checklist remains open until every P0 item is complete, the real
WebLLM lifecycle has been run successfully on supported hardware, the serial
release tour has been executed, and the remaining manual accessibility/browser
policy checks have recorded evidence. Until then, agents must report the product
as partially verified rather than fully accepted.
