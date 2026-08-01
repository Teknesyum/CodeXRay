# CodeXRay Release Debug Closure and Coverage Evidence

Last audited: 2026-08-01  
Scope: the complete CodeXRay SPA, deterministic simulators, workspace UI,
God Mode, optional on-device WebLLM, radio, accessibility, performance, and
publication guardrails.

## Verdict

No known reproducible application defect remains open in the audited release
scope. Every defect found during this audit was fixed and retained as an
automated regression. The deterministic release gate is green in bundled
Chromium, installed Google Chrome 151, and installed Microsoft Edge 151.

This statement is deliberately narrower than claiming that every future GPU,
browser version, model output, operating system, or external YouTube response
can never fail. Those are changing environments, not unfinished debug items.
Their release checks remain explicit and repeatable below.

## Verified release evidence

| Gate | Result | Evidence |
|---|---:|---|
| Lint | PASS | `npm run lint`, zero warnings/errors after local research artifacts are ignored |
| Unit/integration | PASS | 51 Vitest files, 240/240 tests |
| Coverage | PASS | 80.64% statements, 69.02% branches, 79.06% functions, 83.05% lines |
| WebLLM worker coverage | PASS | 94.00% statements, 75.00% branches, 94.11% functions, 93.47% lines |
| Production build | PASS | TypeScript + Vite + bundle budgets |
| Main JS budget | PASS | 554.0 KiB / 600.0 KiB |
| Worker budget | PASS | 5926.6 KiB / 6500.0 KiB |
| CSS budget | PASS | 63.4 KiB / 100.0 KiB |
| Dependency audit | PASS | `npm audit --audit-level=high`, zero vulnerabilities |
| Bundled Chromium E2E | PASS | 54/54 Playwright tests |
| Google Chrome 151 E2E | PASS | 54/54 Playwright tests |
| Microsoft Edge 151 E2E | PASS | 54/54 Playwright tests |
| DP timing stability | PASS | 12/12 repeated Chrome runs across four DP journeys |
| Real WebLLM | PASS | Qwen2.5 Coder 0.5B, WebGPU, Chrome 151; first load 10.601 s, cache return 1.821 s |
| Real YouTube radio | PASS | 45/45 curated tracks reached confirmed playback |
| Source whitespace | PASS | `git diff --check` |

## Closed debug areas

### Deterministic catalog, inputs, and timeline

- All 60 supported catalog entries have independent simulator/registry
  evidence, final-result oracles, source-line bounds, structured trace values,
  replay, and seeded cross-family regression tests.
- Array, string, tree, graph, compound, Unicode, invalid, and hostile inputs are
  parsed without uncaught exceptions. Invalid edits preserve the last committed
  workspace.
- Graph renaming atomically updates edges and start/target/root references.
  Duplicate edges, invalid weights, negative Dijkstra/A* edges, cycles,
  unreachable nodes, unusual IDs, and sparse trees have direct tests.
- Forward/back, jump, play/pause, checkpoint tours, pins, relocalization, and
  stale-state cleanup remain synchronized with the selected trace step.

### God Mode and generated algorithms

- Deterministic routing distinguishes questions from commands and immediately
  handles DFS/BFS navigation and supported DP requests.
- The serialized Manager/Architect/Code Author/Input Engineer/Visualization
  Designer/Compiler/Critic/Tutor queue exposes progress, cancellation, bounded
  retries, failure ownership, and completion.
- Model-authored source is never evaluated as JavaScript. Typed artifacts are
  schema-validated, compiled/interpreted through SimLang, committed atomically,
  audited, undoable, and rolled back on failure.
- A full model-authored browser fixture proves that source, custom input,
  simulation program, original visual contract, trace, checkpoints, and
  five-lens narration commit together.
- User graphs are preserved when requested; missing start/target requirements
  produce clarification instead of silent replacement.
- Bidirectional BFS includes two frontier states, node states, traversed edge
  states, meeting/path semantics, task title, exact input, and grounded teaching.

### DP authoring and teaching

- LeetCode 486 Predict the Winner implements the requested recurrence and
  interval fill order, supports input replacement, and shows active cell plus
  exact dependency cells at each transition.
- General DP families now include House Robber (1D), LCS (rectangular 2D), and
  Longest Palindromic Subsequence (interval DP).
- Base states, fill direction, operands, current/result cells, source lines,
  rewind/replay, final values, and matrix cell diffs are asserted.
- Grounded-teaching tests verify every checkpoint against committed code,
  variables, visual state, and adjacent trace steps. Turkish, English, mixed
  language, typo-heavy routing, interruption, and stale-history cases are
  included.

