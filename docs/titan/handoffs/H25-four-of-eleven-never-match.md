# H25 — four of eleven never match

## Turn

- route: `docs/titan/routes/R25-four-of-eleven-never-match.md`
- base SHA: `590f4bd`
- end SHA: `19a3e763e417434ad96ba8b6a3041a86fdebeadf`
- status: `closed`
- next holder: Claude (T0)

## Özet

Seçenek A alındı: imza artık desenle taranmıyor, parametre listesi ayrıştırılıp her bildirilen tip
sınıflandırılıyor; iki ve daha çok boyutlu diziler ile desteklenmeyen öğe tipleri reddediliyor.
Çalışan yedi kelime alternatifi ayrı bir açıklama taraması olarak duruyor.

Reddetme gerekçesi artık kapalı bir `SimulationCompatibilityCodeV1` birleşimi; altı kodun her biri
EN ve TR karşılığıyla geliyor ve `read-web-source` sohbet mesajı yerelleştirilmiş gerekçeyi gösteriyor.

53 imzalık ölçümde 16 verdi `true`den `false`a döndü, hiçbiri `false`tan `true`ya dönmedi; e2e
verdileri değişmedi.

## What changed

| path:line-range | intent | kind |
|---|---|---|
| `src/types/webSource.ts:66-81` | `simulationCompatibility` becomes `SimulationCompatibilityV1`; new `SimulationCompatibilityCodeV1` closed union | edited |
| `src/services/webSource.ts:10-14` | import the two new types plus `Locale` and `t` | edited |
| `src/services/webSource.ts:302-336` | `SHAPE_WORDS`, `DECLARATION_MODIFIERS`, `SUPPORTED_ELEMENT_TYPES`, `TYPE_PREFIX`, `collapseTypeWhitespace`, `splitTopLevel` | added |
| `src/services/webSource.ts:338-380` | `declarationTokens`, `declaredParameterType`, `declaredReturnType`, `classifyDeclaredType`, `isArrayType`, `compatibilityTranslationKey`, `compatibilityVerdict` | added |
| `src/services/webSource.ts:382-413` | `simulationCompatibility` rewritten as a signature type parser; `localizedCompatibilityReason` exported | edited |
| `src/i18n/translations.ts:259-264` | six EN compatibility reason strings | added |
| `src/i18n/translations.ts:628-633` | six TR compatibility reason strings | added |
| `src/components/AiAssistant.tsx:33` | import `localizedCompatibilityReason` | edited |
| `src/components/AiAssistant.tsx:555` | read-web-source chat message carries the localized reason | edited |
| `src/services/webSource.test.ts:2` | import `localizedCompatibilityReason` | edited |
| `src/services/webSource.test.ts:104-178` | seven permanent tests covering criteria 1-6 and 8 | added |
| `src/components/LeetCodeDrawer.test.tsx:55` | fixture gains `code: 'fits-simlang'` | edited |
| `src/services/titanModeRouting.test.ts:289` | fixture gains `code: 'fits-simlang'` | edited |
| `e2e/translation-provenance.spec.ts:265` | asserts the distinguishable two-dimensional-array reason is visible after a Read | added |

## Commits

```
19a3e76 route(R25): close
```

## Which option was taken

**Option A.** The parser plus its six constants is 112 lines of `src/services/webSource.ts`,
inside the route's "one small parser" estimate, so no measurement forced Option B. Option C was
not taken.

## Gate output

### `npm run lint` — exit 0

```
> codexray@2.3.4 lint
> oxlint


LINT_EXIT=0
```

### `npm run test` — exit 0

```
> codexray@2.3.4 test
> vitest run


 RUN  v4.1.10 C:/Users/Administrator/Desktop/Projeler/CodeXray


 Test Files  119 passed (119)
      Tests  890 passed (890)
   Start at  20:03:00
   Duration  19.39s (transform 10.24s, setup 22.59s, import 19.30s, tests 42.70s, environment 149.71s)


TEST_EXIT=0
```

Test count before the turn (`git stash push -- src e2e`, then `npm run test`, then `git stash pop`):

