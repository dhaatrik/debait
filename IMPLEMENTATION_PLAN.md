# DeBait — Production Hardening & Optimization Implementation Plan

> **Target Version:** `v1.1.0`  
> **Repository:** `dhaatrik/debait`  
> **Source Audit Date:** 2026-11-05  
> **Purpose:** Step-by-step, self-contained implementation plan to execute the audit recommendations across 4 isolated, testable phases.

---

## 🎯 Architecture & Objectives Overview

This implementation plan transitions DeBait from a functional prototype into an enterprise-grade, production-hardened Chrome Extension.

### Key Objectives:
1. **Eliminate CSS Leakage**: Confine thumbnail overrides strictly to YouTube thumbnail containers without disturbing global avatars, badges, or loading skeletons.
2. **Eliminate Observer Feedback Cascades**: Optimize the `MutationObserver` and DOM scanning to handle YouTube's infinite scroll without lagging CPU or thrashing the main thread.
3. **Fix Recycled Element Invariants**: Ensure individual flip buttons work seamlessly across YouTube's virtualized Lit/Polymer scrollers.
4. **Expand Robustness & Edge Cases**: Add support for `/live/<id>` streams, `youtu.be/<id>`, Shorts aspect-ratio handling, and reliable fallback exhaustion to creator thumbnails.
5. **Modernize Tooling & Testing**: Add DOM/Service-Worker unit tests, a cross-platform Node.js packager, and full keyboard accessibility.

---

## 📅 Phased Execution Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Critical Bug Fixes, CSS Isolation & Core Engine Hardening     │
│ ├── Strict CSS containment (remove global !important leakages)         │
│ ├── Fallback exhaustion handling (restore original instead of broken)  │
│ ├── Extended URL parsing (/live/<id>, youtu.be/<id>)                   │
│ ├── Dynamic version display in popup (eliminate hardcoded version)     │
│ ├── Keyboard accessibility (:focus-visible styling)                    │
│ └── Dead code removal                                                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 2: Performance, Observer & Virtualizer Hardening                 │
│ ├── Observer optimization (mutation addedNodes scoping)                │
│ ├── Elimination of self-triggering rescan cascades                     │
│ ├── Virtual-scroll recycler event delegation (fix stale closures)      │
│ ├── Smart srcset synchronization                                       │
│ └── YouTube Shorts mode option (prevent 16:9 vertical crop)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 3: Testing, Tooling & Build Pipeline Modernization               │
│ ├── DOM-level unit test suite (using mock / jsdom in Node.js)          │
│ ├── Service worker & storage sync unit tests                           │
│ ├── Cross-platform Node.js package script (replaces PowerShell)        │
│ ├── Git cleanup: remove committed debait-v1.0.0.zip from repository    │
│ └── Enhanced syntax/static lint script                                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 4: Store Readiness, Polish & Documentation                       │
│ ├── CHROMEWEBSTORE.md update (permissions, justifications, changelog)  │
│ ├── README.md update (remove deprecated DNR references)                │
│ ├── Scoped permissions review (clean youtube-nocookie if unused)       │
│ └── Tag & release verification                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Critical Bug Fixes, CSS Isolation & Core Engine Hardening

### 1.1 Scope CSS Containment in `content/content.css`
* **File:** `content/content.css`
* **Problem:** Lines 108–136 contain global rules targeting `yt-img-shadow:not([loaded]) #img` and `.yt-core-image:not(.yt-core-image--loaded)` with `!important`. These elements are used by YouTube for channel avatars, comment avatars, and loading skeletons. Setting them to `display: block !important; opacity: 1 !important;` globally forces un-loaded images across YouTube to display prematurely with broken placeholders.
* **Implementation:**
  1. Scope all image visibility and display overrides strictly to thumbnail parent containers:
     ```css
     /* Target only thumbnails within valid video containers */
     ytd-thumbnail yt-image img,
     ytd-thumbnail yt-img-shadow img,
     ytd-thumbnail #img,
     ytd-thumbnail img.yt-core-image,
     ytd-thumbnail img,
     #thumbnail img,
     .ytp-videowall-still-image {
       opacity: 1 !important;
       visibility: visible !important;
       display: block !important;
       object-fit: cover !important;
     }

     ytd-thumbnail yt-image,
     ytd-thumbnail yt-img-shadow {
       opacity: 1 !important;
       visibility: visible !important;
       display: block !important;
     }

     /* Constrain Polymer loaded overrides strictly to ytd-thumbnail / #thumbnail */
     ytd-thumbnail yt-img-shadow:not([loaded]) #img,
     #thumbnail yt-img-shadow:not([loaded]) #img {
       display: block !important;
       opacity: 1 !important;
     }

     ytd-thumbnail .yt-core-image:not(.yt-core-image--loaded),
     #thumbnail .yt-core-image:not(.yt-core-image--loaded) {
       opacity: 1 !important;
     }
     ```
  2. Remove the standalone, unscoped `.yt-core-image:not(...)` and `yt-img-shadow:not(...)` blocks.

