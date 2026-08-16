# T18 God Mode Residue Removal Contract

## Objective

Remove the final source-level God Mode compatibility names while preserving the
exact event payload, routing behavior, radio logic, and fuzz coverage.

## Scope

- Consolidate the workspace UI event surface as `titanUiControl.ts` with
  `TITAN_UI_EVENT`, `isTitanUiEvent`, and `dispatchTitanUiAction`.
- Update active callers to those names and delete both obsolete UI-control
  filenames.
- Change only the import, handler identifier, and referenced symbol names in
  `PlaylistRadio.tsx`; preserve every branch, payload, effect dependency, and
  playback operation.
- Import and call `routeTitanModeRequest` directly in
  `robustnessFuzz.test.ts`; preserve its test cases, iteration counts, seeds,
  inputs, and expectations.
- Delete `godModeRouting.ts`.

## Invariants

- `WORKSPACE_UI_EVENT` remains the emitted event string and `UiActionV1` remains
  the payload contract.
- Radio behavior and fuzz semantics do not change.
- No compatibility alias containing God Mode remains under `src/`.
- No test count or assertion is removed.

## Acceptance Criteria

1. Case-insensitive `godmode` search under `src/` returns zero results.
2. The two obsolete God Mode compatibility files are deleted.
3. `PlaylistRadio.tsx` differs only in its event-control import and identifier
   names.
4. `robustnessFuzz.test.ts` differs only in its router import and call name.
5. `npm run lint` and all 747 tests pass.
6. T18 is committed separately before T19 begins.
