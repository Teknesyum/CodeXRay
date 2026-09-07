# H26 — The interval that outlived its test

## Turn

- Route: `docs/titan/routes/R26-red-on-a-commit-that-changed-no-source.md`
- Base SHA: `a3b577e`
- End SHA: `9fcdfa5550173408dabfc4177ae9763a5348bbad`
- Status: `closed`
- Next holder: Claude (T0)

## Özet

CI'ın `TitanProgress.test.tsx`'e yazdığı sahipsiz `ReferenceError: window is not defined`
hatası 35 tam koşuda **0** kez tekrarlanmadı; sayı budur, gerisi tahmin olurdu. Bunun
yerine sızıntı mekanizması ölçülerek kanıtlandı: vitest'in jsdom ortamında
`window.setInterval` aslında Node'un `setInterval`'ı olduğu için `dom.window.close()` onu
durdurmuyor, dolayısıyla unmount edilmeyen bir `TitanModeProgress` 250 ms'lik interval'ını
teardown'dan sonra da çalıştırmaya devam ediyor.

İki test dosyası (`TitanProgress.test.tsx`, `ProblemRichText.test.tsx`) render ettiği ağacı
hiç unmount etmiyordu; ikisine de `cleanup()` eklendi. Ayrıca `src/test/setup.ts` içine bir
teardown dedektörü kuruldu: bundan sonra sızdıran interval, dosyalar arası bir yan etki
olarak değil, **kendi testinin adıyla** aynı dosyada patlıyor.

Kriter 7 için iddia: **muhtemelen düzeltildi** — kanıtlanmış değil. Gerekçesi aşağıda,
`## Acceptance` 7. maddede.

## What changed

| path:line-range | intent | added, edited or deleted |
| --- | --- | --- |
| `src/test/timerLeakDetector.ts:1-84` | teardown-time interval leak detector, host-injected so it is testable without jsdom | added |
| `src/test/timerLeakDetector.test.ts:1-91` | 5 tests: names the leaking test, stays silent when cleared, reports once then forgets, throws on a post-teardown fire, restores host timers | added |
| `src/test/setup.ts:1-4,26-39` | installs the detector against `globalThis` and throws in `afterEach` when an interval survived the test | edited |
| `src/components/TitanProgress.test.tsx:1-6` | `afterEach(() => cleanup())` — the file rendered a plan with a `running` job three times and never unmounted it | edited |
| `src/components/ProblemRichText.test.tsx:1-6` | `afterEach(() => cleanup())` — leaked DOM made `getAllByRole('math')` order-dependent | edited |

## Commits

- `5d680d4` route(R26): open
- `9fcdfa5` route(R26): close

## Gate output

Test counts, separately:

- before the turn (`a3b577e`): `Test Files  119 passed (119)` / `Tests  890 passed (890)`
- after the turn (`9fcdfa5`): `Test Files  120 passed (120)` / `Tests  895 passed (895)`
- delta: +1 file, +5 tests — `src/test/timerLeakDetector.test.ts`

### `npm run lint` — exit 0

```
> codexray@2.3.4 lint
> oxlint
```

### `npm run test:coverage` — exit 0

```
> codexray@2.3.4 test:coverage
> vitest run --coverage


 RUN  v4.1.10 C:/Users/Administrator/Desktop/Projeler/CodeXray
      Coverage enabled with v8


 Test Files  120 passed (120)
      Tests  895 passed (895)
   Start at  20:57:06
   Duration  23.29s (transform 6.21s, setup 28.01s, import 18.36s, tests 57.86s, environment 164.78s)
```

```
=============================== Coverage summary ===============================
Statements   : 82.23% ( 11104/13503 )
Branches     : 72% ( 7908/10982 )
Functions    : 82.66% ( 2131/2578 )
Lines        : 84.77% ( 9613/11340 )
================================================================================
```

### `npm run build` — exit 0

```
> codexray@2.3.4 build
> tsc -b && vite build && node scripts/check-build-size.mjs

vite v8.1.5 building client environment for production...
transforming...✓ 1888 modules transformed.
rendering chunks...
computing gzip size...
✓ built in 409ms
Initial JavaScript: 418.3 / 420.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
```

### `npm run desktop:check` — not run

`src-tauri/**` did not change; see `## Diff scope`.

### `npm run test:e2e` — exit 0 on the second attempt

Run with the external-server procedure in `AGENTS.md`.

```
Running 77 tests using 8 workers
  77 passed (1.1m)
Running 2 tests using 1 worker
  2 passed (34.0s)
```

