# Chrome Web Store Listing: DeBait for YouTube™

> Last Updated: 2026-11-05

## Store Listing

**Extension Name**
DeBait: Honest YouTube Thumbnails

**Short Description**
DeBait replaces clickbait YouTube thumbnails with real frames from halfway through the video. Toggle between them anytime with 1 click.

**Detailed Description**
See what is actually in the video before you click.

DeBait automatically replaces misleading, exaggerated, or clickbait thumbnails on YouTube with honest, unaltered frames captured directly from halfway (50%) through the video.

Key Features:
- Automatic Replacement: Every video thumbnail across your home feed, search results, subscriptions, and recommendations automatically displays a genuine frame from the video midpoint.
- Instant 1-Click Toggle: Convenient toggle switch integrated right into YouTube's top navigation bar lets you flip between halfway frames and creator thumbnails instantly without reloading.
- Per-Thumbnail Flip: Curious about what the creator chose for their custom thumbnail? Hover over any individual video to reveal a flip button and toggle just that video.
- YouTube Shorts Support: Midpoint replacement for YouTube Shorts feeds with an optional independent toggle in settings.
- YouTube Live Stream Support: Full recognition for active live streams and premiere feeds (`/live/`).
- Honest Frame Badge: A clean, subtle indicator in the corner confirms when an honest halfway frame is being displayed.
- Keyboard Shortcut: Press Alt + H anytime on YouTube to toggle all thumbnails in a split second.
- High Resolution: Displays crisp 1280x720 HD stills whenever available, with automatic smooth fallback.

How to Use:
1. Install the extension and open YouTube.
2. Thumbnails will automatically display genuine midpoint frames.
3. Click the "DeBait" toggle in YouTube's top bar or press Alt+H to switch back to creator thumbnails whenever you want.
4. Click the extension icon in your browser toolbar to customize badges, quality, toggle visibility, and Shorts replacement.

Privacy First:
DeBait runs entirely locally within your browser. It does not track your browsing history, does not collect personal data, and makes zero connections to third-party tracking servers.

**Category**
Productivity

**Single Purpose**
Replaces YouTube video thumbnails with auto-generated halfway frames and provides instant toggles between the two.

**Primary Language**
English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Store Icon | 128x128 PNG | Ready | `icons/icon-128.png` |
| Small Icon | 48x48 PNG | Ready | `icons/icon-48.png` |
| Toolbar Icon | 16x16 PNG | Ready | `icons/icon-16.png` |
| Screenshot 1 | 1280x800 | Pending capture | Store screenshots |
| Promo Tile | 440x280 | Optional | Promo graphic |

---

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| `storage` | permissions | Saves user preferences (such as enabling/disabling halfway thumbnails, badge visibility, Shorts handling, and preferred image resolution) and synchronizes them across browser sessions. |
| `*://*.youtube.com/*` | host_permissions | Required to detect video elements on YouTube pages and swap thumbnail image elements with their corresponding midpoint frame. |

---

## Privacy & Data Use

### Data Collection
- **Personal Data**: None. No names, email addresses, or identifiers are collected.
- **Web History**: None. The extension does not log or transmit visited URLs.
- **User Activity**: None. Extension interactions (such as toggling) are saved strictly to local browser storage (`chrome.storage.sync`).
- **External Servers**: None. All image assets are loaded directly from YouTube's official content delivery network (`i.ytimg.com`).

### Privacy Policy
DeBait does not collect, transmit, store, or sell any personal or browsing information. All preferences and states remain on the user's local device.

---

## Version History

- **v1.1.1** (2026-11-05): Performance patch. Eliminated runaway mutation recursion during toggle off and initial streaming query storms. Made thumbnail restoration strictly idempotent.
- **v1.1.0** (2026-11-05): Production hardening release. Strictly scoped CSS opacity overrides to thumbnail wrappers. Graceful fallback exhaustion restoring creator original thumbnails. Support for `/live/` and `youtu.be/` links. MutationObserver cascade loop elimination and subtree scanning. Virtualized scroller event delegation preventing stale DOM references. Optional YouTube Shorts mode toggle. Comprehensive Node.js unit test harness and zero-dependency packaging pipeline.
- **v1.0.6** (2026-11-04): Resolved blank thumbnail loading caused by mutation loop and Polymer opacity overrides.
- **v1.0.5** (2026-11-04): Guard against extension context invalidation, disable redundant iframe injection, and watch dynamic srcset mutations.
- **v1.0.4** (2026-11-03): Performance overhaul: eliminated async network probe latency for instant (0ms) synchronous thumbnail swapping, debounced DOM scanning with requestAnimationFrame, and decoupled storage persistence.
- **v1.0.3** (2026-11-03): Re-architected with direct probe and DOM interception engine. Completely eliminated `declarativeNetRequest` to avoid all Chromium RE2 regex memory limit restrictions while maintaining instant, reliable midpoint swaps.
- **v1.0.2** (2026-11-03): DNR optimization attempt.
- **v1.0.1** (2026-11-03): Stageshow dark-hero UI revamp.
- **v1.0.0** (2026-11-03): Initial release.
