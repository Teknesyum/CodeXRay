# R26 — red on a commit that changed no source

## Özet

CI, hiçbir kaynak dosyası değiştirmeyen bir commit'te kırmızıya döndü. `ea3b2d5` yalnız bir
rota belgesi ekliyor; ebeveyni `590f4bd` yeşildi. `quality` işi düştü ve düşme sebebi bir test
değil — 119 test dosyasının hepsi geçtikten sonra vitest'in yakaladığı **tek bir sahipsiz hata**:
`ReferenceError: window is not defined`.

Bu, jsdom ortamı yıkıldıktan sonra hâlâ çalışan asenkron bir işin imzasıdır. Vitest hatayı o
sırada koşan dosyaya yazar, hatayı **çıkaran** dosyaya değil — vitest bunu kendi çıktısında
söylüyor. Yani `TitanProgress.test.tsx` büyük olasılıkla kurban, fail değil.

Ölçülen sıklık: son 40 koşuda 1. Yerelde `npm run test:coverage` bir kez çalıştırıldı,
üretilmedi (890 geçti).

Bu turun asıl işi düzeltmek değil **sızıntının kaynağını kanıtlamak**. Kaynak bilinmeden
yazılacak düzeltme, yeşil bir süiti yeşil olduğu için doğru sanmaktır — bu depoda son altı turda
tekrar eden hatanın tam şekli.

## Objective

Find what keeps running after its test environment is gone, and make the suite say so
deterministically.

### The measurement

CI run `34145241129`, job `quality`, step `npm run test:coverage`, exit 1. Verbatim, ANSI
stripped:

```
Test Files  119 passed (119)
⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯
Vitest caught 1 unhandled error during the test run.
This might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.
ReferenceError: window is not defined
This error originated in "src/components/TitanProgress.test.tsx" test file. It doesn't mean the
error was thrown inside the file itself, but while it was running.
     Errors  1 error
##[error]Process completed with exit code 1.
```

The commit under test:

```
ea3b2d5 route(R25): open      — docs/titan/routes/R25-four-of-eleven-never-match.md, 1 file
590f4bd (parent)              — CI run 34144922126, success
```

**No source file differs between the green parent and the red child.** Whatever failed was
already present and did not fail the run before.

Frequency, measured over the last 40 runs on `main`:

```
gh run list --limit 40 --json databaseId,headSha,conclusion \
  | failures -> 34145241129 ea3b2d5 only
```

One in forty. Not reproduced locally in one full `npm run test:coverage` (`119 passed`,
`890 passed`).

Also in that CI log, and **not** the failure — say so in the handoff so nobody chases it:

```
Retrying loadCatalog for bad... Error: Invalid schema for catalog bad
```

That is `algorithmCatalog.ts:49` on its retry path, exercised deliberately by a test. Expected
noise.

### Why the attributed file is probably not the culprit

Every test file runs under `environment: 'jsdom'` (`vitest.config.ts`). `window is not defined`
therefore cannot mean "this file had no DOM"; it means the DOM was **torn down** while a task
was still pending. Vitest attributes such an error to whichever file the worker happened to be
running, which changes with scheduling — which is exactly why it can appear on a docs-only
commit and vanish locally.

Candidates, named as candidates and not as findings. Do not assume one is right; measure.

- `src/context/TimelineContext.tsx:596` — `window.setInterval` in an effect, cleared at `:610`.
  Correct if the effect's cleanup runs; a test that never unmounts leaks it.
- `src/services/titanUiControl.ts:7` — `window.dispatchEvent` reached from pipeline code that a
  test may start and not await.
- `src/services/desktopSecurity.ts:12-13` — `window.location` inside a document-level handler.

## Turn

- `Turn.holder`: T0-delegated implementer
- `Turn.base`: `a3b577e`
- `Turn.branch`: `main`

`git merge-base --is-ancestor a3b577e HEAD` must exit 0, and `git diff --name-only a3b577e..HEAD`
must list only T0-owned paths before you write.

## Expected Files

A forecast, not a gate.

- `src/test/setup.ts` — where a leak detector or an unhandled-rejection assertion would live.
- Whichever test file is proven to leak.
- `vitest.config.ts` — only if the fix is a configuration one and the handoff argues why.

## Invariants

- **Do not make the suite quieter.** Suppressing the unhandled-error report, lowering coverage
  thresholds, or setting `dangerouslyIgnoreUnhandledErrors` is a failure of this route, not a
  fix. The signal is correct; CI was right to go red.
- No production behaviour changes to make a test pass. If a leak is in production code, fix the
  leak, and say in the handoff what user-visible behaviour it corresponds to.
