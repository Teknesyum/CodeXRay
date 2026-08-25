# R06 — Translation reaches the user

## Özet

`CodeEditor.tsx` "JAVA kaynağından çevrildi · deterministik doğrulandı" rozetini çizmeye
hazır bekliyor, ama o rozeti hiçbir kod yolu doldurmuyor: `translation` alanını yazacak tek
fonksiyon olan `translateToVerifiedPackage`'ın sıfır çağrısı var. Ürün kullanıcıya asla
tutamayacağı bir söz veriyor. Bu rota o sözü ya tutar ya geri alır — ikisinden biri, ikisi
arası değil.

## Objective

Make the translation provenance badge reachable, or remove it. Right now
`src/components/CodeEditor.tsx:229` renders a claim about where a simulation came from,
guarded by `activeSimulationPackage?.translation`, and no code path in the repository can set
that field. This is not dead code in the ordinary sense — it is a **dead promise**, sitting
in the UI layer where a user would believe it.

R05 deleted a dead module because nothing depended on it. This route is the opposite case:
something visible already depends on `translate.ts`, and has been waiting since T13 for the
call that never came.

### What is actually there, measured at this route's base

`translateToVerifiedPackage` (`src/services/titan/translate.ts:46`) is complete and tested. It
takes up to three sets of model-authored SimLang-Lite fragments, merges them, validates the
merged `ProgramSpecV1`, compiles it through `compileCustomSimulationPackage`, and refuses
anything that does not produce a verified deterministic trace. It never executes the foreign
source. The model supplies fragments; the deterministic compiler decides whether they run.
That is the correct shape, and it is why this route is a wiring job and not a redesign.

Reverse-reference grep over `src/` and `e2e/`, excluding `i18n/`:

```
src/services/titan/translate.ts:13,46,50,80,82   (self)
src/services/titan/translate.test.ts:4,38,42,56,57
src/types/titan.ts:437  translation?: TranslationProvenanceV1;
src/types/titan.ts:440-447  interface TranslationProvenanceV1
src/components/CodeEditor.tsx:229-234  the badge, reading .translation.originalLanguage
```

So the type exists, the producer exists, the consumer exists — and nothing joins the producer
to the consumer. Two ends of a wire, no wire.

`translate.test.ts` is green and proves nothing about product behaviour, which is exactly the
failure mode `## Call path` was added to the protocol to prevent.

### The entry point this route must find, not invent

Do not start by inventing a new intent. R05 closed the set at seven and said no eighth opens
without a route; this route may open one, but only after establishing that no existing path
already carries foreign-language source into the product and drops it.

Look first at the web-source path. `AGENTS.md` already states, as a standing contract:

> Never persist raw HTML, execute Java fallback source, bypass authentication or bot
> protection, or mutate the workspace for an unexecuted Java artifact.

That sentence describes foreign-language source arriving from a read web problem and being
refused, because the product has no way to run it. Translation is the missing half of that
refusal. If the measurement confirms it, wiring `solve-web-problem` to
`translateToVerifiedPackage` closes a real user-facing gap without adding an intent at all.

The handoff states which entry point was chosen and what the measurement showed. "I picked
the easiest one" is not a justification; "these are the places foreign source enters, here is
what each does with it today" is.

## Turn

- Route id: `R06`
- Base: `e38fb9eddf43c1f2cf074cc0f190d4a4442792b8`
- Holder: `sole`
- Expected size: 5–10 files, 2 commits (`route(R06): close`, `handoff(H06): record`)

## Expected Files

| Path | Why |
|---|---|
| `src/services/titan/translate.ts` | The producer, wired |
| `src/services/titan/translate.test.ts` | Follows its module |
| `src/services/titan/titanPipeline.ts` | If translation enters through the five-phase seam |
| `src/services/titanModeRouting.ts` | Only if the measurement proves a new intent is needed |
| `src/services/titanModeRouting.test.ts` | Follows its module |
| `src/services/webProblemOrchestrator.ts` | The likely entry point |
| `src/services/webProblemOrchestrator.test.ts` | Follows its module |
| `src/types/titan.ts` | `TranslationProvenanceV1` and the intent union, if the decision requires it |
| `src/components/CodeEditor.tsx` | **The badge only** — lines 229-234 and the string move |
| `src/components/AiAssistant.tsx` | **The `solve-web-problem` branch only** — lines 546-607 |
| `src/types/webSource.ts` | Only if the `validated-simulation` kind needs a translated variant |
| `src/i18n/translations.ts` | New EN/TR strings this route introduces |
| `e2e/**` | One new spec proving the badge appears; existing specs only if a symbol moved |
| `docs/titan/handoffs/H06-translation-reaches-the-user.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

`titanEngine.ts`, `titanEntry.ts`, `inputPatch.ts`, `webSource.ts`, and everything under
`src/services/trace/` are **read-only this turn**.

The `CodeEditor.tsx` forecast is bounded to the provenance badge. Nothing else in that file
changes. If the decision is to remove the badge, that bound covers its deletion instead.

The `AiAssistant.tsx` forecast is bounded to the Java-fallback branch of `solve-web-problem`:
applying a verified translation package through the existing `applySimulationPackage`
transaction and writing the resulting session and transcript outcome. The R04 seam at
`AiAssistant.tsx:869` and everything else in that 1000-line component stay as they are.

**This list is a forecast, not a gate.** It was written from greps; the holder works from the
call path and will see files this author could not. Write what the criteria require inside
your own ownership and justify each extra file in `## Deviations`. Do not stop to ask.

