# Titan protocol folder
## Files
- `PROTOCOL.md` canonical turn protocol, single source of truth. Read before acting.
- `DOD.md` live definition-of-done table; Sole writes evidence cells only.
- `SOLE_BOOTSTRAP.md` one-time opening prompt for Sole (Codex CLI).
- `routes/R<nn>-<slug>.md` routes. **Claude writes these.**
- `handoffs/H<nn>-<slug>.md` handoff reports. **Sole writes these.**
## Ownership
Claude owns `PROTOCOL.md`, `SOLE_BOOTSTRAP.md`, `routes/*`. Sole owns `handoffs/*` and the
`DOD.md` evidence cells. Neither edits the other's files; append-only naming means no shared
line is ever touched.
## Why there is no STATE.md
State is derived, not stored: the holder is the answer to "does the highest-numbered `R` have a
matching `H`?" — if not, Sole holds the turn. A cached status file would be a second source of
truth and would lie the moment someone forgot to update it. Do not add one. Sole's start check
is the `## Turn.base` SHA of the active route against `git log -1 --format=%H`.
