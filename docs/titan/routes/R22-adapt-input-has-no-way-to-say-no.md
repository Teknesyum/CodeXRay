# R22 — adapt-input has no way to say no

## Özet

`adapt-input` anlamadığı bir isteği reddedemiyor. Yamalayıcılar eşleşmediğinde akış
`adaptSimulationInputFromRequest`'in son satırına düşüyor; o satır kullanıcının girdisini atıp
bir preset döndürüyor, motor onu koşulsuz uyguluyor ve iş özeti "deterministik olarak
uygulandı" diyor. Kullanıcı `[9, 4, 7, 1, 3]` üzerinde çalışırken "diziyi karıştır" yazıyor,
dizisi `[9,8,7,6,5,4,3,2,1]` oluyor ve bunun bir başarı olduğu söyleniyor.

Ayrımı üretmek için yeni bir tip gerekmiyor — dönen değer zaten `origin: 'preset'` taşıyor.
Kimse okumuyor. R21'in bulduğu şeklin bir kat dışarısı: "anlamadım" diyemeyen bir fonksiyon,
anlamış gibi okunur.

İkinci yarısı aynı bloğun içinde: tipli grafik ve dizi işlemleri aktif paket yokken üretilip
atılıyor, ama redleri yine de turu düşürüyor.

## Objective

Give `adapt-input` an explicit "I did not understand this request" outcome, and stop
understood typed operations from being silently discarded.

### The measurement

Taken at `ff9071d` with a temporary probe against `adaptSimulationInputFromRequest`, current
input `[9, 4, 7, 1, 3]`, algorithm `Bubble Sort`, no active package. Verbatim:

```
req="diziyi karıştır"     patch=null out={"kind":"array","text":"[9,8,7,6,5,4,3,2,1]","origin":"preset"}
req="sort the array"      patch=null out={"kind":"array","text":"[9,8,7,6,5,4,3,2,1]","origin":"preset"}
req="diziyi ters çevir"   patch=null out={"kind":"array","text":"[9,8,7,6,5,4,3,2,1]","origin":"preset"}
req="make it interesting" patch=null out={"kind":"array","text":"[9,8,7,6,5,4,3,2,1]","origin":"preset"}
```

Four requests a user might plausibly type. None is understood — `createSemanticArrayPatch`
returns `null` for all four, `shuffle-array` because it requires an explicit seed and the
sentence carries none. The user's five values are replaced by a nine-value preset that has
nothing to do with any of the four sentences.

**The discriminant already exists and nobody reads it.** `SimulationInput.origin` is
`'preset' | 'user' | 'agent'` (`src/types/simulation.ts:59`). Every understood branch of
`inputRequestAdapter.ts` returns `'user'` or `'agent'` — lines 96, 101, 116, 120, 129, 136,
150, 157, 163. The single branch that returns `'preset'` is the unconditional tail at
`:166-173`, reached only when nothing matched. So the adapter is already telling its caller
"I fell through"; `titanEngine.ts:925` takes the value and applies it. The only reader of
`origin === 'preset'` anywhere in `src/**` is `agentInputGenerator.ts:86`, for an unrelated
decision.

`adaptSimulationInputFromRequest` has exactly one production consumer, `titanEngine.ts:925`,
and one test file with six cases. The blast radius of changing its contract is small and
measurable.

### The second half, in the same block

`titanEngine.ts:857-920` tries three typed paths before the adapter. Two of them are gated on
an active package and one is not:

```
:860          if (semanticPatch && options.activePackage && current) {
:882-902      if (parameterPatches.length && current) { if (options.activePackage) {...} else {...applyInputPatches...} }
:907          if (graphPatches?.ok === false) throw new Error(graphPatches.reason);
:908          if (graphPatches?.patches.length && options.activePackage && current) {
```

`set-param` has a package-less fallback through `applyInputPatches`. The semantic array ops
and the four graph ops do not: with no active package their correctly-produced patches are
discarded and the run falls through to the preset tail measured above. A catalog algorithm
with no AI-authored package — the ordinary state for all 50 supported entries — cannot reach
seven of the eleven ops.

`AGENTS.md` currently states, in the `inputPatch.ts` map entry: "**Every op and every parameter
key is reachable from production as of R14 — 11/11 ops, 11/11 keys.**" That sentence is true
only with an active package, and it does not say so. Whichever option is taken, that line must
end this turn either true without qualification or qualified. **That correction is T0's to
write; do not edit `AGENTS.md`.**