### 1.2 Graceful Fallback Exhaustion in `content/content.js`
* **File:** `content/content.js`
* **Problem:** In lines 131–139, `img.onerror` calls `getFallbackUrl(img.src, id)`. If `2.jpg` fails (returns `null`), nothing happens. The user is left with a broken image icon. Also, in `restoreImg` (line 174), defaulting to `hqdefault.jpg` shows letterboxed 4:3 SD thumbnails.
* **Implementation:**
  1. Update `img.onerror` so that when `getFallbackUrl` returns `null`, it gracefully falls back to the original thumbnail or high-res default:
     ```javascript
     img.onerror = () => {
       const fallback = getFallbackUrl(img.src, id);
       if (fallback && img.src !== fallback) {
         img.src = fallback;
         img.dataset.debait = fallback;
       } else {
         // Fallback exhausted: restore genuine creator thumbnail or best available original
         if (img.dataset.debaitOrig) {
           img.src = img.dataset.debaitOrig;
         } else {
           img.src = `https://i.ytimg.com/vi/${id}/hq720.jpg`;
         }
         img.dataset.debaitState = 'original';
         if (container) {
           container.dataset.debaitState = 'original';
           updateBadge(container, false);
           updateFlipButtonTooltip(container, 'original');
         }
       }
     };
     ```
  2. In `restoreImg`, if `debaitOrig` is missing, prefer `https://i.ytimg.com/vi/${id}/hq720.jpg` before falling back to `hqdefault.jpg`.

### 1.3 Extended Video ID Parsing for `/live/` and `youtu.be/`
* **File:** `content/content.js`
* **Problem:** `extractVideoIdFromUrl(url)` ignores `https://www.youtube.com/live/<id>` (used on channel stream tabs) and `https://youtu.be/<id>`.
* **Implementation:**
  1. Add patterns for live streams and short URLs:
     ```javascript
     function extractVideoIdFromUrl(url) {
       if (!url || typeof url !== 'string') return null;

       const vParam = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
       if (vParam) return vParam[1];

       const liveParam = url.match(/\/live\/([a-zA-Z0-9_-]{11})/);
       if (liveParam) return liveParam[1];

       const shortsParam = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
       if (shortsParam) return shortsParam[1];

       const embedParam = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
       if (embedParam) return embedParam[1];

       const youtuBeParam = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
       if (youtuBeParam) return youtuBeParam[1];

       const cdnMatch = url.match(/\/(?:vi|vi_webp)\/([a-zA-Z0-9_-]{11})\//);
       if (cdnMatch) return cdnMatch[1];

       return null;
     }
     ```
  2. Add unit tests for these URL formats in `tests/parser.test.js`.

### 1.4 Dynamic Version Binding in Popup UI
* **Files:** `popup/popup.html`, `popup/popup.js`
* **Problem:** `popup.html` hardcodes `<span class="brand-version">v1.0.4</span>`, desynchronized with `manifest.json` (`1.0.6`).
* **Implementation:**
  1. Change `popup.html`:
     ```html
     <span class="brand-version" id="brand-version">v1.0.0</span>
     ```
  2. In `popup.js`, query `manifest.json` dynamically:
     ```javascript
     const manifest = chrome.runtime.getManifest();
     const versionEl = document.getElementById('brand-version');
     if (versionEl && manifest?.version) {
       versionEl.textContent = `v${manifest.version}`;
     }
     ```

### 1.5 Keyboard Accessibility (:focus-visible)
* **File:** `popup/popup.css`
* **Problem:** Checkbox inputs are visually hidden with `opacity: 0` without focus styling. Keyboard Tab navigation lacks visible focus indicators.
* **Implementation:**
  1. Add focus-visible indicators in `popup.css`:
     ```css
     .switch-control input:focus-visible + .switch-track {
       outline: 2px solid var(--accent);
       outline-offset: 2px;
       box-shadow: 0 0 8px var(--accent-glow);
     }
     ```

### 1.6 Dead Code Elimination
* **File:** `content/content.js`
* **Implementation:**
  1. Remove unused declaration `const ORIGIN = 'https://i.ytimg.com';` at line 61.

