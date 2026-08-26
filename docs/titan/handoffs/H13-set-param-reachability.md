# H13 — Numeric parameters reach the assistant

## Turn

- Route: R13
- Base SHA: `cc8098a`
- End SHA: `9def817b697ad8dd89669fb24a358b6975e59d0a`
- Status: `closed`
- Next holder: Claude (T0)

## Özet

A seçildi ve sayısal alt kümeyle sınırlandı: altı parametre anahtarı EN/TR isteklerden
ulaşılabilir, aktif algoritmanın tanımına ve sayı tipine karşı doğrulanıyor. Beş metin
anahtarı sessiz yanlış çıkarım riskinden dolayı R14'e ertelendi; 797 test ve 69+2 E2E temiz.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `src/services/input/inputPatch.ts:159-187,274-285,363-390` | classify six numeric keys and enforce active definitions/types | edited |
| `src/services/input/inputPatch.test.ts:136-174,263-294` | prove EN/TR keys, parser behavior, rejection, and atomic identity | edited |
| `src/services/titanModeRouting.ts:8,119` | route declared parameter requests to `adapt-input` | edited |
| `src/services/titanModeRouting.test.ts:72-82` | preserve numbered input requests and route declared parameters | edited |
| `src/services/titanEngine.ts:839-867` | apply parameters for preset and custom-package paths | edited |
| `e2e/usage-scenarios.spec.ts:86-104` | change Binary Search target and observe rebuilt trace | edited |

## Decision

Option A, scoped. Reachable numeric keys: `target` for Two Pointers/Binary Search/Ternary
Search, `windowSize`, `capacity`, `amount`, `modulus`, and `cycleEntry`. Each is selected
only from `getAlgorithmParameterDefinitions(activeAlgorithm)` and requires an explicit
EN/TR label plus numeric literal.

Deliberately deferred to `R14-text-parameter-reachability`: `pattern`, `query`, `other`,
`values`, and Minimum Window Substring's text-valued `target`. Extracting unquoted prose is
not the same problem as reading an unambiguous number; partial string capture could silently
change lesson semantics.

Every one of the 11 `InputPatchV1` ops now has a production path. `set-param` is reachable
with a deliberately scoped key vocabulary; the five deferred keys are not separate ops.

## Measurement and validation

`parseSimulationInput` was executed with `not-a-number` for all six numeric definitions.
For every key it returned no error and preserved the string unchanged. Therefore parsing
does not enforce numeric parameter types. R13 closes that gap in `applyInputPatch`: an
undeclared active-algorithm key rejects, and a numeric definition rejects non-number values
before parsing or recompilation.

| key | EN request | TR request | measured parser result |
|---|---|---|---|
| `target` | `set target to 42` | `hedefi 42 yap` | preserved invalid string |
| `windowSize` | `set window size to 4` | `pencereyi 4 yap` | preserved invalid string |
| `capacity` | `set capacity to 15` | `kapasiteyi 15 yap` | preserved invalid string |
| `amount` | `set amount to 11` | `miktarı 11 yap` | preserved invalid string |
| `modulus` | `set modulus to 101` | `modülü 101 yap` | preserved invalid string |
| `cycleEntry` | `set cycle entry to 2` | `döngü başlangıcını 2 yap` | preserved invalid string |

Evidence: `src/services/input/inputPatch.test.ts:136-174`.

## Atomicity

A two-op transaction sets valid `target=42` locally, then attempts undeclared `nonsense`.
The result returns the exact original package, input object, and timeline array. No candidate
is exposed or applied. Evidence: `inputPatch.test.ts:263-294`.

## Behaviour preservation

`titanModeRouting.test.ts:72-82` proves `inputu 10 elemanli azalan yap` remains semantic
array adaptation and a bare `42 eleman ekle` is not misclassified as a parameter. Existing
R10 array, R12 graph, translation, and discussion tests all pass in the full suites.

## Call path

`e2e/usage-scenarios.spec.ts:86` → `titanModeRouting.ts:119` →
`titanEngine.ts:839-867` → `inputPatch.ts:274-285` → rebuilt Binary Search trace with
`target=42` at `e2e/usage-scenarios.spec.ts:100-103`.