`:907` is the mirror defect: a *rejected* graph request throws even when `activePackage` is
absent, so on a package-less run a misunderstood graph phrase fails the turn while an
understood one is silently dropped. The asymmetry is backwards.

### What this is not

Not a claim that a preset is always wrong. When there is no current input at all, a preset is
the correct answer and must stay. The defect is replacing an input the user already has, on a
request nobody understood, and calling it success.

Not a hole in R15's `verifyAdaptInputArtifact`. That check recomputes the trace from the
artifact's committed input and proves internal consistency. A wrong input produces a perfectly
consistent trace, so the gate is green — correctly, for what it measures. This route does not
touch it.

### The category error

R21's shape, one layer out. `callOptionalAgent` could not express "I did not run".
`adaptSimulationInputFromRequest` can express "I did not understand" — it does, in `origin` —
and the caller does not ask. A discriminant that exists and is never read is worth no more than
one that does not exist.

## Turn

- `Turn.holder`: T0-delegated implementer
- `Turn.base`: `ff9071d`
- `Turn.branch`: `main`

Before writing anything: `git merge-base --is-ancestor ff9071d HEAD` must exit 0, and
`git diff --name-only ff9071d..HEAD` must list only T0-owned paths. If either fails, do not
write; report the mismatch.

## Expected Files

A forecast, not a gate.

- `src/services/inputRequestAdapter.ts` — the explicit no-match outcome.
- `src/services/titanEngine.ts` — reading it, and the package-less patch paths.
- `src/i18n/translations.ts` — the EN and TR refusal message.
- `src/services/inputRequestAdapter.test.ts`, `src/services/titanEngine.test.ts` — the probe
  cases as permanent tests.

## Invariants

- No `eval`, no `new Function`, no `Math.random`, no wall-clock branching.
- The trace never comes from the model; the model never computes an index.
- Every new user-facing string ships EN and TR.
- Do not invent colors or measurements — `teknesyum-ui` is not installed here.
- **Never infer a literal from prose.** `requestLiterals.ts` stays the single extractor; do not
  add a fourth quote convention and do not make `shuffle-array` guess a seed to make a sentence
  parse. A request with no delimited literal still produces no patch — after this route it
  produces a refusal instead of a preset.
- Do not widen `getAlgorithmParameterDefinitions` to make a phrase parse.
- A preset is still correct when there is no current input. Do not refuse that case.
- R15's `verifyAdaptInputArtifact` is not in scope. Do not touch
  `src/services/titan/titanPipeline.ts`.
- No frozen or T0-owned path is written: `.claude/**`, `.agents/AGENTS.md`, `docs/tasks/**`,
  `docs/legacy/**`, `CodeXray-readme-neon.svg`, `docs/TITAN_MODE_YOL_HARITASI.md`,
  `docs/titan/routes/**`, `AGENTS.md`.

## The decision

**Option A — refuse, and close the package-less gap.** Two changes in one turn because they are
the same defect seen twice.

1. The adapter gains an explicit no-match outcome the caller must handle — either a discriminated
   return, or a documented contract that `origin === 'preset'` with a non-null `current` means
   "not understood". `titanEngine.ts:925` reads it: when the request was not understood **and**
   the workspace already had an input, the `adapt-input` run fails with an EN/TR message saying
   the request was not understood and the input was left alone. The workspace is untouched.
2. The semantic-array and graph paths get the package-less fallback `set-param` already has
   (`applyInputPatches` onto the current input), and `:907`'s rejection becomes symmetric with
   its application — a graph request only fails the run in the same conditions under which it
   would have been applied.

Cost: one contract change with a single production consumer, one branch in the engine, one
string pair, roughly six tests. The second half is mostly copying the shape already present at
`:882-902`.

Risk, stated plainly: this is a user-visible behaviour change. A sentence that today silently
produces a new preset input will tomorrow produce a visible refusal. That is the intended
direction — the same trade R21 made for the critic — but it is a regression for anyone who was
using "make it interesting" as a way to get a fresh input, and the handoff must say so.

**Option B — refuse only.** Item 1 alone. Cheaper by roughly a third, and it makes the
package-less gap *louder* rather than fixing it: a catalog user asking "hedefi D yap" would get
a refusal instead of a silent no-op, which is honest but worse than working. If taken, the
`AGENTS.md` 11/11 sentence must be reported as still unqualified-and-wrong.

**Option C — close the package-less gap only.** Item 2 alone. Fixes seven ops for catalog users
and leaves the data loss of item 1 standing. Cheapest, and it does not address the finding this
route is named for.

