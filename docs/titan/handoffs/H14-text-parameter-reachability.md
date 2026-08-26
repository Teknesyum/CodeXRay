# H14 — Text parameter reachability

## Turn

- Route: R14
- Base SHA: `ad8bb32`
- End SHA: `a2683e90f671f5a1d5fd6ea89a2b3c0ba6eb1ac0`
- Status: `closed`
- Next holder: Claude (T0)

## Özet

Beş kalan anahtarın tamamı açık ayraçlı EN/TR isteklerden ulaşılabilir oldu: dört metin
anahtarı çift tırnak, `values` ise sayısal JSON dizisi ister. Tırnak davranışı tek ortak
çıkarıcıda birleşti; 805 test ve 70+2 yerel E2E sıfır flaky ile geçti.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `src/services/requestLiterals.ts:1-15` | canonical double-quoted text and numeric-array extraction | added |
| `src/services/input/inputPatch.ts:169-207,296-311` | classify five text keys and validate text/array values | edited |
| `src/services/input/inputPatch.test.ts:153-206` | prove EN/TR syntax, apostrophes, collision, refusal, and rejection | edited |
| `src/services/inputRequestAdapter.ts:1-2,152-157` | use the canonical quote extractor | edited |
| `src/services/stringCompiler.ts:10,28-31` | use the canonical quote extractor | edited |
| `e2e/usage-scenarios.spec.ts:106-125` | change KMP pattern and observe rebuilt trace | edited |

## Decisions

Decision one: Option A. `pattern`, `query`, `other`, and Minimum Window Substring's text
`target` require a straight or smart double-quoted literal. Single quotes are not delimiters
because they collide with Turkish suffix apostrophes. An unquoted near-match produces no
patch and falls through; this route adds no special reply because the existing assistant
fallback remains responsible for non-command text.

Decision two: `values` is reachable through an explicit numeric JSON array literal. Brackets
are its delimiter; the stored parameter remains the canonical JSON string consumed by the
Knapsack simulator.

Decision three: `requestLiterals.ts` is canonical. The two prior quote regexes were removed
and both callers use `extractQuotedLiteral`; no third quote convention was added.

## Reachable syntax

| key | English | Turkish |
|---|---|---|
| `pattern` | `set pattern to "abc"` | `deseni "abc" yap` |
| `query` | `set query to "grow"` | `sorguyu "grow" yap` |
| `other` | `set second text to "ace"` | `ikinci metni "ace" yap` |
| text `target` | `set target to "ABC"` | `hedefi "ABC" yap` |
| `values` | `set item values to [6,12,14]` | `ürün değerlerini [6,12,14] yap` |

Vocabulary: 11 of 11 declared parameter keys are reachable. None remain deferred and no
successor route is required for parameter reachability.

## Turkish apostrophe measurement

The chosen extractor was executed through `createSemanticParameterPatches`:

```text
deseni "abc" yap       -> [{ op: 'set-param', name: 'pattern', value: 'abc' }]
pattern'i "abc" yap    -> [{ op: 'set-param', name: 'pattern', value: 'abc' }]
pattern'i 'abc' yap    -> []
```

## Validation and atomicity

Text definitions reject non-string and empty values. `values` additionally rejects anything
that is not a non-empty finite-number JSON array. Unknown keys still reject against the
active algorithm definition. These checks are stricter than typing into the form only where
the simulator would reject on save; the request path never accepts a value the form-backed
simulation can use incorrectly.

The existing multi-op identity test applies a valid parameter followed by an undeclared one
and asserts the exact original package, input, and timeline identities. It exercises the
same atomic `applyInputPatches` path used by text parameters.

## R13 regression and target collision

`hedefi 42 yap` and `set the target to 42` on Binary Search still produce numeric `42`; the
test asserts `typeof value === 'number'`. Comparable quoted requests on Minimum Window
Substring produce string `"ABC"`, while its unquoted `hedefi 42 yap` produces no patch.

## Call path

`e2e/usage-scenarios.spec.ts:106` → `AiAssistant.tsx:655` →
`titanModeRouting.ts:119` → `titanEngine.ts:842-867` →
`inputPatch.ts:177-207,296-311` → rebuilt KMP trace with `pattern=abc` at
`e2e/usage-scenarios.spec.ts:119-124`.

## Commits

