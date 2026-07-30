# CodeXRay Agent Guide

## Project

CodeXRay is a bilingual English/Turkish React 19, TypeScript 6, and Vite 8 SPA for
deterministic, step-by-step algorithm visualization. It supports 13 algorithms,
typed array/string/tree/graph input, a manual graph builder, and an optional
on-device WebLLM assistant. No API key or remote AI provider is used.

## Commands

```bash
npm ci
npm run dev
npm run lint
npm run test
npm run test:coverage
npm run build
npm run test:e2e
```

Before handoff, run lint, unit tests, build, and relevant browser tests. Do not
commit `dist/`, `coverage/`, `test-results/`, or `node_modules/`.

## Architecture

- `src/types/simulation.ts`: shared input, graph, trace, visual, and step types.
- `src/services/inputParsers.ts`: all untrusted input validation.
- `src/services/inputPresets.ts`: deterministic array/string/tree/graph presets.
- `src/services/simulators.ts`: the 13 offline algorithm implementations.
- `TimelineContext.tsx`: playback, selected algorithm/input, analysis, and local
  AI state. It autosaves only the input workspace in browser storage.
- `GraphInputEditor.tsx`: manual editing plus GraphDocumentV1 and level-order
  tree import/export.
- `localAiService.ts` and `localAi.worker.ts`: optional WebGPU model lifecycle.
- `src/i18n/translations.ts`: complete EN/TR UI, algorithm, validation, and
  runtime explanation localization.
- `scripts/publish-to-site.mjs`: guarded static publication to the portfolio.

## Contracts

- Never truncate trace collections; keep arrays and objects structured as
  `TraceValue`, not preformatted JSON strings.
- `SimulationStep.lineNumber` is 1-based or `null`.
- Visual data is the `array | graph | variables` union. Graph node/edge states
  are `idle`, `queued`, `active`, `visited`, or `path` as applicable.
- Validate GraphDocumentV1 before simulation. Dijkstra and A* reject negative
  weights; A* heuristics must remain admissible.
- Add a distinct deterministic simulator and tests before setting another
  registry entry to `isSupported: true`.
- Every new user-facing string needs English and Turkish output. Language
  switching must update existing simulation steps without rerunning them.
- Keep code and repository documentation in English. Never add secrets, API
  keys, or remote AI calls. Local AI must stay optional and worker-based.

## Deployment

After a clean, committed source state:

```bash
npm run publish:site -- --target "C:\path\to\serkanozelme" --dry-run
npm run publish:site -- --target "C:\path\to\serkanozelme"
```

The publisher must only stage `blog/public/codexray/**`, require a clean and
synchronized target `main`, validate both builds, then let the target repo’s
Cloudflare integration deploy. Preserve unrelated work in both repositories.
