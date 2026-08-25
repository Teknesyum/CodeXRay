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

with a per-role output-token table. It reserves 900 tokens for a `translate` role that is
never requested.

**Correction, and the reason it matters.** This route first said nothing outside that file
references it. That was wrong. What was measured was production callers; the grep was never
widened to tests. `src/services/ai/tolerantJson.test.ts:3` imports both `roleMaxTokens` and
`LOCAL_AI_USABLE_OUTPUT_TOKENS`, and its fourth `it` block asserts against them — a
role-budget test misfiled in a file named for a different module. The claim "zero callers"
and the claim "zero production callers" are different claims, and only the second was
measured. The holder found this before writing anything, which is the check working.

The blast radius of both deletions, measured over `src/` and `e2e/`, pasted rather than
summarised:

```
$ grep -rn "roleBudgets\|roleMaxTokens\|LocalAiRole\|LOCAL_AI_USABLE_OUTPUT_TOKENS" src/ e2e/
src/services/ai/roleBudgets.ts:1:export type LocalAiRole = ...
src/services/ai/roleBudgets.ts:3:export const LOCAL_AI_USABLE_OUTPUT_TOKENS: ...
src/services/ai/roleBudgets.ts:11:export const roleMaxTokens = (
src/services/ai/roleBudgets.ts:12:  role: LocalAiRole,
src/services/ai/roleBudgets.ts:17:  LOCAL_AI_USABLE_OUTPUT_TOKENS[role] + ...
src/services/ai/tolerantJson.test.ts:3:import { LOCAL_AI_USABLE_OUTPUT_TOKENS, roleMaxTokens } from './roleBudgets';
src/services/ai/tolerantJson.test.ts:27:    expect(LOCAL_AI_USABLE_OUTPUT_TOKENS).toEqual({ ... });
src/services/ai/tolerantJson.test.ts:28:    expect(roleMaxTokens('navigate', 500, 1024)).toBe(620);
src/services/ai/tolerantJson.test.ts:29:    expect(roleMaxTokens('translate', 500, 1024)).toBe(1024);

$ grep -rn "titanRouter\|TitanIntent\|TitanRouteDecision\|routeTitanRequest" src/ e2e/
src/services/titan/titanRouter.ts:13,23,24,31,34,42,89,128  (self)
src/services/titan/titanRouter.test.ts:5:import { routeTitanRequest } from './titanRouter';
```

Two files outside the modules themselves, both owned by this route. Nothing else.

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
| `src/services/ai/tolerantJson.test.ts` | **Bounded.** See below — the only importer of `roleBudgets` |
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

The `tolerantJson.test.ts` grant is bounded to exactly two edits, and nothing in that file
may change beyond them:

- the `roleBudgets` import on line 3, and
- the whole fourth `it` block, `'adds measured reasoning overhead to usable role budgets
  within the profile limit'`, which is entirely role-budget assertions.

Deleting only the assertions and leaving an empty `it` is not the intent — the block goes
with them. The three `extractTolerantJson` tests above it are untouched, and `tolerantJson.ts`
itself is out of scope. If option A is chosen and `roleBudgets.ts` survives, this file is not
edited at all.

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
`titanRouter.ts`, its test, and `roleBudgets.ts` are deleted, along with the role-budget block
stranded in `tolerantJson.test.ts`. `AGENTS.md`'s intent paragraph is rewritten to name the
shipped set exactly.

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
4. If a module is deleted, every test of it is deleted with it — including tests filed under
   another module's name — and `npm run test` count moves by exactly the number removed.
   State the before and after counts and the difference. Under option B the expected move is
   **756 to 749**: six `it` blocks in `titanRouter.test.ts` and one in `tolerantJson.test.ts`.
   A different number is not automatically wrong, but the handoff must say what accounts for
   it.
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

**Sign-off:** settled, and this is the first route it applies to. The repository identity is
now `Mustafa Ozel <iyott131@gmail.com>`, set in this repository's local git config by T0 after
the user confirmed it. Sign both commits with `-s`. If `git config user.email` returns
anything else, stop and report rather than signing with whatever is configured — a DCO
trailer is an assertion about a person, and asserting the wrong one is worse than asserting
nothing.

Commits before this point are unsigned on purpose. `coderay@example.com` was a reserved,
unattributable address, and R02b through R04 correctly refused to certify under it. That
history is not rewritten to add trailers after the fact; a sign-off backdated by an
amend certifies nothing.

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

## T0 reconciliation