```
 Test Files  119 passed (119)
      Tests  883 passed (883)
   Start at  19:59:55
   Duration  20.57s (transform 12.78s, setup 25.18s, import 21.93s, tests 45.53s, environment 163.82s)
```

Delta: 883 → 890, **+7 tests**.

### `npm run build` — exit 0

```
dist/assets/AiAssistant-DLznL7yl.js                   43.93 kB │ gzip:  14.50 kB
dist/assets/customSimulationCompiler-YI85GfrF.js      44.31 kB │ gzip:  13.94 kB
dist/assets/recompileSimulationInput-rDSYxmwj.js      81.54 kB │ gzip:  23.50 kB
dist/assets/titanPipeline-CjiTyeeu.js                 93.19 kB │ gzip:  25.83 kB
dist/assets/index-DnAUJfxV.js                        428.30 kB │ gzip: 132.07 kB

✓ built in 468ms
Initial JavaScript: 418.3 / 420.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB

BUILD_EXIT=0
```

### `npm run desktop:check` — not run

```
> git diff --name-only 590f4bd..HEAD -- src-tauri
(no output)
```

`src-tauri/**` did not change.

### `npm run test:e2e` — 77 + 2 passed

External-server procedure from `AGENTS.md`; dev server PID 41396, listener PID 9268, both cleaned
up and nothing else terminated.

```
  ok 65 [chromium] › e2e\translation-provenance.spec.ts:3:1 › translates a reviewed Java web solution into a verified simulation badge (3.4s)
  ok 64 [chromium] › e2e\titan-pipeline-verification.spec.ts:3:1 › shows verification failure and preserves the visible workspace on a mismatched trace (3.7s)
  ok 66 [chromium] › e2e\translation-provenance.spec.ts:155:1 › shows a refused Java fallback without changing workspace or persisted bound source (3.8s)
  ok 67 [chromium] › e2e\tree-input-resilience.spec.ts:10:1 › imports a sparse tree and keeps it after a cyclic document is rejected (4.1s)
  ok 60 [chromium] › e2e\titan-mode-user-graph.spec.ts:25:1 › requires a missing target, then builds on the exact user graph without replacing it (12.1s)
  ok 74 [chromium] › e2e\usage-scenarios.spec.ts:71:1 › resizes a true matrix simulation to a rectangular 8 by 15 grid (6.7s)
  ok 69 [chromium] › e2e\unicode-and-catalog.spec.ts:17:1 › finds and then clears Unicode KMP results without replacing user text (9.8s)
  ok 73 [chromium] › e2e\usage-scenarios.spec.ts:43:1 › edits, expands, and recompiles the active input from natural commands (8.1s)
  ok 75 [chromium] › e2e\usage-scenarios.spec.ts:86:1 › changes a numeric algorithm parameter and rebuilds its trace from a natural command (3.5s)
  ok 70 [chromium] › e2e\unicode-and-catalog.spec.ts:42:1 › clears incompatible timeline and analysis while touring catalog families (10.3s)
  ok 68 [chromium] › e2e\tree-input-resilience.spec.ts:55:1 › renames, adds, traverses, exports, reimports, and deletes a sparse-tree child (10.8s)
  ok 72 [chromium] › e2e\usage-scenarios.spec.ts:28:1 › changes LIS from quadratic DP to n-log-n binary search (10.0s)
  ok 71 [chromium] › e2e\usage-scenarios.spec.ts:13:1 › changes Jump Game from quadratic DP to linear greedy (10.1s)
  ok 77 [chromium] › e2e\web-problem-routing.spec.ts:3:1 › a fetched page cannot select the intent of a bound web solve (2.2s)
  ok 76 [chromium] › e2e\usage-scenarios.spec.ts:106:1 › changes a text algorithm parameter and rebuilds its trace from a quoted command (2.4s)

  77 passed (1.2m)

Running 2 tests using 1 worker

(node:18692) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
TIMELINE_MEASUREMENTS {"playwright":{"min":729.5469999999987,"median":798.09195,"max":891.1277},"inPage":{"min":162.89999997615814,"median":166.2999999821186,"max":167.10000002384186},"handler":{"min":0.40000009536743164,"median":0.5999999940395355,"max":0.8999998569488525},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1523.1934999999999,"catalogMs":241.29729999999972,"simulationMs":62.60010000000011,"dpMs":2438.8899999999994}
  ok 1 [chromium] › e2e\performance-budget.spec.ts:23:1 › keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets @performance (23.1s)
  ok 2 [chromium] › e2e\performance-budget.spec.ts:123:1 › survives repeated cross-subsystem use without stale state, overflow, or locked controls @performance (9.6s)

  2 passed (33.8s)
```

