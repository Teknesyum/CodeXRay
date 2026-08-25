# H06 — Translation reaches the user

## Turn

- Route: R06
- Base SHA: `e38fb9eddf43c1f2cf074cc0f190d4a4442792b8`
- End SHA: `b73945bfeae6ad665cb4146b8be9bc33fc7d0703`
- Status: `closed`
- Next holder: Claude (T0)

## Özet

Web problem çözümünün incelenmiş Java geri dönüşü artık özgün Java'yı çalıştırmadan
SimLang-Lite'a çevriliyor, deterministik derleyici kapılarından geçiriliyor ve mevcut atomik
paket işlemiyle çalışma alanına uygulanıyor. Kullanıcı bu gerçek akışın sonunda EN/TR çeviri
kaynağı rozetini görüyor. Başarısız çeviri çalışma alanını, paketi ve rozeti değiştirmiyor.

## What changed

| path:line | change |
|---|---|
| `src/services/webProblemOrchestrator.ts:44-61,101-116,195-205,381-427` | Translator işi, doğrulanmış zarf ve üretim çeviri çağrısı eklendi. |
| `src/components/AiAssistant.tsx:565-605` | Doğrulanmış paket mevcut atomik işlemle uygulanıp `validated-simulation` oturumuna yazıldı. |
| `src/services/titan/translate.ts:46-85` | `verifiedAt` çağrı noktasından enjekte edilir hale getirildi. |
| `src/components/CodeEditor.tsx:229-234` | Rozetin iki satır içi metni i18n anahtarlarına taşındı. |
| `src/i18n/translations.ts:257-259,615-617` | Uygulama sonucu, rozet başlığı ve rozet metni EN/TR eklendi. |
| `src/services/webProblemOrchestrator.test.ts:25-49` | Derleme reddinde görünür çalışma alanının değişmediği kanıtlandı. |
| `src/services/titan/translate.test.ts:38-61` | Enjekte edilen doğrulama zamanı sabitlendi. |
| `src/i18n/translations.test.ts:23-31` | Rozet ve sonuç metinlerinin iki dilde çıktısı sabitlendi. |
| `e2e/translation-provenance.spec.ts:3-141` | URL'den görünür doğrulanmış JAVA rozetine gerçek kullanıcı akışı eklendi. |

## Commits

- `b73945bfeae6ad665cb4146b8be9bc33fc7d0703 route(R06): close`
- `handoff(H06): record` — this handoff commit

Both commits use `-s`. Before each commit, repository-local `user.email` was required to equal
`iyott131@gmail.com`. Close commit evidence:

```text
Signed-off-by: Mustafa Özel <iyott131@gmail.com>
```

## Foreign-source entry measurement

There are two user-editable/source-bearing surfaces, but only one identifies a foreign
language and requests conversion:

1. The Code Editor textarea accepts arbitrary source at `CodeEditor.tsx:360-371`. It stores
   user text as the current source; it does not infer a language or request translation.
2. The bound web-source flow classifies `solve-web-problem` at `AiAssistant.tsx:527,546`.
   An incompatible problem takes the reviewed Java fallback at `AiAssistant.tsx:548-557`.
   This is the honest translation entry because the branch already knows the source is Java.

Pasted measurement:

```text
src/types/webSource.ts:81:    kind: 'validated-simulation';
src/types/webSource.ts:140:  intent: 'read-web-source' | 'solve-web-problem' | 'explain-bound-solution';
src/services/webProblemOrchestrator.ts:192:    intent: 'solve-web-problem',
src/components/AiAssistant.tsx:527:      if (webIntent?.type === 'read-web-source' || (webIntent?.type === 'solve-web-problem' && webIntent.url)) {
src/components/AiAssistant.tsx:546:      if (webIntent?.type === 'solve-web-problem') {
src/components/AiAssistant.tsx:548:        const { isWebProblemSolveCapable, startJavaFallbackRun } = await import('../services/webProblemOrchestrator');
src/components/AiAssistant.tsx:557:          const run = startJavaFallbackRun({
src/components/CodeEditor.tsx:360:              <textarea
src/components/CodeEditor.tsx:370:                  setCode(event.target.value);
```

