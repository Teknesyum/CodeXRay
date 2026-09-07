# R25 — four of eleven never match

## Özet

`webSource.ts:300`'deki "desteklenmeyen giriş şekli" deseni on bir alternatif sayıyor. Bunların
**dördü normal Java aralığında hiç eşleşmiyor**: `object[]`, `double[]`, `char[][]`, `int[][]`.
Hepsi `]` ile bitiyor ve desenin sonundaki `\b` `]` ile boşluk arasında sınır bulamıyor.

Dördü de dizi şekli alternatifi — yani filtrenin var olma sebebi olan tam sınıf. `matrix`,
`grid`, `listnode`, `map<` gibi kelimeyle biten yedi alternatif çalışıyor. Filtre yalnızca
parametre `matrix` ya da `grid` diye **adlandırıldığında** matrisi yakalıyor.

Sonuç yanlış yönlendirme: `compatible` verdisi yolu seçiyor, ve bir matris problemi Java
yedeğine değil model-yazımı yoluna gidiyor. İkisi de kapılı — bu bir güvenlik açığı değil.
Kaybedilen şey, SimLang V1'in ifade edemediği bir şekli en baştan reddetme yeteneği.

## Objective

Make the SimLang compatibility filter actually reject the array shapes it names.

### The measurement

The pattern, verbatim from `src/services/webSource.ts:300`:

```js
const unsupported = /\b(matrix|grid|listnode|linked list|binary tree node|object\[\]|map<|set<|double\[\]|char\[\]\[\]|int\[\]\[\])\b/;
```

Each alternative was run against a representative signature at `590f4bd`. Verbatim output:

```
matrix             matches= true   int f(int[] matrix)
grid               matches= true   int f(int[] grid)
listnode           matches= true   ListNode f(ListNode head)
linked list        matches= true   reverse a linked list
binary tree node   matches= true   a binary tree node value
object[]           matches= false  int f(Object[] items)
map<               matches= true   int f(Map<String,Integer> m)
set<               matches= true   int f(Set<Integer> s)
double[]           matches= false  double f(double[] xs)
char[][]           matches= false  int f(char[][] board)
int[][]            matches= false  int f(int[][] nums)
```

And the whole function, same run:

```
"int solve(int[][] nums)"     compatible= true
"int solve(int[][]nums)"      compatible= false
"int solve(int[][] matrix)"   compatible= false
"int solve(int[][] grid)"     compatible= false
"int[][] solve(int[] nums)"   compatible= true
"int solve(int[] a, int[] b)" compatible= false
"double solve(double[] xs)"   compatible= true
"int solve(char[][] board)"   compatible= true
```

Read those two blocks together:

- A matrix parameter is rejected only when it happens to be **named** `nums`→no, `matrix`→yes,
  `grid`→yes. The type is not what rejects it; the name is.
- `int solve(int[][]nums)` — no space — is rejected, and the identical signature with the
  conventional space is accepted. Whitespace decides the verdict.
- A matrix **return type** (`int[][] solve(int[] nums)`) is not rejected at all.
- `char[][] board`, the standard LeetCode board signature, is accepted.
- The second guard, `multiArray`, catches two separate one-dimensional arrays
  (`int[] a, int[] b`) and never a single two-dimensional one, because its own pattern
  `(?:int|long|string|char)\s*\[\]` matches `int[]` once inside `int[][]`.

So of the eleven alternatives, **seven work and four are inert**, and the four inert ones are
exactly the array-shape ones. Names catch matrices; types do not.

### What it actually costs, stated narrowly

`simulationCompatibility` has one production consumer, `AiAssistant.tsx:571`, and it selects a
**path**:

- `compatible: false` → `startWebProblemFallbackPipeline`, the R19 Java-translation path with
  `verifyWebProblemFallbackArtifact`.
- `compatible: true` → the ordinary bound-web-solve path, which since R20 routes to
  `create-algorithm: model-authored` and is gated by R18's `verifyModelAuthoredArtifact`.

Both branches are gated. **This is not an ungated path and no route should describe it as one.**
A matrix problem that slips through is asked of the model-authored pipeline, whose verify proves
the artifact is what its program deterministically produces — and cannot prove the program
models a matrix problem SimLang V1 has no shape for. The user gets a confusing failure or a
plausible program for the wrong problem, instead of the clean "outside SimLang V1" message the
filter exists to produce.