- `a2683e90f671f5a1d5fd6ea89a2b3c0ba6eb1ac0 route(R14): close`
- `handoff(H14): record` — this commit

Both are signed after `git config user.email` returned `iyott131@gmail.com`.

## Gate output

```text
lint: exit code 0 — > oxlint
test: exit code 0 — Test Files 119 passed (119) | Tests 805 passed (805)
test count: before 797; after 805
build: exit code 0 — Initial JavaScript: 416.6 / 420.0 KiB
desktop:check: exit code 0 — test result: ok. 7 passed; 0 failed
local e2e: exit code 0 — 70 passed (1.1m) | 2 passed (34.2s)
```

## Verification output

```text
a2683e90f671f5a1d5fd6ea89a2b3c0ba6eb1ac0
.../routes/R14-text-parameter-reachability.md      | 241 +++++++++++++++++++++
 e2e/usage-scenarios.spec.ts                        |  20 ++
 src/services/input/inputPatch.test.ts              |  46 ++++
 src/services/input/inputPatch.ts                   |  34 ++-
 src/services/inputRequestAdapter.ts                |   3 +-
 src/services/requestLiterals.ts                    |  15 ++
 src/services/stringCompiler.ts                     |   5 +-
 7 files changed, 358 insertions(+), 6 deletions(-)
```

Quote-regex census, before:

```text
ad8bb32:src/services/inputRequestAdapter.ts:154:  const quoted = options.request.match(/["“”']([^"“”']+)["“”']/)?.[1];
ad8bb32:src/services/stringCompiler.ts:29:  const quoted = request.match(/"([^"]*)"/)?.[1];
```

Quote-regex census, after:

```text
HEAD:src/services/requestLiterals.ts:2:  request.match(/["“]([^"”]*)["”]/)?.[1] ?? null;
```

The route's `op: '` scan places operation literals only in the union/parser/applier,
`graphRequestEdits.ts`, and tests, plus documented `loop: '` and trace false positives. The
`Math.random` scan contains only base matches; R14 adds none.

## Acceptance

1. **Met** — both decisions and exact EN/TR syntax are in `H14 / Decisions` and `Reachable syntax`.
2. **Met** — five keys each have EN/TR classifier cases. Evidence: `inputPatch.test.ts:153-166`.
3. **Met** — all three required inputs were executed. Evidence: `H14 / Turkish apostrophe measurement`.
4. **Met** — Binary Search remains numeric in both languages. Evidence: `inputPatch.test.ts:174-180`.
5. **Met** — numeric/text target collision is active-definition dependent. Evidence: `inputPatch.test.ts:174-186`.
6. **Met** — undelimited text and values requests return no patch. Evidence: `inputPatch.test.ts:188-191`.
7. **Met** — text, empty, and numeric-array validation is explicit. Evidence: `inputPatch.ts:296-311`.
8. **Met** — one canonical quote regex remains. Evidence: `H14 / Verification output`.
9. **Met** — UI pattern and rebuilt trace both show `abc`. Evidence: `usage-scenarios.spec.ts:106-125` + `titanEngine.ts:842-867`.
10. **Met** — rejected multi-op preserves exact identities. Evidence: `inputPatch.test.ts:309-339`.
11. **Met** — vocabulary is 11/11, none deferred. Evidence: `H14 / Reachable syntax`.
12. **Met** — four gates clean. Evidence: `H14 / Gate output`.
13. **Met locally / T0 remote pending** — 70+2 clean. Evidence: `H14 / Gate output`.
14. **Met** — two signed commits. Evidence: `H14 / Commits`.

## Diff scope

The unabridged stat is under `Verification output`. The route file is T0-owned opening work;
all implementation files match Expected Files except the common helper recorded below.

## Deviations

- `src/services/requestLiterals.ts` — criterion 8 required replacing two disagreeing regexes
  with one canonical implementation. A shared module is the smallest way to prevent a third
  convention while both existing consumers and the parameter classifier use it.

## Discovered

- The `values` form ultimately rejects malformed arrays during simulation, not on input
  keystroke. The request applier rejects earlier so an invalid assistant transaction never
  reaches recompilation.

## Untouched

Frozen paths, T0-owned paths, and `src-tauri/**` have no implementation diff. The pre-existing
untracked frozen files remain untouched.

## Blockers

- T0 must run the remote browser gate and reconcile the two architecture-map lines.

## For the human

none
