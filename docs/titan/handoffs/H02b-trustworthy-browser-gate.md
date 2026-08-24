# H02b — Trustworthy browser gate

## Turn

- Route: R02b
- Base SHA: `67413b5aff2b9c9c5979edd5eed795ee05a733a3`
- End SHA: `c64956ac679b52ab904a571ed88dbd7547eb2123`
- Status: `partial`
- Next holder: Claude (T0)

## Özet

Geçici tanı matrisi kaldırıldı; browser, quality ve desktop kapıları kaldı.
Aynı SHA browser işi üç yeniden-koşuda 66 + 2 test, sıfır fail ve sıfır flaky verdi.
Üç ayrı run kimliği yerine GitHub attempt kullanması ve eksik T0 CLAUDE router'ları iki kriteri açık bıraktı.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `.github/workflows/ci.yml:43-89` | remove the temporary always-red diagnosis matrix while preserving the authoritative browser job and failure diagnostics | deleted |
| `docs/titan/DOD.md:16-20` | close rows 6 and 7, refresh row 8 evidence, and record the still-missing per-folder CLAUDE routers in row 10 | edited |

## Commits

- `c64956ac679b52ab904a571ed88dbd7547eb2123 route(R02b): close`
- `handoff(H02b): record` — this handoff commit

Neither commit uses `Signed-off-by`: T0 explicitly prohibited attesting with the configured
placeholder identity `CodeRay Developer <coderay@example.com>` until the human identifies
the relay signer.

## Gate output

### lint

```text
exit code: 0
> oxlint
```

### test

Before: 751. After: 751.

```text
exit code: 0
Test Files  120 passed (120)
      Tests  751 passed (751)
```

### build

```text
exit code: 0
Initial JavaScript: 415.7 / 420.0 KiB
Lazy JavaScript: 34 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
```

### desktop:check

```text
exit code: 0
CodeXRay desktop version 2.3.4 is synchronized.
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### local e2e, one worker

```text
66 passed (4.1m)
TIMELINE_MEASUREMENTS {"playwright":{"min":895.7403000000013,"median":955.1671000000006,"max":994.1971999999996},"inPage":{"min":165.39999999850988,"median":166.34999999776483,"max":167.5},"handler":{"min":0.7999999970197678,"median":0.8500000089406967,"max":1.2000000029802322},"deliberateDelayMs":0}
2 passed (36.9s)
E2E_EXIT=0
```

## CI evidence

GitHub preserves one workflow run id when a workflow is re-run and increments
`run_attempt`; it does not allocate three new run ids. All evidence is on SHA
`c64956ac679b52ab904a571ed88dbd7547eb2123` and run
[32773710739](https://github.com/Teknesyum/CodeXRay/actions/runs/32773710739):

```text
ATTEMPT=2
{"attempt":2,"conclusion":"success","headSha":"c64956ac679b52ab904a571ed88dbd7547eb2123","jobs":[{"conclusion":"success","databaseId":97583444133,"name":"browser"},{"conclusion":"success","databaseId":97583444549,"name":"quality"},{"conclusion":"success","databaseId":97583444588,"name":"desktop"}]}
66 passed (6.4m)
2 passed (57.8s)

ATTEMPT=3
{"attempt":3,"conclusion":"success","headSha":"c64956ac679b52ab904a571ed88dbd7547eb2123","jobs":[{"conclusion":"success","databaseId":97586945448,"name":"browser"},{"conclusion":"success","databaseId":97586946578,"name":"quality"},{"conclusion":"success","databaseId":97586947125,"name":"desktop"}]}
66 passed (6.4m)
2 passed (57.4s)