The `reason` string on the accepting branch reads "The signature fits a bounded
array/string/scalar SimLang input." It says the signature was examined and fits. For these four
shapes the signature was examined and the examination could not fail. Fifth turn in a row for
this shape.

## Turn

- `Turn.holder`: T0-delegated implementer
- `Turn.base`: `590f4bd`
- `Turn.branch`: `main`

Before writing anything: `git merge-base --is-ancestor 590f4bd HEAD` must exit 0, and
`git diff --name-only 590f4bd..HEAD` must list only T0-owned paths.

## Expected Files

A forecast, not a gate.

- `src/services/webSource.ts` — the filter.
- `src/services/webSource.test.ts` — the table above as permanent tests.
- `src/i18n/translations.ts` — only if a reason string changes and it is user-visible.

## Invariants

- **Cleaned web text stays untrusted data.** This turn reads a signature string; it must not
  make the parser execute, evaluate, or trust anything from the page.
- Never persist raw HTML. Only the requested URL leaves the browser.
- No `eval`, no `new Function`, no `Math.random`, no wall-clock branching.
- Do not touch `startWebProblemFallbackPipeline`, `verifyWebProblemFallbackArtifact`, or
  `translateToVerifiedPackage`. This route changes which branch is chosen, never what either
  branch does after it is chosen.
- **Widening the filter must not silently narrow what CodeXRay can solve.** Every signature that
  is compatible today and stays compatible must be shown to still be compatible; every one whose
  verdict flips must be listed in the handoff with its signature.
- Every new or changed user-facing string ships EN and TR.
- No frozen or T0-owned path is written: `.claude/**`, `.agents/AGENTS.md`, `docs/tasks/**`,
  `docs/legacy/**`, `CodeXray-readme-neon.svg`, `docs/TITAN_MODE_YOL_HARITASI.md`,
  `docs/titan/routes/**`, `AGENTS.md`.

## The decision

**Option A — parse the parameter list, stop pattern-matching prose.** Split the signature's
parameter list, take each parameter's declared type, and decide from the type: a type with two
or more `[]` pairs is unsupported; `Object`, `double`, `Map<…>`, `Set<…>`, `ListNode`,
`TreeNode` are unsupported; `int`/`long`/`String`/`char`/`boolean` and their single-`[]` forms
are supported. Check the return type by the same rule. Keep a **separate** description-level word
scan for `matrix`, `grid`, `linked list`, `binary tree node` — those are genuine prose hints and
are the part of today's filter that works.

Cost: one small parser, roughly twenty cases in the test table, one reason string per rejection
class. The measurement above is the fixture.

Risk: a parser is stricter than a regex and will reject signatures the regex let through. That
is the intent, but it changes which problems reach the model-authored path, so the invariant
about listing every flipped verdict is not optional.

**Option B — fix the four alternatives in place.** Move the trailing `\b` or replace it with
`(?![\w])`, so `int[][] nums` matches. Two characters of real change plus tests.

Honest about what B buys: it fixes the four measured cases and leaves the design — deciding a
type question by scanning a lowercased blob of signature-plus-description for substrings — exactly
as it was. `int[][][]`, `List<List<Integer>>`, `float[]`, `Integer[][]` and every other shape not
in the list stay accepted. B is a correct fix for the bug in the route's title and not for the
sentence under it.

**Option C — reverse the polarity: accept only shapes on an allow-list, reject everything else.**
The strongest, and the one most likely to break working users. SimLang V1's real input surface
would have to be enumerated first, and that enumeration does not exist in writing today. Not this
route; possibly the one after, once A's parser makes the surface explicit.

**T0 reading, not binding: A.** B is defensible if measurement shows the parser is larger than
estimated — take it, say so with the measurement, and route A separately. Do not take C.

## Acceptance Criteria

1. All four measured signatures that are wrongly accepted today are rejected:
   `int solve(int[][] nums)`, `int solve(char[][] board)`, `double solve(double[] xs)`,
   `int f(Object[] items)`.