### Phase 1 Verification Checklist:
- [ ] Run `npm test` — all existing + new URL parser tests pass.
- [ ] Run `npm run lint` — syntax check passes cleanly.
- [ ] Inspect YouTube home page and channel streams tab (`/streams`) — verify thumbnails swap correctly.
- [ ] Check profile avatars and comments — verify no opacity glitches.
- [ ] Open popup and verify version string matches `manifest.json`.
- [ ] Press `Tab` in popup to ensure emerald focus outline is visible on switches.

---

## Phase 2: Performance, Observer & Virtualizer Hardening

### 2.1 Eliminate Self-Triggering Rescan Cascades in `content/content.js`
* **File:** `content/content.js`
* **Problem:** In `observer` (lines 240–280), `m.addedNodes.length > 0` causes `shouldScan = true`. When DeBait appends its own badges or flip buttons, `addedNodes` fires on `ytd-thumbnail`, scheduling another scan pass and querying the entire DOM.
* **Implementation:**
  1. Create a helper to check if added nodes are exclusively DeBait elements:
     ```javascript
     function isDeBaitNode(node) {
       if (!node || node.nodeType !== 1) return false;
       return (
         node.classList?.contains('debait-thumbnail-badge') ||
         node.classList?.contains('debait-flip-btn') ||
         node.classList?.contains('debait-navbar-toggle') ||
         node.id === 'debait-navbar-toggle-container'
       );
     }
     ```
  2. In the mutation loop, ignore added nodes that are internal to DeBait:
     ```javascript
     for (let i = 0; i < mutations.length; i++) {
       const m = mutations[i];
       if (m.type === 'childList') {
         let externalNodesAdded = false;
         for (let j = 0; j < m.addedNodes.length; j++) {
           const node = m.addedNodes[j];
           if (!isDeBaitNode(node)) {
             externalNodesAdded = true;
             break;
           }
         }
         if (externalNodesAdded) {
           shouldScan = true;
         }
       }
     }
     ```

### 2.2 Scoped Mutation Subtree Scanning
* **File:** `content/content.js`
* **Problem:** `scanImmediate()` runs `document.querySelectorAll(...)` globally. On long YouTube sessions with hundreds of videos loaded into memory, this causes layout recalculations and dropped frames during fast scrolling.
* **Implementation:**
  1. Refactor `scanImmediate(root = document)` so it can accept an element or root.
  2. When mutations contain added container elements (e.g., `ytd-rich-item-renderer`, `ytd-video-renderer`), collect added root elements in a `Set` during the mutation loop and scan those subtrees directly. Fall back to a global scan only on full navigation (`yt-navigate-finish`).

### 2.3 Fix Virtual Scroll Recycler Event Listeners
* **File:** `content/content.js`
* **Problem:** In `setupIndividualFlipButton`, if `container.querySelector('.debait-flip-btn')` exists, the function does nothing. But YouTube recycles DOM containers as users scroll. When a container is recycled for video B, clicking the button still refers to the closure of video A.
* **Implementation:**
  1. Avoid closure binding. Instead, use container dataset attributes or an event delegation handler on thumbnail containers:
     ```javascript
     function setupIndividualFlipButton(container, img, videoId) {
       if (!settings.showIndividualToggle) {
         const existingBtn = container.querySelector('.debait-flip-btn');
         if (existingBtn) existingBtn.style.display = 'none';
         return;
       }

       let btn = container.querySelector('.debait-flip-btn');
       if (!btn) {
         btn = document.createElement('button');
         btn.className = 'debait-flip-btn';
         btn.type = 'button';
         btn.innerHTML = `
           <svg viewBox="0 0 24 24" width="14" height="14">
             <path fill="currentColor" d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
           </svg>
         `;

         btn.addEventListener('click', (e) => {
           e.preventDefault();
           e.stopPropagation();

           const targetContainer = btn.closest('ytd-thumbnail, #thumbnail, .ytp-videowall-still') || btn.parentElement;
           const targetImg = targetContainer?.querySelector('img');
           if (!targetContainer || !targetImg) return;

           const currentState = targetContainer.dataset.debaitState || 'halfway';
           const willBeHalfway = currentState !== 'halfway';
           targetContainer.dataset.debaitManualOverride = willBeHalfway ? 'true' : 'false';

           if (willBeHalfway) {
             processImg(targetImg);
           } else {
             restoreImg(targetImg, targetContainer);
           }
         });

         container.appendChild(btn);
       }

       btn.style.display = 'flex';
     }
     ```
  2. When `processImg` runs on a recycled container where `container.dataset.debaitVideoId !== id`, reset `delete container.dataset.debaitManualOverride;` so previous manual flips do not contaminate the new video.