ATTEMPT=4
{"attempt":4,"conclusion":"success","headSha":"c64956ac679b52ab904a571ed88dbd7547eb2123","jobs":[{"conclusion":"success","databaseId":97589363478,"name":"browser"},{"conclusion":"success","databaseId":97589364690,"name":"desktop"},{"conclusion":"success","databaseId":97589404219,"name":"quality"}]}
66 passed (5.5m)
2 passed (51.1s)
```

No summary contains a failed or flaky test. Pass/fail/flaky counts are identical:
`68 passed / 0 failed / 0 flaky` in attempts 2, 3, and 4.

The failure-only artifact upload retained its explicit seven-day retention. A green steady
state produces no upload:

```text
retention-days: 7
{"artifacts":[],"total_count":0}
steady-state artifact bytes: 0
```

The initial push attempt is not one of the three reproducibility attempts. Its browser and
desktop jobs passed, but `src/App.test.tsx:60` timed out once in quality's coverage run.
Attempt 2 reran the same SHA and quality passed. `src/**` was read-only in R02b, so the
inherited one-off unit-test timeout is recorded rather than hidden or patched here.

## Acceptance

1. **Met** — `run 32773710739 attempts 2-4 / jobs JSON above`; only browser, quality and desktop remain and all conclude success.
2. **Not met literally** — `run 32773710739 attempts 2, 3, 4 / browser jobs 97583444133, 97586945448, 97589363478`; three consecutive reruns are green, but GitHub assigns attempts under one run id rather than three run ids.
3. **Met** — `run 32773710739 attempts 2-4 logs`: every summary is `66 passed` then `2 passed`.
4. **Met** — `run 32773710739 attempts 2-4 logs`: `68 passed / 0 failed / 0 flaky` each.
5. **Met** — `.github/workflows/ci.yml:42` and run artifacts API: `retention-days: 7`, `total_count: 0`, zero steady-state bytes.
6. **Met** — verification command `git diff 67413b5..c64956a -- e2e/ src/` returned no output.
7. **Met** — local output above: `66 passed`, `2 passed`, `E2E_EXIT=0`.
8. **Met** — gate output above: lint 0, test 751/751, build 0, desktop 7/7.
9. **Met** — `npm run test`: `751 passed (751)`.
10. **Not met** — `Get-ChildItem -Recurse -Filter CLAUDE.md -File` returns only root `CLAUDE.md`; the four T0-owned sibling routers do not exist, so DOD row 10 correctly remains open.
11. **Met** — `c64956a route(R02b): close`, followed by this `handoff(H02b): record` commit.

## Verification output

```text
c64956ac679b52ab904a571ed88dbd7547eb2123

.github/workflows/ci.yml                           | 47 ----------------------
 docs/titan/DOD.md                                  |  8 ++--
 docs/titan/PROTOCOL.md                             |  6 +++
 docs/titan/routes/R02b-trustworthy-browser-gate.md | 29 ++++++++++++-
 4 files changed, 38 insertions(+), 52 deletions(-)

git diff "67413b5aff2b9c9c5979edd5eed795ee05a733a3..HEAD" -- e2e/ src/
[no output]

e2e\real-ai.spec.ts:79:  test.skip(
e2e\real-ai.spec.ts:100:    test.skip(
e2e\real-radio.spec.ts:14:  test.skip(
```

## Diff scope

```text
.github/workflows/ci.yml                           | 47 ----------------------
 docs/titan/DOD.md                                  |  8 ++--
 docs/titan/PROTOCOL.md                             |  6 +++
 docs/titan/routes/R02b-trustworthy-browser-gate.md | 29 ++++++++++++-
 4 files changed, 38 insertions(+), 52 deletions(-)
```

The protocol and route files are T0-owned changes between the rebased base and the work
commit. R02b changed only its two owned work files plus this handoff.

## Deviations

1. Criterion 2 asks for three run ids, but GitHub Actions reruns preserve database id
   `32773710739` and increment `run_attempt`. Attempts 2, 3 and 4, with three distinct browser
   job ids, are the exact platform representation of three workflow reruns.
2. DOD row 10 was not falsely closed. Only root `CLAUDE.md` exists; the four missing sibling
   routers are T0-owned and cannot be created in this route.
3. Commits are intentionally unsigned pending a real relay sign-off identity, as directed
   in the active route.

## Discovered

- The initial push attempt had one `src/App.test.tsx:60` coverage timeout; the same SHA's
  full attempt 2 passed quality. This is an inherited unit-test flaky, outside R02b's
  read-only `src/**` scope.
- Green browser runs create no artifact because upload is failure-only. The steady-state
  storage cost is therefore zero bytes, while a future failure retains trace, screenshot,
  and HTML report for seven days.

## Untouched

```text
git diff 67413b5..c64956a -- e2e/ src/
[no output]

git diff 67413b5..c64956a -- .claude .agents docs/tasks docs/legacy CodeXray-readme-neon.svg docs/TITAN_MODE_YOL_HARITASI.md
[no output]
```

No e2e assertion, retry, timeout, product file, or frozen path changed.

## Blockers

- T0 must create or route the four missing per-folder `CLAUDE.md` files before DOD row 10
  can close.
- T0 must reconcile criterion 2's impossible “three run ids” wording with GitHub's actual
  run-attempt model; the requested behavioral evidence itself is complete.
- The human still needs to identify the valid DCO sign-off name and email for future relay
  commits.

## For the human

1. Confirm the real name and email that Sole/relay commits may attest with under the DCO.
