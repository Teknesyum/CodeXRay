# R01 Record Truth

## Özet

Kabul matrisi olmayan üç dosya adına atıf yapıyor; ikisi başka adla var, biri gerçek boşluk.
Bu rota matrisi gerçeğe bağlar, testsiz kalan `tracerWorkerClient` için test yazar, altı
`god-mode` adlı e2e dosyasını `git mv` ile Titan adlarına taşır ve i18n anahtarlarını düzeltir.

## Turn

- Route id: `R01`
- Base SHA: `4a712036cfe7455641553ff7cce62b2d22a5ee48`
- Expected turn size: 14-18 files touched, 1 commit
- Holder: `sole`

## Objective

Make the project's own measurement instruments truthful before any behavioural route runs.
Three things are currently false or missing: the acceptance matrix points at test files that
do not exist, `src/services/trace/tracerWorkerClient.ts` is the only untested module in
`src/services/trace/`, and six e2e specs still carry the retired "god mode" name in their
filenames. Additionally, EN/TR key parity in `src/i18n/translations.ts` is asserted nowhere.

## Read first

| Path | Why |
|---|---|
| `docs/TITAN_ACCEPTANCE_MATRIX.md` | The file being corrected; row 1 holds the three wrong names |
| `src/services/trace/jsTracer.test.ts` | Real name behind the matrix's `interpreter.test.ts`; also the house test style for this folder |
| `src/services/trace/leetcodeAcceptance.test.ts` | Real name behind the matrix's `acceptance.test.ts` |
| `src/services/trace/tracerWorkerClient.ts` | 44 lines, module under test; note the module-level `worker` singleton and the `pending` map |
| `src/services/trace/types.ts` | `TracerWorkerRequest` / `TracerWorkerResponse` shapes needed to fake the worker |
| `src/i18n/translations.test.ts` | Existing i18n suite; the parity test goes here or beside it |
| `src/i18n/translations.ts` | `godAgent*` keys live at lines 207-239 (EN) and 561-... (TR) |
| `src/components/TitanModeProgress.tsx` | Line 31 builds the key prefix: `const agentKey = (role: string) => \`godAgent_${role}\`;` |
| `scripts/requirements-coverage.test.ts` | Lines 14, 17, 36, 37, 59, 61 reference the six e2e filenames; renaming without updating this file breaks `npm run test` |

Do not scan the repository beyond these files. Everything R01 needs is listed above.

## Owned Files

- `docs/TITAN_ACCEPTANCE_MATRIX.md`
- `src/services/trace/tracerWorkerClient.test.ts` (new)
- `src/i18n/translations.ts`
- `src/i18n/translations.test.ts` (or a new sibling test file under `src/i18n/`)
- `src/components/TitanModeProgress.tsx`
- `scripts/requirements-coverage.test.ts`
- `e2e/god-mode-clarification.spec.ts` → renamed
- `e2e/god-mode-failures.spec.ts` → renamed
- `e2e/god-mode-user-graph.spec.ts` → renamed
- `e2e/model-authored-god-mode.spec.ts` → renamed
- `e2e/interval-dp-god-mode.spec.ts` → renamed
- `e2e/dp-family-god-mode.spec.ts` → renamed

## Do not touch

- `.claude/**`
- `.agents/AGENTS.md`
- `docs/tasks/**`
- `docs/legacy/**`
- `CodeXray-readme-neon.svg`
- `docs/TITAN_MODE_YOL_HARITASI.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/titan/PROTOCOL.md`
- `docs/titan/routes/**`

## Invariants

- No production behaviour changes. The rendered UI strings, the trace output, and the worker
  protocol are byte-identical before and after this route.
- The i18n rename is mechanical: every `godAgent*` key becomes `titanAgent*`, the values on
  both sides stay exactly as they are, and the EN and TR sides are renamed in lockstep.
- Renames use `git mv`. Deleting a file and creating a new one loses history and is rejected.
- The matrix may only cite paths that exist on disk. No aspirational filenames.
- No new dependency, no change to `package.json`.
- Every user-facing string added by a new test stays out of the product; tests do not
  introduce translation keys.

## Decided, do not relitigate