### Visual design and workspace UI

- Visualization contracts validate unique semantic node/edge IDs, legends,
  role references, layout distance, responsive thresholds, and style bounds.
- Shortest path, MST, max flow, topological order, bidirectional search, and DP
  use task-specific visual roles rather than blindly reusing a generic preset.
- Five panels remain collapsible; desktop splitters are pointer/keyboard
  accessible and bounded; mobile stacking, 320 px/390 px layouts, persistence,
  reset scope, menus, and Markdown containment pass browser tests.
- Performance budgets cover startup, seven cross-family switches, graph
  simulation, timeline stepping, 70-cell DP generation, and repeated mixed use.

### Accessibility, localization, and themes

- Axe WCAG A/AA serious/critical sweeps pass for all three themes and both
  languages, plus mobile settings, graph, radio shell, and 200%/400% equivalent
  reflow.
- Source and radio sliders have accessible names; dialogs restore focus;
  splitters support keyboard input; visual states include non-color semantics.
- Reduced-motion is honored globally. Theme initialization is awaited before
  contrast analysis so transient interpolation is not misreported as a stable
  contrast defect.

### Local AI lifecycle and privacy

- Direct worker tests cover cache discovery/deletion, progress, initialization,
  strict planner options, serialized agent requests, one bounded continuation,
  truthful truncation, active cancellation, late-answer rejection, malformed
  requests, and failure reporting.
- A real on-device run acquired WebGPU, downloaded/initialized Qwen2.5 Coder
  0.5B, answered, returned from cache, and completed its lifecycle without a
  remote AI provider or API key.
- Browser network assertions ensure source, input, and chat payload sentinels do
  not leave the origin. Repository contracts prohibit `eval`, `new Function`,
  unsafe HTML execution, secrets, and remote AI providers.

### Radio

- Controlled-player tests cover confirmed play/pause state, autoplay retry,
  previous/next, shuffle, volume/mute, minimize timing, errors, and fallback.
- Loop means repeat the current track: an ended track seeks to its beginning and
  does not advance while loop is active.
- The live release audit opened every curated iframe entry and confirmed 45/45
  playing. `Up — CDK` remains the first track; the Demons entry uses the verified
  embeddable upload.

### Robustness and release tooling

- Fixed-seed fuzz tests exercise 800 hostile parser/router strings, 400 malformed
  SimLang artifacts, and 160 randomized graph invalidity/atomicity cases.
- A repeated cross-subsystem soak cycles simulation, settings, panels, radio,
  and God Mode without stale state, locked controls, overflow, or leaked errors.
- Publication helpers validate source/target cleanliness, synchronized target
  main, `/codexray/` asset bases, staging containment, rollback, and the exact
  `blog/public/codexray/**` scope.

## External release conditions, not open code defects

These checks cannot be permanently closed by source code because the tested
environment can change. They must be rerun when applicable:

1. YouTube owners may revoke embedding or remove a video; rerun
   `npm run test:e2e:radio-live` before a radio-dependent release.
2. Browser autoplay remains subject to browser engagement policy. CodeXRay
   exposes confirmed state and retry behavior rather than claiming playback
   before the iframe reports it.
3. WebGPU availability, VRAM, storage eviction, and model compatibility vary by
   device. Rerun `npm run test:e2e:ai` on release hardware; a skip is not a pass.
4. A 9B-model real run requires suitable VRAM and is not inferred from the
   successful 0.5B lifecycle. Unsupported hardware must fail cleanly.
5. Real publication requires the explicitly named clean, synchronized portfolio
   repository and deployment authorization. The publisher never guesses a
   filesystem target or pushes unrelated files.
6. Human screen-reader and subjective visual-quality sign-off remain product
   acceptance activities. Automated checks cannot impersonate a human reviewer.

## Reproduction commands

```powershell
npm run lint
npm run test
npm run test:coverage
npm run build
npm audit --audit-level=high
npm run test:e2e
$env:CODEXRAY_E2E_CHANNEL='chrome'; npm run test:e2e
$env:CODEXRAY_E2E_CHANNEL='msedge'; npm run test:e2e
$env:CODEXRAY_E2E_CHANNEL='chrome'; npm run test:e2e:ai
$env:CODEXRAY_E2E_CHANNEL='chrome'; npm run test:e2e:radio-live
```

Generated `dist/`, `coverage/`, `playwright-report/`, `test-results/`, local
research files, and model caches are never committed.