### 2.4 Controlled `srcset` Synchronization
* **File:** `content/content.js`
* **Problem:** If YouTube injects `srcset` after `processImg` has already executed, the browser prioritizes `srcset` over `src`, reverting to the clickbait thumbnail without DeBait noticing.
* **Implementation:**
  1. Add `srcset` back to `attributeFilter` in `observer.observe`:
     `attributeFilter: ['src', 'srcset', 'style']`
  2. In `observer`, if `m.attributeName === 'srcset'` on an image with `img.dataset.debaitActive === 'true'`:
     If `img.getAttribute('srcset')` was re-added by YouTube, strip it again and store it in `dataset.debaitSrcset` without re-triggering a full swap pass.

### 2.5 YouTube Shorts Mode Toggle (Optional Configuration)
* **Files:** `manifest.json`, `background.js`, `content/content.js`, `popup/popup.html`, `popup/popup.js`
* **Problem:** Shorts thumbnails are 9:16 vertical cards. Imposing 16:9 `hq720_2.jpg` frames with `object-fit: cover` zooms into the center, cropping 70% of the image.
* **Implementation:**
  1. Add setting `replaceShorts: false` (or `true`) to `DEFAULT_SETTINGS`.
  2. Add a toggle in `popup/popup.html`:
     ```html
     <div class="option-row">
       <div class="option-meta">
         <span class="option-title">Replace YouTube Shorts</span>
         <span class="option-desc">Apply midpoint frames to vertical Shorts</span>
       </div>
       <label class="switch-control">
         <input type="checkbox" id="setting-shorts">
         <span class="switch-track"><span class="switch-thumb"></span></span>
       </label>
     </div>
     ```
  3. In `content.js`, if `container.closest('ytd-reel-item-renderer, ytd-rich-shelf-renderer[is-shorts]')` and `!settings.replaceShorts`, bypass replacement for Shorts cards.

### Phase 2 Verification Checklist:
- [ ] Scroll YouTube feed continuously for 30 seconds while monitoring Chrome DevTools Performance panel — verify no recurring micro-tasks or frame drops.
- [ ] Flip 3 individual thumbnails using the hover button, then scroll down and back up — verify flip state does not randomly jump to other recycled video cards.
- [ ] Inspect YouTube Shorts feed or shelf with Shorts toggle ON/OFF — verify correct behavior and aspect ratio preservation.

---

## Phase 3: Testing, Tooling & Build Pipeline Modernization

### 3.1 DOM & Content Script Unit Test Suite
* **Files:** `package.json`, `tests/content.test.js`
* **Problem:** Existing tests only test pure string functions. No tests verify DOM replacement, fallback chains, or state restoration.
* **Implementation:**
  1. Add a test script in `tests/content.test.js` using Node.js's built-in `node:test` and a mock DOM environment:
     - Mock minimal DOM elements (`document.createElement`, `img`, `container`, `dataset`).
     - Test `processImg` updates `src`, `dataset.debait`, and Polymer wrapper attributes.
     - Test `restoreImg` restores `dataset.debaitOrig` and removes midpoint attributes.
     - Test `revertAll` correctly rolls back all modified elements on the page.
  2. Include `tests/content.test.js` in `npm test`.

### 3.2 Service Worker & Command Unit Tests
* **File:** `tests/background.test.js`
* **Implementation:**
  1. Mock `chrome.storage.sync`, `chrome.action`, and `chrome.commands`.
  2. Test that `onInstalled` initializes default settings.
  3. Test that `toggle-thumbnails` toggles `enabled` in storage and updates action badge.

### 3.3 Zero-Dependency Cross-Platform Packaging Script
* **Files:** `scripts/package.js`, `package.json`
* **Problem:** `npm run package` uses Windows-specific PowerShell `Compress-Archive` and hardcodes `debait-v1.0.0.zip`, including unnecessary developer markdown files.
* **Implementation:**
  1. Create `scripts/package.js` using Node.js native streams and `archiver` or standard Node.js `zlib`:
     ```javascript
     const fs = require('fs');
     const path = require('path');
     const cp = require('child_process');

     const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
     const version = manifest.version;
     const distDir = path.join(__dirname, '..', 'dist');
     if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

     const zipName = `debait-v${version}.zip`;
     const zipPath = path.join(distDir, zipName);

     // Manifest files to include strictly
     const includePaths = [
       'manifest.json',
       'background.js',
       'content',
       'popup',
       'icons',
       'LICENSE'
     ];

     // Use cross-platform zip command or lightweight native zip
     // ...
     ```
  2. Update `package.json`:
     ```json
     "scripts": {
       "test": "node --test tests/*.test.js",
       "lint": "node -c background.js content/content.js popup/popup.js",
       "package": "node scripts/package.js"
     }
     ```

