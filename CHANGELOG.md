# Changelog

All notable changes to the DeBait extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-11-05

### Added
- Optional setting to preserve YouTube Shorts thumbnails or apply midpoint frames.
- Support for YouTube Live stream URLs formatted as `/live/<id>`.
- Support for short sharing links formatted as `youtu.be/<id>`.
- Automated test coverage for background service worker storage and action badges.
- Automated test coverage for DOM thumbnail swap, fallback, and rollback engine.
- Automated test coverage for observer node filtering and Shorts container detection.
- Cross-platform packaging script in `scripts/package.js` using Node.js built-ins.
- Visible focus outline on popup switches for keyboard accessibility.

### Changed
- Scoped all CSS visibility and opacity overrides to thumbnail wrappers. Global YouTube elements remain untouched.
- Updated resolution fallback engine to restore genuine creator art when all midpoint attempts fail.
- Optimized MutationObserver to scan only newly added subtrees rather than the full document.
- Reworked thumbnail flip button listener to resolve target containers dynamically at click time.
- Switched popup version indicator to read dynamically from `manifest.json`.
- Removed dead `*://*.youtube-nocookie.com/*` permission from `manifest.json`.

### Fixed
- Fixed memory closure retention across recycled Lit virtual scroll containers.
- Fixed MutationObserver feedback loop caused by internal badge insertions.
- Fixed unobserved `srcset` attribute updates on lazily loaded YouTube thumbnails.
- Removed tracked binary archive `debait-v1.0.0.zip` from repository index.

## [1.0.6] - 2026-11-04

### Fixed
- Resolved blank thumbnail states caused by Polymer opacity timing.
- Shielded image processing against infinite mutation observer cycles.

## [1.0.5] - 2026-11-04

### Added
- Context validity guard to prevent crashes during extension reload.
- Initial attribute watcher for dynamic `srcset` changes.

### Changed
- Disabled redundant script injection into cross-origin iframes.

## [1.0.4] - 2026-11-03

### Performance
- Eliminated asynchronous network probe latency for 0ms synchronous thumbnail swaps.
- Batched DOM sweeps using `requestAnimationFrame`.
- Decoupled storage synchronization from image swap operations.

## [1.0.3] - 2026-11-03

### Changed
- Replaced `declarativeNetRequest` with direct DOM keyframe interception.
- Avoided Chromium RE2 regex memory limit restrictions.

## [1.0.2] - 2026-11-03

### Changed
- Split network filtering rules into three lightweight rulesets.

## [1.0.1] - 2026-11-03

### Added
- Stageshow dark surface theme across the extension popup.
- Tactical micro switch controls and glowing status indicators.

## [1.0.0] - 2026-11-03

### Added
- Initial release of DeBait for YouTube.
- 50% midpoint frame replacement using YouTube CDN keyframes.
- In-page masthead toggle button beside search bar.
- Individual video hover flip button.
- Verification badge on replaced thumbnails.
- Universal `Alt+H` keyboard shortcut.