- **The matrix name drift is corrected, not papered over.** `interpreter.test.ts` becomes
  `src/services/trace/jsTracer.test.ts` and `acceptance.test.ts` becomes
  `src/services/trace/leetcodeAcceptance.test.ts`. Files are not created to match the matrix;
  the matrix is corrected to match the files. Only the third name
  (`workerClient.test.ts`) is a real gap and is closed by writing
  `src/services/trace/tracerWorkerClient.test.ts` and citing that exact path.
- **The e2e specs move with `git mv`.** History is preserved. Delete-and-recreate is rejected.
- **The i18n key rename is mechanical and behaviour-preserving.** `godAgent_manager` and its
  siblings are renamed only; no label text is rewritten, no key is dropped or added.

## Yours to judge

- The content and depth of `src/services/trace/tracerWorkerClient.test.ts`. Decide how to
  stand in for `Worker` (the module constructs one via `new Worker(new URL(...))`), and which
  paths are worth covering — resolve, reject, worker `error` event fan-out,
  `terminateTracerWorker` rejecting everything pending, request id uniqueness. Cover what you
  can justify; do not chase a coverage number.
- The content and placement of the EN/TR parity test — extend `src/i18n/translations.test.ts`
  or add a sibling file under `src/i18n/`. Either is acceptable.
- The new names of the six e2e specs, provided each drops "god" entirely and reads in Titan
  terminology. Suggested shape (`titan-mode-clarification.spec.ts`,
  `titan-mode-failures.spec.ts`, …) but the exact names are yours.

## Acceptance Criteria

1. `docs/TITAN_ACCEPTANCE_MATRIX.md` row 1 cites `src/services/trace/jsTracer.test.ts`,
   `src/services/trace/leetcodeAcceptance.test.ts`, and
   `src/services/trace/tracerWorkerClient.test.ts`. The strings `interpreter.test.ts`,
   `acceptance.test.ts`, and `workerClient.test.ts` have zero matches in that file.
2. Every path cited anywhere in `docs/TITAN_ACCEPTANCE_MATRIX.md` exists on disk. Prove it
   with the loop in `## Verification`; the output must contain no `MISSING` line.
3. `src/services/trace/tracerWorkerClient.test.ts` exists and passes, covering at minimum a
   successful trace resolution, a rejected trace, and `terminateTracerWorker` rejecting
   in-flight requests.
4. An EN/TR key parity test exists under `src/i18n/` asserting the two locales' key sets are
   exactly equal in both directions, and it fails if a key is added to one side only.
   Demonstrate the failure once locally before committing the passing state.
5. The six e2e specs are renamed via `git mv`. `git log --follow` on each new path reaches
   commits older than this route, proving history survived.
6. `git ls-files e2e/` returns zero filenames matching `god`.
7. `scripts/requirements-coverage.test.ts` references the new e2e filenames and passes. Its
   only remaining `god` match is the `docs/legacy/GOD_MODE_MULTI_AGENT_PLAN.md` pointer on
   line 60, which is a legacy path and stays.
8. `godAgent` has zero matches in `src/**`. The keys are `titanAgent*` in both locales, the
   key count on each side is unchanged, and `src/components/TitanModeProgress.tsx` builds the
   prefix from `titanAgent_`.
9. A case-insensitive `god.?mode` grep over `src/`, `e2e/` (contents and filenames),
   `src-tauri/`, and `docs/titan/` returns 0. In `scripts/` the only permitted match is the
   `docs/legacy/` pointer named in criterion 7. `docs/legacy/`, `docs/tasks/`, `.claude/`,
   and generated `coverage/` output are excluded from this criterion.
10. `npm run test` reports at least 750 passing tests, i.e. at least 3 more than the verified
    baseline of 747, matching the new `tracerWorkerClient` and i18n parity tests.
11. All four gates are clean: `npm run lint`, `npm run test`, `npm run build`,
    `npm run desktop:check`.
12. `npm run test:e2e` passes, and the GitHub Actions `browser` job is green on the branch.
    See `## Inherited breakage` — the suite is red before this route starts, and renaming a
    broken spec is not progress. Diagnose the cause before touching the filenames; if the
    fault turns out to be product logic rather than the specs, stop and report it in
    `## Blockers` instead of expanding the route.
13. The whole route lands as one dedicated commit, subject `route(R01): close`.

## Inherited breakage

The `browser` CI job was already failing when this route was opened. Run 32751560721 on
`main` (2026-08-24, commit `4e99311`) reported **55 passed, 6 failed, 5 flaky** while
`quality` and `desktop` were both green.

