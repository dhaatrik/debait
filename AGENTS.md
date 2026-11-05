# DeBait: Agent Coding Guidelines & Operational Protocol

This document defines the strict architectural invariants, verification gates, and release rules that **all AI coding agents** (Cursor, Antigravity, Claude Code, Windsurf, Aider, Copilot) must follow when contributing to or modifying this repository.

---

## 1. Absolute Invariants

1. **Zero Runtime npm Dependencies.**
   Do not install external npm dependencies. The production extension runs purely on native modern JavaScript (ES2022+), browser DOM APIs, and WebExtensions APIs. Testing and packaging must use built-in Node.js modules (`node:test`, `node:assert`, `node:fs`, `node:path`, `node:zlib`).

2. **Strict Manifest V3 Compliance.**
   - No background pages; use the Service Worker in `background.js`.
   - No inline scripts or inline event handlers in HTML.
   - Keep permissions strictly minimal (`"storage"` in `permissions`, `*://*.youtube.com/*` in `host_permissions`).

3. **Privacy First (Zero Telemetry).**
   All image operations connect directly to YouTube edge infrastructure (`i.ytimg.com`). Never introduce external network calls, tracking pixels, or third-party analytics.

4. **DOM Mutation Shielding & Performance.**
   - Never allow recursive `MutationObserver` loops.
   - Use `isReverting` execution locks during bulk DOM rollbacks (`revertAll`).
   - Keep `restoreImg` completely idempotent: always delete `debaitOrig` upon restore so subsequent calls produce zero writes to `img.src`.
   - Never iterate `querySelectorAll` over raw DOM elements in `childList` mutations. Batch all scans into a single debounced `requestAnimationFrame` pass.
   - Confine CSS overrides strictly to `ytd-thumbnail` and `#thumbnail`. Never set global `!important` display or opacity rules on `.yt-core-image` or `yt-img-shadow`.

---

## 2. Mandatory Versioning Protocol (SemVer)

Whenever you implement a fix, performance improvement, or new feature:

1. **You MUST bump the version** following [Semantic Versioning](https://semver.org/):
   - **PATCH** (`x.y.Z`): Bug fixes, performance optimizations, internal refactoring.
   - **MINOR** (`x.Y.0`): New features, new settings toggles, extended URL support.
   - **MAJOR** (`X.0.0`): Breaking architecture or platform rewrites.

2. **You MUST synchronize all 4 version locations**:
   - `manifest.json`: `"version": "X.Y.Z"`
   - `package.json`: `"version": "X.Y.Z"`
   - `CHANGELOG.md`: Prepend `## [X.Y.Z] - YYYY-MM-DD` with categorized changes.
   - `CHROMEWEBSTORE.md`: Add `vX.Y.Z` entry in the Version History section.
   *(Note: `popup/popup.html` reads version dynamically from the manifest; do not hardcode static versions in HTML).*

---

## 3. Mandatory Pre-Commit Verification Checklist

Before declaring any task complete or committing changes, you MUST run and pass:

```bash
# 1. Run all unit and regression test suites
npm test

# 2. Verify JavaScript syntax compilation across all files
npm run lint

# 3. Verify cross-platform store package generation
npm run package
```

If any test fails, you are blocked. Resolve the root cause before proceeding.

---

## 4. Git Tagging & Release Protocol

GitHub Releases are driven by Git tags matching `v*.*.*`. Pushing commits to `main` without pushing the corresponding tag will **not** update the release on GitHub.

When publishing a new version:

```bash
# 1. Commit synchronized code and documentation
git add -A
git commit -m "feat/fix: descriptive summary of changes"

# 2. Create the annotated git tag matching manifest version
git tag -a vX.Y.Z -m "Release vX.Y.Z: Summary of release"

# 3. Push both the branch commit and the tag to origin
git push origin main
git push origin vX.Y.Z
```

This triggers the GitHub Actions release workflow to build `dist/debait-vX.Y.Z.zip` and publish the release.