## Verification block, verbatim

```
19a3e763e417434ad96ba8b6a3041a86fdebeadf
=== git config user.email
iyott131@gmail.com
=== git diff --name-only
docs/titan/routes/R25-four-of-eleven-never-match.md
e2e/translation-provenance.spec.ts
src/components/AiAssistant.tsx
src/components/LeetCodeDrawer.test.tsx
src/i18n/translations.ts
src/services/titanModeRouting.test.ts
src/services/webSource.test.ts
src/services/webSource.ts
src/types/webSource.ts
=== git diff --stat
 .../titan/routes/R25-four-of-eleven-never-match.md | 241 +++++++++++++++++++++
 e2e/translation-provenance.spec.ts                 |   1 +
 src/components/AiAssistant.tsx                     |   3 +-
 src/components/LeetCodeDrawer.test.tsx             |   2 +-
 src/i18n/translations.ts                           |  12 +
 src/services/titanModeRouting.test.ts              |   2 +-
 src/services/webSource.test.ts                     |  77 ++++++-
 src/services/webSource.ts                          | 123 ++++++++++-
 src/types/webSource.ts                             |  19 +-
 9 files changed, 463 insertions(+), 17 deletions(-)
```

### Grep 5 — `simulationCompatibility`, at HEAD

```
src\components\AiAssistant.tsx:555:            { role: 'ai' as const, content: `${t('webSourceReady', locale)}\n\n**${problem.title}**\n\n${localizedCompatibilityReason(problem.simulationCompatibility, locale)}` },
src\components\AiAssistant.tsx:572:        if (!activeWebSession.problem.simulationCompatibility.compatible) {
src\components\LeetCodeDrawer.test.tsx:55:      simulationCompatibility: { compatible: true, code: 'fits-simlang', reason: 'test' },
src\services\titanModeRouting.test.ts:289:    simulationCompatibility: { compatible: true, code: 'fits-simlang', reason: 'ok' },
src\services\webSource.test.ts:36:    expect(problem.simulationCompatibility.compatible).toBe(true);
src\services\webSource.test.ts:101:    expect(problem.simulationCompatibility.compatible).toBe(false);
src\services\webSource.test.ts:110:  }).simulationCompatibility;
src\services\webSource.ts:10:  SimulationCompatibilityCodeV1,
src\services\webSource.ts:11:  SimulationCompatibilityV1,
src\services\webSource.ts:370:const compatibilityTranslationKey = (code: SimulationCompatibilityCodeV1): string =>
src\services\webSource.ts:374:  code: SimulationCompatibilityCodeV1,
src\services\webSource.ts:376:): SimulationCompatibilityV1 => ({
src\services\webSource.ts:382:const simulationCompatibility = (
src\services\webSource.ts:385:): SimulationCompatibilityV1 => {
src\services\webSource.ts:411:  compatibility: SimulationCompatibilityV1,
src\services\webSource.ts:462:    simulationCompatibility: simulationCompatibility(signature, description),
src\types\webSource.ts:66:  simulationCompatibility: SimulationCompatibilityV1;
src\types\webSource.ts:69:export type SimulationCompatibilityCodeV1 =
src\types\webSource.ts:77:export interface SimulationCompatibilityV1 {
src\types\webSource.ts:79:  code: SimulationCompatibilityCodeV1;
```

### Grep 5 — `simulationCompatibility`, at base `590f4bd`

