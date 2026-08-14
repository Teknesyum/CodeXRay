# T2 Titan Type Module Contract

## Objective

Mechanically rename the shared God Mode type module from
`src/types/godMode.ts` to `src/types/titan.ts` and update every importing module
without changing runtime behavior.

## Scope

- Rename `src/types/godMode.ts` to `src/types/titan.ts` with identical content.
- Replace every source and test import path that targets `types/godMode` with
  the equivalent `types/titan` path.
- Record the completed package and verification evidence in
  `docs/DEVIRALAN.md`.

## Invariants

- This package is a path-only mechanical rename. Exported type names and runtime
  contracts remain unchanged for later Titan packages.
- Do not modify the radio feature or its runtime assets.
- Do not modify the contents of `pedagogical*`, `randomizedRegression`, or
  `robustnessFuzz` tests.
- Do not change orchestrator behavior, model behavior, trace production, UI
  labels, storage keys, or user-visible strings.
- Do not add model-generated trace or any code-execution mechanism.

## Acceptance Criteria

1. `src/types/titan.ts` exists and `src/types/godMode.ts` does not.
2. No file under `src/` imports or references the `types/godMode` module path.
3. The renamed module content is unchanged apart from its path in Git.
4. TypeScript and lint checks report no unresolved imports.
5. `npm run lint` passes.
6. `npm run test` passes.
7. The T2 changes are committed in one dedicated commit before T3 begins.

## Verification

Run the following before the T2 commit:

```powershell
git diff --summary
rg "types/godMode" src
npm run lint
npm run test
```

## Out of Scope

- Renaming exported `GodMode*` symbols, UI copy, storage keys, components, or
  service modules.
- Tracer parser, interpreter, execution budgets, and Worker isolation.
- Any T3 or later Titan Mode implementation.