2. Whitespace does not change a verdict. `int solve(int[][]nums)` and `int solve(int[][] nums)`
   agree. A test asserts it.
3. A matrix **return type** is rejected: `int[][] solve(int[] nums)`.
4. The seven alternatives that work today still work. Assert all seven.
5. `int solve(int[] a, int[] b)` stays rejected — do not lose the `multiArray` guard while
   replacing it.
6. At least three signatures that are compatible today and must stay compatible are asserted
   compatible: a bare `int[]`, a `String`, and a scalar. Name them in the handoff.
7. (T0) The handoff lists **every** signature whose verdict flips, with the signature text, in
   both directions.
8. Rejection reasons are distinguishable — a caller can tell "two-dimensional array" from
   "unsupported element type" from "no signature found". EN and TR.
9. No page content is executed, evaluated, or trusted; raw HTML is not persisted. Show the diff
   touches no network or storage call.
10. `npm run lint`, `npm run test`, `npm run build` pass. `npm run desktop:check` if
    `src-tauri/**` changed.
11. e2e passes. `translation-provenance.spec.ts` exercises this path — say whether its verdicts
    changed.
12. No frozen or T0-owned path is written. `git diff --name-only 590f4bd..HEAD` proves it.
13. Every commit is DCO-signed as `Mustafa Özel <iyott131@gmail.com>`.

## Verification

PowerShell 5.1. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git config user.email

git diff --name-only "590f4bd..HEAD"

git diff --stat "590f4bd..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'simulationCompatibility'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'multiArray|unsupported ='

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'Math\.random'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'new Function|eval\('

npm run lint

npm run test

