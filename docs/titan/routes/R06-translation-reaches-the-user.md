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

## Owned Files

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
| `src/i18n/translations.ts` | New EN/TR strings this route introduces |
| `e2e/**` | One new spec proving the badge appears; existing specs only if a symbol moved |
| `AGENTS.md` | **The intent paragraph only**, and only if an eighth intent lands |
| `src/services/titan/AGENTS.md` | The `translate.ts` status line, which this route makes false |
| `docs/titan/handoffs/H06-translation-reaches-the-user.md` | Handoff |
| `docs/titan/DOD.md` | Evidence cells only |

`titanEngine.ts`, `titanEntry.ts`, `inputPatch.ts`, `webSource.ts`, and everything under
`src/services/trace/` are **read-only this turn**.

The `CodeEditor.tsx` grant is bounded to the provenance badge. Nothing else in that file
changes. If the decision is to remove the badge, the grant covers its deletion instead.

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
   each currently does with it, with pasted greps. The chosen entry point is one of them, or
   the handoff argues why none of them fit.
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
9. If an eighth intent was added, `AGENTS.md`'s intent paragraph names it and a classifier
   test produces it. If none was added, say which existing intent carries translation.
10. `src/services/titan/AGENTS.md` no longer says `translate.ts` has no production caller.
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
- Pushing to `origin`. The remote half of criterion 12 belongs to T0.
