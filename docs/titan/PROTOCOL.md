# Titan Turn Protocol

## Özet

Claude ile Sole arasındaki tur protokolünün kanonik metnidir; başka hiçbir dosya bu
kurallarla çelişemez. Durum ayrı bir dosyada tutulmaz, `routes/` ve `handoffs/`
altındaki dosya adlarından türetilir. Rota Claude'un, uygulama Sole'undur.

## Roles

| Actor | Does | Never does |
|---|---|---|
| **Claude (T0)** | Writes the plan, opens the route, verifies the closed turn, writes the next route | Writes product code or tests, starts a dev server, runs `npm ci` |
| **Sole (Codex CLI)** | Implements the active route, commits, runs the verification block, writes the handoff | Touches files outside `## Owned Files`, edits a route, summarizes evidence |

One working directory, one branch, strictly sequential turns. No parallelism.

Directory layout:

| Path | Author | Purpose |
|---|---|---|
| `docs/titan/PROTOCOL.md` | Claude | Canonical turn protocol, single source of truth |
| `docs/titan/DOD.md` | Sole (evidence cells only) | Live definition-of-done table |
| `docs/titan/SOLE_BOOTSTRAP.md` | Claude | One-time opening prompt for Sole |
| `docs/titan/routes/R<nn>-<slug>.md` | Claude | Route |
| `docs/titan/handoffs/H<nn>-<slug>.md` | Sole | Handoff report |
| `docs/titan/AGENTS.md` | Claude | Router file, under 20 lines |

## Ownership table

| Owner | Paths |
|---|---|
| **Sole** | `src/**`, `e2e/**`, `src-tauri/**`, `.github/**`, `scripts/**`, `package.json`, `docs/titan/handoffs/H*.md`, `docs/titan/DOD.md` (evidence cells only) |
| **Claude** | `docs/titan/PROTOCOL.md`, `docs/titan/routes/R*.md`, `docs/DEVIRALAN.md`, `AGENTS.md` and every `*/AGENTS.md`, `CLAUDE.md`, `docs/README.md`, `docs/titan/SOLE_BOOTSTRAP.md` |
| **Nobody** | `.claude/**`, `.agents/AGENTS.md`, `docs/tasks/**`, `docs/legacy/**`, `CodeXray-readme-neon.svg`, `docs/TITAN_MODE_YOL_HARITASI.md` |

A path owned by nobody is frozen. It is not edited, moved, or deleted by either side.

## Turn lifecycle

1. Claude writes `R<n>` and commits it as `route(R<n>): open`. The `## Turn.base` field
   records the HEAD SHA at that moment.
2. On startup Sole checks that `## Turn.base` of the active route is an ancestor of local
   HEAD, and that nothing outside Claude-owned paths changed between the two. If either
   check fails, Sole **does not write**; it reports the mismatch and stops.

   ```powershell
   git merge-base --is-ancestor <base> HEAD
   git diff --name-only <base>..HEAD
   ```

   The first command must exit 0. The second must list only Claude-owned paths
   (`docs/titan/PROTOCOL.md`, `docs/titan/routes/**`, `docs/titan/SOLE_BOOTSTRAP.md`,
   `docs/DEVIRALAN.md`, `AGENTS.md`, `*/AGENTS.md`, `CLAUDE.md`, `docs/README.md`).
   Anything else means another writer touched the tree — stop and report.
3. Sole touches only the files listed in `## Owned Files` and lands one or more commits.
4. Sole runs the commands in `## Verification` **verbatim** and pastes the output into
   `H<n>` verbatim.
5. The close lands as **two commits**, in this order:

   - `route(R<n>): close` — the work itself. This is the commit `## Verification` reports.
   - `handoff(H<n>): record` — `H<n>` plus the `DOD.md` evidence rows.

   They are separate because the handoff quotes `git log -1 --format=%H` of the commit it
   reports on, and no commit can contain its own hash. One commit would make every handoff
   either wrong or silent about the SHA that identifies the turn.
6. Before opening the next turn Claude **re-runs the verification commands itself** and
   compares the result against `H<n>`.
7. On any mismatch the route is not patched — it is **reopened** as `R<n>b`.
8. Claude writes `R<n+1>`. The turn ends here.

A route Claude has drafted but is not opening yet lives in `docs/titan/routes/queued/`. The
active route is always the highest-numbered file **directly** in `docs/titan/routes/`;
`queued/` is planning material and carries no authority to write code. A queued route's
`## Turn.base` stays unstamped until it moves up, because a base recorded before the turn
opens would name a commit that later work has already passed.

## Turn state

There is **no `STATE.md`** and no lock file. A derivable cache file is a second source of
truth: the moment a state-flip commit is forgotten, the protocol starts lying. State is
read from the append-only file names instead, and that method contains no step anyone can
forget.

Derivation:

- `active route` = the highest-numbered file in `docs/titan/routes/`.
- `holder` = the answer to "does the highest-numbered `R` have a matching `H`?"
  No matching `H` → holder is **Sole**. A matching `H` exists → holder is **Claude**.
- `base SHA` = the `## Turn.base` field of the active route — the commit that opened the
  turn. Sole's startup check asks whether that commit is an ancestor of local HEAD and
  whether the range touched only Claude-owned paths. It is not an equality check: the
  commit that fills in `base` necessarily lands after the commit `base` names, so HEAD is
  normally one or two Claude commits ahead. Equality would fail on every turn.
  The check reads git history, never a status file.

```powershell
Get-ChildItem docs\titan\routes -Filter R*.md | Sort-Object Name | Select-Object -Last 1
Get-ChildItem docs\titan\handoffs -Filter H*.md | Sort-Object Name | Select-Object -Last 1
git log -1 --format=%H
```

