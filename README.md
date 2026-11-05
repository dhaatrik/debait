# DeBait for YouTube™

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Extension-Manifest%20V3-4285F4.svg?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Vanilla JavaScript](https://img.shields.io/badge/Built%20With-Vanilla%20ES6%2B-F7DF1E.svg?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success.svg?style=flat-square)](#tech-stack--architectural-rationale)
[![Cross Browser](https://img.shields.io/badge/Browsers-Chrome%20%7C%20Edge%20%7C%20Brave%20%7C%20Arc-orange.svg?style=flat-square)](#getting-started--installation)

<p align="center">
  <strong>Show what is actually in the video.</strong><br>
  An ultra-lightweight, zero-dependency browser extension that bypasses sensationalized, misleading clickbait by replacing YouTube thumbnails with authentic frames captured at the exact 50% midpoint of the video.
</p>

[Overview](#overview) •
[Tech Stack](#tech-stack--architectural-rationale) •
[Features](#features--key-functionalities) •
[Architecture](#how-it-works-technical-deep-dive) •
[Installation](#getting-started--installation) •
[Usage](#usage-instructions) •
[Testing](#testing--quality-assurance) •
[Contributing](#contributing) •
[Contact](#connect--inquiries)

</div>

---

## Overview

| Dimension | Description |
| :--- | :--- |
| **Problem** | Sensationalized thumbnails, exaggerated facial reactions, and fabricated graphics are pervasive across YouTube, manipulating viewer attention and obscuring true video content. |
| **Solution** | **DeBait** intercepts video elements across all YouTube surfaces and replaces uploader thumbnails with genuine frames captured from the exact 50% midpoint of the video timeline. |
| **Approach** | Rather than relying on external proxy servers or heavyweight client-side video decoders, DeBait interfaces directly with YouTube's keyframe edge infrastructure (`i.ytimg.com`). It serves native 16:9 720p HD midpoint stills with automated fallbacks and zero telemetry. |

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack & Architectural Rationale](#tech-stack--architectural-rationale)
- [Features & Key Functionalities](#features--key-functionalities)
- [How It Works: Technical Deep Dive](#how-it-works-technical-deep-dive)
- [Getting Started & Installation](#getting-started--installation)
- [Usage Instructions](#usage-instructions)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Project Structure](#project-structure)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)
- [Connect & Inquiries](#connect--inquiries)

---

## Tech Stack & Architectural Rationale

DeBait was engineered with a strict **zero-dependency, maximum-performance** philosophy.

```text
+------------------------------------------------------------------------+
|                        DeBait Architecture                             |
|                                                                        |
|   [ YouTube DOM ] ---> [ MutationObserver ] ---> [ RAF Debouncer ]    |
|                                                          |             |
|                                                          v             |
|   [ Image Swap ] <--- [ Fallback Engine ] <--- [ Video ID Parser ]    |
|         |                     |                                        |
|         v                     v                                        |
|   hq720_2.jpg (HD) ---> hq2.jpg (SD) ---> 2.jpg (Low)                  |
+------------------------------------------------------------------------+
```

| Technology | Role | Justification |
| :--- | :--- | :--- |
| **Vanilla JavaScript (ES6+)** | Core Runtime | Eliminates compilation and bundling overhead, guarantees microsecond execution speeds, and removes external supply-chain risks. |
| **DOM Keyframe Interception** | Keyframe Replacement | Intercepts and swaps thumbnail image elements and attributes directly in the YouTube DOM for instantaneous, zero-flicker keyframe swaps without Chromium regex budget limits. |
| **Manifest V3** | Extension Standard | Modern Chrome Extensions specification utilizing Service Workers (`background.js`), scoped permissions, and a strict Content Security Policy (CSP). |
| **Chrome Storage API** | State Management | `chrome.storage.sync` enables asynchronous, persistent settings synchronization across multiple devices and tabs without page reloads. |
| **CSS3 Custom Properties** | Injected UI Theme | Utilizes YouTube's native design tokens (e.g., `--yt-spec-text-primary`, `--yt-spec-badge-chip-background`) so injected controls automatically adapt to Dark and Light modes. |
| **YouTube Keyframe CDN** | Asset Delivery | Communicates directly with Google's edge CDN (`i.ytimg.com`). Requires zero proprietary backend infrastructure, ensuring total user privacy. |

---

## Features & Key Functionalities

- **True 50% Midpoint Frame Extraction**  
  Directly requests `hq720_2.jpg` (1280x720 native 16:9 aspect ratio). Automatically handles multi-tier error fallback chains (`hq720_2.jpg` -> `hq2.jpg` -> `2.jpg`) for standard-definition or vintage uploads.

- **In-Page YouTube Masthead Toggle**  
  Injects an accessible toggle switch into YouTube's top navigation bar (beside search and notifications). Toggles the entire page between halfway frames and creator thumbnails in a single click without page reloads.

- **Per-Thumbnail Micro-Flip Control**  
  Hovering over any individual video reveals a dedicated flip button in the top-right corner, allowing users to inspect the creator's uploaded thumbnail on a per-video basis.

- **Visual Verification Badge**  
  Renders an unobtrusive corner badge on active thumbnails, confirming that an authentic midpoint capture is currently displayed.

- **Universal Keyboard Shortcut (<kbd>Alt</kbd> + <kbd>H</kbd>)**  
  Registered via the Chrome Commands API. Press <kbd>Alt</kbd> + <kbd>H</kbd> anywhere on YouTube to instantly toggle thumbnail modes.

- **Settings Popup Dashboard**  
  A clean dashboard providing master controls, live operational status, granular option switches (navbar toggle, badges, hover buttons), and resolution preferences.

- **Zero Telemetry and Full Privacy**  
  No tracking, no analytics, and no external network calls. All operations execute strictly between the browser and YouTube's official asset domains.

---

## How It Works: Technical Deep Dive

### 1. Keyframe Resolution Mapping
When videos are processed on YouTube, its ingestion pipeline encodes automated fallback keyframes at fixed timeline points:

$$\text{Timestamp Position} \approx 50\% \text{ of Total Duration}$$

| URL Segment | Resolution | Aspect Ratio | Availability |
| :--- | :--- | :--- | :--- |
| `hq720_2.jpg` | 1280 x 720 | 16:9 | HD and modern uploads |
| `hq2.jpg` | 480 x 360 | 4:3 (Letterboxed) | Universal fallback |
| `2.jpg` | 120 x 90 | 4:3 | Low-bandwidth fallback |

### 2. Video ID Parsing Strategy
DeBait extracts video IDs using a high-reliability dual-stage resolver:
1. **DOM Anchor Traversal**: Queries parent and adjacent anchors (`a#thumbnail`, `a#video-title-link`, `a[href*="/watch?v="]`, `a[href*="/shorts/"]`) using regex `/[?&]v=([a-zA-Z0-9_-]{11})/`.
2. **CDN URL Introspection**: If anchor links are virtualized or unrendered, DeBait extracts the ID directly from active `img.src` or `img.srcset` attributes via `/\/(?:vi|vi_webp)\/([a-zA-Z0-9_-]{11})\//`.

### 3. Non-Destructive State Restoration
Before replacing a thumbnail, DeBait caches the original image attributes:
- `img.dataset.debaitOrigSrc = img.currentSrc || img.src`
- `img.dataset.debaitOrigSrcset = img.srcset`

When toggled back to original mode, the exact creator thumbnail and `srcset` are restored from memory without re-triggering network fetches or layout shifts.

### 4. SPA Lifecycle Handling
YouTube operates as a client-side Single Page Application (Polymer/Custom Elements). DeBait hooks into native YouTube lifecycle events (`yt-navigate-finish`, `yt-page-data-updated`) and batches DOM operations with a `MutationObserver` piped into `window.requestAnimationFrame()` to maintain 60 FPS scrolling.

---

## Getting Started & Installation

### Prerequisites
- Any modern Chromium-based browser supporting **Manifest V3**:
  - Google Chrome (v88+)
  - Microsoft Edge (v88+)
  - Brave Browser
  - Arc Browser / Opera / Vivaldi

### Step-by-Step Installation

```bash
# 1. Clone the repository
git clone https://github.com/dhaatrik/debait.git

# 2. Enter the project directory
cd debait
```

#### Loading into Your Browser:
1. Open your browser and navigate to the Extensions management page:
   - **Chrome**: `chrome://extensions`
   - **Brave**: `brave://extensions`
   - **Edge**: `edge://extensions`
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. Click the **Load unpacked** button in the top-left toolbar.
4. Select the cloned `debait` project folder.
5. Pin **DeBait** to your browser toolbar from the Extensions menu.
6. Open [youtube.com](https://www.youtube.com).

---

## Usage Instructions

### Toggle Matrix

| Method | Trigger Location | Scope |
| :--- | :--- | :--- |
| **Top Bar Switch** | YouTube Masthead | Global (All videos on page) |
| **Keyboard Shortcut** | <kbd>Alt</kbd> + <kbd>H</kbd> | Global (All videos on page) |
| **Hover Flip Button** | Video Thumbnail Top-Right | Individual Video |
| **Extension Popup** | Browser Toolbar Icon | Global state & configuration |

### Keyboard Shortcut Configuration
By default, the global toggle is mapped to <kbd>Alt</kbd> + <kbd>H</kbd>. To customize this shortcut:
1. Open `chrome://extensions/shortcuts` in your browser.
2. Scroll to **DeBait: Honest YouTube Thumbnails**.
3. Click the edit icon beside `Toggle between halfway frames and creator thumbnails` and assign your preferred key combination.

---

## Testing & Quality Assurance

### 1. Automated Test Suite (Zero Dependencies)
Runs the test suite using Node.js's built-in `node:test` runner, verifying YouTube URL parsing, edge-case video ID extraction, resolution fallback chains, and Manifest V3 asset schema:

```bash
npm test
```

### 2. JavaScript Syntax Compilation Check
Ensures all background, content, popup, and packaging scripts compile cleanly with zero syntax errors:

```bash
npm run lint
```

### 3. Zero-Dependency Distribution Packager
Packages the production extension zip into `dist/debait-v1.1.0.zip` using raw Node.js streams without third-party dependencies:

```bash
npm run package
```

### 4. Continuous Integration
All tests, syntax checks, and packaging steps run automatically via GitHub Actions on every push and pull request to `main`.

---

## Project Structure

```text
debait/
|-- .github/
|   `-- workflows/
|       |-- ci.yml            # Automated CI test runner on push & PR
|       `-- release.yml       # Automated tag-driven packaging & GitHub Release
|-- manifest.json             # Chrome Manifest V3 metadata, permissions & routing
|-- background.js             # Service Worker: storage sync, badges & hotkeys
|-- content/
|   |-- content.js            # Injected DOM engine: ID parser, frame swap & observer
|   `-- content.css           # Injected UI styles: masthead toggle, badges & flip button
|-- popup/
|   |-- popup.html            # Extension action popup interface
|   |-- popup.css             # Dark-themed UI component styles
|   `-- popup.js              # Settings controller & bidirectional sync
|-- icons/
|   |-- icon-16.png           # 16x16px browser action icon
|   |-- icon-48.png           # 48x48px extensions manager icon
|   `-- icon-128.png          # 128x128px high-DPI & web store icon
|-- scripts/
|   `-- package.js            # Zero-dependency build script creating production zip
|-- tests/
|   |-- background.test.js    # Service worker lifecycle, sync & hotkey unit tests
|   |-- content.test.js       # DOM element swap, fallback chain & restore unit tests
|   |-- manifest.test.js      # Manifest schema, permissions & asset presence tests
|   |-- observer.test.js      # Mutation observer filtering & Shorts element unit tests
|   `-- parser.test.js        # Unit tests for URL parser, fallbacks & ID resolver
|-- package.json              # Zero-dependency test, lint & package task definitions
|-- CHANGELOG.md             # Complete historical record of all releases
|-- CONTRIBUTING.md          # Open-source contribution guidelines & setup
|-- CHROMEWEBSTORE.md         # Official Web Store metadata, justifications & privacy policy
|-- LICENSE                   # Open-source MIT License
`-- README.md                 # Project documentation & engineering manual
```

---

## Changelog

Detailed release notes and historical updates for each version are documented in [CHANGELOG.md](CHANGELOG.md).

---

## Contributing

Contributions are welcomed. DeBait is built with a strict zero-dependency architecture and modern Manifest V3 standards.

Please review our [CONTRIBUTING.md](CONTRIBUTING.md) guide before submitting a pull request for information on:
- Local development and extension loading.
- Running the zero-dependency test suite (`npm test`).
- Code style, performance invariants, and conventional commit rules.

1. **Fork the Repository** on GitHub.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Commit Changes** using [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add user-configurable frame offset"
   ```
4. **Push Branch**:
   ```bash
   git push origin feat/your-feature-name
   ```
5. **Open a Pull Request** against the `main` branch.

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```text
Copyright (c) 2026 Dhaatrik Chowdhury
```

---

## Connect & Inquiries

Developed and maintained by **Dhaatrik Chowdhury**. For professional inquiries, collaborations, or questions:

<div align="center">

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2.svg?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/dhaatrik)
[![X / Twitter](https://img.shields.io/badge/X%20(Twitter)-000000.svg?style=flat-square&logo=x&logoColor=white)](https://x.com/dhaatrik)
[![GitHub](https://img.shields.io/badge/GitHub-181717.svg?style=flat-square&logo=github&logoColor=white)](https://github.com/dhaatrik)
[![Portfolio](https://img.shields.io/badge/Portfolio-2563EB.svg?style=flat-square&logo=google-chrome&logoColor=white)](https://dhaatrik.github.io/)

</div>