Failing specs, by match count in the failure log:

| Spec | Note |
|---|---|
| `e2e/usage-scenarios.spec.ts` | highest match count |
| `e2e/dp-family-god-mode.spec.ts` | also renamed by criterion 5 |
| `e2e/release-tour.spec.ts` | |
| `e2e/god-mode-user-graph.spec.ts` | also renamed by criterion 5 |
| `e2e/god-mode-clarification.spec.ts` | also renamed by criterion 5 |

Every failure shares one symptom — an accessible-label lookup for a running simulation
never resolves:

```
> 69 |   await expect(page.getByLabel('LeetCode 1143 — Longest Common Subsequence execution')).toBeVisible();
Error: element(s) not found
Timeout: 5000ms
```

`e2e/usage-scenarios.spec.ts:85` fails the same way on `LeetCode 322 — Coin Change`.

This was not verified locally: per the protocol, Claude does not run servers or e2e in this
project, so whether the suite also fails on a developer machine is unknown. Establish that
first — a CI-only failure and a universal failure need different fixes.

Three of the five failing specs are ones criterion 5 renames. Fix before renaming, so that
`git log --follow` history and the green state land together rather than a rename burying a
red suite.

## Call path

`n/a — this route changes no user-visible behavior.`

Reason: every change here is documentation accuracy, test coverage, filename hygiene, and a
mechanical i18n key rename whose rendered values are unchanged — no user action reaches new
or altered production logic, so there is no chain to trace.

Template rule, restated so it is not forgotten in later routes: *"Kullanıcıya görünür davranış
iddia eden hiçbir kriter yalnız birim testiyle kapanamaz; `Call path` boş olan rota kabul
edilmez."* This field is filled, not empty; `n/a` is a claim that the route makes no
user-visible behaviour claim, and criterion 8's "values unchanged" requirement is what backs it.

## Evidence required

| Criterion | Evidence type | Pointer form |
|---|---|---|
| 1 | grep output | `Select-String` result over the matrix, verbatim |
| 2 | script output | the path-existence loop output, no `MISSING` line |
| 3 | test run | vitest file line for `tracerWorkerClient.test.ts` with test count |
| 4 | test run + narrative | vitest line for the parity test, plus the deliberate-failure message quoted once in `## Discovered` |
| 5 | git output | `git log --follow --oneline` first and last line per renamed path |
| 6, 7, 8, 9 | grep output | command and its output verbatim, including the empty result |
| 10 | test summary | `npm run test` tail, before and after counts side by side |
| 11 | gate output | exit code plus numeric summary line per gate, verbatim |
| 12 | git output | `git log --oneline <base>..HEAD` showing exactly one commit |

Prose is not evidence. Every row above closes with machine-readable output pasted verbatim
into `docs/titan/handoffs/H01-record-truth.md`.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run each block and paste output verbatim.