### The call path, as measured before this route opened

The holder's startup measurement established the entry point, and it is recorded here so the
route does not have to be re-derived:

| Hop | Where |
|---|---|
| web source arrives | `AiAssistant.tsx:527` |
| incompatible problem enters Java fallback | `AiAssistant.tsx:546` |
| today's only outcome | `unexecuted-java17`, printed to chat, `AiAssistant.tsx:571-591` |
| the package transaction | `applySimulationPackage`, `AiAssistant.tsx:832` |
| the badge | `CodeEditor.tsx:229` |

The gap is between rows three and four. `webProblemOrchestrator.ts` can produce a verified
package, but only `AiAssistant.tsx` can apply one, so calling `translateToVerifiedPackage`
inside the orchestrator alone cannot make the badge appear. `types/webSource.ts:81` already
declares a `validated-simulation` solution kind, so the session type may need nothing at all
— check before adding a variant.

## Invariants

- **The model never authors an executed program.** It supplies SimLang-Lite fragments; those
  are parsed, validated, and compiled deterministically. No `eval`, no `new Function`, and no
  execution of the original C++, Java, or Python source — ever, including "just to check".
- A package commits only after schema, compile, sample, visual, and critic gates pass. A
  translation that fails any gate mutates nothing.
- The trace never comes from the model, and the model never computes an index.
- Every new user-facing string has English and Turkish output, and language switching updates
  existing steps without rerunning them.
- Cleaned web text stays untrusted data in every prompt.
- The five-phase order is untouched, and `discuss-current-step` keeps flowing through the R04
  seam.
- No secrets, no API keys, no remote AI calls. Local AI stays optional and worker-based.

## The `verifiedAt` question

`translate.ts:84` writes `verifiedAt: Date.now()` into the provenance record. This is **not** a
violation of the determinism rule as written — that rule forbids wall-clock *branching*, and
nothing branches on this value. Three other timestamps sit in the same layer
(`titanPipeline.ts:123`, `customSimulationCompiler.ts:190`, `tracerWorkerClient.ts:33`) and are
equally unbranched.

But this one is on a record whose entire purpose is to certify that a package was verified,
and it means the same source translated twice produces two different packages. Decide, and say
which in the handoff:

- keep it, and state why a provenance record should carry a wall-clock reading; or
- make it injected, so tests and reruns are byte-reproducible and production passes the clock
  in at the call site.

Either is acceptable. Leaving it unexamined is not, because this route is what makes the field
reach a user for the first time. Do not touch the other three timestamps; they are out of
scope and their own decision.

## Acceptance Criteria

1. The handoff names every place foreign-language source enters the product today and what
   each currently does with it, with pasted greps. The measurement above already establishes
   `solve-web-problem` as the honest entry point; confirm or correct it, do not redo it from
   scratch.
2. `translateToVerifiedPackage` has at least one production caller, shown as `file:line`.
3. `## Call path` is filled: user action to badge, every hop as `file:line`, naming the e2e
   spec that traverses it.
4. **The badge renders for a real user flow.** A new e2e spec drives the product from a user
   action to a visible `Translated from … · deterministically verified` badge. Criterion 4
   cannot close on a unit test — this is the criterion that makes the route about the product
   rather than about a module.
5. A translation that fails its gates changes nothing the user can see: no workspace mutation,
   no partial package, no badge. Prove it with a test that feeds fragments which fail
   compilation and asserts the workspace is untouched.
6. The original foreign source is never executed. Grep for `eval`, `new Function`, and any
   dynamic import of user or model text in the changed files, and show the result is empty.
7. Both EN and TR strings exist for everything this route adds, and the badge's two inline
   strings at `CodeEditor.tsx:231-233` move into `src/i18n/translations.ts` like every other
   user-facing string.
8. The `verifiedAt` decision is stated and implemented.
9. The handoff says which intent carries translation. If an eighth intent was added, a
   classifier test produces it. **(T0)** Naming it in `AGENTS.md` is Claude's; no `AGENTS.md`
   is the holder's to write.
10. **(T0)** `src/services/titan/AGENTS.md` no longer says `translate.ts` has no production
   caller. Claude closes this in `## T0 reconciliation`.
11. All four gates clean: `npm run lint`, `npm run test`, `npm run build`,
    `npm run desktop:check`.