The first attempt failed one test, and it is reported here rather than hidden:

```
  1) [chromium] › e2e\radio-controller.spec.ts:3:1 › honors confirmed playback, transport, audio, loop, and minimize contracts

    Test timeout of 30000ms exceeded.

    Error: locator.hover: Test timeout of 30000ms exceeded.
    Call log:
      - waiting for getByRole('complementary', { name: 'Radio' })
        - locator resolved to <aside aria-label="Radio" class="playlist-radio">…</aside>
      - attempting hover action
        - waiting for element to be visible and stable
        - element is visible and stable
        - scrolling into view if needed
        - done scrolling
        - <h2>Variables & Trace</h2> from <div class="split-layout">…</div> subtree intercepts pointer events

      170 |     .toContain('PL_CUSTOM_FAST_LOAD');
      171 |   await page.getByRole('button', { name: 'Close settings' }).click();
    > 172 |   await radio.hover();
          |               ^

  1 failed
  76 passed (1.2m)
```

Re-run of that spec alone:

```
Running 1 test using 1 worker
  ok 1 [chromium] › e2e\radio-controller.spec.ts:3:1 › honors confirmed playback, transport, audio, loop, and minimize contracts (6.8s)

  1 passed (7.2s)
```

This failure cannot come from this turn's change: Playwright never loads
`src/test/setup.ts` — it is a vitest `setupFiles` entry only — and the other three touched
files are vitest test files that the browser suite does not import. It is a pointer-interception
timing flake under 8-worker load, and it is a **second** flake in this repository, not the one
R26 is about. It is listed in `## Discovered`.

## Acceptance

**1. The reproduction attempt is reported as a count: how many full runs, under which pool and
ordering settings, and how many reproduced. A zero is a valid answer and must be stated as a
number, not as prose.** — **met.**

| configuration | full runs | nonzero exits | runs containing `window is not defined` |
| --- | --- | --- | --- |
| `npm run test:coverage`, default pool and ordering | 20 | 0 | **0** |
| `--sequence.shuffle.files` | 5 | 0 | **0** |
| `--sequence.shuffle` | 5 | 4 | **0** |
| `--pool=threads --no-file-parallelism --no-isolate` | 5 | 5 | **0** |
| **total** | **35** | 9 | **0** |

Grading is on `grep -l "window is not defined" run-*.log`, not on the exit code, because the
route's loop counts any nonzero exit and the last two configurations exit nonzero for reasons
that are not this flake:

- `--sequence.shuffle` reorders tests **inside** a file and exposed pre-existing
  order-dependence at `TitanProgress.test.tsx:28`, `ProblemRichText.test.tsx:13`,
  `algorithmCatalog.test.ts:25`, and in `App.test.tsx`. The first two are the same missing
  `cleanup()` this turn fixes.
- `--no-isolate` shares module state across files and breaks 16 unrelated tests
  deterministically. That configuration is **inconclusive**, not a clean zero, and is reported
  as such.

`--poolOptions.threads.singleThread` from the route text does not exist in vitest 4
(`CACError: Unknown option --poolOptions`); the first five attempts under it never ran and were
discarded. `--pool=threads --no-file-parallelism --no-isolate` is the vitest 4 spelling of the
same intent and is what the table reports. See `## Deviations`.

**2. If it reproduced: the leaking file and the leaking call are named, with the evidence that
identifies them — not an inference from the vitest attribution line.** — **met**, and by
measurement rather than by the attribution line, which the route was right to distrust.

The leaking call is `src/components/TitanModeProgress.tsx:137`:

```ts
  useEffect(() => {
    if (!runningTimerKey) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [runningTimerKey]);
```

The component's own cleanup is correct. The leak is that `src/components/TitanProgress.test.tsx`
renders a plan whose `titan-produce` job is `status: 'running'` in all three tests and never
unmounts, so that cleanup never runs. Detector output with the fix temporarily reverted,
`npx vitest run src/components/TitanProgress.test.tsx`:

```
which surfaces as an ownerless "ReferenceError: window is not defined" on an unrelated file.
  every 250 ms, registered by: TitanProgress > keeps cancel, undo, and redo controls keyboard accessible

Error: interval registered here
    at host.setInterval (C:/Users/Administrator/Desktop/Projeler/CodeXray/src/test/timerLeakDetector.ts:46:14)
    at C:/Users/Administrator/Desktop/Projeler/CodeXray/src/components/TitanModeProgress.tsx:137:26
    at Object.react_stack_bottom_frame (node_modules/react-dom/cjs/react-dom-client.development.js:25989:20)
    at commitHookEffectListMount (node_modules/react-dom/cjs/react-dom-client.development.js:13249:29)
    at commitHookPassiveMountEffects (node_modules/react-dom/cjs/react-dom-client.development.js:13336:11)
    at flushPassiveEffects (node_modules/react-dom/cjs/react-dom-client.development.js:18432:9)

 Test Files  1 failed (1)
      Tests  3 failed (3)
```