```powershell
git log -1 --format=%H

Select-String -Path docs/TITAN_ACCEPTANCE_MATRIX.md -Pattern 'interpreter\.test|acceptance\.test\.ts|workerClient\.test'

$paths = Select-String -Path docs/TITAN_ACCEPTANCE_MATRIX.md -Pattern '`([^`]+\.(ts|tsx|mjs|rs))`' -AllMatches
$paths.Matches | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique | ForEach-Object { if (Test-Path $_) { "OK       $_" } else { "MISSING  $_" } }

git ls-files e2e/ | Select-String -Pattern 'god'

Get-ChildItem -Recurse -Path src, e2e, src-tauri, docs/titan -File | Select-String -Pattern 'god.?mode' -CaseSensitive:$false

Get-ChildItem -Recurse -Path scripts -File | Select-String -Pattern 'god.?mode' -CaseSensitive:$false

Get-ChildItem -Recurse -Path src -File | Select-String -Pattern 'godAgent' -CaseSensitive:$false

Select-String -Path src/i18n/translations.ts -Pattern 'titanAgent' | Measure-Object

npm run lint

npm run test

npm run build

npm run desktop:check

git log --oneline "4a712036cfe7455641553ff7cce62b2d22a5ee48..HEAD"

git diff --stat "4a712036cfe7455641553ff7cce62b2d22a5ee48..HEAD"
```

The e2e suite is run separately, not as a line in the block above. On Windows the
Playwright `webServer` helper can wait on its own child process and produce no output;
use the external-server procedure from `AGENTS.md` and clean up only the PIDs this run
created:

```powershell
$server = Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") `
  -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

Paste the full pass/fail summary line into `## Gate output`, and record the counts both
before and after the route so the inherited 55/6/5 split can be compared.

Per-rename history proof, once for each new e2e path:

```powershell
git log --follow --oneline -- e2e/<new-name>.spec.ts
```

Untouched proof:

```powershell
git diff --stat "4a712036cfe7455641553ff7cce62b2d22a5ee48..HEAD" -- .claude docs/tasks docs/legacy AGENTS.md CLAUDE.md docs/titan/PROTOCOL.md docs/titan/routes
```

That last command must print nothing.

## Rollback

The route is one commit. If any gate fails after commit and the cause is not obvious:

```powershell
git revert --no-edit HEAD
```

If the failure is caught before commit:

```powershell
git checkout -- .
git clean -fd src/services/trace/tracerWorkerClient.test.ts
```

`git mv` renames are staged; `git checkout -- .` alone does not undo them. Use
`git reset --hard 4a712036cfe7455641553ff7cce62b2d22a5ee48` only when the working tree holds nothing else worth keeping, and
record the decision in `## Deviations`.

## Out of Scope

- **The `AGENTS.md` rewrite and the `CLAUDE.md` pointer files.** These are Claude's ownership
  and are completed before this route opens. Do not touch `AGENTS.md`, `CLAUDE.md`, or any
  `*/AGENTS.md`, and do not create new ones.
- Wiring `titanRouter`, `executeTitanPipeline`, `inputPatch`, or `translate` into the
  production call chain — that is R02.
- Any change to the interpreter's supported language profile — that is R03.
- CI workflow files under `.github/` — that is R04.
- Adding tests for modules other than `tracerWorkerClient` and i18n parity. Raising coverage
  elsewhere is not this route's job and inflates the diff the handoff must justify.
- Rewriting the bodies of the six e2e specs. They are renamed, and their references in
  `scripts/requirements-coverage.test.ts` are updated. Their test titles and selectors already
  use Titan terminology — a case-insensitive `god` grep over their contents returns zero — so
  there is nothing inside them to change.
- Retiring `docs/GEMINI_HANDOFF_LEETCODE_MEGA_UPDATE.md` to `docs/legacy/`.

## T0 reconciliation

Written by Claude/T0 after re-running `## Verification` independently and reading
`docs/titan/handoffs/H01-record-truth.md`. This section rules on the four deviations Sole
recorded. It is appended, not substituted: the criteria above stand as they were written,
including their defects, because a route is a record of what was asked.

Independent gate re-run, same working tree, T0's own invocation:

```
lint    clean
test    Test Files  120 passed (120)   Tests  751 passed (751)
build   Initial JavaScript: 415.7 / 420.0 KiB
        Tracer worker: 141.0 / 150.0 KiB
        Styles: 91.3 / 100.0 KiB
```

Identical to H01. The handoff is not overstating its evidence.

### Deviation 1 — criterion 9 cannot return zero. Sole is right; the criterion is defective.

The grep's remaining matches are:

```
docs/titan/DOD.md                    1
docs/titan/SOLE_BOOTSTRAP.md         7
docs/titan/routes/R01-record-truth.md  12
e2e/titan-mode.spec.ts               1
```

The first three are T0-owned and Sole is forbidden from editing them; they name the old
term because they are the documents that order and describe the rename. A protocol that
forbids its own records from naming what they retired is incoherent. The fourth is

```
e2e/titan-mode.spec.ts:12
await expect(page.getByText('God Mode', { exact: true })).toHaveCount(0);
```

a negative assertion proving the label is gone from the UI. Deleting it would remove the
only test that fails if the old label returns. The criterion would have destroyed the
evidence it was written to protect.

**Ruling: criterion 9 is closed as satisfied.** Its correct scope is `src/`, `e2e/`
filenames, and `src-tauri/`, with two enumerated exceptions — a negative assertion naming
the retired term, and the `docs/legacy/` pointer already permitted by criterion 7. Every
one of those holds. `docs/titan/` never belonged in the scope. Future routes use:

```powershell
Get-ChildItem -Recurse -Path src, e2e, src-tauri -File | Select-String -Pattern 'god.?mode' -CaseSensitive:$false
git ls-files e2e/ | Select-String -Pattern 'god'
```

with any surviving match required to be a named exception in the route text.

### Deviation 2 — criterion 1's verification pattern is defective. Sole is right.

`Select-String` is case-insensitive by default, so
`-Pattern 'interpreter\.test|acceptance\.test\.ts|workerClient\.test'` matches inside the
two filenames the same criterion **requires**: `leetcodeAcceptance.test.ts` contains
`Acceptance.test.ts`, and `tracerWorkerClient.test.ts` contains `WorkerClient.test`. Two
of the three prescribed names trip the pattern that demands zero matches. Nonempty output
was the only possible result.

The matrix content is correct — row 1 cites the three real paths, and no stale name
survives. **Ruling: criterion 1 is closed as satisfied.** The pattern is corrected to
require a word boundary, which no substring match can produce:

```powershell
Select-String -Path docs/TITAN_ACCEPTANCE_MATRIX.md -Pattern '\b(interpreter|acceptance|workerClient)\.test'
```

### Deviation 3 — the browser job could not be asserted locally. Correct, and T0's error.

R01 required a green `browser` job but granted no push authority, and the job cannot run
without a push. The remote half of criterion 12 was never Sole's to close. T0 pushed
`7a6f9f3` to `origin/agent/titan-relay` and carries the result; see `## Remote closure`
below. Sole's local `66 passed` + `2 passed` with `E2E_EXIT=0` stands as the local half.

**Standing correction:** a criterion depending on remote state must name who pushes. If
that is not the route's holder, the criterion belongs to T0 and is marked so in the route.

### Deviation 4 — the close commit cannot contain its own SHA. Sole is right; the protocol is defective.

`PROTOCOL.md` step 5 commits the handoff *as* `route(R<n>): close`, while `## Verification`
requires `git log -1 --format=%H` pasted verbatim into that same handoff. A commit cannot
contain a hash that only exists once the commit is written. This is a flaw in the protocol,
not in the turn. Corrected in `PROTOCOL.md` by splitting the close into two commits; the
work lands as `route(R<n>): close` and the evidence follows as `handoff(H<n>): record`,
which can name the commit above it. R01 is not retried for this.

## Remote closure

T0 pushed `7a6f9f3` to `origin/agent/titan-relay`. Run 32756724301: `quality` **success**,
`desktop` **success**, `browser` **failure** — 12 failed, 4 flaky, 50 passed.

The remote half of criterion 12 therefore does not pass. It also does not fail in a way that
says anything about R01, and the three runs together show why:

| Head | What it contains | browser result |
|---|---|---|
| `4e99311` (main) | the inherited baseline | 6 failed · 5 flaky · 55 passed |
| `6c7e5ff` (branch, before the close) | protocol documents only — zero `src/**` or `e2e/**` changes | 10 failed · 3 flaky · 53 passed |
| `7a6f9f3` (branch, after the close) | R01's renames and two new tests | 12 failed · 4 flaky · 50 passed |

The middle row is the decisive one. Between `4e99311` and `6c7e5ff` not one line of product
code or test code changed — the diff is Markdown — and the failure count still moved from 6
to 10. A gate that swings by four failures on a documentation-only diff is not measuring the
tree under test. R01's renames moved it from 10 to 12, inside the same band.

Failures cluster in `e2e/dp-family-titan-mode.spec.ts` and `e2e/usage-scenarios.spec.ts`,
every one of them an `expect(locator).toBeVisible()` timeout, and none of them reproduce
locally, where Sole and T0 both observe `66 passed` with `E2E_EXIT=0`.

**Ruling: criterion 12's remote half is unresolved, and it is not Sole's to carry.** The
local half passed. The remote half cannot be graded until the instrument is fixed, which is
`R02`. Criterion 12 is the one criterion R01 does not close.

**Standing correction, stronger than the one under deviation 3:** no future route may make a
green `browser` job an acceptance criterion until R02 establishes that the job's result is a
function of the commit. A criterion whose value changes without its input changing is not a
criterion.

### Verdict

R01 closes with one criterion open. Twelve of thirteen are satisfied — ten directly, two
(1 and 9) as defective text over correct work. Criterion 12 closes locally and stays open
remotely, carried into `R02`. No `R01b` is opened: nothing remains for Sole to implement, and
the open half was never within Sole's authority.
