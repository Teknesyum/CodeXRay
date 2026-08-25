# R05 — One intent vocabulary

## Özet

`AGENTS.md` kapalı bir intent kümesi ilan ediyor, ama o küme sevk edilen ürünün kümesi değil
— ikisi birbirinin alt kümesi bile değil. Belgedeki isimler yalnızca hiç çağrılmayan
`titanRouter.ts`'te yaşıyor; canlı sınıflandırıcı `titanModeRouting.ts` bambaşka bir sözlük
konuşuyor. Bu rota iki sözlükten birini seçer, ötekini ya bağlar ya siler, ve `AGENTS.md`'yi
çalışan koda uydurur. Çelişkiyi olduğu gibi bırakmak bu rotanın başarısızlığıdır.

## Objective

Leave exactly one intent vocabulary in the repository, and make `AGENTS.md`'s closed-set
claim describe it. A contract document that names a set no shipped code produces is worse
than no contract: it tells every future agent the wrong thing with authority.

### The contradiction, measured at this route's base

`AGENTS.md` states:

> Intents are a closed set — no free-form intent strings: `navigate`, `edit-input`,
> `explain`, `trace-code`, `translate-code`, `load-preset`, `ui-control`, `unclear`.

That is `TitanIntent`, declared at `src/services/titan/titanRouter.ts:13`. Its only
classifier, `routeTitanRequest`, has **zero production callers**.

What actually classifies user requests is `routeTitanModeRequest`
(`src/services/titanModeRouting.ts`), which returns `TitanModeIntent`
(`src/types/titan.ts:545`):

| Documented `TitanIntent` | Shipped `TitanModeIntent` |
|---|---|
| `navigate` | — |
| `edit-input` | `adapt-input` |
| `explain` | `discuss-current-step` |
| `trace-code` | — |
| `translate-code` | — |
| `load-preset` | — |
| `ui-control` | `ui-control` |
| `unclear` | — |
| — | `create-algorithm` |
| — | `create-catalog-problem` |
| — | `clarify-algorithm` |
| — | `deterministic` |

Two names line up, two have obvious counterparts under different spellings, and eight exist
on one side only. Neither set contains the other.

A third spelling of the same idea sits in `src/services/ai/roleBudgets.ts:1`:

```ts
export type LocalAiRole = 'route' | 'navigate' | 'edit-input' | 'explain' | 'translate';
```

with a per-role output-token table. Nothing outside that file references it — `roleMaxTokens`
and `LOCAL_AI_USABLE_OUTPUT_TOKENS` have zero callers. It reserves 900 tokens for a
`translate` role that is never requested.

Dead weight after R04, all with zero production callers:

| Module | Lines | Belongs to |
|---|---|---|
| `src/services/titan/titanRouter.ts` | 149 | this route |
| `src/services/ai/roleBudgets.ts` | 18 | this route |
| `src/services/input/inputPatch.ts` | 259 | R07 |
| `src/services/titan/translate.ts` | 102 | R06 |

R04 removed one item from this list by making `collapseTitanPlan` live, so the list does
shrink as seams land. It shrinks by decision, not by drift.

`titanRouter.ts` is fully self-contained, measured at this base. Its three exports are
`TitanIntent`, `TitanRouteDecision`, and `routeTitanRequest`; the only file outside it that
names any of them is `titanRouter.test.ts`. `collapseTitanPlan`, which R04 made live, is
declared in `titanPipeline.ts:183` and does not come from here. Nothing in the live pipeline
depends on this module, so deleting it cannot reach production code — which removes a whole
class of risk from option B and should be weighed as such.

## Turn

- Route id: `R05`
- Base: `0a5c1af95b7776e2ecbc0380eeea4afd8e34ec55`
- Holder: `sole`
- Expected size: 4–9 files, 2 commits (`route(R05): close`, `handoff(H05): record`)

## Owned Files

