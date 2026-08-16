# T16 Documentation Consolidation Contract

## Objective

Leave one English product README at the repository root and consolidate tracked
planning, review, requirements, and release notes under `docs/` without losing
history or breaking repository guidance.

## Scope

- Keep `README.md` as the single root product document and update it for Titan
  Mode's deterministic-first architecture and current local-model boundaries.
- Keep `AGENTS.md` at the root because repository tooling discovers it there;
  it is an agent instruction router, not a product document.
- Move every other tracked root Markdown document into a clearly named
  `docs/legacy/` archive with history-preserving Git moves.
- Update live references to the moved files and add a concise documentation
  index.
- Refresh `docs/DEVIRALAN.md` as the final Claude/developer handoff report.

## Invariants

- No source, radio, generated catalog, or protected regression behavior changes.
- Historical documents retain their contents; relocation does not rewrite their
  claims as current product truth.
- Repository documentation added or rewritten by this package is English.
- The untracked Turkish Titan roadmap remains preserved unless explicitly
  selected for version control.

## Acceptance Criteria

1. The root contains only `README.md` plus the required `AGENTS.md` instruction
   router among tracked Markdown files.
2. All former root planning/review documents exist under `docs/legacy/` and all
   tracked references resolve.
3. `README.md` accurately states that trace and navigation derive only from real
   deterministic execution and that model output is optional and untrusted.
4. `docs/README.md` indexes current contracts, acceptance evidence, handoff, and
   historical material.
5. `docs/DEVIRALAN.md` reports T1-T16 completion, commits, verification evidence,
   skipped real-model testing, and any environment-only retry.
6. `npm run lint` and `npm run test` pass before the dedicated T16 commit.
