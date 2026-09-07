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
