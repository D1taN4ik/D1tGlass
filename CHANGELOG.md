# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-11-18

### Fixed
- Tab pill drifted sideways while pressed (most visible on the last tabs). The pill is now positioned with the `translate` property, so `scale` no longer multiplies the offset.
- Tab pill jumped back to the active tab during a press: the library re-initialized tabs when its own `rf-pressing` class was toggled.
- On quick taps the pill had no time to grow. It now grows in 0.18s and stays pressed for at least 220ms, then springs back.

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

[1.0.1]: ../../releases/tag/v1.0.1
[1.0.0]: ../../releases/tag/v1.0.0
