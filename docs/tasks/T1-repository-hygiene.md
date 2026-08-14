# T1 Repository Hygiene Contract

## Objective

Remove local debugging and research artifacts from the repository workspace and
keep them excluded from version control without changing application behavior.

## Scope

- Remove root-level `page.html` and `ytInitialData.json` artifacts.
- Remove root-level `vite-debug*.log` artifacts.
- Remove the root-level `test-results/` and `scratch/` directories.
- Ensure `.gitignore` excludes each artifact family.
- Record the completed package and verification evidence in `docs/DEVIRALAN.md`.

## Invariants

- Do not modify the radio feature or its runtime assets.
- Do not modify `pedagogical*`, `randomizedRegression`, or `robustnessFuzz` tests.
- Do not remove application source, curated simulation assets, or release inputs.
- Do not claim a check passed unless its command completed successfully.

## Acceptance Criteria

1. None of `page.html`, `ytInitialData.json`, `vite-debug*.log`,
   `test-results/`, or `scratch/` exists at the repository root.
2. `.gitignore` contains effective rules for every removed artifact family.
3. `git ls-files` reports none of the removed artifacts as tracked.
4. `npm run lint` passes.
5. `npm run test` passes.
6. The T1 changes are committed in one dedicated commit before T2 begins.

## Verification

Run the following before the T1 commit:

```powershell
git status --short
git ls-files -- page.html ytInitialData.json test-results scratch "vite-debug*.log"
git check-ignore -v page.html ytInitialData.json test-results scratch vite-debug.log
npm run lint
npm run test
```

## Out of Scope

- Titan type renaming and all T2 work.
- Tracer, interpreter, Worker, model, pipeline, and UI implementation.
- Radio refactoring, relocation, or behavioral verification beyond regression
  coverage already provided by the required test suite.
