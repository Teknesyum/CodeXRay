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

---

## T0 reconciliation

Closed at `1adf406`, handoff `d4f5c5e`. Option A, both halves. I verified the diff, the file
list, and the gates myself rather than reading the handoff's copy of them: `lint` clean,
`867 passed` against `850` at the base, `build` inside every budget. No frozen or T0-owned path
appears in `git diff --name-only ff9071d..HEAD`.

**Item 2 came in cheaper than the estimate, and the estimate was wrong in an instructive way.**
The route hedged that `applyInputPatches` might not accept a graph op without a compiled
package. It does — a synthetic `packagelessContract` around the current input is enough, and the
change is the same seven lines `set-param` already had, lifted into a shared helper and used
three times. My hedge was written from reading the call sites; one probe against
`applyInputPatches` would have removed it. Cheaper to measure than to hedge.

**The count is 13, not 11.** `InputPatchV1` has thirteen members. `AGENTS.md` has said eleven
since R14 and I repeated it in this route's own Objective without counting. Reachable without an
active package: **6/13 before, 13/13 after**. I have corrected the map entry; the sentence now
gives the number and says the qualifier out loud.

**`graphRequestEdits.ts` was fixed in the same turn, as the route required.** The deferred
finding said `"A düğümünü sil"` produced three ops because the English article `a` matched the
node-count pattern. Item 2 would have made that reachable. The fix narrows `a` to the two
phrasings where it is genuinely a count — `add a node`, `a node add` — and leaves `bir`/`one`
alone. This is the correct order: a deferred finding that a live route would activate is not
deferred, it is part of that route.

### The exclusion is inert, and the handoff overstates it

`titanEngine.ts:956` excludes `predict_winner_interval_dp` from the refusal. `## Discovered`
item 5 justifies it as necessary, because that branch replaces `generated` wholesale after the
adapter runs so the adapter's `origin` is not the discriminant there. The first half is true.
The conclusion is not: the replacement at `:948-954` sets `origin` from
`resolved.origin === 'user' ? 'user' : 'agent'`, which cannot produce `'preset'`, so
`isUnderstoodInputAdaptation` already returns `true` for that program on every path.

The guard changes no behaviour. I am leaving the code as it is — it is a correct statement of
an intent, and removing it would spend a turn to delete a line — but the *description* is the
thing that must be right, because the next route reads the description. This is R21's finding at
one-tenth scale, and it surfaced inside the turn that was written to hunt it: **a guard whose
stated reason is broader than its effect.** The implementer reported it under `## Discovered`
rather than presenting it as load-bearing, which is why it was catchable. That is the behaviour
the protocol is for.

### What this route did not buy

The refusal reads `origin`, and `origin` is set by the adapter's own branch structure. It means
"no branch of `inputRequestAdapter.ts` matched", not "the user's intent was not served". A
request that matches a branch and is understood *wrongly* still applies and still reports
success. There is no gate anywhere in the system for that, and none of R15's, R16's, R18's or
this turn's checks is one. Do not let a later document describe R22 as intent verification.

Criterion 4 held: the six existing adapter cases pass unmodified. One of them,
`inputRequestAdapter.test.ts:31`, now has a name that describes production behaviour it no
longer has — the adapter still returns the preset, but the engine refuses it. The implementer
left it alone because the criterion forbade touching it and said so, rather than quietly
renaming it. Correct call; the rename belongs to whoever next opens that file.

### Standing

Four route-worthy findings remain measured and unclaimed: the nine non-pipelined creation
templates that still commit with no external refusal point (open since R20),
`webSource.ts:298`'s signature filter, the inert structural trace layer across all 50 catalog
algorithms, and `traceQuery.ts` with no production consumer.

E2E timeout sightings are now five local across four specs — `titan-mode.spec.ts:22`,
`ai-actions.spec.ts:112`, `radio-controller.spec.ts` at H12 and H15, and this turn's
`translation-provenance.spec.ts` strict-mode violation under full-suite parallelism, green on
two subsequent full runs. Still zero on CI. The next one makes it a route regardless of where
it lands.