```
src\components\AiAssistant.tsx:571:        if (!activeWebSession.problem.simulationCompatibility.compatible) {
src\components\LeetCodeDrawer.test.tsx:55:      simulationCompatibility: { compatible: true, reason: 'test' },
src\services\titanModeRouting.test.ts:289:    simulationCompatibility: { compatible: true, reason: 'ok' },
src\services\webSource.test.ts:36:    expect(problem.simulationCompatibility.compatible).toBe(true);
src\services\webSource.test.ts:101:    expect(problem.simulationCompatibility.compatible).toBe(false);
src\services\webSource.ts:298:const simulationCompatibility = (signature: string | null, description: string) => {
src\services\webSource.ts:357:    simulationCompatibility: simulationCompatibility(signature, description),
src\types\webSource.ts:66:  simulationCompatibility: {
```

Delta: 8 hits → 20 hits. The path-selecting production consumer is still exactly one branch
(`AiAssistant.tsx:572`); the growth is the new type, its constructor, and the two fixture updates.
One new production read was added at `AiAssistant.tsx:555`, which renders the reason and does not
select a path.

### Grep 6 — `multiArray|unsupported =`, at HEAD

```
(no output)
```

### Grep 6 — `multiArray|unsupported =`, at base `590f4bd`

```
src\services\webSource.ts:300:  const unsupported = /\b(matrix|grid|listnode|linked list|binary tree node|object\[\]|map<|set<|double\[\]|char\[\]\[\]|int\[\]\[\])\b/;
src\services\webSource.ts:302:  const multiArray = (parameters.match(/(?:int|long|string|char)\s*\[\]/gi)?.length ?? 0) > 1;
src\services\webSource.ts:303:  if (unsupported.test(combined) || multiArray) {
```

Delta: 3 hits → 0. Both the eleven-alternative pattern and the `multiArray` counter are gone; the
seven working alternatives live on in `SHAPE_WORDS` and the two-array-parameter guard lives on as
`parameterTypes.filter(isArrayType).length > 1`.

### Grep 7 — `Math\.random`

