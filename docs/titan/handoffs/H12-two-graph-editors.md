# H12 — One typed graph editor

## Turn

- Route: R12
- Base SHA: `2a1071f`
- End SHA: `49371fb2c9ecd7ba03509d6a74a8e15533fb6277`
- Status: `closed`
- Next holder: Claude (T0)

## Özet

A seçildi: dört grafik op'u gerçek EN/TR isteklerinden ulaşılabilir ve bütün op dizisi tek
aday input üzerinde doğrulanıp yalnız tamamen başarılıysa yeniden derleniyor. Eski tipsiz
mutation uygulaması kaldırıldı; yerel kapılar 782 test ve 68+2 E2E ile temiz.

## What changed

| path:line-range | intent | change |
|---|---|---|
| `src/services/graphRequestEdits.ts:69-220` | preserve deterministic request recognition but emit validated typed graph ops instead of mutating | edited |
| `src/services/graphRequestEdits.test.ts:20-163` | preserve nine behavior groups, prove EN/TR emission and strict failures | edited |
| `src/services/input/inputPatch.ts:18,77-90,242-307,324-372` | own graph mutation and atomic multi-op apply/recompile | edited |
| `src/services/input/inputPatch.test.ts:131-167` | prove graph ops, divergence rejection, and input identity on failed transactions | edited |
| `src/services/titanEngine.ts:839-859` | route production graph adaptation through the typed atomic transaction | edited |
| `src/services/titanEngine.test.ts:590-674` | prove successful structural recompile and failed multi-op package/timeline identity | edited |
| `src/services/gm2Contracts.test.ts:128-151` | move structural classification evidence onto the typed applier | edited |
| `e2e/ai-actions.spec.ts:227-260` | prove the Turkish graph request adds one node/two edges and rebuilds a trace containing X | edited |
| `src/services/webProblemOrchestrator.ts:409` | make an existing discriminated-union check explicit for the clean TypeScript gate | edited |

## Decision

Option A was selected. `graph-add-node`, `graph-add-edge`, `graph-remove`, and `set-target`
are reachable. `graphRequestEdits.ts` retains only deterministic request recognition and
resolution; it emits `InputPatchV1[]` and delegates every candidate operation to
`parseInputPatch` plus `applyInputPatch`.

`applyInputPatches` applies the sequence to an immutable local candidate. On the first
failure it returns an error and exposes no candidate. `applyAndRecompileInputPatches`
recompiles only the final successful candidate and otherwise returns the exact active
package. The five-phase caller still applies that package only after verify succeeds.
Therefore a request such as “add X, then connect X to missing” leaves nodes, edges, target,
package, and timeline unchanged rather than committing the first op.

`set-param` remains in the union and unchanged. Its reachability/deletion decision belongs
in a future `R13-set-param-reachability` route; R12 adds no code for it.

## Call path

| hop | evidence |
|---|---|
| Turkish user request | `e2e/ai-actions.spec.ts:248` |
| live `adapt-input` branch | `src/services/titanEngine.ts:839` |
| deterministic request-to-op parser | `src/services/graphRequestEdits.ts:96` |
| atomic typed application | `src/services/input/inputPatch.ts:324` |
| one recompile after all ops | `src/services/input/inputPatch.ts:338` |
| existing five-phase package apply | `src/services/titanEngine.ts:843-859` |
| visible node, edges, and rebuilt X trace | `e2e/ai-actions.spec.ts:251-260` |

## EN/TR op evidence

`src/services/graphRequestEdits.test.ts:149-163` contains one classifier case per op per
language:

| op | English | Turkish |
|---|---|---|
| `graph-add-node` | `add node X` | `X düğüm ekle` |
| `graph-add-edge` | `add node X and connect 1 to X` | `X düğüm ekle, 1 ile X arasında bağlantı kur` |
| `graph-remove` | `remove node 1` | `1 nolu nodu kaldır` |
| `set-target` | `target node 1 set` | `hedefi 1 yap` |

## Previous behavior accounting