12. `npm run test:e2e` passes locally, both phases. **(T0)** The remote `browser` job is
    Claude's to close.
13. Two commits, in order: `route(R06): close`, then `handoff(H06): record`. A published
    `fix(R06): ...` between them is permitted when remote evidence forces it, provided the
    handoff names it and says what taught the correction.

Both commits are signed with `-s`. Verify `git config user.email` returns
`iyott131@gmail.com` before signing; if it returns anything else, stop and report.

## If wiring turns out to be wrong

The measurement is already in, and it found a real entry point, so this section is now the
unlikely branch rather than the expected one. It stands only for the case where implementation
proves the path unworkable for a reason the measurement could not see.

If the measurement shows there is no honest entry point — no foreign source reaches the
product, and inventing an intent would be building a feature nobody asked for — then **say
so and delete the badge instead**. Removing `CodeEditor.tsx:229-234`,
`TranslationProvenanceV1`, `translate.ts`, and its test is a complete and successful outcome
of this route, on the same terms R05 deleted `titanRouter.ts`.

What is not acceptable is leaving the badge unreachable for a third route in a row. A UI
element that claims something the product cannot do is a defect whether or not anyone has
noticed it.

## Verification

PowerShell 5.1. No `&&`, no `||`, no ternary. Run verbatim; paste output verbatim.

```powershell
git log -1 --format=%H

git diff --stat "e38fb9eddf43c1f2cf074cc0f190d4a4442792b8..HEAD"

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'translateToVerifiedPackage'

Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx -File | Select-String -Pattern 'eval\(|new Function'

git diff "e38fb9eddf43c1f2cf074cc0f190d4a4442792b8..HEAD" -- src/components/CodeEditor.tsx

npm run lint

npm run test

npm run build

npm run desktop:check
```

The third command is criterion 2's evidence and must show a caller outside `translate.ts` and
its test. The fourth is criterion 6's and must show no new match. The fifth must show the
badge and nothing else.

Local e2e uses the external-server procedure in `AGENTS.md`. Clean up only the PIDs this run
created.

```powershell
$server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4173") -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$env:PLAYWRIGHT_EXTERNAL_SERVER = "1"
npm run test:e2e
```

## Rollback

`git reset --hard e38fb9eddf43c1f2cf074cc0f190d4a4442792b8` only when the working tree holds
nothing else worth keeping, and record the decision in `## Deviations`.

## Out of Scope

- **Moving a second intent onto the five-phase seam.** R07, and it needs `inputPatch.ts`,
  which stays read-only here.
- Rewriting `titanEngine.ts` or `titanEntry.ts`.
- The three timestamps outside `translate.ts`.
- Adding new translatable languages beyond `cpp | java | python`.
- Bypassing authentication or bot protection on any source site.
- Any change to the interpreter's supported language profile.
- **Every `AGENTS.md` file.** They are T0-owned without exception. Criteria 9 and 10 are
  marked `(T0)` for that reason; do not write them, and do not stop for them either.
- Pushing to `origin`. The remote half of criterion 12 belongs to T0.

## T0 reconciliation

Opened while the turn is still in flight, because criterion 10 blocked the holder and the
block was T0's fault.

**Criterion 10 is closed by T0.** `src/services/titan/AGENTS.md` now reads
`STATUS: two seams live` and describes `translateToVerifiedPackage` as called from the
`solve-web-problem` flow through `webProblemOrchestrator.ts`. The `Not wired` marker on the
`translate.ts` file entry is gone, replaced by the constraint that actually matters there:
the model supplies SimLang-Lite fragments only, and nothing foreign is ever executed.

**Criterion 9 is closed by T0 as far as documents go.** No eighth intent was added;
`solve-web-problem` carries translation, so `AGENTS.md`'s intent paragraph is already correct
and needs no edit. The holder still owes the handoff sentence naming which intent carries it.

**Why the holder was blocked, and why stopping was right.** R06 listed two `AGENTS.md` files
in `## Expected Files`, copying a pattern that worked in R05 when `## Owned Files` was the
gate. Last turn's inversion made the ownership table the only boundary, which revoked those
grants without anyone noticing. So the route asked for something the protocol forbade. Under
the new rules the holder had exactly two options — write a T0 file, or stop — and it chose the
one that was still a rule. That is the boundary working, not a turn wasted.

The protocol now states the rule in both directions: a criterion may never require the holder
to write a T0-owned path, and such criteria are marked `(T0)`. Criteria 9 and 10 are marked,
and both `AGENTS.md` entries are struck from `## Expected Files`.

**Not yet verified.** The product seam is uncommitted at the time of writing. This section
records only what T0 closed. The gates, the greps, the badge e2e, and the remote `browser`
job are graded after `H06` lands, and a failure there reopens the route as `R06b` — including
the `AGENTS.md` status above, which describes a wiring that must still prove itself.