| Path | Why |
|---|---|
| `src/services/titan/titanRouter.ts` | Wired or deleted, per the decision |
| `src/services/titan/titanRouter.test.ts` | Follows its module |
| `src/services/ai/roleBudgets.ts` | Wired or deleted, per the decision |
| `src/services/titanModeRouting.ts` | The live classifier, if option A is chosen |
| `src/services/titanModeRouting.test.ts` | Follows its module |
| `src/types/titan.ts` | **`TitanModeIntent` union only**, and only if the decision requires it |
| `AGENTS.md` | **The intent paragraph only.** Nothing else in the file. |
| `src/services/titan/AGENTS.md` | Same, if it repeats the claim |
| `e2e/**` | **Only** a spec that names a symbol this route renames or deletes |
| `docs/titan/handoffs/H05-one-intent-vocabulary.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

`AGENTS.md` is Claude-owned everywhere except the intent paragraph, which this route is
explicitly granted so the code and the contract land in one commit. Touching any other part
of it fails the route.

`titanEngine.ts`, `titanEntry.ts`, `inputPatch.ts` and `translate.ts` are **read-only this
turn**.

The `e2e/**` grant is a mechanical follow-through, not an invitation. A spec may be edited to
track a renamed symbol and for nothing else. No assertion is weakened, no spec is skipped, and
no expected user-visible text changes — criterion 5 says behaviour is unchanged, so a spec that
needed a real edit to keep passing is evidence the route broke something.

## Invariants

- **One vocabulary at the end.** Two type unions describing user intent may not both survive
  unless one is defined in terms of the other and that relationship is expressed in the type
  system, not in prose.
- No free-form intent strings. Whatever survives stays a closed union; anything the
  deterministic router cannot classify maps to a declared fallback.
- The trace never comes from the model, and the model never computes an index.
- Behaviour is unchanged. Every request that produces a given result today produces the same
  result after this route. This is a naming and wiring change, not a feature change.
- `discuss-current-step` keeps flowing through the R04 seam, and the five-phase order is
  untouched.
- Deleting a module means deleting its tests. Leaving orphan tests for deleted code is how
  dead weight comes back.

## The decision

Choose **one**, and justify it in the handoff against what the other would cost.

**Option A — the deterministic router becomes real.** `routeTitanModeRequest` delegates
classification to `routeTitanRequest`, and `TitanIntent` maps into `TitanModeIntent` through
a total, exhaustively-tested function. Both names survive with a defined relationship: one
classifies, the other describes what the product does with the classification. `AGENTS.md`
then describes a two-layer contract truthfully.

Costs: a mapping layer to maintain, and `TitanIntent` carries four names
(`navigate`, `trace-code`, `translate-code`, `load-preset`) with no shipped counterpart, so
either they map to `unclear` — which is a lie about what the product can do — or the route
grows to wire them, which it must not.

**Option B — the shipped set is the contract.** `TitanModeIntent` is the only intent union.
`titanRouter.ts`, its test, and `roleBudgets.ts` are deleted. `AGENTS.md`'s intent paragraph
is rewritten to name the shipped set exactly.

Costs: 167 lines of tested code deleted, and the five-phase pipeline loses the vocabulary it
was designed around — though R04 showed the pipeline works fine taking `TitanModeIntent`
straight from the router, so that cost may be theoretical.

**T0's reading, not a binding instruction:** option B looks right. The documented set is
older than the product and describes capabilities that reach users through other paths
entirely — `load-preset` through `resolveAlgorithmPresetFromCommand`, `navigate` through
`aiTimelineControl`. Naming them as pipeline intents claims an architecture that does not
exist. But the holder has the code in front of it and may see something this reading misses;
a justified option A is a valid outcome, and so is a third option the handoff argues for.
What is not valid is shipping both unions unrelated, or editing `AGENTS.md` to match
whichever set needed less work.

## Acceptance Criteria

1. Exactly one user-intent union remains, or two remain with a total mapping function between
   them that the type checker enforces. Prove it by listing every union in `src/**` that
   describes user intent and showing the relationship.
2. `AGENTS.md`'s intent paragraph names exactly the intents the shipped classifier can
   return, with no extras and none missing. Prove it by pasting the paragraph next to the
   union declaration.
3. Every intent named in `AGENTS.md` is produced by the live classifier for at least one
   input, proven by a test per intent. An intent no input can produce is not in the set.
4. If a module is deleted, its tests are deleted with it and `npm run test` count moves by
   the number of tests removed. State the before and after counts and the difference.
5. Behaviour is unchanged: the full e2e suite passes, and the handoff names which specs cover
   the intents that changed spelling.
6. `roleBudgets.ts` is either called from production or gone. If it survives, show the caller;
   if it goes, confirm no token budget regressed by naming what now supplies those numbers.
7. The five-phase seam from R04 still carries `discuss-current-step`. Prove it with the
   existing e2e assertion, unmodified.
8. No free-form intent string exists anywhere in the routing path. Grep for string comparisons
   against intent names outside the union declaration and show the result.
9. All four gates clean: `npm run lint`, `npm run test`, `npm run build`, `npm run desktop:check`.
10. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
    Claude's to close.
11. Two commits, in order: `route(R05): close`, then `handoff(H05): record`. A published
    `fix(R05): ...` between them is permitted when remote evidence forces it, provided the
    handoff names it and says what taught the correction.

**Sign-off:** the repository requires a `Signed-off-by` trailer, but the configured identity
is still the unusable placeholder `CodeRay Developer <coderay@example.com>`. Keep committing
without `-s` until T0 says the identity is settled, and record in the handoff that you did.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "0a5c1af95b7776e2ecbc0380eeea4afd8e34ec55..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'routeTitanRequest|LocalAiRole|roleMaxTokens'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern "'navigate'|'edit-input'|'trace-code'|'translate-code'|'load-preset'|'unclear'"

git diff "0a5c1af95b7776e2ecbc0380eeea4afd8e34ec55..HEAD" -- AGENTS.md

npm run lint

npm run test

npm run build

npm run desktop:check
```

The fourth command is criterion 8's evidence: every remaining match must be inside a union
declaration or its exhaustive mapping, never an ad-hoc string comparison in control flow.
The fifth must show the intent paragraph and nothing else.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## Rollback

`git reset --hard 0a5c1af95b7776e2ecbc0380eeea4afd8e34ec55` only when the working tree holds nothing else worth keeping, and
record the decision in `## Deviations`.

## Out of Scope

- **Moving a second intent onto the five-phase seam.** That is R07, and it needs
  `inputPatch.ts`, which stays read-only here.
- **Shipping cross-language translation.** R06. `translate.ts` stays read-only and is not
  deleted — its fate is decided when its route opens, not as a side effect of this one.
- Rewriting `titanEngine.ts` or `titanEntry.ts`.
- Any change to `AGENTS.md` outside the intent paragraph.
- Adding a new intent. This route reconciles what exists; it does not grow the set.
- Pushing to `origin`. The remote half of criterion 10 belongs to T0.
