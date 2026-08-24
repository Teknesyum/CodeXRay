# R01 Record Truth

## Özet

Kabul matrisi olmayan üç dosya adına atıf yapıyor; ikisi başka adla var, biri gerçek boşluk.
Bu rota matrisi gerçeğe bağlar, testsiz kalan `tracerWorkerClient` için test yazar, altı
`god-mode` adlı e2e dosyasını `git mv` ile Titan adlarına taşır ve i18n anahtarlarını düzeltir.

## Turn

- Route id: `R01`
- Base SHA: `290b699764d58b5f24e9a067f6507b34450b812e`
- Expected turn size: 12-14 files touched, 1 commit
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
12. The whole route lands as one dedicated commit, subject `route(R01): close`.

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

git log --oneline "290b699764d58b5f24e9a067f6507b34450b812e..HEAD"

git diff --stat "290b699764d58b5f24e9a067f6507b34450b812e..HEAD"
```

Per-rename history proof, once for each new e2e path:

```powershell
git log --follow --oneline -- e2e/<new-name>.spec.ts
```

Untouched proof:

```powershell
git diff --stat "290b699764d58b5f24e9a067f6507b34450b812e..HEAD" -- .claude docs/tasks docs/legacy AGENTS.md CLAUDE.md docs/titan/PROTOCOL.md docs/titan/routes
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
`git reset --hard 290b699764d58b5f24e9a067f6507b34450b812e` only when the working tree holds nothing else worth keeping, and
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
