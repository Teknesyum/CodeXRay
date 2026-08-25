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
State is derived, not stored: the active route is the one file directly in `routes/` with no
matching `handoffs/H<id>-*.md`, and while such a file exists Sole holds the turn. Pairing
decides this, never numbering — a retry `R<n>b` opens after higher-numbered routes have
closed. `routes/queued/**` is planning material and is never the active route. A cached status
file would be a second source of truth and would lie the moment someone forgot to update it.
Do not add one. Sole's start check is the active route's `## Turn.base` SHA as an ancestor of
`HEAD`, not as an equal to it.