| Former `graphRequestEdits.test.ts` behavior group | Resolution | Evidence |
|---|---|---|
| four visual-only classifications | still passing unchanged | `graphRequestEdits.test.ts:41-50` |
| spread clones and clamps positions | still passing unchanged | `graphRequestEdits.test.ts:52-60` |
| add weighted chain with smallest gaps and set last target | moved to typed op sequence, same result | `graphRequestEdits.test.ts:62-73` |
| cap generated nodes at five | still passing through typed sequence | `graphRequestEdits.test.ts:75-78` |
| set existing target, ignore missing target | existing target passes; missing target now explicitly rejects | `graphRequestEdits.test.ts:80-86` |
| named node plus two real-user connections | same node and edges through typed ops | `graphRequestEdits.test.ts:88-109` |
| numbered removal clears incident edges and repairs target | same outcome in central applier | `graphRequestEdits.test.ts:111-126` |
| add directly below requested anchor | coordinates carried by typed node op | `graphRequestEdits.test.ts:128-136` |
| double complexity within bound | same deterministic typed chain | `graphRequestEdits.test.ts:138-142` |

## Divergence resolution

| Old permissive case | Chosen behavior | Test |
|---|---|---|
| edge endpoint missing silently continued | reject the whole request; no partial graph/package/timeline | `graphRequestEdits.test.ts:136-148`, `titanEngine.test.ts:658-674` |
| missing explicit target silently retained/fell back | reject with “does not exist”; no apply | `graphRequestEdits.test.ts:80-86` |
| removal at the one-node floor silently continued | reject final-node removal; source stays identical | `graphRequestEdits.test.ts:136-148` |

These are intentional behavior improvements: a misunderstood request is visible as a failed
Titan run instead of being reported as successfully applied. `titanEngine.test.ts:658-674`
proves the apply callback is never called and the original input and timeline retain object
identity.

## Commits

- `49371fb2c9ecd7ba03509d6a74a8e15533fb6277 route(R12): close`
- `handoff(H12): record` — this handoff commit

Both commits use `Signed-off-by: Mustafa Özel <iyott131@gmail.com>` after
`git config user.email` returned exactly `iyott131@gmail.com`.

## Gate output

### lint

```text
exit code: 0
> oxlint
```

### test

Before: 772. After: 782.

```text
exit code: 0
Test Files  119 passed (119)
      Tests  782 passed (782)
Duration  21.59s
```

### build

```text
exit code: 0
Initial JavaScript: 416.6 / 420.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
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

The authoritative full run used the established four-worker local setting and cleaned only
the listener and launcher PIDs created by that run.

```text
exit code: 0
Running 68 tests using 4 workers
CLARIFICATION_PIPELINE_MS 3074
68 passed (1.2m)
Running 2 tests using 1 worker
TIMELINE_MEASUREMENTS {"playwright":{"min":779.6663000000008,"median":858.4423499999998,"max":958.6509000000001},"inPage":{"min":165.30000000074506,"median":166.55000000074506,"max":167.60000000149012},"handler":{"min":0.5,"median":0.7500000037252903,"max":1.0999999940395355},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1412.7575,"catalogMs":321.6714999999999,"simulationMs":81.94129999999996,"dpMs":2463.385900000001}
2 passed (34.3s)
```

Two preceding eight-worker runs exposed the same unrelated local radio hover timeout; the
first also caught the real `nodes to this graph` parser ambiguity. After the parser fix,
`release-tour.spec.ts` and `ai-actions.spec.ts` passed together 4/4, release-tour passed in
the next full run, and the full four-worker gate was clean. No timeout or retry was raised.

## Verification output

```text
49371fb2c9ecd7ba03509d6a74a8e15533fb6277
.../routes/R11-timeline-commit-budget-validity.md  |  69 ++++++++++
 .../routes/{queued => }/R12-two-graph-editors.md   |   8 +-
 e2e/ai-actions.spec.ts                             |   1 +
 src/services/gm2Contracts.test.ts                  |  13 +-
 src/services/graphRequestEdits.test.ts             |  70 ++++++++--
 src/services/graphRequestEdits.ts                  | 149 ++++++++++++++-------
 src/services/input/inputPatch.test.ts              |  14 ++
 src/services/input/inputPatch.ts                   |  52 +++++--
 src/services/titanEngine.test.ts                   |  18 +++
 src/services/titanEngine.ts                        |  30 ++++-
 src/services/webProblemOrchestrator.ts             |   2 +-
 11 files changed, 347 insertions(+), 79 deletions(-)
```

Single-implementation reverse-reference result:

```text
applyStructuralGraphRequest
<no output>

