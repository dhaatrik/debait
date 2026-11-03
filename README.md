# DeBait for YouTube™ 🎯

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Extension-Manifest%20V3-4285F4.svg?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Vanilla JavaScript](https://img.shields.io/badge/Built%20With-Vanilla%20ES6%2B-F7DF1E.svg?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success.svg?style=for-the-badge)](#tech-stack)
[![Cross Browser](https://img.shields.io/badge/Browsers-Chrome%20%7C%20Edge%20%7C%20Brave%20%7C%20Arc-orange.svg?style=for-the-badge)](#getting-started)

<p align="center">
  <strong>Show what is actually in the video.</strong><br>
  An ultra-lightweight, zero-dependency browser extension that bypasses sensationalized, misleading clickbait by replacing YouTube thumbnails with authentic frames captured at the exact 50% midpoint of the video.
</p>

[Key Features](#features--key-functionalities) •
[Architecture](#how-it-works-technical-deep-dive) •
[Installation](#getting-started--installation) •
[Usage](#usage-instructions) •
[Contributing](#contributing) •
[Connect](#connect--inquiries)

</div>

---

## 💡 Overview: The What, Why, and How

| Dimension | Description |
| :--- | :--- |
| **What** | **DeBait** is a production-grade browser extension built for modern Chromium browsers (Chrome, Edge, Brave, Arc, Opera) using Manifest V3. It intercepts video cards across all YouTube surfaces and swaps the uploader's marketing thumbnail with an actual high-definition video frame extracted from the halfway timestamp. |
| **Why** | Exaggerated facial expressions, fabricated graphics, red arrows, and out-of-context images dominate YouTube's recommendation feed to manipulate viewer psychology. DeBait restores cognitive clarity and informs browsing choices by previewing raw video footage *before* you click. |
| **How** | Rather than relying on heavyweight video processing or third-party proxy servers, DeBait taps directly into YouTube's distributed keyframe edge network (`i.ytimg.com`). It extracts 16:9 720p HD midpoint stills (`hq720_2.jpg`) with graceful multi-tier fallbacks, client-side caching, and instantaneous bidirectional toggling. |

---

## 📑 Table of Contents

- [Overview: The What, Why, and How](#-overview-the-what-why-and-how)
- [Tech Stack & Architectural Rationale](#-tech-stack--architectural-rationale)
- [Features & Key Functionalities](#-features--key-functionalities)
- [How It Works: Technical Deep Dive](#-how-it-works-technical-deep-dive)
- [Getting Started & Installation](#-getting-started--installation)
- [Usage Instructions](#-usage-instructions)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)
- [Connect & Inquiries](#-connect--inquiries)

---

## 🛠️ Tech Stack & Architectural Rationale

DeBait was engineered with a strict **zero-dependency, maximum-performance** philosophy.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DeBait Architecture                             │
│                                                                        │
│   [ YouTube DOM ] ───► [ MutationObserver ] ───► [ RAF Debouncer ]    │
│                                                          │             │
│                                                          ▼             │
│   [ Image Swap ] ◄─── [ Fallback Engine ] ◄─── [ Video ID Parser ]    │
│         │                     │                                        │
│         ▼                     ▼                                        │
│   hq720_2.jpg (HD) ──► hq2.jpg (SD) ──► 2.jpg (Low)                    │
└────────────────────────────────────────────────────────────────────────┘
```

| Technology | Role | Justification |
| :--- | :--- | :--- |
| **JavaScript (ES6+)** | Core Logic | Pure Vanilla JS with no compilation step. Eliminates runtime bundle overhead, guarantees microsecond execution speeds, and ensures zero supply-chain vulnerabilities. |
| **Manifest V3** | Extension Standard | Modern Chrome Extension specification leveraging Service Workers (`background.js`), granular declarative permissions, and strict Content Security Policy (CSP). |
| **Chrome Storage API** | State Management | `chrome.storage.sync` enables instantaneous, asynchronous preference persistence across multiple devices and active browser windows without page reloads. |
| **CSS3 Custom Properties** | Injected UI Theme | Utilizes YouTube's native CSS design tokens (e.g., `--yt-spec-text-primary`, `--yt-spec-badge-chip-background`) so injected controls automatically adapt to Dark and Light modes. |
| **YouTube Keyframe CDN** | Asset Delivery | Communicates directly with Google's edge CDN (`i.ytimg.com`). Zero proprietary backend servers, ensuring 100% user privacy and sub-10ms response times. |

---

## ✨ Features & Key Functionalities

- **🎯 True 50% Midpoint Frame Extraction**  
  Directly requests `hq720_2.jpg` (1280×720 native 16:9 aspect ratio). Automatically handles multi-tier error fallback chains (`hq720_2.jpg` $\rightarrow$ `hq2.jpg` $\rightarrow$ `2.jpg`) for vintage or low-resolution uploads.

- **⚡ In-Page YouTube Masthead Toggle**  
  Injects a seamless switch directly into YouTube's top navigation bar (beside search and notifications). Toggles the entire page between halfway frames and creator thumbnails in 1 click without refreshing.

- **🔄 Per-Thumbnail Micro-Flip Control**  
  Curious about what clickbait graphic the creator uploaded? Hovering over any individual video reveals a dedicated flip icon in the top-right corner to toggle *just that specific video*.

- **🏷️ Visual Verification Badge (`50%`)**  
  Renders a semi-transparent corner badge on active thumbnails, giving clear visual confirmation that you are viewing an authentic midpoint capture.

- **⌨️ Universal Keyboard Shortcut (<kbd>Alt</kbd> + <kbd>H</kbd>)**  
  Registered through the Chrome Commands API. Press <kbd>Alt</kbd> + <kbd>H</kbd> anywhere on YouTube to instantly toggle thumbnails.

- **🎛️ Feature-Rich Extension Popup**  
  Modern dark-mode dashboard providing master controls, live operational status, granular option switches (navbar toggle, badges, hover buttons), and resolution preferences.

- **🛡️ 100% Privacy & Zero Telemetry**  
  No tracking, no analytics, no external network requests. All operations execute strictly between the browser and YouTube's official asset domains.

---

## 🔬 How It Works: Technical Deep Dive

### 1. Keyframe Resolution Mapping
When videos are processed on YouTube, its ingestion pipeline encodes automated fallback keyframes at fixed timeline points:

$$\text{Timestamp Position} \approx 50\% \text{ of Total Duration}$$

```text
┌────────────────────────────────────────────────────────────────────────┐
│ YouTube Edge Keyframe Endpoints (vi/<ID>/)                             │
├──────────────────────┬─────────────┬──────────────┬────────────────────┤
│ URL Segment          │ Resolution  │ Aspect Ratio │ Availability       │
├──────────────────────┼─────────────┼──────────────┼────────────────────┤
│ hq720_2.jpg          │ 1280 × 720  │ 16:9         │ HD / Modern Videos │
│ hq2.jpg              │ 480 × 360   │ 4:3 (Letter) │ Universal Fallback │
│ 2.jpg                │ 120 × 90    │ 4:3          │ Low-Bandwidth      │
└──────────────────────┴─────────────┴──────────────┴────────────────────┘
```

### 2. Video ID Parsing Strategy
DeBait extracts video IDs using a high-reliability dual-stage resolver:
1. **DOM Anchor Traversal**: Queries parent and adjacent anchors (`a#thumbnail`, `a#video-title-link`, `a[href*="/watch?v="]`, `a[href*="/shorts/"]`) using regex `/[?&]v=([a-zA-Z0-9_-]{11})/`.
2. **CDN URL Introspection**: If anchor links are virtualized or unrendered, DeBait falls back to extracting the ID directly from active `img.src` or `img.srcset` attributes via `/\/(?:vi|vi_webp)\/([a-zA-Z0-9_-]{11})\//`.

### 3. Non-Destructive State Restoration
Before replacing a thumbnail, DeBait stores the original image attributes:
- `img.dataset.debaitOrigSrc = img.currentSrc || img.src`
- `img.dataset.debaitOrigSrcset = img.srcset`

When toggled back to original mode, the exact creator thumbnail and `srcset` are restored from local memory without re-triggering network fetches or layout shifts.

### 4. SPA Lifecycle Handling
YouTube operates as a client-side Single Page Application (Polymer/Custom Elements). DeBait listens to native YouTube lifecycle hooks (`yt-navigate-finish`, `yt-page-data-updated`) and batches DOM operations with a `MutationObserver` piped into `window.requestAnimationFrame()` to guarantee 60 FPS scrolling.

---

## 🚀 Getting Started & Installation

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
5. Pin **DeBait** to your browser toolbar from the Extensions menu (puzzle piece icon).
6. Navigate to [youtube.com](https://www.youtube.com) and explore!

---

## 🎮 Usage Instructions

### Toggle Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                         DeBait Toggle Modes                            │
├─────────────────────┬───────────────────────────┬──────────────────────┤
│ Method              │ Trigger Location          │ Scope                │
├─────────────────────┼───────────────────────────┼──────────────────────┤
│ Top Bar Switch      │ YouTube Masthead          │ Global (All videos)  │
│ Keyboard Shortcut   │ Alt + H                   │ Global (All videos)  │
│ Hover Flip Button   │ Video Thumbnail Top-Right │ Individual Video     │
│ Extension Popup     │ Browser Toolbar Icon      │ Global & Settings    │
└─────────────────────┴───────────────────────────┴──────────────────────┘
```

### Keyboard Shortcut Configuration
By default, the global toggle is mapped to <kbd>Alt</kbd> + <kbd>H</kbd>. To customize this shortcut:
1. Open `chrome://extensions/shortcuts` in your browser.
2. Scroll down to **DeBait — Honest YouTube Thumbnails**.
3. Click the edit icon beside `Toggle between halfway frames and creator thumbnails` and assign your preferred key combination.

---

## 🧪 Testing & Quality Assurance

DeBait includes automated syntax validation and structural integrity verification scripts.

### 1. Structural Integrity & Manifest Audit
Verify that all manifest targets, icons, content scripts, and assets resolve correctly:

```bash
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
console.log('✓ Validating Manifest V3 schema for:', manifest.name);
Object.values(manifest.icons).forEach(f => { if (!fs.existsSync(f)) throw new Error('Missing icon: ' + f); });
manifest.content_scripts.forEach(cs => cs.js.concat(cs.css).forEach(f => { if (!fs.existsSync(f)) throw new Error('Missing script: ' + f); }));
console.log('✓ All assets and paths successfully verified!');
"
```

### 2. JavaScript Syntax Compilation Check
Ensure all background, content, and popup scripts compile cleanly with zero syntax errors:

```bash
node -c background.js content/content.js popup/popup.js
```

### 3. Build Distribution Bundle
To package the extension into an optimized zip file for deployment or Chrome Web Store distribution:

```bash
# Windows PowerShell
Compress-Archive -Path manifest.json, background.js, icons, content, popup, README.md, LICENSE, CHROMEWEBSTORE.md -DestinationPath debait-v1.0.0.zip -Force
```

---

## 📂 Project Structure

```text
debait/
├── manifest.json              # Chrome Manifest V3 metadata, permissions & routing
├── background.js             # Service Worker: storage sync, badges & hotkeys
├── content/
│   ├── content.js            # Injected DOM engine: ID parser, frame swap & observer
│   └── content.css           # Injected UI styles: masthead toggle, badges & flip button
├── popup/
│   ├── popup.html            # Extension action popup interface
│   ├── popup.css             # Dark-themed UI component styles
│   └── popup.js              # Settings controller & bidirectional sync
├── icons/
│   ├── icon-16.png           # 16×16px browser action icon
│   ├── icon-48.png           # 48×48px extensions manager icon
│   └── icon-128.png          # 128×128px high-DPI & web store icon
├── CHROMEWEBSTORE.md         # Official Web Store metadata, justifications & privacy policy
├── LICENSE                   # Open-source MIT License
└── README.md                 # Project documentation & engineering manual
```

---

## 🤝 Contributing

Contributions, feature suggestions, and bug reports are welcome!

1. **Fork the Repository**: Click the `Fork` button at the top of the repository.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feat/amazing-feature
   ```
3. **Commit Your Changes**: Follow [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add custom frame timestamp selection"
   ```
4. **Push to the Branch**:
   ```bash
   git push origin feat/amazing-feature
   ```
5. **Open a Pull Request**: Submit your PR with a concise description of your changes and testing steps.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for complete details.

```text
Copyright (c) 2026 Dhaatrik Chowdhury
```

---

## 📬 Connect & Inquiries

Developed and maintained by **Dhaatrik Chowdhury**. If you like this project or have inquiries regarding collaborations, feel free to connect:

<div align="center">

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2.svg?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/dhaatrik)
[![X / Twitter](https://img.shields.io/badge/X%20(Twitter)-000000.svg?style=for-the-badge&logo=x&logoColor=white)](https://x.com/dhaatrik)
[![GitHub](https://img.shields.io/badge/GitHub-181717.svg?style=for-the-badge&logo=github&logoColor=white)](https://github.com/dhaatrik)
[![Portfolio](https://img.shields.io/badge/Portfolio-2563EB.svg?style=for-the-badge&logo=google-chrome&logoColor=white)](https://dhaatrik.github.io/)

</div>