- Determinism as ever: no `Math.random`, no wall-clock branching in simulation, trace, or
  pipeline code.
- Do not retitle, skip, or delete a test to make this go away.
- No frozen or T0-owned path: `.claude/**`, `.agents/AGENTS.md`, `docs/tasks/**`,
  `docs/legacy/**`, `CodeXray-readme-neon.svg`, `docs/TITAN_MODE_YOL_HARITASI.md`,
  `docs/titan/routes/**`, `AGENTS.md`.

## The decision

**Option A — reproduce first, then fix.** Force the scheduling that produces it: run
`npm run test:coverage` repeatedly, and separately run vitest with a shuffled file order and
with `--pool=threads --poolOptions.threads.singleThread` and its opposite, to vary which files
share a worker. Once it reproduces, bisect to the file that leaks by running that file's
neighbours together. Fix the leak at its source.

Cost: unbounded in the worst case; a 1-in-40 event may need many runs. Bound it: **twenty full
runs is enough attempts.** If it has not reproduced by then, take B and say so with the count.

**Option B — make the leak detectable without reproducing the flake.** Add teardown
instrumentation in `src/test/setup.ts`: in `afterEach`, assert that no timer, interval, or
pending `window` listener registered during the test is still live, and name the test that left
it. This converts an occasional cross-file symptom into a deterministic same-file failure. Every
leak it finds is a real leak whether or not it is *the* leak.

Risk, stated plainly: B may find several leaks and none of them the one in the CI log, and the
route must not then claim the flake is fixed. B's honest close is "these leaks existed and are
now gone; the CI flake is not proven to be one of them."

**Option C — accept it and retry CI.** Rejected. A suite that is green by scheduling luck tells
you nothing on the run where it matters, and this repository has spent six turns on gates that
said more than they established.

**T0 reading, not binding: A for twenty runs, then B.** B alone is acceptable if A's twenty runs
produce nothing — report the count either way. Do not take C.

## Acceptance Criteria

1. The reproduction attempt is reported as a **count**: how many full runs, under which pool and
   ordering settings, and how many reproduced. A zero is a valid answer and must be stated as a
   number, not as prose.
2. If it reproduced: the leaking file and the leaking call are named, with the evidence that
   identifies them — not an inference from the vitest attribution line.
3. If it did not reproduce: teardown instrumentation exists that would name the offending test
   the next time, and its output on a deliberately leaked timer is shown.
4. Every leak found is fixed at its source, or documented in the handoff with the reason it was
   left.
5. `npm run test:coverage` — the exact CI command — passes locally, with output.
6. The suite is not quieter than before: no threshold lowered, no error report suppressed, no
   test skipped or deleted. Show the diff proves it.
7. (T0) The handoff states whether the CI flake is **proven** fixed, **probably** fixed, or
   **not** fixed. Those are three different claims; pick one and defend it.
8. `npm run lint`, `npm run test`, `npm run build` pass. `desktop:check` if `src-tauri/**`
   changed.
9. e2e passes.
10. No frozen or T0-owned path is written. `git diff --name-only a3b577e..HEAD` proves it.
11. Every commit DCO-signed as `Mustafa Özel <iyott131@gmail.com>`.

## Verification

PowerShell 5.1. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git config user.email

git diff --name-only "a3b577e..HEAD"

git diff --stat "a3b577e..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'dangerouslyIgnoreUnhandledErrors'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern '\.skip\(|\.todo\('

git diff "a3b577e..HEAD" -- vitest.config.ts

npm run lint

npm run test:coverage

npm run build
```

The sixth grep must be run against the base too, and the two counts compared — a route about not
weakening the suite closes on a delta, not on a snapshot.

Repeat-run loop for criterion 1, adjust the count as the route allows:

```powershell
$reproduced = 0
for ($i = 1; $i -le 20; $i++) {
  npm run test:coverage 2>&1 | Out-File -Append -FilePath "run-$i.log"
  if ($LASTEXITCODE -ne 0) { $reproduced = $reproduced + 1 }
}
"reproduced $reproduced of 20"
```

Delete the `run-*.log` files before committing; they are not evidence to commit, only to read.

e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run created.

## Still deferred after this route

- Structural trace intelligence inert across all 50 catalog algorithms: `sigIsZero=17`,
  `singlePhase=44`, kinds only `mutate`/`statement`, events `none`. Those indices reach the model
  prompt through `aiContext.ts:223` labelled as important steps. The largest remaining route.
- `src/services/trace/traceQuery.ts` has no production consumer.
- `inputRequestAdapter.test.ts:31`'s name has described no production behaviour since R22.
- `titanEntry.ts:130` is the one engine caller outside `PipelineRunId`'s brand.

---

## T0 reconciliation

Closed at `9aad8e5`. Route opened `5d680d4`, closed `9fcdfa5`, handoff `9aad8e5`.
Verified independently by T0.

### Independently confirmed

T0 tested the detector rather than reading about it: removed the added `afterEach(() =>
cleanup())` from `TitanProgress.test.tsx`, ran that file alone, restored it. Verbatim:

```
 ❯ src/components/TitanProgress.test.tsx (3 tests | 3 failed) 118ms
 FAIL  src/components/TitanProgress.test.tsx > TitanProgress > renders exactly five ordered stages and an explicit skipped state in both locales