Handoff `H05` recorded at `e38fb9eddf43c1f2cf074cc0f190d4a4442792b8`, closing `d4ddeda4`.
Option B was chosen. Claude re-ran the gates and the greps independently; every claim held.

| Claim in H05 | Independent result |
|---|---|
| `npm run lint` clean | clean |
| `npm run test` | `Test Files 119 passed (119)`, `Tests 751 passed (751)` |
| `npm run build` | `Initial JavaScript: 415.9 / 420.0 KiB` |
| no residual references to either deleted vocabulary | grep over `src/ e2e/` returns nothing |
| only the seven owned paths changed | `git diff --stat` lists exactly those |
| both commits carry the DCO trailer | `Signed-off-by: Mustafa Özel <iyott131@gmail.com>` |

`npm run desktop:check` was not re-run: `src-tauri/**` is absent from the diff, so the gate
had nothing to grade. The handoff's own run of it stands unchallenged.

**Criterion 4 moved, and the handoff was right to move it.** The route projected `756 → 749`
from seven deletions; the actual count is 751. Criterion 3 asked for a classifier test per
documented intent, and two of the seven — `discuss-current-step` and `ui-control` — had none.
Two tests were added. `756 − 7 + 2 = 751` is the arithmetic the criterion asked for, stated in
`## Deviations` rather than absorbed. That is the difference between a deviation and drift.

**Criterion 1 was answered more carefully than it was asked.** The criterion demanded exactly
one user-intent union. Two other unions could have been quietly ignored; instead the handoff
named both and said why neither counts — `WebSourceIntent` selects read/solve/explain for a
bound URL *before* `routeTitanModeRequest` runs, and `DeterministicWorkspaceCommand` is an
application command union carried inside `TitanModeIntent.deterministic`. Verified: neither is
a second spelling of pipeline intent. A handoff that surfaces the two hardest cases against
itself is doing the job.

**The `unclear` correction.** The old contract listed `unclear` as an intent. The shipped
classifier has no such member — it returns `null` and the request stays ordinary chat. Both
`AGENTS.md` files now say that. The contract got less tidy and more true, which is the trade
this route existed to make.

**The bounded grant held.** `tolerantJson.test.ts` lost exactly the import and the one
role-budget block; the three `extractTolerantJson` tests are untouched. Six stale references
to the deleted module were left in place rather than fixed, because they sat outside the
grant, and all were reported in `## Discovered`. Refusing to fix something you can see, and
naming it instead, is what a bounded grant is for.

**T0 follow-up, done in this turn.** Sole reported three stale references; grep found six.
All six are now corrected in T0-owned files:

| File | Was | Now |
|---|---|---|
| `AGENTS.md:116` | architecture map named `titanRouter.ts` | names `titanPipeline.ts` and its entry |
| `src/services/titan/AGENTS.md:2-6` | `STATUS: NOT WIRED`, "Route R02 connects them" | `STATUS: one seam live`, names R04 |
| `src/services/titan/AGENTS.md:8` | `titanRouter.ts` file entry | removed |
| `PROTOCOL.md:204` | invented call chain through `titanRouter` | the real R04 chain |
| `PROTOCOL.md:213` | four modules "never called in production" | where each of the four ended up |
| `docs/DEVIRALAN.md:224` | T10's description of `titanRouter` | marked superseded, entry preserved |

The `NOT WIRED` banner was the worst of them: it had been false since R04 and pointed at R02,
a route that turned into gate repair and never wired anything. An agent reading that file
would have been told the opposite of the truth by a document whose whole purpose is
orientation.

`DEVIRALAN.md` was annotated rather than edited. It is a dated rollup of what each turn
delivered, and T10 did deliver that module; rewriting the entry would falsify the record to
make the present tidy. The superseding note sits directly under the claim, where a grep for
`titanRouter` lands.

One unrelated repair: `PROTOCOL.md:128-130` carried a mangled sentence from an earlier T0
edit, with a clause duplicated into nonsense. Rewritten.

## Remote closure

Criterion 10's remote half is closed. Both commits are pushed to `main`. Run `32840631016`
on `e38fb9e`, first attempt, all three jobs `success`:

```
quality  success
desktop  success
browser  success
```

The `browser` job, both phases, no flaky line:

```
  67 passed (6.4m)
  2 passed (59.6s)
```

Third consecutive commit green on the first attempt with zero flaky specs. The e2e total is
67, unchanged from R04 — this route deleted unit suites, not browser specs. The gate is now
stable across three different tree shapes, including one that deleted two modules.

**R05 closes as met.** Local and remote halves of every criterion are satisfied.