Translation is carried by the existing `solve-web-problem` web-source intent. No eighth
`TitanModeIntent` was added.

## Call path

| hop | file:line |
|---|---|
| User submits a bound problem URL | `src/components/AiAssistant.tsx:527` |
| Existing intent chooses Java fallback | `src/components/AiAssistant.tsx:546-557` |
| Local code-author and critic produce reviewed Java | `src/services/webProblemOrchestrator.ts:293-380` |
| Local compiler supplies untrusted SimLang-Lite fragments | `src/services/webProblemOrchestrator.ts:381-401` |
| Deterministic translator validates and compiles | `src/services/webProblemOrchestrator.ts:402`; `src/services/titan/translate.ts:46-90` |
| Existing atomic package transaction applies | `src/components/AiAssistant.tsx:572` |
| Session records validated package | `src/components/AiAssistant.tsx:583-593` |
| Code Editor renders provenance | `src/components/CodeEditor.tsx:229-234` |
| User-flow proof | `e2e/translation-provenance.spec.ts:3-141` |

Production-caller grep:

```text
src\services\titan\translate.test.ts:4:import { translateToVerifiedPackage, type TranslatableLanguage } from './translate';
src\services\titan\translate.test.ts:38:const translate = (language: TranslatableLanguage, attempts: string[][]) => translateToVerifiedPackage({
src\services\titan\translate.ts:46:export const translateToVerifiedPackage = (options: {
src\services\webProblemOrchestrator.ts:18:import { translateToVerifiedPackage, type TranslationResult } from './titan/translate';
src\services\webProblemOrchestrator.ts:107:}): TranslationResult => translateToVerifiedPackage({
```

## `verifiedAt` decision

`verifiedAt` is injected. Tests pass a fixed value, so the same accepted fragments produce a
byte-reproducible package. Production passes `Date.now()` at the orchestration call site
(`webProblemOrchestrator.ts:407`) because provenance should record when this user-visible
verification happened. Nothing branches on the timestamp, and the other three timestamps
remain untouched.

## Gate output

### lint

```text
exit code: 0
> codexray@2.3.4 lint
> oxlint
```

### test

Before: 751. After: 753.

```text
exit code: 0
Test Files  119 passed (119)
     Tests  753 passed (753)
```

### build