**T0 reading, not binding: A.** B leaves the more common path worse than it found it; C leaves
the only defect in this pair that destroys user data. If measurement shows item 2 is larger than
this estimate — for instance if `applyInputPatches` cannot accept a graph op without a compiled
package — take B, say so with the measurement, and route item 2 separately.

## Acceptance Criteria

1. An `adapt-input` request that no patcher understands, on a workspace that already has an
   input, does **not** change the workspace and does **not** report success. A unit test
   reproduces all four measured sentences.
2. The refusal message exists in EN and TR and names the fact that the input was left unchanged.
3. A request with no current input still receives a preset. A test asserts it.
4. Requests that are understood today keep working unchanged — the six existing
   `inputRequestAdapter.test.ts` cases pass without modification. If one must change, justify it
   in `## Deviations`; do not weaken an assertion to make a new branch pass.
5. (Option A or C) With no active package, a semantic array op and a graph op produce the same
   input change they produce with one. A test asserts at least one of each.
6. (Option A or C) A rejected graph request fails the run only under the conditions in which an
   accepted one would have been applied. A test asserts the package-less rejected case.
7. `src/services/requestLiterals.ts` is unchanged, and no new quote convention or seed inference
   was added. Show the file's diff is empty.
8. `npm run lint`, `npm run test`, `npm run build` pass. `npm run desktop:check` if
   `src-tauri/**` changed.
9. e2e passes. If an existing e2e spec depended on the preset fallback, say which and how it was
   resolved.
10. (T0) The handoff states how many of the eleven `inputPatch.ts` ops are reachable from
    production without an active package, before and after this turn, as counted numbers.
11. No frozen or T0-owned path is written. `git diff --name-only ff9071d..HEAD` proves it.
12. Every commit is DCO-signed as `Mustafa Özel <iyott131@gmail.com>`; confirm
    `git config user.email` before the first commit.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git config user.email

git diff --name-only "ff9071d..HEAD"

git diff --stat "ff9071d..HEAD"

git diff "ff9071d..HEAD" -- src/services/requestLiterals.ts

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern "origin === 'preset'"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'options\.activePackage'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'new Function|eval\('

npm run lint

npm run test

npm run build
```

The fifth must produce no output — that is criterion 7. The sixth and seventh are criteria 1
and 5's evidence; run them against the base first and report the delta. The last two must show
no new match.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## Deferred, deliberately

Three further findings were measured this session and are **not** part of this route. They are
recorded here so the next planner does not re-measure them.

- **`graphRequestEdits.ts:25` counts the English article `a` as a node count.** The pattern
  `/(?:bir|one|a)\s+(?:node|d[uü][gğ][uü]m)/` matches the normalized Turkish phrase
  `"a düğüm"` inside `"A düğümünü sil"`, so deleting node `A` also requests adding one node and
  one edge. Measured: `"A düğümünü sil"` produces
  `[graph-remove A, graph-add-node 1, graph-add-edge G→1]`. Today this is unreachable without
  an active package. **Closing item 2 of this route makes it reachable**, so whoever takes
  Option A must either fix this pattern in the same turn or record in `## Deviations` that it
  is now live.
- **`webSource.ts:298` cannot reject `int[][] nums`.** The trailing `\b` after an alternative
  ending in `]` never matches before a space, so a standard Java matrix signature is declared
  SimLang-compatible unless the parameter happens to be *named* `matrix` or `grid`. Measured:
  `int solve(int[][] nums)` → compatible `true`; `int solve(int[][]nums)` → `false`. Its own
  reason string claims the signature was checked. Needs a signature parser, not a wider regex.
- **Structural trace intelligence is inert on all 50 catalog algorithms.** `_traceKind` /
  `_traceEvent` / `_callDepth` are produced only by `trace/adapter.ts`, so over the 50 supported
  entries: `sigIsZero=17`, `singlePhase=44`, kinds only `mutate`/`statement`, events `none`.
  `mostSignificantIndex` and `structuralCheckpointIndices` degrade to near-uniform sampling, and
  those indices enter the model prompt through `aiContext.ts:223` labelled as important steps.
  The existing tests cannot catch this because every fixture hand-writes the missing fields.
  Fixing it means emitting events from 60 simulators; it deserves its own route.
  Related and smaller: `src/services/trace/traceQuery.ts` has no production consumer — its only
  caller is `traceIntelligence.test.ts`.