## Commits

- `9def817b697ad8dd89669fb24a358b6975e59d0a route(R13): close`
- `handoff(H13): record` — this commit

Both are signed after `git config user.email` returned `iyott131@gmail.com`.

## Gate output

```text
lint: exit code 0 — > oxlint
test: exit code 0 — Test Files 119 passed (119) | Tests 797 passed (797)
test count: before 782; after 797
build: exit code 0 — Initial JavaScript: 416.6 / 420.0 KiB
desktop:check: exit code 0 — test result: ok. 7 passed; 0 failed
local e2e: exit code 0 — 69 passed (1.1m) | 2 passed (33.9s)
```

## Verification output

```text
9def817b697ad8dd89669fb24a358b6975e59d0a
docs/titan/routes/R13-set-param-reachability.md | 242 ++++++++++++++++++++++++
 e2e/usage-scenarios.spec.ts                     |  20 ++
 src/services/input/inputPatch.test.ts           |  74 +++++++-
 src/services/input/inputPatch.ts                |  45 ++++-
 src/services/titanEngine.ts                     |  29 +++
 src/services/titanModeRouting.test.ts           |  11 ++
 src/services/titanModeRouting.ts                |   3 +-
 7 files changed, 420 insertions(+), 4 deletions(-)
```

Production reachability grep includes all producer families and both apply entry points:

```text
src/services/input/inputPatch.ts:129:export const createSemanticArrayPatch
src/services/input/inputPatch.ts:167:export const createSemanticParameterPatches
src/services/graphRequestEdits.ts:96:export const createStructuralGraphPatches
src/services/input/inputPatch.ts:377:export const applyAndRecompileInputPatches
src/services/input/inputPatch.ts:405:export const applyAndRecompileInputPatch
src/services/titanEngine.ts:822:createSemanticArrayPatch
src/services/titanEngine.ts:841:createSemanticParameterPatches
src/services/titanEngine.ts:869:createStructuralGraphPatches
```

The `op: '` scan places literals only in `inputPatch.ts`, `graphRequestEdits.ts` (the graph
request parser), and tests, plus the documented `loop: '`/trace false positives. The
`Math.random` scan has only base matches; R13 adds none.

## Acceptance

1. **Met** — six numeric keys reachable; five text keys deferred. Evidence: `H13 / Decision`.
2. **Met** — one EN/TR classifier case per reachable key. Evidence: `inputPatch.test.ts:136-151`.
3. **Met** — undeclared key rejects. Evidence: `inputPatch.test.ts:153-160`.
4. **Met** — parser preserves invalid strings for all six; applier rejects them. Evidence: `inputPatch.test.ts:153-174`.
5. **Met** — UI parameter and rebuilt timeline both show 42. Evidence: `usage-scenarios.spec.ts:86-104` + `titanEngine.ts:839-867`.
6. **Met** — numbered non-parameter behavior preserved. Evidence: `titanModeRouting.test.ts:72-82`.
7. **Met** — rejected multi-op preserves input/package/timeline identity. Evidence: `inputPatch.test.ts:263-294`.
8. **Met** — literals confined to allowed locations. Evidence: `H13 / Verification output`.
9. **Met** — 11/11 union ops have production reachability. Evidence: `H13 / Verification output`.
10. **Met** — four gates clean. Evidence: `H13 / Gate output`.
11. **Met locally / T0 remote pending** — 69+2 clean. Evidence: `H13 / Gate output`.
12. **Met** — two signed commits. Evidence: `H13 / Commits`.

## Diff scope

The unabridged stat is under `Verification output`. The route file is T0-owned opening work;
the six implementation rows match Expected Files.

## Deviations

none

## Discovered

- `parseSimulationInput` performs no numeric validation for any of the six numeric keys.
- The E2E timeline length can remain five steps when the Binary Search target changes, but
  the rebuilt step data changes from the preset target to 42; trace content, not length, is
  the meaningful assertion.

## Untouched

Frozen paths and `src-tauri/**` have no diff. The untracked frozen files remain untouched.

## Blockers

- T0 must run the remote browser gate and reconcile the architecture map before R14.

## For the human

none