src/services/graphRequestEdits.ts:96:export const createStructuralGraphPatches = (
src/services/input/inputPatch.ts:324:export const applyInputPatches = (
src/services/input/inputPatch.ts:338:export const applyAndRecompileInputPatches = (options: {
src/services/titanEngine.ts:840:            ? createStructuralGraphPatches(current.graph, options.request)
src/services/titanEngine.ts:844:            const semanticResult = applyAndRecompileInputPatches({
```

The `op: '` verification output contains graph op literals only in
`graphRequestEdits.ts` (the request parser), `inputPatch.ts` (union/parser/applier), and
tests. Its other matches are the pre-existing `loop: '` translation suffix and trace
collection `op` field. The `Math.random` output is unchanged from base; R12 adds none.

## Acceptance

1. **Met** — A selected; four reachable ops and atomic candidate/recompile mechanism. Evidence: `H12 / Decision`.
2. **Met** — Four ops, one real request per EN/TR combination. Evidence: `graphRequestEdits.test.ts:149-163`.
3. **Met** — UI request asserts graph node, two edges, and rebuilt X timeline. Evidence: `e2e/ai-actions.spec.ts:248-260` + `titanEngine.ts:839-859`.
4. **Met** — Every prior assertion group is tabulated. Evidence: `H12 / Previous behavior accounting`.
5. **Met** — All three divergences have strict tested resolutions. Evidence: `H12 / Divergence resolution`.
6. **Met** — Failed multi-op preserves graph/package/timeline identity. Evidence: `titanEngine.test.ts:658-674`.
7. **Met** — `set-param` deferred to named future `R13-set-param-reachability`; no code changed for it. Evidence: `H12 / Decision`.
8. **Met** — Graph op literals occur only in request parser, union/parser/applier, and tests. Evidence: `H12 / Verification output`.
9. **Met** — `applyStructuralGraphRequest` has zero references; `inputPatch.ts` is sole mutation implementation. Evidence: `H12 / Verification output`.
10. **Met** — lint, 782 tests, build, desktop check clean. Evidence: `H12 / Gate output`.
11. **Met locally / T0 remote pending** — full local 68+2 clean. Evidence: `H12 / Gate output / local e2e`.
12. **Met** — close then handoff commits, signed after exact email check. Evidence: `H12 / Commits`.

## Diff scope

```text
.../routes/R11-timeline-commit-budget-validity.md  |  69 ++++++++++
 .../routes/{queued => }/R12-two-graph-editors.md   |   8 +-
 e2e/ai-actions.spec.ts                             |   1 +
 src/services/gm2Contracts.test.ts                  |  13 +-
 src/services/graphRequestEdits.test.ts             |  70 ++++++++--
 src/services/graphRequestEdits.ts                  | 149 ++++++++++++++-------
 src/services/input/inputPatch.test.ts              |  14 ++
 src/services/input/inputPatch.ts                   |  52 +++++--
 src/services/titanEngine.test.ts                   |  18 +++
 src/services/titanEngine.ts                        |  30 ++++-
 src/services/webProblemOrchestrator.ts             |   2 +-
 11 files changed, 347 insertions(+), 79 deletions(-)
```

The first two rows are T0-owned reconciliation/route-opening work already present between
base and holder close. The holder commit contains the nine rows in `What changed`.

## Deviations

- `src/services/webProblemOrchestrator.ts` was outside Expected Files. A clean TypeScript
  build after `npm ci` exposed its existing `TranslationResult` narrowing as invalid at the
  two `translation.reason` reads. Criterion 10 required the clean build; changing
  `if (!translation.ok)` to `if (translation.ok === false)` is behavior-neutral and keeps
  the R06 translation flow covered by the full unit and E2E suites.

## Discovered

- The old optional-`connect` English regex read “Add two nodes **to this** graph” as an edge
  from `nodes` to `this`. Its permissive implementation silently ignored those missing
  endpoints. Strict typed handling made the latent parse ambiguity visible; requiring the
  explicit English `connect A to B` phrase preserves tested requests and prevents the false
  edge classification.
- At eight local workers `radio-controller.spec.ts:172` twice timed out hovering a radio
  panel hidden/intercepted during layout contention. It passed in 7.5 seconds in the clean
  four-worker full run. No application timeout or retry setting changed.

## Untouched

```text
git diff --name-only 2a1071f..49371fb -- .claude .agents docs/tasks docs/legacy CodeXray-readme-neon.svg docs/TITAN_MODE_YOL_HARITASI.md src-tauri
<no output>
```

Frozen untracked `.claude/`, `CodeXray-readme-neon.svg`, and
`docs/TITAN_MODE_YOL_HARITASI.md` remain untouched.

## Blockers

- T0 must run the remote browser gate and reconcile the architecture-map lines before R13.

## For the human

none
