# CodeXRay Agent Guide

## Purpose

CodeXRay is an English-only React SPA that simulates algorithm code step by
step, highlights the active line and variables, and renders array or graph
visualizations. The “Master Coder” panel provides code analysis and Q&A. The
stack is React 19, TypeScript 6, Vite 8, Oxlint, and
`@google/generative-ai`.

## Quick start

```bash
npm ci
npm run dev
npm run lint
npm run build
```

There is no automated test suite. After a change, run at least `npm run lint`
and `npm run build`. Lint currently reports a few baseline warnings; do not add
new errors or warnings. Do not edit or commit generated `dist/` or
`node_modules/` content.

## Architecture and data flow

1. `src/main.tsx` boots the app; `src/App.tsx` wires the layout and
   simulate/analyze actions.
2. `src/context/TimelineContext.tsx` is the shared state source for code,
   steps, playback index/speed, analysis, API key, and input.
3. `src/components/CodeEditor.tsx` selects code from `codeRegistry` and starts
   simulations with custom input or `preset:i1|i2|i3`.
4. `src/services/aiService.ts` produces local mock steps without an API key
   and calls Gemini from the browser when a key is supplied. API failures fall
   back to mock data.
5. `DynamicVisualizer`, `VariablesPanel`, and `AiAssistant` read the same
   timeline step. `ControlBar` manages playback, analysis, example questions,
   and settings.

## Contracts to preserve

- `SimulationStep` is `{ lineNumber, visualData, explanation }`.
  `lineNumber` is 1-based and must match the displayed source line.
- Supported `visualData.type` values are `array`, `graph`, and `variables`.
  Unknown types render as JSON.
- Array data uses `values`, optional `pointers`, and `vars`. Graph data uses
  `nodes[{id,label,x,y,active}]`, `edges[{from,to,active}]`, and `vars`.
  Keep current local values in `vars` so the variables panel works.
- Put new shared UI state in `TimelineContext`. Component styles live beside
  components; preserve the existing neon variables and class structure.
- Add all new user-facing copy to `src/i18n/translations.ts`, which now
  contains the single English dictionary.

## Algorithm and AI notes

- `src/services/codeRegistry.ts` contains 60 C/C++ examples; 13 have
  `isSupported: true`. This flag enables offline input presets.
- Mock routing recognizes algorithms through substrings in their code. New
  offline support must update the registry flag, mock routing, step generator,
  and all three presets together.
- The provider selector is currently visual only; the integration uses Gemini
  (`gemini-1.5-flash`). API keys exist only in React memory. Never add real
  keys to source, logs, or commits; remember that user code and input are sent
  to the external service.
- `scripts/gen_registry*.cjs` are development helpers and currently write to
  a machine-specific absolute Windows path. Do not run them until the target
  path is fixed and a full registry replacement is intentional.

## Working rules

- Inspect the related component, context, and service together; behavior often
  spans all three layers.
- Preserve existing user changes and avoid formatting unrelated files.
- Prefer existing React/Vite tools before adding dependencies. If a dependency
  changes, update `package-lock.json` too.
- Report validation commands and any remaining known limitations.
