# Contributing to DeBait

Thank you for your interest in contributing to DeBait.
This document outlines our engineering guidelines, development setup, and pull request process.

## Guiding Principles

1. **Zero External Dependencies.** The production extension uses zero npm packages. It runs on native browser and Node.js built-in APIs.
2. **Strict Manifest V3 Compliance.** We use service workers, declarative commands, and scoped permissions.
3. **Privacy First.** The extension runs locally. No analytics, tracking, or external server calls are permitted.
4. **Zero Performance Impact.** DOM operations must remain debounced and lightweight. Never block the YouTube player or main scrolling thread.

## Local Development Setup

### Prerequisites
- Node.js (version 20 or higher).
- A Chromium browser (Google Chrome, Brave, Microsoft Edge, or Arc).

### Loading the Extension Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/dhaatrik/debait.git
   cd debait
   ```
2. Open your browser and navigate to the extensions manager:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the cloned `debait` repository folder.
5. Navigate to [youtube.com](https://www.youtube.com) to verify your changes.

## Verification Commands

Run the test suite before submitting any changes:

```bash
# Run the automated unit test suite
npm test

# Verify syntax across all JavaScript files
npm run lint

# Generate a clean production release archive in dist/
npm run package
```

## Project Architecture

- `manifest.json`: Defines extension metadata, scoped permissions, and script registration.
- `background.js`: Service worker handling default settings, browser startup, and hotkeys.
- `content/content.js`: Main content script handling URL parsing, DOM replacement, and mutation tracking.
- `content/content.css`: Injected styles for masthead controls, thumbnail badges, and flip buttons.
- `popup/`: Extension popup user interface and settings controller.
- `scripts/package.js`: Zero-dependency zip archiver producing store distribution packages.
- `tests/`: Automated test suites covering parser logic, DOM mutations, and service workers.

## Pull Request Guidelines

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Follow Conventional Commits for commit messages:
   - `feat:` for new capabilities.
   - `fix:` for bug fixes.
   - `perf:` for performance optimizations.
   - `test:` for test additions or updates.
   - `docs:` for documentation updates.
3. Keep changes focused and self-contained.
4. Ensure all unit tests pass cleanly before opening a pull request.
5. Open a pull request against the `main` branch with a clear description of the problem and your solution.