npm run build
```

Run the fifth and sixth against the base too and report the delta. Grep for assertion text, never
for a line range.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## Still deferred after this route

- Structural trace intelligence inert across all 50 catalog algorithms: `sigIsZero=17`,
  `singlePhase=44`, kinds only `mutate`/`statement`, events `none`. Those indices reach the model
  prompt through `aiContext.ts:223` labelled as important steps. Fixing it means emitting events
  from 60 simulators — its own route, and the largest one left.
- `src/services/trace/traceQuery.ts` has no production consumer; its only caller is
  `traceIntelligence.test.ts`.
- `inputRequestAdapter.test.ts:31`'s name has described no production behaviour since R22.
- `titanEntry.ts:130` is the one engine caller outside `PipelineRunId`'s brand. Correct today,
  reachable by a future wrapper.
- E2E parallelism flake: eight clean runs of `translation-provenance.spec.ts` at H24, two
  unrelated single-run flakes elsewhere. Zero on CI.

---

## T0 reconciliation

Closed at `050f834`. Route opened `ea3b2d5`, closed `19a3e76`, handoff `050f834`.
Verified independently by T0; the handoff was read, not trusted.

### Independently confirmed

T0 ran its own probe at HEAD — twenty-one signatures through `normalizeWebProblem`, the real
production entry, not a transcribed body. Verbatim:

```
int solve(int[][] nums) | solve it                   compatible=false code=multi-dimensional-array
int solve(int[][]nums) | solve it                    compatible=false code=multi-dimensional-array
int solve(char[][] board) | solve it                 compatible=false code=multi-dimensional-array
double solve(double[] xs) | solve it                 compatible=false code=unsupported-element-type
int f(Object[] items) | solve it                     compatible=false code=unsupported-element-type
int[][] solve(int[] nums) | solve it                 compatible=false code=multi-dimensional-array
int solve(int[] a, int[] b) | solve it               compatible=false code=multiple-array-parameters
int solve(int[] nums) | solve it                     compatible=true  code=fits-simlang
int solve(String s) | solve it                       compatible=true  code=fits-simlang
int solve(int n) | solve it                          compatible=true  code=fits-simlang
int solve(int[] nums) | walk the matrix              compatible=false code=unsupported-shape-in-description
int solve(int[] nums) | reverse a linked list        compatible=false code=unsupported-shape-in-description
ListNode f(ListNode head) | solve it                 compatible=false code=unsupported-element-type
int f(Map<String,Integer> m) | solve it              compatible=false code=unsupported-element-type
int f(Set<Integer> s) | solve it                     compatible=false code=unsupported-element-type
int solve(int[] grid) | solve it                     compatible=false code=unsupported-shape-in-description
void solve(int[] nums) | solve it                    compatible=true  code=fits-simlang
int solve(int... nums) | solve it                    compatible=true  code=fits-simlang
int solve(List<List<Integer>> g) | solve it          compatible=false code=unsupported-element-type
int solve(int[][][] c) | solve it                    compatible=false code=multi-dimensional-array
public static int solve(final int[] nums) | solve it compatible=true  code=fits-simlang
```

That closes criteria 1, 2, 3, 4, 5, 6 and 8 on T0's own evidence. Also T0-run: `lint` exit 0,
`test` **890 passed / 119 files** (base 883, +7), `build` exit 0 within every budget.
`git diff --name-only 590f4bd..HEAD` lists ten files; the only `docs/titan/routes/` entry is
this route, written by T0's own `ea3b2d5`. No frozen path touched. Grep over the added lines
for `eval(`, `new Function`, `Math.random`, `Date.now`, `fetch(`, `localStorage`: none.

The flip table is real and reproduces the route's ordering: 16 flips, **all `true` → `false`,
zero in the other direction**, each with its signature text.

### What the route got wrong

**The route's Option A draft rejected a signature it meant to keep.** Written literally,
"check the return type by the same rule" rejects `solve(int[] nums)` — a constructor-shaped
head with no return type at all. The implementer's first draft did exactly that, its own
measurement caught it, and `declaredReturnType` now returns `null` under two tokens. My
prose specified a rule for a case I had not enumerated. The measurement in the route was of
the **defect**; there was no measurement of the **fix's** own edge cases, and one turn later
that is where the bug was.

**The route under-described `multiArray`.** I wrote that it "matches `int[]` once inside
`int[][]`". The implementer established the sharper fact: it counts array *occurrences*, not
array *parameters*, which is a second and independent reason a matrix was never caught. Two
guards, both blind to the same shape, for two different reasons.

### What shipped beyond the route

Option A as read, and larger in the right direction. `List<List<Integer>>`, `int[][][]`,
`float[]`, `Integer[][]`, `TreeNode` — none named anywhere in the route or in the old pattern —
are now rejected structurally. That is the whole argument for A over B, and it is measured
rather than asserted: nine of the sixteen flips are element-type rejections, and only four of
the sixteen are the ones the route's title is about.

Criterion 8 shipped as a closed union, `SimulationCompatibilityCodeV1`, with the reason string
resolved through `t()` per locale rather than stored English. The verdict object now carries the
code, so `localizedCompatibilityReason` renders EN/TR from one source. Stronger than "reasons are
distinguishable", and the same shape R23 established: make the set closed and let the compiler
hold it.

Criterion 11 closed as *unchanged*: both `translation-provenance.spec.ts` fixtures use
`public int solve(int[][] grid)`, which the base rejected on the word `grid` and HEAD rejects
structurally. Same branch, different code. Worth stating plainly — an e2e that keeps passing
across a filter rewrite is only evidence if you show *why* the verdict was stable.

### Deviations, all accepted

Five files outside the forecast: `src/types/webSource.ts` (the union criterion 8 needs),
`src/components/AiAssistant.tsx` (the EN/TR string's real consumer at `:555`; the path-selecting
branch at `:572` untouched), `e2e/translation-provenance.spec.ts` (one assertion — criterion 11
claims user-visible behaviour and cannot close on a unit test), and two fixtures gaining the new
required `code` field. Each is inside the criteria. `DOD.md` untouched: this turn closes no row.

### Recorded

**Measuring the defect is not measuring the fix.** R25's route carried an unusually strong
measurement of what was broken and none at all of what the replacement would do at its own
edges — and the one bug in the turn was in the replacement's edge, caught by the implementer's
measurement rather than by mine. A route that proposes a parser should name the shapes the
parser must *keep*, not only the ones it must reject. Criterion 6 did some of this by accident;
it should have been the rule, not one line.

**Sixth consecutive turn on the same finding class:** a check whose description is broader than
what it establishes. R21 provenance, R22 refusal, R23 the ungated nine, R24 a preview that never
fired, R25 four alternatives that never matched. The accepting branch here even said the
signature "fits" — for four shapes it could not have said anything else.
