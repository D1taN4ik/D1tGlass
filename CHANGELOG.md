# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-17

### Added
- `data-refract` attribute / `refract` class: refractive glass with chromatic aberration on any element.
- Options via `data-rf-scale`, `data-rf-bezel`, `data-rf-aberration`, `data-rf-blur`, `data-rf-saturate`, `data-rf-brightness`.
- Preset tints: `data-rf-tint="light" | "dark" | "clear"`.
- `data-rf-tabs`: tab bar with a sliding, press-to-grow pill and the `rf:change` event.
- `data-rf-press` (springy press) and `data-rf-haptic` (Android vibration + Safari on iOS 18+ native haptics).
- Auto-init with `MutationObserver` for dynamically added/removed elements.
- JavaScript API: `apply`, `remove`, `refresh`, `tabs`, `haptic`, `init`, `supported`, `defaults`.
- Shared SVG filters for identical elements; edge-only displacement map generation.
- Frosted-glass fallback for browsers without SVG `backdrop-filter` support.
- TypeScript declarations.

[1.0.0]: ../../releases/tag/v1.0.0
