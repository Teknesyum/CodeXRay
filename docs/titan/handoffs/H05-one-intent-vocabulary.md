# H05 — One intent vocabulary

## Turn

- Route: R05
- Base SHA: `0a5c1af95b7776e2ecbc0380eeea4afd8e34ec55`
- End SHA: `d4ddeda4e114b42f8396ed75ae546c9d1337d95e`
- Status: `closed`
- Next holder: Claude (T0)

## Özet

Ölü `TitanIntent` ve `LocalAiRole` sözlükleri silindi; canlı `TitanModeIntent` tek Titan kullanıcı-intent sözlüğü oldu.
AGENTS intent sözleşmesi çalışan sınıflandırıcıyla aynı yedi intenti adlandırıyor; iki eksik canlı intent testi eklendi.
Tüm kapılar ve tam tarayıcı paketi yeşil; iki commit de doğrulanmış DCO kimliğiyle imzalandı.

## Decision

Option B was selected. `TitanModeIntent` already crosses the production R04 seam directly,
while `TitanIntent` had no production caller and contained four names with no shipped
counterpart. Option A would preserve a mapping layer whose only honest total mapping would
discard those names or falsely claim product capabilities. Deleting the unrelated union is
smaller, type-honest, and behaviour-preserving.

`WebSourceIntent` remains a separate pre-Titan web-source routing domain: it selects read,
solve, or explain operations for a bound URL before `routeTitanModeRequest` runs. It is not a
second spelling of the Titan pipeline intent vocabulary. `DeterministicWorkspaceCommand` is
an application command union carried by `TitanModeIntent.deterministic`, not a user-intent
union.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `src/services/titan/titanRouter.ts:1-149` | remove the uncalled legacy `TitanIntent` classifier | deleted |
| `src/services/titan/titanRouter.test.ts:1-94` | remove tests belonging only to the deleted classifier | deleted |
| `src/services/ai/roleBudgets.ts:1-18` | remove the uncalled third intent vocabulary and token table | deleted |
| `src/services/ai/tolerantJson.test.ts:3,24-29` | remove the deleted budget import and its complete fourth test block | edited |
| `src/services/titanModeRouting.test.ts:52-62` | prove live production inputs for `discuss-current-step` and `ui-control` | added |
| `AGENTS.md:181-184` | make the canonical closed-set paragraph match `TitanModeIntent` exactly | edited |
| `src/services/titan/AGENTS.md:13-15` | make the local closed-set paragraph match the canonical vocabulary | edited |

## Commits

- `d4ddeda4e114b42f8396ed75ae546c9d1337d95e route(R05): close`
- `handoff(H05): record` — this handoff commit

Both commits use `-s`. Local identity was verified immediately before the close commit:

```text
USER_EMAIL=iyott131@gmail.com
Signed-off-by: Mustafa Özel <iyott131@gmail.com>
```

## Intent inventory

The single Titan user-intent union is `TitanModeIntent` at `src/types/titan.ts:545-565`:

```text
create-algorithm
create-catalog-problem
clarify-algorithm
adapt-input
discuss-current-step
ui-control
deterministic
```

The canonical paragraph at `AGENTS.md:181-184` names the same seven values and states the
`null` ordinary-chat fallback. Production-input tests exist for every value:

| intent | classifier evidence |
|---|---|
| `create-catalog-problem` | `src/services/titanModeRouting.test.ts:5-16` |
| `deterministic` | `src/services/titanModeRouting.test.ts:26-36` |
| `adapt-input` | `src/services/titanModeRouting.test.ts:45-50` |
| `discuss-current-step` | `src/services/titanModeRouting.test.ts:52-54` |
| `ui-control` | `src/services/titanModeRouting.test.ts:56-62` |
| `create-algorithm` | `src/services/titanModeRouting.test.ts:64-69` |
| `clarify-algorithm` | `src/services/titanModeRouting.test.ts:181-188` |

## Gate output

### lint

```text
exit code: 0
> oxlint
```

### test

Before: 756. After: 751.

```text
exit code: 0
Test Files  119 passed (119)
     Tests  751 passed (751)
```

The exact movement is `756 - 6 titanRouter tests - 1 roleBudgets test + 2 missing live-intent tests = 751`.

### build

```text
exit code: 0
Initial JavaScript: 415.9 / 420.0 KiB
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
67 passed (1.0m)
TIMELINE_MEASUREMENTS {"playwright":{"min":786.530999999999,"median":821.5465000000008,"max":923.6327999999999},"inPage":{"min":164.10000000149012,"median":166.2999999988824,"max":168.09999999776483},"handler":{"min":0.29999999329447746,"median":0.5499999970197678,"max":0.8999999910593033},"deliberateDelayMs":0}
2 passed (34.1s)
```

## Acceptance