## Branch and commit policy

- One branch: `agent/titan-relay`, forked from `main`. No per-route branches — in a single
  working directory `checkout` is the one operation that breaks turn order.
- When a DoD item closes: fast-forward to `main` and tag `titan-dod-<n>`.
- `npm ci` is Sole's alone, and only at the start of a turn.
- Claude never starts a server. Ports 5173 and 4173 belong entirely to Sole.
- `git add`, `commit`, `checkout`, `stash` only by whoever holds the turn.
- Commit subjects, in order: `route(R<n>): open` (Claude), `route(R<n>): close` (Sole's
  work), `handoff(H<n>): record` (Sole's evidence). Never fold the last two together.

## Route template

File: `docs/titan/routes/R<nn>-<slug>.md`. The `docs/tasks/T*.md` skeleton is preserved so
Sole does not have to learn a new shape. Body in English, with a 3-line Turkish `## Özet`
at the top.

Preserved sections:

- `## Objective`
- `## Owned Files`
- `## Invariants`
- `## Acceptance Criteria` — numbered and measurable; the final items are always the four
  gates and the two close commits. A criterion whose evidence lives on a remote — a CI job,
  a published site — must name who pushes. If that is not the route's holder, the criterion
  is marked `(T0)` and Claude closes it. Every grep criterion demanding zero matches is
  written so that the paths the same route *requires* cannot themselves match it; a
  substring or case-insensitive pattern over filenames is the usual way this goes wrong
- `## Verification` — PowerShell 5.1 compatible, no `&&`
- `## Out of Scope`

Added sections:

- `## Turn` — route id, base SHA, expected turn size (file count + commit count), holder
- `## Read first` — which files to read and **why**; prevents Sole from scanning from scratch
- `## Do not touch` — explicit prohibition list
- `## Decided, do not relitigate` — Claude's decisions and their rationale
- `## Yours to judge` — choices deliberately delegated to Sole
- `## Call path` — **mandatory**
- `## Evidence required` — which kind of evidence closes each criterion
- `## Rollback` — how to undo if this goes wrong

### `## Call path` is mandatory

The field records the chain from the user action to the changed module, every hop written
as `file:line` (`UI event → TimelineContext → titanRouter → executeTitanPipeline`), plus
the name of **at least one e2e or integration test** that traverses that chain.

Rule sentence, carried into every route:

> No criterion that claims user-visible behavior may be closed by a unit test alone; a
> route with an empty `Call path` is not accepted.

Why it exists: T10-T14 were closed on exactly the "module added + its test passed"
criterion, yet `titanRouter`, `executeTitanPipeline`, `inputPatch` and `translate` are
never called in production. `## Evidence required` alone cannot catch this — it proves the
module behaves, not that the product is wired to it.

## Handoff template

File: `docs/titan/handoffs/H<nn>-<slug>.md`. Written by Sole.

- `## Turn` — route / base SHA / end SHA / status: `closed`, `partial` or `blocked` / next holder
- `## Özet` — 3 Turkish lines, for a human
- `## What changed` — table: `path:line-range` | intent | added, edited or deleted.
  **Prose rows are not accepted.**
- `## Commits` — SHA and subject, one line each
- `## Gate output` — lint, test, build, desktop:check; for each: exit code, the numeric
  summary line **verbatim**, and the test counts before and after the turn separately
- `## Acceptance` — the numbered criteria copied verbatim from the route; each marked
  met or not-met with **exactly one** evidence pointer. For a user-visible behavior claim
  the pointer must be an e2e spec name **plus** the `file:line` of the production call site.
- `## Diff scope` — `git diff --stat <base>..HEAD` output, unabridged
- `## Deviations` — deviations from the route and why. Never left empty; write "none".
- `## Discovered` — findings the route did not know about
- `## Untouched` — filtered diff proof that the protected paths did not change
- `## Blockers` — decisions Claude must make before `R<n+1>`
- `## For the human` — at most 3 items, otherwise "none"

**Four requirements** — if any one of them fails, `status: closed` may not be written:

1. Every criterion is proven by a **machine-verifiable** pointer; prose is not evidence.
2. A new behavior claim must match a delta in the `npm run test` count — if the number did
   not change, there is no new test.
3. The `git diff --stat` list is compared against `## Owned Files`; every file outside it
   requires a `## Deviations` entry.
4. Claude re-runs the same commands.

## Conflict rules

- File names are **append-only**. `R07` and `H07` are separate files, so the two sides
  never touch the same line and a merge conflict cannot arise.
- An existing route or handoff is never rewritten. A failed turn produces `R<n>b`, not an
  edit of `R<n>`.
- `DOD.md` is the single shared file: Claude owns its structure, Sole writes only the
  evidence cells, and only during its own turn.
- If a violation is observed — a write outside `## Owned Files`, an edited past route, a
  handoff landed while the base SHA did not match — the turn is **not** patched. The
  handoff is marked `status: blocked`, the offending commit is reverted by the owner of
  the affected paths, and the route is reopened as `R<n>b`.

## Escalation to human

The human is involved only where the two agents genuinely cannot proceed:

- Sole's startup base-SHA check fails and the divergence is not explainable from `git log`.
- A handoff's `## Blockers` requires a product decision that is written down nowhere.
- A destructive operation is needed: force push, history rewrite, deleting a tag or a
  release, forcing `main`.
- Anything requiring credentials, 2FA, payment, or a browser sign-in.
- The same route has been reopened twice — `R<n>b` also failed verification.

The channel is the `## For the human` section of the handoff, at most 3 items. Everything
else is resolved between Claude and Sole inside the turn.
