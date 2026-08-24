# Playwright layer
Runner `scripts/run-e2e.mjs`, config `playwright.config.ts`, base URL `http://127.0.0.1:4173`.
## Windows server procedure
- The runner spawns vite on 127.0.0.1:4173 and sets `PLAYWRIGHT_EXTERNAL_SERVER=1` for the
  Playwright children, so the config skips its own `webServer`.
- If a server is already up, export `PLAYWRIGHT_EXTERNAL_SERVER=1` before the runner and it attaches.
- **Only kill the PID you started.** The runner kills its own child handle and nothing else.
  Never sweep port 4173 and never kill node processes by name.
## Phases
- Pass 1 `--grep-invert @performance`, fully parallel.
- Pass 2 `--grep @performance --workers=1`, only if pass 1 exited 0. Budgets are unreliable
  under parallel load, so keep them tagged `@performance`.
## Real-service specs
`real-ai.spec.ts` and `real-radio.spec.ts` are excluded by `testIgnore` unless enabled: `--real-ai`
sets `CODEXRAY_REAL_AI=1`, `--real-radio` sets `CODEXRAY_REAL_RADIO=1`, each un-ignoring exactly
one file. They hit live services; never add them to the default run.