Error: 1 interval timer(s) were still running when the test finished.
An interval that outlives its test keeps firing after the jsdom environment is torn down,
Error: interval registered here
```

`git diff --stat src/components/TitanProgress.test.tsx` after restoring: empty. That closes
criterion 3 on T0's own evidence, and it closes something the handoff could only assert — the
detector **names the test that leaked**, which is the whole point of B.

Also T0-run: `lint` exit 0, `test:coverage` **120 files / 895 tests passed** (base 119 / 890),
`build` exit 0 within budget. `git diff --name-only a3b577e..HEAD` lists seven files, no frozen
or T0-owned path; the only `docs/titan/routes/` entry is this route from T0's own `5d680d4`.

Criterion 6 checked as a delta, not a snapshot: `.skip(`/`.todo(` count 0 at HEAD,
`dangerouslyIgnoreUnhandledErrors` absent, `git diff a3b577e..HEAD -- vitest.config.ts` empty.
The suite is five tests larger and no quieter.

CI green on `a3b577e` (`34146604596`) and on `5d680d4` (`34146858615`).

### The claim, endorsed as written

Criterion 7 answered **probably fixed**, not proven. T0 endorses that and will not upgrade it.
A real leak of the right shape was found in the right file and removed; the CI `ReferenceError`
itself never reproduced in 35 runs, so the last link — that *this* interval caused *that* error —
is argument, not measurement. The mechanism is sound: under vitest's jsdom, `window.setInterval`
is Node's `setInterval`, `dom.window.close()` does not stop it, and teardown deletes
`globalThis.window`, leaving a ~2 ms window in which a 250 ms interval firing hits a missing
`window`. That is consistent with 1-in-40; it is not proof of it.

If it recurs on CI, this route was wrong and the next one starts from a suite that can now name
its own leaks — which is worth more than the guess.

### What the route got wrong

**The route named a flag that does not exist.** `--poolOptions.threads.singleThread` is vitest 3
syntax; this repository runs vitest 4.1.10, where it is rejected outright:

```
CACError: Unknown option `--poolOptions`
```

I wrote a verification command without running it. The implementer substituted
`--pool=threads --no-file-parallelism --no-isolate` and said so. **A `## Verification` block is
the one part of a route that is executable, and an unexecuted command in it is a defect** — the
same class as R25's Option A draft rejecting a signature it meant to keep, two turns running.

**The route's twenty-run bound was too small to be informative and the implementer was right to
exceed it.** 35 runs across four scheduling configurations, all reported with their
distribution, including four non-zero exits under `--sequence.shuffle` that were unrelated
order-dependencies and correctly not counted — the criterion was scored on
`grep "window is not defined"`, not on exit code. That distinction is the implementer's, not the
route's, and it is the right one.

### What shipped beyond the route

The detector found a **second** leak, in `ProblemRichText.test.tsx`, which nothing in the route
predicted and no CI run has ever attributed to anything. That is B working as intended: it finds
real leaks whether or not they are *the* leak.

`--no-isolate` deterministically breaks 16 tests. Measured in passing, not chased. Not a defect
of this turn; worth knowing before anyone reaches for it as a speed-up.

### Deviations, all accepted

Five, each argued: the detector as its own module rather than inline in `setup.ts`, the second
test file, the vitest 4 flag substitution, scoring by log content rather than exit code, and 35
runs instead of 20. The third and fourth correct the route.

One unrelated e2e flake seen once (`radio-controller.spec.ts`), passing alone and on rerun. Third
sighting of an e2e flake in this relay and still not the same spec twice — the standing rule
holds: not yet a route.

### Recorded

**A verification block is code.** R24 taught that a route must not contradict its own objective;
R25 that measuring the defect is not measuring the fix; R26 adds that the commands a route hands
the implementer must have been run by the person who wrote them. Three turns, three defects in
routes rather than in implementations. The routes are now the weaker half of this relay.