```
src\components\AiAssistant.tsx:1181:      ? (['lcs', 'edit', 'knapsack'] as const)[Math.floor(Math.random() * 3)]
src\components\AiAssistant.tsx:1184:      ? Math.floor(Date.now() + Math.random() * 1_000_000)
src\services\trace\interpreter.ts:163:    math.random = native('Math.random', () => this.nextRandom());
src\services\trace\jsTracer.test.ts:114:    const source = `function solve() { return [Math.random(), Math.random()]; }`;
src\services\algorithmCatalog.ts:90:  return filtered[Math.floor(Math.random() * filtered.length)];
src\services\titanEngine.ts:105:  `gm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\titanEntry.ts:67:  const runId = `gm-catalog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\webProblemOrchestrator.ts:196:    runId: `web-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
```

Identical to the base; this turn added none, and no hit is in `webSource.ts`.

### Grep 8 — `new Function|eval\(`

```
src\services\trace\jsTracer.test.ts:136:    ['eval("1 + 1")', 'Dynamic code execution'],
src\services\trace\jsTracer.test.ts:137:    ['new Function("return 1")', 'Function constructor'],
src\services\trace\traceIntelligence.test.ts:51:    expect(() => queryTrace(trace, 'eval(i)')).toThrow('Unsupported trace query');
```

Identical to the base; all three are tests asserting these constructs are *rejected*.

## Verdict flip table

53 signatures were run through the base implementation — its body transcribed verbatim into a
throwaway probe at the repository root, run with `npx vitest run`, output written with
`appendFileSync`, then deleted — and through the committed one, side by side. `base=` is the base
verdict, `now=` the committed one.

```
     "int f(int[] matrix)" | desc="x" | base=false -> now=false code=unsupported-shape-in-description
     "int f(int[] grid)" | desc="x" | base=false -> now=false code=unsupported-shape-in-description
     "ListNode f(ListNode head)" | desc="x" | base=false -> now=false code=unsupported-element-type
     null | desc="reverse a linked list" | base=false -> now=false code=unsupported-shape-in-description
     null | desc="a binary tree node value" | base=false -> now=false code=unsupported-shape-in-description
FLIP "int f(Object[] items)" | desc="x" | base=true -> now=false code=unsupported-element-type
     "int f(Map<String,Integer> m)" | desc="x" | base=false -> now=false code=unsupported-element-type
     "int f(Set<Integer> s)" | desc="x" | base=false -> now=false code=unsupported-element-type
FLIP "double f(double[] xs)" | desc="x" | base=true -> now=false code=unsupported-element-type
FLIP "int f(char[][] board)" | desc="x" | base=true -> now=false code=multi-dimensional-array
FLIP "int f(int[][] nums)" | desc="x" | base=true -> now=false code=multi-dimensional-array
FLIP "int solve(int[][] nums)" | desc="x" | base=true -> now=false code=multi-dimensional-array
     "int solve(int[][]nums)" | desc="x" | base=false -> now=false code=multi-dimensional-array
     "int solve(int[][] matrix)" | desc="x" | base=false -> now=false code=multi-dimensional-array
     "int solve(int[][] grid)" | desc="x" | base=false -> now=false code=multi-dimensional-array
FLIP "int[][] solve(int[] nums)" | desc="x" | base=true -> now=false code=multi-dimensional-array
     "int solve(int[] a, int[] b)" | desc="x" | base=false -> now=false code=multiple-array-parameters
FLIP "double solve(double[] xs)" | desc="x" | base=true -> now=false code=unsupported-element-type
FLIP "int solve(char[][] board)" | desc="x" | base=true -> now=false code=multi-dimensional-array
     "int solve(int[] nums)" | desc="x" | base=true -> now=true code=fits-simlang
     "int solve(String s)" | desc="x" | base=true -> now=true code=fits-simlang
     "int solve(int n)" | desc="x" | base=true -> now=true code=fits-simlang
     "public int[] twoSum(int[] nums, int target)" | desc="Return the indices of two values whose sum is target." | base=true -> now=true code=fits-simlang
     "public int compute(int[] nums)" | desc="x" | base=true -> now=true code=fits-simlang
     "public int solve(int[][] grid)" | desc="Return the number of rows in the matrix." | base=false -> now=false code=multi-dimensional-array
     "boolean solve(String s, char c)" | desc="x" | base=true -> now=true code=fits-simlang
     "int solve(int[]nums)" | desc="x" | base=true -> now=true code=fits-simlang
     "void solve(long[] xs)" | desc="x" | base=true -> now=true code=fits-simlang
FLIP "List<Integer> solve(int[] nums)" | desc="x" | base=true -> now=false code=unsupported-element-type
     "int solve(int... nums)" | desc="x" | base=true -> now=true code=fits-simlang
     null | desc="no signature at all here" | base=false -> now=false code=no-signature
FLIP "int solve(int[][][] cube)" | desc="x" | base=true -> now=false code=multi-dimensional-array
FLIP "Integer[][] solve(int n)" | desc="x" | base=true -> now=false code=multi-dimensional-array
FLIP "float[] solve(int n)" | desc="x" | base=true -> now=false code=unsupported-element-type
FLIP "List<List<Integer>> solve(int[] nums)" | desc="x" | base=true -> now=false code=unsupported-element-type
FLIP "TreeNode solve(TreeNode root)" | desc="x" | base=true -> now=false code=unsupported-element-type
     "public static long fib(int n)" | desc="x" | base=true -> now=true code=fits-simlang
     "String solve(String s, String t)" | desc="x" | base=true -> now=true code=fits-simlang
     "char solve(char[] letters)" | desc="x" | base=true -> now=true code=fits-simlang
     "boolean solve(boolean flag)" | desc="x" | base=true -> now=true code=fits-simlang
     "int solve()" | desc="x" | base=true -> now=true code=fits-simlang
     "solve(int[] nums)" | desc="x" | base=true -> now=true code=fits-simlang
     "int solve(int[])" | desc="x" | base=true -> now=true code=fits-simlang
     "public int longestPalindrome(String s)" | desc="Find the longest palindromic substring." | base=true -> now=true code=fits-simlang
     "int maxProfit(int[] prices)" | desc="You are given an array of prices." | base=true -> now=true code=fits-simlang
     "int[] sortArray(int[] nums)" | desc="Sort the array." | base=true -> now=true code=fits-simlang
     "int solve(long[] a, int k)" | desc="x" | base=true -> now=true code=fits-simlang
FLIP "double solve(int[] nums)" | desc="x" | base=true -> now=false code=unsupported-element-type
FLIP "int solve(Object o)" | desc="x" | base=true -> now=false code=unsupported-element-type
     "int solve(int [] nums)" | desc="x" | base=true -> now=true code=fits-simlang
     "int solve( int[] nums )" | desc="x" | base=true -> now=true code=fits-simlang
     "public int solve(final int[] nums)" | desc="x" | base=true -> now=true code=fits-simlang
     "int solve(Map<String, Integer> m)" | desc="x" | base=false -> now=false code=unsupported-element-type

total=53 flips=16
```

**16 flips, every one `compatible: true` → `compatible: false`. Zero flips in the other
direction** — `grep -c "base=false -> now=true"` over that output returned `0`.

Both directions, by signature text:

`true` → `false`, `multi-dimensional-array` (7):

- `int f(char[][] board)`
- `int f(int[][] nums)`
- `int solve(int[][] nums)`
- `int[][] solve(int[] nums)`
- `int solve(char[][] board)`
- `int solve(int[][][] cube)`
- `Integer[][] solve(int n)`

`true` → `false`, `unsupported-element-type` (9):

- `int f(Object[] items)`
- `double f(double[] xs)`
- `double solve(double[] xs)`
- `List<Integer> solve(int[] nums)`
- `float[] solve(int n)`
- `List<List<Integer>> solve(int[] nums)`
- `TreeNode solve(TreeNode root)`
- `double solve(int[] nums)`
- `int solve(Object o)`

`false` → `true` (0): none.

## Acceptance

1. **All four measured signatures that are wrongly accepted today are rejected:
   `int solve(int[][] nums)`, `int solve(char[][] board)`, `double solve(double[] xs)`,
   `int f(Object[] items)`.** — met.
   `src/services/webSource.test.ts:112` `rejects the four array shapes the old pattern named but never matched`.
   Production call site: `src/services/webSource.ts:462`.

2. **Whitespace does not change a verdict. `int solve(int[][]nums)` and `int solve(int[][] nums)`
   agree. A test asserts it.** — met.
   `src/services/webSource.test.ts:119` `does not let whitespace decide a verdict`, which also
   pairs `int solve(int[]nums)` and `int solve(int [] nums)` against `int solve(int[] nums)`.

3. **A matrix return type is rejected: `int[][] solve(int[] nums)`.** — met.
   `src/services/webSource.test.ts:125` `rejects a two-dimensional return type`.

4. **The seven alternatives that work today still work. Assert all seven.** — met.
   `src/services/webSource.test.ts:129` `keeps rejecting the seven shape hints that worked before`
   asserts `matrix`, `grid`, `listnode`, `linked list`, `binary tree node`, `map<` and `set<`
   against the route's own representative signatures.

5. **`int solve(int[] a, int[] b)` stays rejected — do not lose the `multiArray` guard while
   replacing it.** — met.
   `src/services/webSource.test.ts:139` `keeps rejecting two array parameters`, under the new
   `multiple-array-parameters` code.

6. **At least three signatures that are compatible today and must stay compatible are asserted
   compatible: a bare `int[]`, a `String`, and a scalar. Name them in the handoff.** — met.
   `src/services/webSource.test.ts:143` `keeps the bounded array, string, and scalar shapes compatible`.
   The three named: **`int solve(int[] nums)`** (bare `int[]`), **`int solve(String s)`** (a
   `String`), **`int solve(int n)`** (a scalar). Three more are asserted beside them:
   `public int[] twoSum(int[] nums, int target)` (the repository's own fixture, also covered at
   `src/services/webSource.test.ts:36`), `boolean solve(String s, char c)`, and
   `public static long fib(int n)`.

7. **(T0) The handoff lists every signature whose verdict flips, with the signature text, in both
   directions.** — met. See **Verdict flip table**: 16 flips printed with signature text and new
   code, grouped by direction; the `false` → `true` direction is empty and that count is
   machine-derived, not asserted.

8. **Rejection reasons are distinguishable — a caller can tell "two-dimensional array" from
   "unsupported element type" from "no signature found". EN and TR.** — met.
   `src/services/webSource.test.ts:152` `distinguishes every rejection class in both locales`
   asserts five distinct codes in a fixed order and, for each, that EN and TR resolve to real,
   different strings rather than the key itself. User-visible:
   `src/components/AiAssistant.tsx:555` renders
   `localizedCompatibilityReason(problem.simulationCompatibility, locale)` into the
   read-web-source chat message, and `e2e/translation-provenance.spec.ts:265` asserts that
   `A two-dimensional array type is outside SimLang V1.` is visible after reading
   `https://example.com/refused-matrix-scan`.

9. **No page content is executed, evaluated, or trusted; raw HTML is not persisted. Show the diff
   touches no network or storage call.** — met.
   `git diff --unified=0 590f4bd..HEAD -- src/services/webSource.ts` produces exactly five hunk
   headers: `@@ -9,0 +10,2 @@`, `@@ -10,0 +13,2 @@`, `@@ -298,7 +302,35 @@`, `@@ -306,2 +338,13 @@`,
   `@@ -309,0 +353,62 @@`. `readWebSource`, `saveBoundWebSource`, `loadBoundWebSource`,
   `clearBoundWebSource`, and every `fetch` and `sessionStorage` call lie outside all five. The
   parser reads the signature string with `String` methods and regular expressions only; greps 7
   and 8 show no `Math.random`, `eval`, or `new Function` was added.

10. **`npm run lint`, `npm run test`, `npm run build` pass. `npm run desktop:check` if
    `src-tauri/**` changed.** — met. All three exit 0, output above. `src-tauri/**` did not
    change, so `desktop:check` was not run.

11. **e2e passes. `translation-provenance.spec.ts` exercises this path — say whether its verdicts
    changed.** — met. 77 + 2 passed.
    **`translation-provenance.spec.ts`'s compatibility verdicts did not change.** Both of its
    fixtures use the signature `public int solve(int[][] grid)`, which was `compatible: false` at
    the base (caught by the `grid` word alternative) and is `compatible: false` now (caught
    structurally as `multi-dimensional-array`); the flip table's line for that exact
    signature-and-description pair reads `base=false -> now=false`. Both tests still take the Java
    fallback branch at `AiAssistant.tsx:572`. What changed is the **reason code**, from the single
    catch-all sentence to `multi-dimensional-array`, which is what the new assertion at
    `e2e/translation-provenance.spec.ts:265` reads.
    `web-problem-routing.spec.ts` uses `public int compute(int[] nums)`: `compatible: true` before
    and after, so it still takes the model-authored branch.
    `smoke.spec.ts`'s reader fixture carries no signature segment: `compatible: false` before and
    after, now under the distinct `no-signature` code.

12. **No frozen or T0-owned path is written. `git diff --name-only 590f4bd..HEAD` proves it.** —
    met. See `## Untouched`.

13. **Every commit is DCO-signed as `Mustafa Özel <iyott131@gmail.com>`.** — met.

    ```
    19a3e763e417434ad96ba8b6a3041a86fdebeadf
    Mustafa Özel <iyott131@gmail.com>
    route(R25): close

    Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
    Signed-off-by: Mustafa Özel <iyott131@gmail.com>
    ```

## Diff scope

```
 .../titan/routes/R25-four-of-eleven-never-match.md | 241 +++++++++++++++++++++
 e2e/translation-provenance.spec.ts                 |   1 +
 src/components/AiAssistant.tsx                     |   3 +-
 src/components/LeetCodeDrawer.test.tsx             |   2 +-
 src/i18n/translations.ts                           |  12 +
 src/services/titanModeRouting.test.ts              |   2 +-
 src/services/webSource.test.ts                     |  77 ++++++-
 src/services/webSource.ts                          | 123 ++++++++++-
 src/types/webSource.ts                             |  19 +-
 9 files changed, 463 insertions(+), 17 deletions(-)
```

## Deviations

Five files outside `## Expected Files`.

1. **`src/types/webSource.ts`** — required by criterion 8. "Rejection reasons are distinguishable"
   cannot be a property of a free-form English sentence; it needs a discriminant a caller can
   switch on. `SimulationCompatibilityCodeV1` is a closed union declared beside `WebProblemSpecV1`,
   the only place the artifact's shape is defined.

2. **`src/components/AiAssistant.tsx`** — required by criterion 8's "EN and TR". A translation pair
   with no consumer is not a shipped string. The artifact's only production consumer lives here,
   so the localized reason is rendered into the read-web-source chat message (`:555`). The
   path-selecting branch at `:572` was not touched: the route's invariant that this turn changes
   *which* branch is chosen, never what a branch does after it is chosen, is intact.

3. **`e2e/translation-provenance.spec.ts`** — required by criterion 8 read against `PROTOCOL.md`'s
   rule that a criterion claiming user-visible behavior may not close on a unit test alone. One
   assertion added; no fixture, no verdict, and no existing assertion changed.

4. **`src/components/LeetCodeDrawer.test.tsx`** and **5. `src/services/titanModeRouting.test.ts`** —
   mechanical. Both construct a `simulationCompatibility` object literal, and the new required
   `code` field makes them type errors otherwise. One field added to each fixture; neither test's
   subject changed.

`src/i18n/translations.ts` was inside the forecast — "only if a reason string changes and it is
user-visible" — and both conditions hold.

## Discovered

- **The route's Option A sketch, taken literally, rejects a signature that has no return type.**
  Taking "the token before the method name" from a head of one token treats the *method name* as
  the return type, so `solve(int[] nums)` — a signature scraped without modifier and return type,
  which generic problem pages do produce — would be rejected as an unsupported element type. The
  first parser draft did exactly that. `declaredReturnType` now returns `null` below two tokens,
  and the flip table shows `solve(int[] nums)` staying compatible. Caught by measurement, not by
  reading the code.

- **The order of the three checks decides the reason, never the verdict.** Structural type checks
  run before the word scan, so `public int solve(int[][] grid)` now reports
  `multi-dimensional-array` rather than the weaker prose hint its description would also have
  produced. Any ordering of the three yields the same `compatible` boolean; only the code differs.

- **`multiArray` counted array *occurrences*, not array *parameters*.** Its pattern
  `(?:int|long|string|char)\s*\[\]` matches `int[]` exactly once inside `int[][]`, which is the
  second, independent reason a two-dimensional array was never caught — the route names it, and
  the replacement is immune because it counts parameters whose declared type is an array.

- **`reason` is now derived from the EN dictionary instead of duplicated.** `compatibilityVerdict`
  builds it with `t(key, 'en')`, so the persisted English sentence and the rendered English
  sentence cannot drift; `src/services/webSource.test.ts:175` asserts they are equal.

- **The initial JavaScript budget sits at 418.3 / 420.0 KiB.** This turn did not move it — the
  same figure is printed by the pre-change and post-change build runs — but the headroom is
  1.7 KiB, and the next turn that adds an eagerly imported module will hit it.

## Untouched

```
> git diff --name-only 590f4bd..HEAD -- .claude .agents/AGENTS.md docs/tasks docs/legacy CodeXray-readme-neon.svg docs/TITAN_MODE_YOL_HARITASI.md AGENTS.md
(no output)

> git diff --name-only 590f4bd..HEAD -- src-tauri
(no output)
```

`docs/titan/routes/R25-four-of-eleven-never-match.md` appears in the full `--name-only` list only
because T0's own `route(R25): open` commit is inside the `590f4bd..HEAD` range. This turn wrote
nothing under `docs/titan/routes/**`.

## Blockers

None.

## For the human

None.