1. **Met** — exactly one Titan user-intent union remains: `src/types/titan.ts:545-565`; `H05 / Decision` distinguishes the separate web-source domain and typed application commands.
2. **Met** — `AGENTS.md:181-184` and `src/types/titan.ts:545-565` contain the same seven values.
3. **Met** — `H05 / Intent inventory` points to a production-input classifier test for every value.
4. **Met** — the deleted modules' tests were deleted; the measured test movement is `756 → 751`, accounted for in `H05 / Gate output / test`.
5. **Met** — full E2E passed without any E2E edit; spelling coverage remains in `e2e/titan-mode.spec.ts`, `e2e/titan-mode-clarification.spec.ts`, and `e2e/usage-scenarios.spec.ts`.
6. **Met** — `roleBudgets.ts` is gone. Real limits still come from `localAiModels.ts:41-85` profile `maxOutputTokens` and are clamped at `localAiService.ts:623-641`; no production caller used the deleted values.
7. **Met** — the unmodified `e2e/titan-mode.spec.ts:22-40` R04 assertion passed in the 67-test phase.
8. **Met** — the legacy intent grep output below contains no production intent comparison. Remaining `load-preset` matches are the typed `DeterministicWorkspaceCommand`; other legacy strings occur only in generic unit-test fixtures.
9. **Met** — all four gates are clean; see `H05 / Gate output`.
10. **Met locally / T0 remote pending** — both local E2E phases passed; no push was made.
11. **Met** — close then handoff, with no corrective commit; see `H05 / Commits`.

## Verification output

```text
d4ddeda4e114b42f8396ed75ae546c9d1337d95e

AGENTS.md                                      |   7 +-
 docs/titan/AGENTS.md                           |  11 +-
 docs/titan/PROTOCOL.md                         |  28 ++-
 docs/titan/routes/R04-first-seam.md            |  60 +++++
 docs/titan/routes/R05-one-intent-vocabulary.md | 297 +++++++++++++++++++++++++
 src/services/ai/roleBudgets.ts                 |  18 --
 src/services/ai/tolerantJson.test.ts           |   7 -
 src/services/titan/AGENTS.md                   |   5 +-
 src/services/titan/titanRouter.test.ts         |  94 --------
 src/services/titan/titanRouter.ts              | 149 -------------
 src/services/titanModeRouting.test.ts          |  11 +
 11 files changed, 406 insertions(+), 281 deletions(-)
```

The `routeTitanRequest|LocalAiRole|roleMaxTokens` command emitted no output.

The legacy-name scan emitted only typed application-command matches and test fixtures:

```text
src\components\AiAssistant.tsx:370:        const actionLabel = action.type === 'load-preset'
src\components\AiAssistant.tsx:404:          case 'load-preset': {
src\services\aiTimelineControl.ts:21:  | { type: 'load-preset'; presetId: string };
src\services\aiTimelineControl.ts:74:      return [{ type: 'load-preset', presetId: preset.id }];
```

The verbatim canonical contract diff is:

```text
AGENTS.md | 7 ++++---
1 file changed, 4 insertions(+), 3 deletions(-)

-Intents are a closed set — no free-form intent strings: `navigate`, `edit-input`,
-`explain`, `trace-code`, `translate-code`, `load-preset`, `ui-control`, `unclear`.
-Anything the deterministic router cannot classify is `unclear`.
+Intents are a closed set — no free-form intent strings: `create-algorithm`,
+`create-catalog-problem`, `clarify-algorithm`, `adapt-input`, `discuss-current-step`,
+`ui-control`, `deterministic`. Anything the deterministic router cannot classify returns
+`null` and remains ordinary chat.
```

## Diff scope

```text
AGENTS.md                                      |   7 +-
 docs/titan/AGENTS.md                           |  11 +-
 docs/titan/PROTOCOL.md                         |  28 ++-
 docs/titan/routes/R04-first-seam.md            |  60 +++++
 docs/titan/routes/R05-one-intent-vocabulary.md | 297 +++++++++++++++++++++++++
 src/services/ai/roleBudgets.ts                 |  18 --
 src/services/ai/tolerantJson.test.ts           |   7 -
 src/services/titan/AGENTS.md                   |   5 +-
 src/services/titan/titanRouter.test.ts         |  94 --------
 src/services/titan/titanRouter.ts              | 149 -------------
 src/services/titanModeRouting.test.ts          |  11 +
 11 files changed, 406 insertions(+), 281 deletions(-)
```

The base range includes T0-owned R04 reconciliation, protocol, and R05 route-opening changes.
The R05 close commit itself contains exactly the seven owned paths listed above.

## Deviations

- The route projected `756 → 749` from seven deletions. Criterion 3 exposed two live intents with no direct classifier test, so two tests were added and the final count is 751. This is the exact arithmetic required by criterion 4, not unexplained drift.

## Discovered

- `AGENTS.md:116` and `src/services/titan/AGENTS.md:8` still name the now-deleted `titanRouter.ts`; the route explicitly granted only the intent paragraphs, so these T0-owned architecture/file-map lines were not edited.
- The first three lines of `src/services/titan/AGENTS.md` still claim `executeTitanPipeline` has no production caller, which became false in R04. This was also outside the bounded intent-paragraph grant.
- The Teknesyum statusline requests `live/_sorun.log`, but that path does not exist in this workspace; T0 identified it as a Teknesyum `live`/`canli` naming defect rather than a CodeXRay issue.

## Untouched

```text
git diff --name-only 0a5c1af95b7776e2ecbc0380eeea4afd8e34ec55..HEAD -- .claude .agents docs/tasks docs/legacy CodeXray-readme-neon.svg docs/TITAN_MODE_YOL_HARITASI.md src/services/titanEngine.ts src/services/titanEntry.ts src/services/input/inputPatch.ts src/services/titan/translate.ts
<no output>
```

The pre-existing untracked `.claude/`, `CodeXray-readme-neon.svg`, and `docs/TITAN_MODE_YOL_HARITASI.md` remain untouched.

## Blockers

- T0 must push and close the remote `browser` job.
- T0 should remove the three stale references named in `## Discovered` before a later route relies on those guides.

## For the human

none