### 3.4 Git Repository Cleanup
* **Problem:** `debait-v1.0.0.zip` (21KB) was committed into git history.
* **Implementation:**
  1. Remove binary from git index:
     ```bash
     git rm --cached debait-v1.0.0.zip
     ```
  2. Ensure `.gitignore` ignores `dist/` and `*.zip`.

### Phase 3 Verification Checklist:
- [ ] Run `npm test` — all parser, DOM, and service worker tests pass.
- [ ] Run `npm run package` on both Windows and macOS/Linux — creates clean `dist/debait-v1.1.0.zip` without errors.
- [ ] Unzip package and verify absence of `README.md`, `CHROMEWEBSTORE.md`, `.git`, and `tests/`.

---

## Phase 4: Store Readiness, Polish & Documentation

### 4.1 Update `CHROMEWEBSTORE.md`
* **File:** `CHROMEWEBSTORE.md`
* **Implementation:**
  1. Update Version History with changelogs for `v1.0.5`, `v1.0.6`, and `v1.1.0`.
  2. Add plain-English justification for all permissions:
     - `storage`: Preserves settings across browser tabs and devices.
     - `*://*.youtube.com/*`: Replaces thumbnail DOM elements with midpoint frames.
     - Either remove `*://*.youtube-nocookie.com/*` from `manifest.json` if embedded iframes are skipped, or add justification if supported.
  3. Update store listing features to mention `/live/` support, hover flip controls, and performance optimizations.

### 4.2 Reconcile `README.md`
* **File:** `README.md`
* **Implementation:**
  1. Remove the reference to `Declarative Net Request` in the Tech Stack table (line 77) and accurately describe the DOM keyframe interception engine.
  2. Update version references, badges, and project structure tree to reflect `scripts/package.js` and `dist/`.

### 4.3 Manifest & Version Synchronization
* **Files:** `manifest.json`, `package.json`
* **Implementation:**
  1. Ensure both versions match `1.1.0`.
  2. Clean up host permissions if `youtube-nocookie.com` is unused.

### Phase 4 Verification Checklist:
- [ ] Run `git status` — all files tracked cleanly, no stale binaries.
- [ ] Run `npm test && npm run lint` — all suites green.
- [ ] Verify `CHROMEWEBSTORE.md` and `README.md` contain zero contradictory statements.

---

## 🚀 Execution Order Reference Table

| Step | Phase | Task Description | Target Files | Estimated Impact |
| :---: | :---: | :--- | :--- | :--- |
| **1** | Phase 1 | Scope CSS thumbnail overrides | `content/content.css` | High (fixes visual glitches across YouTube) |
| **2** | Phase 1 | Fallback exhaustion to genuine original | `content/content.js` | High (eliminates broken image icons) |
| **3** | Phase 1 | Expand URL parser (`/live/`, `youtu.be/`) | `content/content.js`, `tests/parser.test.js` | Medium (fixes missing live thumbnails) |
| **4** | Phase 1 | Dynamic popup version & `:focus-visible` | `popup/popup.html`, `popup/popup.js`, `popup/popup.css` | Medium (a11y + consistency) |
| **5** | Phase 1 | Remove dead code `ORIGIN` | `content/content.js` | Low (cleanliness) |
| **6** | Phase 2 | Prevent observer self-rescan cascades | `content/content.js` | High (eliminates redundant full-DOM scans) |
| **7** | Phase 2 | Fix virtualizer closure in flip button | `content/content.js` | High (fixes button binding on scroll) |
| **8** | Phase 2 | Intercept dynamic `srcset` mutations | `content/content.js` | Medium (prevents clickbait sneaking back) |
| **9** | Phase 2 | YouTube Shorts toggle setting | `manifest.json`, `content/content.js`, `popup/*` | Medium (prevents awkward 16:9 vertical crop) |
| **10** | Phase 3 | DOM & Service Worker unit tests | `tests/content.test.js`, `tests/background.test.js` | High (guards against regressions) |
| **11** | Phase 3 | Cross-platform Node.js package script | `scripts/package.js`, `package.json` | Medium (clean store zip generation) |
| **12** | Phase 3 | Remove tracked binary `debait-v1.0.0.zip` | `.gitignore`, git index | Low (repo hygiene) |
| **13** | Phase 4 | Update `CHROMEWEBSTORE.md` & `README.md` | `CHROMEWEBSTORE.md`, `README.md` | Medium (approval readiness) |
| **14** | Phase 4 | Final version bump & package build | `manifest.json`, `package.json` | Final (ready for release) |
