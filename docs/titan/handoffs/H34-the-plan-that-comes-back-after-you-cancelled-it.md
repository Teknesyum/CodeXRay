# H34 — The Plan That Comes Back After You Cancelled It

- route: R34, base `53edc55` (rebased from `e1c9f3a` in `b47f834`; the teknesyum-ui commits in
  between are outside this route)
- holder: Claude
- close commit: `73a2186 route(R34): close`

## Criteria

1. **Reproduced on the base.** `e2e/titan-mode-cancel-persistence.spec.ts` failed before the fix.
   Five storage writes to the cancelled run's key after `cancel()`; the last at **81 ms**.

   ```
   R34 post-cancel writes for titan-pipeline-28bdcfc2-834d-4842-9e6f-44d0e7c394eb: [{"ms":69,"failed":false},{"ms":81,"failed":false},{"ms":81,"failed":false},{"ms":81,"failed":false},{"ms":81,"failed":false}]
   R34 storage after unwind: run=present index=["titan-pipeline-28bdcfc2-834d-4842-9e6f-44d0e7c394eb"]
       Error: expect(received).toBeNull()
     1 failed
       [chromium] › e2e\titan-mode-cancel-persistence.spec.ts:8:1 › a cancelled Titan run never returns after a reload
   ```

   The recreated plan has every job `completed` or `cancelled` and none `failed` (R29's half holds),
   so on this worker mock the reader at `AiAssistant.tsx:205-213` does not restore it. The failure
   is therefore on the storage key, not on screen. The route asked for an on-screen failure on the
   base; that requires a job that genuinely fails after the cancel, and no current producer emits
   one here. See `## Deviations`.

2. **No dismissed run reaches storage.** After the 1500 ms window (18× the measured 81 ms), in
   the page, before any reload:

   ```
   R34 post-cancel writes for titan-pipeline-07e7d410-69c3-423c-9da1-1ac14a7384c2: [{"ms":96,"failed":false}]
   R34 storage after unwind: run=null index=[]
   ```

   The one remaining write is the cancel path's own sanitized `cancelled` snapshot, removed
   straight after by `removeTitanModePlan`.

3. **Clean reload.** Same spec: after the reload it waits for the question box to be enabled, then
   waits 1500 ms (beyond the 312–347 ms lazy-panel mount recorded in `AGENTS.md`), then asserts
   `.titan-mode-progress` is absent. Guard: `src/components/AiAssistant.tsx:858`.

4. **A failed run still comes back.** `e2e/titan-mode-failures.spec.ts` passes unchanged.
   `git diff 53edc55 -- src/components/AiAssistant.tsx | Select-String 'loadLatestTitanModePlan|latest.jobs'`
   printed nothing.

5. **Cancel path unchanged.** The sanitize map and `removeTitanModePlan` in `onCancel` are
   untouched; `git diff --name-only 53edc55 | Select-String 'src/services/titan/'` printed nothing.

6. **`ui-control` needs no guard.** `AiAssistant.tsx:785` persists a plan whose every job is
   `completed` at creation (`:776`), synchronously, once, and never before a dismissal can exist
   for its run id — there is no later event to resurrect it.

7. **Store-level coverage.** `titanModeRunStore.test.ts` › "lets a persist after a remove recreate
   the run, so callers must not persist dismissed runs", with an injected `Storage`. Units
   923 → 924, files 123 → 123.

8. **Gates.**

   ```
   == lint
   > codexray@2.3.4 lint
   > oxlint
   == test
    Test Files  123 passed (123)
         Tests  924 passed (924)
   == build
   Styles: 114.5 / 115.0 KiB
   == e2e
     90 passed (3.1m)
     2 passed (40.6s)
   ```

   e2e 89 + 2 → 90 + 2: the new spec.

9. `route(R34): close` then this record.

## Verification

`frozen` and `titan` checks printed nothing; `git status --porcelain | Select-String 'test-results|dist/|coverage/|probe'`
printed nothing after `test-results/` was deleted.

## Deviations

- The base was moved from `e1c9f3a` to `53edc55` by a route commit, because the teknesyum-ui
  work landed after the route opened and touched non-T0 paths.
- Criterion 1 fails on storage, not on screen; see criterion 1.
- `.claude/teknesyum-ui.json` shows as modified from the tool, not from this route; not committed.
