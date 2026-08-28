# H17c — grounded current-step verification at scale

## Turn

- Route: `R17c`
- Base SHA: `0712c05`
- End SHA: `9cf36109b92801a1ed7c597021ababdfb7f84b97`
- Status: `closed`
- Next holder: `Claude`

## Özet

Data doğrulaması artık yalnızca cevabın açıkça kurduğu bağları committed trace ile karşılaştırıyor; söylemediği değişkenleri zorunlu tutmuyor.
Fallback, JSON'u ortadan kesmek yerine 700 karaktere sığan tam ve deterministik bağları yayımlıyor.
Tüm desteklenen algoritmaların yasal en büyük girdileri EN/TR doğrulandı; en büyük `vars` serileştirmesi 21.204 karakterdi.

## What changed

| Path:line-range | Intent | Change |
|---|---|---|
| `src/services/titan/titanPipeline.ts:235-275` | Verify only explicit Data claims against committed values | edited |
| `src/services/titanEngine.ts:582-591` | Emit complete bounded variable bindings instead of slicing JSON mid-value | edited |
| `src/services/titan/titanPipeline.test.ts:21-77` | Build legal maximum-size inputs for every supported input kind | added |
| `src/services/titan/titanPipeline.test.ts:258-308` | Cover 200-item Merge Sort, the all-registry EN/TR oracle, and contradiction rejection | added |

## Commits

- `9cf36109b92801a1ed7c597021ababdfb7f84b97 route(R17c): close`

## Gate output

### `git log -1 --format=%H` — exit 0

```text
9cf36109b92801a1ed7c597021ababdfb7f84b97
```

### `git diff --stat "0712c05..HEAD"` — exit 0

```text
.../R17c-grounded-current-step-verification.md     | 197 +++++++++++++++++++++
 src/services/titan/titanPipeline.test.ts           | 107 +++++++++++
 src/services/titan/titanPipeline.ts                |  41 ++++-
 src/services/titanEngine.ts                        |  10 +-
 4 files changed, 346 insertions(+), 9 deletions(-)
```

### `Get-ChildItem ... 'slice\(0, 700\)'` — exit 0

```text
```

### `Get-ChildItem ... 'Math\.random'` — exit 0

```text
src\components\AiAssistant.tsx:1138:      ? (['lcs', 'edit', 'knapsack'] as const)[Math.floor(Math.random() * 3)]
src\components\AiAssistant.tsx:1141:      ? Math.floor(Date.now() + Math.random() * 1_000_000)
src\services\trace\interpreter.ts:163:    math.random = native('Math.random', () => this.nextRandom());
src\services\trace\jsTracer.test.ts:114:    const source = `function solve() { return [Math.random(), Math.random()]; }
`;
src\services\algorithmCatalog.ts:90:  return filtered[Math.floor(Math.random() * filtered.length)];
src\services\titanEngine.ts:104:  `gm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\titanEntry.ts:67:  const runId = `gm-catalog-${Date.now().toString(36)}-${Math.random().toString(36).slice
(2, 8)}`;
src\services\webProblemOrchestrator.ts:190:    runId: `web-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)
}`,
```

No match is new in `0712c05..9cf3610`; the close commit changes only the three files listed above.

### `npm run lint` — exit 0

```text
> oxlint
```

### `npm run test` — exit 0

Before R17c: 119 files / 828 tests. After R17c:

```text
> vitest run
 RUN  v4.1.10 C:/Users/Administrator/Desktop/Projeler/CodeXray
 Test Files  119 passed (119)
      Tests  831 passed (831)
   Start at  11:31:20
   Duration  18.69s (transform 9.27s, setup 23.54s, import 20.19s, tests 39.89s, environment 158.97s)
```

### `npm run build` — exit 0

```text
✓ 1888 modules transformed.
✓ built in 389ms
Initial JavaScript: 416.8 / 420.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
```

### `npm run desktop:check` — exit 0

```text
CodeXRay desktop version 2.3.4 is synchronized.
running 7 tests
test tests::authentication_errors_are_actionable_without_echoing_credentials ... ok
test tests::structured_output_requires_three_native_trials ... ok
test tests::reasoning_only_length_stop_is_returned_for_a_bounded_retry ... ok
test tests::probe_json_parser_accepts_plain_or_fenced_objects ... ok
test tests::non_loopback_and_credential_urls_are_rejected ... ok
test tests::loopback_urls_are_normalized ... ok
test tests::completion_timeout_scales_with_the_requested_output_budget ... ok
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
running 0 tests
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
running 0 tests
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### `npm run test:e2e` with external server and `CODEXRAY_E2E_WORKERS=2` — exit 0

The default 8-worker run twice timed out only at `radio-controller.spec.ts:172`; its isolated run passed in 7.034s. A 1-worker diagnostic passed radio but exposed an unrelated reflow instability. The supported 2-worker profile then passed twice, including once after the close commit. Final numeric output verbatim:

```text
Running 72 tests using 2 workers
  72 passed (2.2m)
Running 2 tests using 1 worker
TIMELINE_MEASUREMENTS {"playwright":{"min":745.955100000001,"median":798.7891500000005,"max":842.4558999999999},"inPage":{"min":165.10000000009313,"median":166.20000000018626,"max":167.40000000037253},"handler":{"min":0.19999999925494194,"median":0.5000000002328306,"max":0.7000000006519258},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1544.7914999999998,"catalogMs":241.9371000000001,"simulationMs":77.04649999999992,"dpMs":2953.9148999999998}
  2 passed (34.2s)
```

The exact listener and launcher PIDs created for the final run, `1320` and `4552`, were stopped after the suite.

## Acceptance

1. **A test runs the oracle at scale.** For every algorithm the registry supports, at the maximum legal input size for its input kind, every step's deterministic five-lens answer verifies in EN and TR. Report the largest `JSON.stringify(vars)` length encountered. This is the test whose absence caused both R17b and this route. — **met**: `src/services/titan/titanPipeline.test.ts:274`; largest length assertion `21_204` at line 293.
2. **The 200-element Merge Sort case verifies.** Named explicitly, with the measured `worstVarsChars`, so the regression has a reproduction that outlives this turn. — **met**: `src/services/titan/titanPipeline.test.ts:258`; measured `worstVarsChars = 764` at line 262.
3. **A test proves a contradicting value is still rejected** — an answer whose `Data` lens states `i` as a value the trace does not hold. If Option C was taken, this criterion is answered by stating that it can no longer be rejected, in the handoff summary's first sentence. — **met**: `src/services/titan/titanPipeline.test.ts:296` rejects committed `i: 2` versus stated `i = 3`.
4. R17b's six accepted phrasings, its ambiguity rejection, and R17's wrong-line, wrong-step, and unlabelled rejections all keep their verdicts. Same tests, unchanged. — **met**: unchanged parameterized/rejection tests at `src/services/titan/titanPipeline.test.ts:167`, `:212`, and `:235`; full suite 831/831.
5. The handoff states, per slot, what is compared and what can still slip past — in the same plain form H16 used for its ceiling. — **met**: `## Slot guarantees and ceiling` below.
6. `adapt-input`, the array templates, and `model-authored` are untouched. Name the R15, R16, and R18 tests that prove it. — **met**: R15 `rejects a well-formed artifact whose carried trace disagrees with independent recomputation` (`titanPipeline.test.ts:547`); R16 `defers the deterministic array engine apply and applies its verified package exactly once` (`:414`); R18 `independently verifies a model-authored package before previewing and applying it exactly once` (`:457`).
7. All four gates clean: `npm run lint`, `npm run test`, `npm run build`, `npm run desktop:check`. — **met**: `## Gate output` exit-0 blocks above.
8. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is Claude's to close. — **met locally**: `72 passed (2.2m)` and `2 passed (34.2s)` above; remote remains T0.
9. Two commits, in order: `route(R17c): close`, then `handoff(H17c): record`, both signed `-s` after verifying `git config user.email` returns `iyott131@gmail.com`. — **met at record time**: close `9cf3610`; handoff commit recorded below after identity output `iyott131@gmail.com`.

## Slot guarantees and ceiling

| Slot | Compared | What can still slip past |
|---|---|---|
| Code | The single distinct integer against committed `lineNumber`; result steps require zero integers and result-step wording | Other prose is unchecked if it introduces no second distinct integer |
| Data | Every explicit known-variable binding found in the slot is JSON-exact against committed `vars`; at least one binding is required | Omitted variables are allowed: the rule is “says nothing false,” not “says everything true”; unrelated prose and an extra unknown prose binding beside a correct known binding are not semantic-checked |
| Visual | Required labelled slot only | All content can be wrong |
| Reasoning | Required labelled slot only | All content can be wrong |
| Time | Parsed `N/M` against `currentIndex + 1` and `steps.length` | Other prose is unchecked |

## Diff scope

```text
.../R17c-grounded-current-step-verification.md     | 197 +++++++++++++++++++++
 src/services/titan/titanPipeline.test.ts           | 107 +++++++++++
 src/services/titan/titanPipeline.ts                |  41 ++++-
 src/services/titanEngine.ts                        |  10 +-
 4 files changed, 346 insertions(+), 9 deletions(-)
```

## Deviations

- `src/services/titanEngine.ts` was forecast as conditional and changed for criterion 1: complete bindings must be selected before bounding so the deterministic oracle always has at least one verifiable claim.
- Local e2e required `CODEXRAY_E2E_WORKERS=2` after the default 8-worker profile twice timed out in the pre-existing radio hover test. No e2e, timeout, or application code was changed.

## Discovered

- Maximum-input coverage reached a 21,204-character `vars` object, far above the old 700-character cut.
- The shipped local e2e suite has load-sensitive radio-hover and reflow behavior: 8 workers failed radio, 1 worker failed reflow, while 2 workers passed both full phases twice.

## Untouched

`git show --name-only 9cf3610` lists only:

```text
src/services/titan/titanPipeline.test.ts
src/services/titan/titanPipeline.ts
src/services/titanEngine.ts
```

No frozen or T0-owned path changed in the close commit. The route file in the base-range stat is T0's route-opening commit.

## Blockers

none locally. T0 still owns the remote `browser` job and `AGENTS.md` reconciliation.

## For the human

none
