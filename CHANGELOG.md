# Changelog

All notable changes to CodeXRay are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Titan Mode: deterministic router, five-stage Route/Produce/Semantics/Verify/Apply
  pipeline, validated input patch flow, measured local model layer, SimLang-Lite
  interpreter, and progress/capability UI (formerly God Mode).
- Verified English/Turkish runtime translation of simulator output.
- Titan relay protocol, roadmap, `CONTRIBUTING.md`, and DCO 1.1 sign-off requirement.
- AGPL-3.0-or-later license.
- Windows desktop release workflow, `CHANGELOG.md`, Turkish README, language and
  sponsor badges, and a Download section in the README.

### Changed

- Primary workspace panels are lazy loaded and the initial bundle budget is enforced.
- `main` is the single long-lived branch; CI runner Node is aligned with the lockfile.
- Personal site publisher (`publish:site`) removed from the package scripts.

### Fixed

- Persisted chat is preserved when a Titan run is refused.
- Visible verification errors are targeted correctly.
- Sampled timeline median is used for the performance judge.
- Cross-platform `@emnapi` entries pinned in `package-lock.json`.

## [2.3.4] - 2026-08-11

### Fixed

- Extended the active local stream timeout.

## [2.3.3] - 2026-08-11

### Added

- Streamed God Mode agent reasoning.

## [2.3.2] - 2026-08-11

### Fixed

- Retry for reasoning-only God Mode agents.

## [2.3.1] - 2026-08-11

### Added

- Streamed local model responses.

## [2.3.0] - 2026-08-11

### Added

- Local model reasoning is revealed in the assistant.

## [2.2.1] - 2026-08-11

### Fixed

- Reasoning model endpoints are supported.
- Desktop provider selector is shown.

## [2.2.0] - 2026-08-11

### Added

- Windows desktop (Tauri 2) app with loopback Ollama and OpenAI-compatible
  providers.
- Internal catalog and optimization flows; expanded catalog with stabilized
  God Mode simulations.

### Fixed

- Desktop AI provider settings are exposed.

## [2.1.2] - 2026-08-02

### Fixed

- Assistant text overlap in the UI.

## [2.1.1] - 2026-08-02

### Fixed

- DeepSeek output truncation.

## [2.1.0] - 2026-08-02

### Added

- DeepSeek R1 and resilient God Mode with dual-call architecture and strict planner.
- Solving problems from web sources; ProblemSpecV2 and DpFamilyContractV2.
- Experimental 32K context for all models.
- Product requirements document and expanded regression coverage.

### Fixed

- Radio playback preserved across locale changes.
- Accessible theme contrast enforced.

## [2.0.0] - 2026-07-31

### Added

- All remaining algorithm simulators (60 deterministic simulators).
- Versioning system and update notes.
- CodeXRay Radio: YouTube Music playlist player with wave animation, media
  controls, custom playlists, progress bar, minimize timeout, and autoplay settings.
- Settings tabs, light/dark theme toggle, and AI panel maximize toggle.
- Installation instructions for Windows, macOS, and Linux.

## [0.0.0] - 2026-07-30

### Added

- Initial open source release of CodeXRay.

[Unreleased]: https://github.com/Teknesyum/CodeXRay/compare/v2.3.4...HEAD
[2.3.4]: https://github.com/Teknesyum/CodeXRay/releases/tag/v2.3.4