Why an interval survives at all — this is the part the attribution line cannot tell you, and it
was verified directly, not read off a changelog. Vitest's jsdom environment copies window keys
onto the Node global through `getWindowKeys`, which **skips any key already present on Node's
global** unless it is in its own `KEYS` list. `setInterval` is present on Node's global and is
not in `KEYS`, so `window.setInterval` in a vitest jsdom test **is Node's `setInterval`**. A
probe run at the repo root established this on the running environment:

```
typeof window.setInterval(...) => object
constructor                    => Timeout
window.setInterval === globalThis.setInterval => true
jsdom window own setInterval === global       => false
has unref (node Timeout)       => true
```

Therefore `dom.window.close()` in vitest's `teardown()` does not stop it, and `teardown()` then
deletes `globalThis.window`. A second probe wrote each firing to a file with `appendFileSync`
(vitest swallows `console.log`) and caught the window closing:

```
t+69ms TEST BODY ENDED
t+70ms window=object
t+71ms window=object
t+73ms window=undefined
```

The post-teardown window before the worker exits is roughly 2 ms wide. A 250 ms interval landing
inside a ~2 ms gap is the right order of magnitude for the route's observed 1-in-40.

`src/components/ProblemRichText.test.tsx` was found by the same detector run: no timer, but
leaked DOM that makes `screen.getAllByRole('math')` order-dependent. Fixed identically.

**3. If it did not reproduce: teardown instrumentation exists that would name the offending test
the next time, and its output on a deliberately leaked timer is shown.** — **met**, by
`src/test/timerLeakDetector.ts:31-82` installed at `src/test/setup.ts:27-39`, and by the output
quoted verbatim under criterion 2, which is exactly a deliberately re-introduced leak on a real
file. The detector wraps `setInterval` to record the registering test name, delay, and stack;
wraps the callback so a firing after `globalThis.window` is gone throws
`A leaked interval fired after its test environment was torn down.` naming the registering test;
and reports in `afterEach`. It is directly unit-tested against an injected host at
`src/test/timerLeakDetector.test.ts:22-90` (5 tests), so its own behaviour does not depend on
reproducing the flake.

Note on a correctness bug in the first version of the detector, because it changes what its
silence means: ids were typed `number` and cleared with `if (typeof id === 'number')`, which is
never true for a Node `Timeout` object, so nothing was ever deregistered and a full run produced
41 false positives. `TimerId` is now `unknown` and `clearInterval` deletes unconditionally
(`timerLeakDetector.ts:66-69`). The clean run reported below is from the corrected version.

**4. Every leak found is fixed at its source, or documented in the handoff with the reason it was
left.** — **met.** With the corrected detector armed, a full `npm run test` reported leaks from
**no** product test file; the only two failures were my own temporary probe files, which have
since been deleted:

```
 Test Files  2 failed | 122 passed (124)
      Tests  2 failed | 897 passed (899)
```

Both were `probe repro` (`40 interval timer(s) ... every 250 ms`) and `probe survive`
(`1 interval timer(s) ... every 1 ms`). The clean gate run under `## Gate output` — 120 files,
895 tests, zero failures, detector armed — is the standing proof that no leak is left behind.

**5. `npm run test:coverage` — the exact CI command — passes locally, with output.** — **met**;
output verbatim under `## Gate output`.

**6. The suite is not quieter than before: no threshold lowered, no error report suppressed, no
test skipped or deleted. Show the diff proves it.** — **met.**

```
PS> Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'dangerouslyIgnoreUnhandledErrors'
PS>
```

Zero matches at HEAD, and zero at base:

```
PS> git grep -n "dangerouslyIgnoreUnhandledErrors" a3b577e -- "src/*.ts" "src/*.tsx" | Measure-Object | Select-Object -ExpandProperty Count
0
```

The `.skip(|.todo(` grep, as a delta rather than a snapshot, as the route requires:

