# R34 — The Plan That Comes Back After You Cancelled It

## Özet

`AiAssistant.tsx:857` writes the plan to storage **before** the dismissed-run guard on the next
line. A cancelled or dismissed run keeps emitting `onPlan` events while the engine winds down, so
the `removeTitanModePlan` at `:1462` and `:1289` deletes a key that the very next event writes
back. The user cancels, refreshes, and the run is on screen again. Fix the ordering, prove the
key stays gone, and give the cancel path an e2e that survives a reload.

## Turn

- route: R34
- base: `e1c9f3a`
- expected size: ~3 files, 1 close commit
- holder: Sole

```powershell
git merge-base --is-ancestor e1c9f3a HEAD
git diff --name-only "e1c9f3a..HEAD"
```

The first must exit 0. The second must list only T0-owned paths.

## Why

`onPlan` is the engine's progress callback, installed at `AiAssistant.tsx:856`:

```
857  persistTitanModePlan(plan);
858  if (!mountedRef.current || dismissedTitanModeRunsRef.current.has(plan.runId)) return;
```

The guard on `:858` protects `setTitanModePlan` — the on-screen bar — and nothing else. Storage
is written unconditionally, one line earlier, for every event of every run including runs the
user has already thrown away.

Two dismissal paths add a run id to `dismissedTitanModeRunsRef` and then remove its key:

- `:1288-1289` — `dismissTitanModePlan`, the bar's ✕.
- `:1449-1462` — `TitanProgress`'s `onCancel`, which also calls `titanModeRunRef.current?.cancel()`,
  restores the source preview, and writes one last plan with the live jobs marked `cancelled`
  before removing the key.

Neither removal is final: `cancel()` aborts the engine, but abort propagates through the
pipeline's phases, and every phase transition on the way out is another `onPlan`. The `:1455`
sanitize map — the block that rewrites `waiting`/`running`/`retrying` to `cancelled` — is
therefore writing a value that a later event overwrites, and `:1462`'s removal is deleting a key
that a later event recreates. Both are effectively unreachable as *final* state.

What the user sees comes from `AiAssistant.tsx:205-213`, the only reader of a persisted plan: on
mount it takes the newest stored run, drops it if any job is still `waiting`/`running`/`retrying`,
and restores it **only if some job is `failed`**. So the visible symptom depends on where the
cancelled run happened to stop. `AGENTS.md` records that R29 already fixed one half of this — the
pipeline's `catch` published `failed` for an aborted phase, so a cancelled run persisted
`titan-produce: failed` and came back on reload framed as a failure. R29 made the catch publish
`cancelled`. **The write-before-guard is the other half, and R29 did not touch it**: a run whose
engine emits a genuine `failed` on some other job after the user cancels is still stored and still
restored.

This is the last item in R32's `## Still deferred` list and has been carried since.

## Decision

The dismissed-run set becomes authoritative for storage, not only for the bar.

- **`onPlan` checks the guard before it writes.** A run id in `dismissedTitanModeRunsRef` produces
  no `persistTitanModePlan` call at all. The `mountedRef` half of the existing condition governs
  `setTitanModePlan` only — an unmounted component may still have storage written by an in-flight
  event, and changing that is out of scope.
- **The cancel path's final write stays where it is.** `:1455` writes the `cancelled` snapshot and
  `:1462` removes the key; with the guard moved, nothing rewrites it afterwards. Do not delete the
  sanitize map on the grounds that the key is removed straight after — it is the value another
  tab or a later reader would see if `removeTitanModePlan` throws, and its `catch` is silent.
- **The ordering is proven from storage, not from the bar.** The gate is that
  `codexray.titan-mode.run.v1.<runId>` and its index entry are absent after a cancel, and stay
  absent while the engine finishes unwinding.
- **`AiAssistant.tsx:205`'s restore rule does not change.** `AGENTS.md` is explicit: a genuinely
  failed run must still come back, `'cancelled'` is deliberately in neither branch, and
  `e2e/titan-mode-failures.spec.ts` asserts the failed case. Making the reload case pass by
  widening or narrowing that reader is forbidden.

## Yours to judge

- **Where the guard lives.** Either an early return inside `onPlan` before `:857`, or a small
  wrapper (`persistUnlessDismissed`) beside the ref. The wrapper is worth it only if the second
  persist site at `:784` — the `ui-control` immediate plan — needs the same protection; decide
  whether it does and say why. That site writes a plan that is `completed` at creation, so the
  answer may be no.
- **How long "still unwinding" is.** The e2e must not assert absence in a window where nothing has
  been written yet — `AGENTS.md`'s mount-race rule applies with full force here, and this is
  exactly the shape that made `titan-mode-failures.spec.ts:3` a false pass for four routes.
  Measure when the last `onPlan` after a cancel actually lands, put the number in the handoff, and
  make the assertion outlast it.
- **Whether a unit test can carry any of this.** `titanModeRunStore.ts` takes an injectable
  `Storage`, so the store half is unit-testable. The user-visible half is not: criterion 3 is a
  reload.

## Read first