```text
exit code: 0
Initial JavaScript: 416.4 / 420.0 KiB
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

### local e2e

```text
exit code: 0
68 passed (1.2m)
TIMELINE_MEASUREMENTS {"playwright":{"min":804.8839000000007,"median":852.3757000000005,"max":910.7953000000016},"inPage":{"min":165.19999999925494,"median":166.19999999925494,"max":174.09999999776483},"handler":{"min":0.4999999962747097,"median":0.7499999981373549,"max":1.0000000037252903},"deliberateDelayMs":0}
2 passed (35.5s)
```

The new E2E itself passed as test 60:

```text
ok 60 [chromium] › e2e\translation-provenance.spec.ts:3:1 › translates a reviewed Java web solution into a verified simulation badge (4.7s)
```

## Security grep

The route's repository-wide command emitted only three pre-existing negative-test strings:

```text
src\services\trace\jsTracer.test.ts:136:    ['eval("1 + 1")', 'Dynamic code execution'],
src\services\trace\jsTracer.test.ts:137:    ['new Function("return 1")', 'Function constructor'],
src\services\trace\traceIntelligence.test.ts:51:    expect(() => queryTrace(trace, 'eval(i)')).toThrow('Unsupported trace query');
```

A scan limited to all nine R06-changed files for `eval(`, `new Function`, or dynamic
`import(` from user/model text emitted no unsafe match. The only `import(` matches are static
literal module paths already used by the bundle. The original Java remains data in the
translator prompt and provenance; it is never executed.

## Acceptance

1. **Met** — every source-bearing entry and current behavior is named with pasted greps in `Foreign-source entry measurement`; `solve-web-problem` is the measured translation entry.
2. **Met** — production caller: `src/services/webProblemOrchestrator.ts:107`.
3. **Met** — `Call path` lists every hop and the traversing E2E.
4. **Met** — `e2e/translation-provenance.spec.ts:3-141` drives URL submission to the visible English badge; full E2E passed.
5. **Met** — `src/services/webProblemOrchestrator.test.ts:25-49` feeds invalid SimLang-Lite and asserts code, input, package id, and badge remain unchanged.
6. **Met** — no unsafe match exists in changed files; repository-wide matches are rejection tests recorded above.
7. **Met** — EN/TR keys and assertions are in `translations.ts:257-259,615-617` and `translations.test.ts:23-31`; badge inline strings are gone.
8. **Met** — injected timestamp decision is implemented and recorded above.
9. **Met / T0 reconciled** — existing `solve-web-problem` carries translation; no eighth Titan intent exists and no AGENTS file was touched by the holder.
10. **Met / T0 reconciled** — `src/services/titan/AGENTS.md` already says two seams live.
11. **Met** — all four local gates are clean.
12. **Met locally / T0 remote pending** — both local E2E phases passed; no push was made.
13. **Met** — close then handoff, both `-s`, with no corrective commit.

## Verification output

```text
b73945bfeae6ad665cb4146b8be9bc33fc7d0703

 AGENTS.md                                          |   9 +-
 docs/DEVIRALAN.md                                  |   4 +
 docs/titan/PROTOCOL.md                             |  76 +++++-
 docs/titan/SOLE_BOOTSTRAP.md                       |  18 +-
 docs/titan/routes/R05-one-intent-vocabulary.md     |  91 +++++++
 .../routes/R06-translation-reaches-the-user.md     | 302 +++++++++++++++++++++
 e2e/translation-provenance.spec.ts                 | 141 ++++++++++
 src/components/AiAssistant.tsx                     |  38 ++-
 src/components/CodeEditor.tsx                      |   8 +-
 src/i18n/translations.test.ts                      |   9 +
 src/i18n/translations.ts                           |   6 +
 src/services/titan/AGENTS.md                       |  17 +-
 src/services/titan/translate.test.ts               |   2 +
 src/services/titan/translate.ts                    |   3 +-
 src/services/webProblemOrchestrator.test.ts        |  28 +-
 src/services/webProblemOrchestrator.ts             | 110 +++++++-
 16 files changed, 808 insertions(+), 54 deletions(-)
```

The base range includes T0-owned protocol, route, rollup, bootstrap, and AGENTS reconciliation.
The close commit contains exactly the nine holder-owned product/test paths in `What changed`.
The verbatim `CodeEditor.tsx` diff contains only the provenance badge string move.

## Deviations

None. All changed holder-owned paths were forecast by `Expected Files`.

## Discovered

- The Playwright wrapper does not forward a trailing spec path; the attempted focused run
  therefore ran the complete 68-test normal phase and then the complete 2-test performance
  phase. Both passed, so no second E2E run was required.
- The repository-wide security grep necessarily finds three strings in tests that prove
  dynamic execution is rejected. No new match was introduced.

## Untouched

```text
git diff --name-only e38fb9eddf43c1f2cf074cc0f190d4a4442792b8..HEAD -- .claude .agents docs/tasks docs/legacy CodeXray-readme-neon.svg docs/TITAN_MODE_YOL_HARITASI.md src/services/titanEngine.ts src/services/titanEntry.ts src/services/input/inputPatch.ts src/services/trace
<no output>
```

The pre-existing untracked `.claude/`, `CodeXray-readme-neon.svg`, and
`docs/TITAN_MODE_YOL_HARITASI.md` remain untouched.

## Blockers

- T0 must push and close the remote `browser` job.

## For the human

none