```
PS> Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern '\.skip\(|\.todo\(' | Measure-Object | Select-Object -ExpandProperty Count
0
PS> git grep -n --extended-regexp "\.skip\(|\.todo\(" a3b577e -- "src/*.ts" "src/*.tsx" | Measure-Object | Select-Object -ExpandProperty Count
0
```

Base 0, HEAD 0, delta 0. `vitest.config.ts` is untouched:

```
PS> git diff "a3b577e..HEAD" -- vitest.config.ts
PS>
```

The test count went **up** by 5 and the suite gained a new failure mode it did not have before —
a leaked interval is now a hard `afterEach` throw naming its own test. This turn makes the suite
strictly louder.

**7. (T0) The handoff states whether the CI flake is proven fixed, probably fixed, or not fixed.
Those are three different claims; pick one and defend it.** — **probably fixed.**

Defended, and the boundary stated rather than blurred:

What is proven. `TitanProgress.test.tsx` leaked a 250 ms interval (criterion 2's detector
output). A leaked interval in this environment is Node's, survives `dom.window.close()`, and
keeps firing for a ~2 ms window after `globalThis.window` is deleted (the two probes). That leak
is gone, and the detector says no other product test leaks one.

What is not proven. That the specific `ReferenceError: window is not defined` in CI run
`34145241129` came from **this** leak. The leaked callback is `() => setNow(Date.now())`, which
does not itself dereference `window`; it schedules React work whose flush would. Ten runs of a
40-mount probe under the original setup produced **0** occurrences of the error, so the last
link — leak fires post-teardown → that specific `ReferenceError` — is argued, not measured.

Why not "not fixed": a real leak of exactly the shape the symptom requires was found on exactly
the file CI named, and removed. Why not "proven": the CI event was never reproduced, in 35 runs
or in a targeted probe. If the flake recurs, the detector now converts it from an ownerless
cross-file report into a named same-file failure, which is the difference this turn actually
guarantees.

**8. `npm run lint`, `npm run test`, `npm run build` pass. `desktop:check` if `src-tauri/**`
changed.** — **met**; `## Gate output`. `src-tauri/**` did not change, so `desktop:check` was not
run.

**9. e2e passes.** — **met**; `77 passed (1.1m)` under `## Gate output`, with the first
attempt's single unrelated flake reported there in full rather than dropped.

**10. No frozen or T0-owned path is written. `git diff --name-only a3b577e..HEAD` proves it.** —
**met**; `## Untouched`.

**11. Every commit DCO-signed as `Mustafa Özel <iyott131@gmail.com>`.** — **met.**

```
PS> git config user.email
iyott131@gmail.com
PS> git log -1 --format=%H
9fcdfa5550173408dabfc4177ae9763a5348bbad
PS> git log --format="%h %s%n%(trailers:key=Signed-off-by)" a3b577e..HEAD
9fcdfa5 route(R26): close
Signed-off-by: Mustafa Özel <iyott131@gmail.com>

5d680d4 route(R26): open
Signed-off-by: Mustafa Özel <iyott131@gmail.com>
```

## Diff scope

```
PS> git diff --stat "a3b577e..HEAD"
 .../R26-red-on-a-commit-that-changed-no-source.md  | 220 +++++++++++++++++++++
 src/components/ProblemRichText.test.tsx            |   6 +-
 src/components/TitanProgress.test.tsx              |   6 +-
 src/test/setup.ts                                  |  16 ++
 src/test/timerLeakDetector.test.ts                 |  91 +++++++++
 src/test/timerLeakDetector.ts                      |  84 ++++++++
 6 files changed, 419 insertions(+), 4 deletions(-)
```

`R26-...md` is T0's own route-open commit `5d680d4`, inside the base..HEAD range because the base
SHA names the commit before it. Sole wrote none of it.

## Deviations

1. **`src/test/timerLeakDetector.ts` and `src/test/timerLeakDetector.test.ts` are outside
   `## Expected Files`.** The forecast named `src/test/setup.ts` as "where a leak detector would
   live". Putting the detector's body inline in `setup.ts` would have made it untestable: it
   needs an injected timer host and an injected teardown predicate to be exercised without a
   real jsdom teardown. Criterion 3 asks for instrumentation that "would name the offending test
   the next time" — a claim that needs its own tests, so it needs its own module. `setup.ts` now
   holds only the wiring. Precedent for the location: `src/test/progressWatchdog.ts` and its
   test already sit there, and `src/test/**` is excluded from coverage, so this adds no coverage
   pressure.