- `src/components/AiAssistant.tsx:856-868` — `onPlan` and the guard.
- `src/components/AiAssistant.tsx:1445-1468` — `onCancel`, the sanitize map, the removal.
- `src/components/AiAssistant.tsx:1282-1292` — `dismissTitanModePlan`.
- `src/components/AiAssistant.tsx:205-213` — the only reader; do not change its rule.
- `src/services/titanModeRunStore.ts:26-77` — persist / load / remove, index of 8, silent catches.
- `AGENTS.md`, the `titanPipeline.ts` paragraph — R29's half of this defect and why the reader's
  `failed`-only branch is deliberate.

## Call path

- cancel: `TitanProgress onCancel` → `AiAssistant.tsx:1449` (`dismissed.add`) →
  `titanModeRunRef.current?.cancel()` → `:1455` persist(cancelled) → `:1462` remove
- the leak: engine unwind → `onPlan` → `AiAssistant.tsx:857` `persistTitanModePlan` (**before**
  the `:858` guard) → key recreated
- reload: `AiAssistant.tsx:206` `loadLatestTitanModePlan` → `:213` restore when any job `failed`
- traversing tests: `e2e/titan-mode-failures.spec.ts`, `e2e/deterministic-template-pipeline.spec.ts`

No criterion that claims user-visible behavior may be closed by a unit test alone.

## Criteria

1. **The defect is reproduced before it is fixed.** An e2e that cancels a running Titan plan,
   reloads, and shows the plan on screen — failing on the base. Paste the failing output and the
   count of `onPlan` events that arrive after `cancel()` on the base, with the elapsed ms of the
   last one.

2. **No dismissed run reaches storage.** After the fix, `sessionStorage` holds no
   `codexray.titan-mode.run.v1.<runId>` for the cancelled run and no index entry for it, asserted
   in the page after the unwind window measured in criterion 1, before any reload.

3. **The reload is clean.** The same e2e as criterion 1 now shows no plan after the reload.
   Positive assertion first (the workspace is usable, the composer is ready), then the absence,
   per the mount-race rule.

4. **A genuinely failed run still comes back.** `e2e/titan-mode-failures.spec.ts` passes with no
   assertion loosened and no change to `AiAssistant.tsx:205-213`. Show the diff of those lines is
   empty.

5. **The cancel path's own state is unchanged where it is correct.** The `:1455` sanitize map and
   `:1462` removal still run; the engine's own cancel path (`titanEngine.ts:691`, `:1674`) is not
   touched.

6. **The second persist site is decided, not ignored.** State whether `AiAssistant.tsx:784`
   (`ui-control`) needs the same guard and why. If it does, it gets one; if not, one sentence of
   evidence.

7. **Store-level coverage.** At least one unit test against `titanModeRunStore.ts` with an
   injected `Storage` proving remove-then-persist leaves the key present — the mechanism this
   route is fixing — so the regression has a cheap gate as well as an expensive one.

8. `lint`, `test`, `build`, `test:e2e` clean; unit count stated against the base's 923 / 123 files,
   e2e against 89 + 2.

9. Close as two commits: `route(R34): close`, then `handoff(H34): record`.

## Expected Files

A forecast, not a gate.

- `src/components/AiAssistant.tsx`
- `src/services/titanModeRunStore.test.ts`
- `e2e/titan-mode-cancel-persistence.spec.ts` (or the name you choose)

## Do not touch

- `src/components/AiAssistant.tsx:205-213` — the restore rule.
- `src/services/titan/titanEngine.ts`, `titanPipeline.ts` — R29 settled the cancel-vs-failed
  publication; this route is the storage ordering only.
- Any budget constant.

## Decided, do not relitigate

- The reader's `failed`-only restore stays. A cancelled run must not come back; a failed run must.
- `removeTitanModePlan`'s silent `catch` stays silent — storage may be unavailable and the live bar
  still works.
- The fix is ordering, not a new storage schema.

## Evidence required

- 1: the failing run's output, the post-cancel `onPlan` count and last-event ms.
- 2: the in-page storage read, verbatim.
- 3, 4: e2e spec names plus the production `file:line` of the guard.
- 6: the sentence, with the `file:line` it rests on.
- 7: test name and the unit-count delta.

## Rollback

Revert `route(R34): close`. The guard returns to its old position and the ghost plan with it;
nothing else depends on the ordering.

## Verification

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e
git diff "e1c9f3a..HEAD" -- src/components/AiAssistant.tsx | Select-String -Pattern 'loadLatestTitanModePlan|latest.jobs'
git diff --name-only "e1c9f3a..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$|^docs/titan/ROADMAP\.md$'
git diff --name-only "e1c9f3a..HEAD" | Select-String -Pattern 'src/services/titan/'
git status --porcelain | Select-String -Pattern 'test-results|dist/|coverage/|probe'
```

The last four must print nothing. e2e defaults to 2 workers; use the external-server procedure in
`AGENTS.md`, clean up only the PIDs this run created, delete `test-results/` before finishing, and
leave no probe file in the tree.

## Out of Scope

- `eventWeight`, `traceQuery.ts`, `inputRequestAdapter.test.ts:31`, `titanEntry.ts` — R35.
- The three slow e2e specs — R36.
- The phase-residual whitelist question from H33 `## Discovered` — unowned, not this route.
- Anything in `docs/titan/ROADMAP.md` below R34.