2. **`src/components/ProblemRichText.test.tsx` is outside `## Expected Files`.** The forecast
   allowed "whichever test file is proven to leak", singular. The detector proved two. Criterion
   4 requires every leak found to be fixed at its source, so leaving the second would have failed
   the route.

3. **`--poolOptions.threads.singleThread` from `## The decision` was not used.** It does not
   exist in vitest 4.1.10 and errors with `CACError: Unknown option --poolOptions` before any
   test runs. Substituted `--pool=threads --no-file-parallelism --no-isolate`, which is the same
   intent in the current CLI. Reported in criterion 1's table under its real name, with the
   `--no-isolate` result marked inconclusive rather than counted as a clean zero.

4. **Reproduction was graded on log content, not on the exit code the route's loop uses.** The
   route's snippet counts any nonzero exit as a reproduction. Two of the four configurations exit
   nonzero for unrelated, deterministic reasons, so that count would have reported 9
   reproductions where the real number is 0. Graded on
   `grep -l "window is not defined" run-*.log` instead. Both numbers are in the table.

5. **35 full runs rather than the route's 20.** The route bounds A at twenty and then allows B.
   Twenty default runs were completed first and produced 0; the additional 15 were the ordering
   and pooling variants `## The decision` also names. B was taken, as the route directs.

## Discovered

1. **`window.setInterval` is not jsdom's in this test environment.** Vitest's `getWindowKeys`
   omits any global Node already defines unless it is in `KEYS`; `setInterval` qualifies. Any
   test-hygiene reasoning that assumes `dom.window.close()` stops timers is wrong in this repo.
   The same argument applies to `setTimeout` — this turn instruments intervals only, because only
   an interval refires.

2. **A second, unrelated flake exists.** `e2e/radio-controller.spec.ts:172`'s `radio.hover()`
   times out under 8-worker load when the `Variables & Trace` heading intercepts pointer events;
   it passes alone and passed on re-run. Not touched by this route.

3. **Vitest hook ordering makes this detector work.** `getSuiteHooks` reverses `afterEach` when
   `sequence.hooks === 'stack'`, so `setup.ts`'s `afterEach` — registered first — runs **last**,
   after each file's own `afterEach(cleanup)`. A detector registered any other way would report
   every RTL render as a leak. This is load-bearing and undocumented; do not move that hook.

4. **`--sequence.shuffle` fails on `algorithmCatalog.test.ts:25` and in `App.test.tsx` for
   reasons unrelated to timers.** Real order-dependence in the suite, left in place: fixing it is
   outside this route's criteria and would have made the diff argue for two things at once.

5. **The `Retrying loadCatalog for bad... Error: Invalid schema for catalog bad` line in the CI
   log is expected noise**, emitted by a passing negative-path test through
   `src/services/algorithmCatalog.ts:49`. It is not related to the flake, as the route suspected.

## Untouched

```
PS> git diff --name-only "a3b577e..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/AGENTS\.md$|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$'
PS>
```

Zero matches. `docs/titan/routes/R26-...md` appears in the range but was written by T0 in
`5d680d4`; the only Sole commit, `9fcdfa5`, touches five `src/**` files and nothing else.

All temporary probe files (`probe-*.test.ts[x]`, `probe-setup.ts`, `probe-vitest.config.ts`),
all `run-*.log`, all `probe-*.log`, and `test-results/` were deleted before committing.
`git status --porcelain` at the close shows only pre-existing untracked entries
(`.claude/`, `CodeXray-readme-neon.svg`, `docs/TITAN_MODE_YOL_HARITASI.md`).

## Blockers

1. **Criterion 7 is `(T0)`.** The claim written above is "probably fixed". Only CI can move it to
   "proven": the honest close is that R26 removed a leak of the right shape on the right file and
   made the next one self-identifying, and that the CI event itself was never reproduced. If T0
   wants "proven", the evidence has to come from CI runs after this lands, not from another local
   loop — 35 runs already produced 0.

2. **`AGENTS.md` needs a line and T0 owns it.** Nothing in the guide currently says that
   `src/test/setup.ts` throws on a surviving interval, or that a component test rendering a
   `running` Titan plan must unmount. The next agent that adds such a test will hit the throw
   with no documented explanation.

## For the human

1. Push is T0's. `9fcdfa5` is committed on `main` and not pushed.
2. The suite is now stricter: any test that renders a component with a live interval and does not
   `cleanup()` fails immediately, in its own file. That is intended.
3. `e2e/radio-controller.spec.ts` flaked once under load and passed on re-run. It is a separate
   flake from R26's and is recorded in `## Discovered` rather than fixed here.
